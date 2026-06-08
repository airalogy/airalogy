"""Tests for the AiralogyEngine API using example_protocol.

These are integration tests that run protocol code inside a BoxLite sandbox.
Use ``--sandbox-mode=rootfs`` (default) to test with a local OCI rootfs, or
``--sandbox-mode=image`` to test with a remote Docker image.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from airalogy_engine import AiralogyEngine

_MONOREPO_ROOT = Path(__file__).resolve().parents[4]
_EXAMPLE_PROTOCOL = str(_MONOREPO_ROOT / "examples/airalogy-engine")
_VALID_ENDPOINT = "https://api.example.test"
_VALID_VARIABLES = {
    "seconds": "60",
    "duration": "PT1M",
    "user_name": "alice",
    "current_time": "2025-01-01T00:00:00",
    "endpoint": _VALID_ENDPOINT,
}
_ASSIGN_DEBUG_LINES = (
    "This is debug log",
    "Converting 60 seconds to duration: 0:01:00",
)


def _state_is_running(state) -> bool:
    return state is not None and getattr(state, "running", False) is True


# ---------------------------------------------------------------------------
# parse_protocol
# ---------------------------------------------------------------------------


class TestParseProtocol:
    """Tests for ``AiralogyEngine.parse_protocol``."""

    @pytest.mark.asyncio
    async def test_parse_success(self, engine):
        """parse_protocol returns the expected schema, metadata, and fields."""
        result = await engine.parse_protocol()

        assert result["success"] is True
        data = result["data"]

        assert data["meta_data"]["id"] == "alice_s_protocol"
        assert data["meta_data"]["name"] == "Alice's Protocol"
        assert data["meta_data"]["version"] == "0.0.1"

        var_names = {v["name"] for v in data["fields"]["var"]}
        assert "seconds" in var_names
        assert "duration" in var_names
        assert "user_name" in var_names
        assert "current_time" in var_names
        assert "endpoint" in var_names

        assert "vars" in data["json_schema"]
        schema_props = data["json_schema"]["vars"].get("properties", {})
        assert "seconds" in schema_props
        assert "duration" in schema_props
        assert "endpoint" in schema_props

        assert "duration" in data["assigners"]
        assert "endpoint" in data["assigners"]
        assert "seconds" in data["assigners"]["duration"]["dependent_fields"]
        assert "seconds" in data["assigners"]["endpoint"]["dependent_fields"]

        assert isinstance(data["assigner_graph"], dict)
        assert len(data["assigner_graph"]) > 0

        assert "{{var|seconds}}" in data["aimd"]
        assert "{{var|duration}}" in data["aimd"]
        assert "{{var|endpoint}}" in data["aimd"]

    def test_constructor_invalid_path(self):
        """AiralogyEngine raises ValueError for a non-existent directory."""
        with pytest.raises(ValueError, match="must be a directory"):
            AiralogyEngine("/tmp/nonexistent_protocol_dir_12345")

    def test_constructor_missing_aimd(self, tmp_path):
        """AiralogyEngine raises ValueError when protocol.aimd is missing."""
        empty_dir = tmp_path / "empty_protocol"
        empty_dir.mkdir()
        with pytest.raises(ValueError, match="protocol.aimd not found"):
            AiralogyEngine(str(empty_dir))


# ---------------------------------------------------------------------------
# assign_variable
# ---------------------------------------------------------------------------


class TestAssignVariable:
    """Tests for ``AiralogyEngine.assign_variable``."""

    @pytest.mark.asyncio
    async def test_assign_endpoint_from_env_vars(self, engine):
        """assign_variable returns env-driven values from the assigner."""
        result = await engine.assign_variable(
            var_name="endpoint",
            dependent_data={"seconds": 60},
            env_vars={"ENDPOINT": _VALID_ENDPOINT},
        )

        assert result["success"] is True
        assigned_fields = result["data"]["assigned_fields"]
        assert assigned_fields["duration"] == "PT1M"
        assert assigned_fields["endpoint"] == _VALID_ENDPOINT

    @pytest.mark.asyncio
    async def test_assign_variable_ignores_unrelated_empty_fields(self, engine):
        """assign_variable validates only the selected assigner's declared dependencies."""
        result = await engine.assign_variable(
            var_name="endpoint",
            dependent_data={
                "seconds": 60,
                "duration": "",
                "endpoint": "",
            },
            env_vars={"ENDPOINT": _VALID_ENDPOINT},
        )

        assert result["success"] is True
        assigned_fields = result["data"]["assigned_fields"]
        assert assigned_fields["duration"] == "PT1M"
        assert assigned_fields["endpoint"] == _VALID_ENDPOINT

    @pytest.mark.asyncio
    async def test_timeout_returns_promptly_when_assigner_sleeps(
        self,
        sandbox_kwargs,
    ):
        """assign_variable times out promptly when PROTOCOL_SLEEP_TIME exceeds timeout."""
        home = tempfile.mkdtemp(prefix="aebl-timeout-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            warmup = await engine.parse_protocol()
            assert warmup["success"] is True

            started = asyncio.get_running_loop().time()
            result = await engine.assign_variable(
                var_name="duration",
                dependent_data={"seconds": 60},
                env_vars={"PROTOCOL_SLEEP_TIME": "2"},
                timeout=1,
            )
            elapsed = asyncio.get_running_loop().time() - started

            assert result == {
                "success": False,
                "message": "Execution timed out after 1 seconds",
                "output": "",
            }
            assert elapsed < 6.0
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_assign_variable_succeeds_when_timeout_exceeds_protocol_sleep(
        self,
        engine,
    ):
        """assign_variable still succeeds when timeout exceeds PROTOCOL_SLEEP_TIME."""
        result = await engine.assign_variable(
            var_name="duration",
            dependent_data={"seconds": 60},
            env_vars={"PROTOCOL_SLEEP_TIME": "2"},
            timeout=5,
        )

        assert result["success"] is True
        assert result["data"]["assigned_fields"]["duration"] == "PT1M"

    @pytest.mark.asyncio
    async def test_timeout_debug_copies_log(
        self,
        sandbox_kwargs,
        tmp_path,
    ):
        """debug=True still copies the partial log after killing a timed-out guest."""
        log_file = tmp_path / "slow_timeout.log"
        home = tempfile.mkdtemp(prefix="aebl-timeout-debug-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            warmup = await engine.parse_protocol()
            assert warmup["success"] is True

            started = asyncio.get_running_loop().time()
            result = await engine.assign_variable(
                var_name="duration",
                dependent_data={"seconds": 60},
                env_vars={"PROTOCOL_SLEEP_TIME": "2"},
                timeout=1,
                debug=True,
                log_file=str(log_file),
            )
            elapsed = asyncio.get_running_loop().time() - started

            assert result == {
                "success": False,
                "message": "Execution timed out after 1 seconds",
                "output": "",
            }
            assert elapsed < 6.0
            assert log_file.is_file()
            log_content = log_file.read_text(encoding="utf-8")
            assert "action: assign_variable" in log_content
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)


# ---------------------------------------------------------------------------
# validate_variables
# ---------------------------------------------------------------------------


class TestValidateVariables:
    """Tests for ``AiralogyEngine.validate_variables``."""

    @pytest.mark.asyncio
    async def test_validate_valid_vars(self, engine):
        """validate_variables accepts correct variable values."""
        result = await engine.validate_variables(
            variables=_VALID_VARIABLES,
        )

        assert result["success"] is True
        data = result["data"]
        assert "data" in data
        assert "errors" not in data

    @pytest.mark.asyncio
    async def test_validate_invalid_and_missing(self, engine):
        """validate_variables reports errors for invalid types and missing fields."""
        result = await engine.validate_variables(
            variables={
                "seconds": "not_a_number",
                "duration": "PT1M",
                "user_name": "alice",
                "current_time": "2025-01-01T00:00:00",
            },
        )

        assert result["success"] is True
        error_locations = {tuple(error["loc"]) for error in result["data"]["errors"]}
        assert ("seconds",) in error_locations
        assert ("endpoint",) in error_locations

    @pytest.mark.asyncio
    async def test_validate_invalid_duration_format(self, engine):
        """validate_variables rejects an invalid duration format."""
        result = await engine.validate_variables(
            variables={**_VALID_VARIABLES, "duration": "invalid_duration"},
        )

        assert result["success"] is True
        data = result["data"]
        assert "errors" in data
        assert any(tuple(error["loc"]) == ("duration",) for error in data["errors"])


# ---------------------------------------------------------------------------
# import_records
# ---------------------------------------------------------------------------


class TestImportRecords:
    """Tests for ``AiralogyEngine.import_records``."""

    @pytest.mark.asyncio
    async def test_import_records_from_protocol_local_json(
        self,
        sandbox_kwargs,
        tmp_path,
    ):
        """import_records imports a JSON input file from inside the protocol."""
        protocol_dir = tmp_path / "protocol"
        protocol_dir.mkdir()
        protocol_dir.joinpath("protocol.aimd").write_text(
            """## Minimal protocol

Seconds: {{var|seconds:int}}
Endpoint: {{var|endpoint}}
""",
            encoding="utf-8",
        )
        protocol_dir.joinpath("protocol.toml").write_text(
            """[airalogy_protocol]
id = "records_protocol"
version = "1.0.0"
name = "Records Protocol"
""",
            encoding="utf-8",
        )
        input_file = protocol_dir / "records.json"
        input_file.write_text(
            """[
  {"seconds": 60, "endpoint": "https://api.example.test"}
]""",
            encoding="utf-8",
        )
        home = tempfile.mkdtemp(prefix="aebl-import-records-", dir="/tmp")
        engine = AiralogyEngine(
            str(protocol_dir),
            boxlite_home=home,
            **sandbox_kwargs,
        )

        try:
            result = await engine.import_records("records.json")
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)

        assert result["success"] is True
        data = result["data"]
        assert data["errors"] == []
        assert len(data["records"]) == 1

        record = data["records"][0]
        assert record["data"]["var"]["seconds"] == 60
        assert record["data"]["var"]["endpoint"] == _VALID_ENDPOINT
        assert record["metadata"]["protocol_id"] == "records_protocol"

    @pytest.mark.asyncio
    async def test_import_records_rejects_parent_path(self, engine):
        """import_records does not allow input_filename to escape the protocol."""
        result = await engine.import_records("../records.json")

        assert result["success"] is False
        assert (
            "input_filename must point inside the protocol package" in result["message"]
        )


