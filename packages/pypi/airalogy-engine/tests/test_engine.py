"""Tests for the AiralogyEngine API using example_protocol.

These are integration tests that run protocol code inside a BoxLite sandbox.
Use ``--sandbox-mode=rootfs`` (default) to test with a local OCI rootfs, or
``--sandbox-mode=image`` to test with a remote Docker image.
"""

import asyncio
import os
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
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


# ---------------------------------------------------------------------------
# parse_protocol
# ---------------------------------------------------------------------------


class TestParseProtocol:
    """Tests for ``AiralogyEngine.parse_protocol``."""

    @pytest.mark.asyncio
    async def test_parse_success(self, engine):
        """parse_protocol returns the expected schema, metadata, and fields."""
        result = await engine.parse_protocol(_EXAMPLE_PROTOCOL)

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

    @pytest.mark.asyncio
    async def test_parse_invalid_path(self, engine):
        """parse_protocol raises ValueError for a non-existent directory."""
        with pytest.raises(ValueError, match="must be a directory"):
            await engine.parse_protocol("/tmp/nonexistent_protocol_dir_12345")

    @pytest.mark.asyncio
    async def test_parse_missing_aimd(self, engine, tmp_path):
        """parse_protocol raises ValueError when protocol.aimd is missing."""
        empty_dir = tmp_path / "empty_protocol"
        empty_dir.mkdir()
        with pytest.raises(ValueError, match="protocol.aimd not found"):
            await engine.parse_protocol(str(empty_dir))


# ---------------------------------------------------------------------------
# assign_variable
# ---------------------------------------------------------------------------