# ---------------------------------------------------------------------------
# debug / log_file
# ---------------------------------------------------------------------------


class TestDebugMode:
    """Tests for debug and log_file parameters."""

    @pytest.mark.asyncio
    async def test_debug_creates_and_appends_log(self, engine, tmp_path):
        """debug=True creates a log file; subsequent calls append to it."""
        log_file = str(tmp_path / "debug.log")

        # First call creates the log
        result = await engine.parse_protocol(
            debug=True,
            log_file=log_file,
        )
        assert result["success"] is True
        assert os.path.isfile(log_file)
        first_content = Path(log_file).read_text(encoding="utf-8")
        assert "action: parse_protocol" in first_content
        first_size = os.path.getsize(log_file)
        assert first_size > 0

        # Second call appends
        await engine.parse_protocol(
            debug=True,
            log_file=log_file,
        )
        assert os.path.getsize(log_file) > first_size

    @pytest.mark.asyncio
    async def test_assign_and_validate_debug(self, engine, tmp_path):
        """assign_variable and validate_variables create log files with debug=True."""
        assign_log = str(tmp_path / "assign_debug.log")
        result = await engine.assign_variable(
            var_name="duration",
            dependent_data={"seconds": 60},
            debug=True,
            log_file=assign_log,
        )
        assert result["success"] is True
        assert os.path.isfile(assign_log)
        assign_content = Path(assign_log).read_text(encoding="utf-8")
        assert "action: assign_variable" in assign_content
        for line in _ASSIGN_DEBUG_LINES:
            assert line in assign_content

        validate_log = str(tmp_path / "validate_debug.log")
        result = await engine.validate_variables(
            variables=_VALID_VARIABLES,
            debug=True,
            log_file=validate_log,
        )
        assert result["success"] is True
        assert os.path.isfile(validate_log)
        validate_content = Path(validate_log).read_text(encoding="utf-8")
        assert "action: validate_variables" in validate_content
        assert "output:" in validate_content

    @pytest.mark.asyncio
    async def test_debug_false_no_log(self, engine, tmp_path):
        """debug=False (default) does not create a log file."""
        log_file = str(tmp_path / "should_not_exist.log")
        result = await engine.parse_protocol(
            debug=False,
            log_file=log_file,
        )
        assert result["success"] is True
        assert not os.path.isfile(log_file)


# ---------------------------------------------------------------------------
# box lifecycle
# ---------------------------------------------------------------------------


class TestBoxLifecycle:
    """Tests for AiralogyEngine-managed BoxLite box lifecycle."""

    @pytest.mark.asyncio
    async def test_auto_stop_true_clears_box_after_command(
        self,
        sandbox_kwargs,
    ):
        home = tempfile.mkdtemp(prefix="aebl-lifecycle-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            **sandbox_kwargs,
        )

        try:
            result = await engine.parse_protocol()
            assert result["success"] is True
            assert engine.box_status() is None
            assert engine._box is None
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_auto_stop_false_reuses_running_box(
        self,
        sandbox_kwargs,
    ):
        home = tempfile.mkdtemp(prefix="aebl-reuse-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            first = await engine.parse_protocol()
            first_box = engine._box
            assert first["success"] is True
            assert first_box is not None
            assert _state_is_running(engine.box_status())

            second = await engine.validate_variables(variables=_VALID_VARIABLES)
            assert second["success"] is True
            assert engine._box is first_box
            assert _state_is_running(engine.box_status())
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_stop_stops_box_and_later_command_creates_new_box(
        self,
        sandbox_kwargs,
    ):
        home = tempfile.mkdtemp(prefix="aebl-stop-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            first = await engine.parse_protocol()
            assert first["success"] is True
            assert engine._box is not None
            first_box_id = engine._box.id

            await engine.stop()
            assert engine.box_status() is None
            assert engine._box is None

            second = await engine.parse_protocol()
            assert second["success"] is True
            assert engine._box is not None
            assert engine._box.id != first_box_id
            assert _state_is_running(engine.box_status())
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_timeout_does_not_stop_persistent_box(
        self,
        sandbox_kwargs,
    ):
        home = tempfile.mkdtemp(prefix="aebl-persistent-timeout-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            warmup = await engine.parse_protocol()
            assert warmup["success"] is True

            started = asyncio.get_running_loop().time()
            result = await engine.assign_variable(
                var_name="duration",
                dependent_data={"seconds": 60},
                env_vars={"PROTOCOL_SLEEP_TIME": "2"},
                timeout=1,
            )
            elapsed = asyncio.get_running_loop().time() - started

            assert result == {
                "success": False,
                "message": "Execution timed out after 1 seconds",
                "output": "",
            }
            assert elapsed < 6.0
            assert _state_is_running(engine.box_status())

            recovery = await engine.assign_variable(
                var_name="duration",
                dependent_data={"seconds": 60},
                timeout=5,
            )
            assert recovery["success"] is True
            assert recovery["data"]["assigned_fields"]["duration"] == "PT1M"
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)


# ---------------------------------------------------------------------------
# sandbox execution helper
# ---------------------------------------------------------------------------


class TestSandboxExecutionHelper:
    """Tests for low-level sandbox command execution behavior."""

    @pytest.mark.asyncio
    async def test_exec_command_with_timeout_passes_env_pairs(
        self,
        sandbox_kwargs,
    ):
        """_exec_command_with_timeout passes sequence env pairs into box.exec."""
        import airalogy_engine.engine as engine_module

        home = tempfile.mkdtemp(prefix="aebl-env-", dir="/tmp")
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home,
            auto_stop=False,
            **sandbox_kwargs,
        )

        try:
            box = await engine._ensure_running_box()
            (
                exec_result,
                stdout,
                stderr,
                timed_out,
            ) = await engine_module._exec_command_with_timeout(
                box,
                [
                    "python",
                    "-c",
                    "import os; print(os.environ.get('AIRALOGY_ENV_TEST', ''))",
                ],
                10,
                env=[("AIRALOGY_ENV_TEST", "env-value")],
            )

            assert timed_out is False
            assert exec_result is not None
            assert exec_result.exit_code == 0
            assert stdout.strip() == "env-value"
            assert stderr.strip() == ""
        finally:
            await engine.close()
            shutil.rmtree(home, ignore_errors=True)


# ---------------------------------------------------------------------------
# concurrency / runtime homes
# ---------------------------------------------------------------------------


class TestConcurrency:
    """Tests for async concurrency and runtime ownership."""

    @pytest.mark.asyncio
    async def test_async_concurrent_parse_protocol(self, engine):
        """One engine supports concurrent parse_protocol calls in one event loop."""
        results = await asyncio.gather(
            engine.parse_protocol(),
            engine.parse_protocol(),
        )

        assert all(result["success"] is True for result in results)

    @pytest.mark.asyncio
    async def test_async_commands_run_concurrently(self, monkeypatch):
        """Concurrent calls enter BoxLite execution at the same time."""
        import airalogy_engine.engine as engine_module

        class FakeState:
            running = True
            status = "Running"

        class FakeInfo:
            state = FakeState()

        class FakeBox:
            id = "fake-box"

            def __init__(self):
                self.stop_count = 0

            def info(self):
                return FakeInfo()

            async def stop(self):
                self.stop_count += 1

        class FakeExecResult:
            exit_code = 0

        fake_box = FakeBox()
        engine = AiralogyEngine(_EXAMPLE_PROTOCOL)
        engine._box = fake_box

        running = 0
        max_running = 0
        both_started = asyncio.Event()

        async def fake_ensure_running_box():
            return fake_box

        async def fake_exec_command_with_timeout(box, command, timeout, env=None):
            nonlocal running, max_running
            running += 1
            max_running = max(max_running, running)
            if running == 2:
                both_started.set()

            await asyncio.wait_for(both_started.wait(), timeout=1)
            await asyncio.sleep(0)
            running -= 1
            return FakeExecResult(), '{"success":true,"data":{}}', "", False

        monkeypatch.setattr(engine, "_ensure_running_box", fake_ensure_running_box)
        monkeypatch.setattr(
            engine_module,
            "_exec_command_with_timeout",
            fake_exec_command_with_timeout,
        )

        results = await asyncio.gather(
            engine.parse_protocol(),
            engine.parse_protocol(),
        )

        assert max_running == 2
        assert all(result["success"] is True for result in results)
        assert fake_box.stop_count == 1
        assert engine._box is None

    @pytest.mark.asyncio
    async def test_engines_with_different_homes_can_coexist(
        self,
        sandbox_kwargs,
    ):
        """Two engine instances can use separate BoxLite runtime homes."""
        home_a = tempfile.mkdtemp(prefix="aebl-a-", dir="/tmp")
        home_b = tempfile.mkdtemp(prefix="aebl-b-", dir="/tmp")
        engine_a = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home_a,
            **sandbox_kwargs,
        )
        engine_b = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=home_b,
            **sandbox_kwargs,
        )

        try:
            results = await asyncio.gather(
                engine_a.parse_protocol(),
                engine_b.parse_protocol(),
            )
        finally:
            await engine_a.close()
            await engine_b.close()
            shutil.rmtree(home_a, ignore_errors=True)
            shutil.rmtree(home_b, ignore_errors=True)

        assert all(result["success"] is True for result in results)

    def test_engine_owns_and_closes_runtime(
        self,
        monkeypatch,
        tmp_path,
    ):
        """One engine creates and closes its own BoxLite runtime."""
        import airalogy_engine.engine as engine_module

        class FakeBoxlite:
            instances = []

            def __init__(self, options):
                self.options = options
                self.closed = False
                self.instances.append(self)

            def close(self):
                self.closed = True

        monkeypatch.setattr(engine_module, "Boxlite", FakeBoxlite)
        engine = AiralogyEngine(
            _EXAMPLE_PROTOCOL,
            boxlite_home=str(tmp_path / "boxlite-home"),
        )

        runtime_a = engine._get_runtime()
        runtime_b = engine._get_runtime()
        assert runtime_a is runtime_b
        assert len(FakeBoxlite.instances) == 1

        asyncio.run(engine.close())
        assert runtime_a.closed is True
        assert engine._runtime is None