class TestAssignVariable:
    """Tests for ``AiralogyEngine.assign_variable``."""

    @pytest.mark.asyncio
    async def test_assign_endpoint_from_env_vars(self, engine):
        """assign_variable returns env-driven values from the assigner."""
        result = await engine.assign_variable(
            _EXAMPLE_PROTOCOL,
            var_name="endpoint",
            dependent_data={"seconds": 60},
            env_vars={"ENDPOINT": _VALID_ENDPOINT},
        )

        assert result["success"] is True
        assigned_fields = result["data"]["assigned_fields"]
        assert assigned_fields["duration"] == "PT1M"
        assert assigned_fields["endpoint"] == _VALID_ENDPOINT

    @pytest.mark.asyncio
    async def test_timeout_returns_promptly_when_assigner_sleeps(self, engine):
        """assign_variable times out promptly when PROTOCOL_SLEEP_TIME exceeds timeout."""
        started = asyncio.get_running_loop().time()
        result = await engine.assign_variable(
            _EXAMPLE_PROTOCOL,
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

    @pytest.mark.asyncio
    async def test_assign_variable_succeeds_when_timeout_exceeds_protocol_sleep(
        self,
        engine,
    ):
        """assign_variable still succeeds when timeout exceeds PROTOCOL_SLEEP_TIME."""
        result = await engine.assign_variable(
            _EXAMPLE_PROTOCOL,
            var_name="duration",
            dependent_data={"seconds": 60},
            env_vars={"PROTOCOL_SLEEP_TIME": "2"},
            timeout=5,
        )

        assert result["success"] is True
        assert result["data"]["assigned_fields"]["duration"] == "PT1M"

    @pytest.mark.asyncio
    async def test_timeout_debug_copies_log(self, engine, tmp_path):
        """debug=True still copies the partial log after killing a timed-out guest."""
        log_file = tmp_path / "slow_timeout.log"

        started = asyncio.get_running_loop().time()
        result = await engine.assign_variable(
            _EXAMPLE_PROTOCOL,
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


# ---------------------------------------------------------------------------
# validate_variables
# ---------------------------------------------------------------------------


class TestValidateVariables:
    """Tests for ``AiralogyEngine.validate_variables``."""

    @pytest.mark.asyncio
    async def test_validate_valid_vars(self, engine):
        """validate_variables accepts correct variable values."""
        result = await engine.validate_variables(
            _EXAMPLE_PROTOCOL,
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
            _EXAMPLE_PROTOCOL,
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
            _EXAMPLE_PROTOCOL,
            variables={**_VALID_VARIABLES, "duration": "invalid_duration"},
        )

        assert result["success"] is True
        data = result["data"]
        assert "errors" in data
        assert any(tuple(error["loc"]) == ("duration",) for error in data["errors"])


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
            _EXAMPLE_PROTOCOL,
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
            _EXAMPLE_PROTOCOL,
            debug=True,
            log_file=log_file,
        )
        assert os.path.getsize(log_file) > first_size

    @pytest.mark.asyncio
    async def test_assign_and_validate_debug(self, engine, tmp_path):
        """assign_variable and validate_variables create log files with debug=True."""
        assign_log = str(tmp_path / "assign_debug.log")
        result = await engine.assign_variable(
            _EXAMPLE_PROTOCOL,
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
            _EXAMPLE_PROTOCOL,
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
            _EXAMPLE_PROTOCOL,
            debug=False,
            log_file=log_file,
        )
        assert result["success"] is True
        assert not os.path.isfile(log_file)


# ---------------------------------------------------------------------------
# concurrency / runtime homes
# ---------------------------------------------------------------------------


class TestConcurrency:
    """Tests for runtime reuse under concurrent engine calls."""

    @pytest.mark.asyncio
    async def test_async_concurrent_parse_protocol(self, engine):
        """One engine supports concurrent parse_protocol calls in one event loop."""
        results = await asyncio.gather(
            engine.parse_protocol(_EXAMPLE_PROTOCOL),
            engine.parse_protocol(_EXAMPLE_PROTOCOL),
        )

        assert all(result["success"] is True for result in results)

    def test_threaded_concurrent_parse_protocol(self, engine):
        """One engine supports concurrent parse_protocol calls from threads."""

        def run_parse() -> dict:
            return asyncio.run(engine.parse_protocol(_EXAMPLE_PROTOCOL))

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(run_parse) for _ in range(2)]
            results = [future.result() for future in as_completed(futures)]

        assert len(results) == 2
        assert all(result["success"] is True for result in results)

    @pytest.mark.asyncio
    async def test_engines_with_different_homes_can_coexist(
        self,
        sandbox_kwargs,
    ):
        """Two engine instances can use separate BoxLite runtime homes."""
        home_a = tempfile.mkdtemp(prefix="aebl-a-", dir="/tmp")
        home_b = tempfile.mkdtemp(prefix="aebl-b-", dir="/tmp")
        engine_a = AiralogyEngine(
            boxlite_home=home_a,
            **sandbox_kwargs,
        )
        engine_b = AiralogyEngine(
            boxlite_home=home_b,
            **sandbox_kwargs,
        )

        try:
            results = await asyncio.gather(
                engine_a.parse_protocol(_EXAMPLE_PROTOCOL),
                engine_b.parse_protocol(_EXAMPLE_PROTOCOL),
            )
        finally:
            await engine_a.close()
            await engine_b.close()
            shutil.rmtree(home_a, ignore_errors=True)
            shutil.rmtree(home_b, ignore_errors=True)

        assert all(result["success"] is True for result in results)

    def test_engines_with_same_home_share_runtime_until_last_close(
        self,
        monkeypatch,
        tmp_path,
    ):
        """Two engine instances with the same home share one runtime ref."""
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
        engine_a = AiralogyEngine(boxlite_home=str(tmp_path / "boxlite-home"))
        engine_b = AiralogyEngine(boxlite_home=str(tmp_path / "boxlite-home"))

        runtime_a = engine_a._get_runtime()
        runtime_b = engine_b._get_runtime()

        assert runtime_a is runtime_b
        assert len(FakeBoxlite.instances) == 1

        asyncio.run(engine_a.close())
        assert runtime_a.closed is False

        asyncio.run(engine_b.close())
        assert runtime_a.closed is True
