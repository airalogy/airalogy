import asyncio
import json
import os
import tempfile
import uuid
from collections.abc import Sequence
from contextlib import suppress
from pathlib import Path
from typing import Any

from boxlite import Box, Boxlite, BoxOptions, BoxStateInfo, CopyOptions, Options
from boxlite.errors import BoxliteError

# Locate protocol_executor.py relative to this file
_EXECUTOR_PATH = str(Path(__file__).parent / "protocol_executor.py")
_WORKING_DIR = "/home/airalogy/protocols"
_PROTOCOL_DIR = f"{_WORKING_DIR}/protocol"
_SANDBOX_LOG_FILE = "protocol_debug.log"
DEFAULT_IMAGE = "numbcoder/airalogy-engine:latest"
_COPY_OPTIONS = CopyOptions(
    recursive=True,
    overwrite=True,
    follow_symlinks=False,
    include_parent=False,
)
_BACKGROUND_CLEANUP_TASKS: set[asyncio.Task[Any]] = set()


def _resolve_boxlite_home(boxlite_home: str | None) -> str:
    if boxlite_home is not None:
        return str(Path(boxlite_home).expanduser().resolve())

    configured_home = os.environ.get("BOXLITE_HOME")
    if configured_home:
        return str(Path(configured_home).expanduser().resolve())

    return str(Path.home().joinpath(".boxlite").resolve())


def _is_pyo3_panic(exc: BaseException) -> bool:
    exc_type = type(exc)
    return (
        exc_type.__module__ == "pyo3_runtime" and exc_type.__name__ == "PanicException"
    )


async def _copy_out_log(box: Box, sandbox_log_file: str, log_file: str) -> None:
    """Copy the executor log from sandbox and append to the host log file."""
    tmp_dir = tempfile.mkdtemp()
    try:
        await box.copy_out(
            f"{_WORKING_DIR}/{sandbox_log_file}",
            tmp_dir,
            _COPY_OPTIONS,
        )
        tmp_log = Path(tmp_dir) / sandbox_log_file
        if tmp_log.exists():
            log_content = tmp_log.read_text(encoding="utf-8")
            if log_content:
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(log_content)
    except Exception:
        pass
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)


def _decode_stream_line(line: str | bytes) -> str:
    if isinstance(line, bytes):
        return line.decode("utf-8", errors="replace")
    return line


async def _collect_output_stream(stream: Any, output_lines: list[str]) -> None:
    """Consume a BoxLite output stream into the provided list."""
    if stream is None:
        return

    try:
        async for line in stream:
            output_lines.append(_decode_stream_line(line))
    except Exception:
        # Stream collection is best-effort because cleanup paths may close
        # streams abruptly after a timeout-triggered kill.
        pass


async def _cancel_future(task: asyncio.Future[Any] | None) -> None:
    """Cancel a task or future and suppress cleanup-related errors."""
    if task is None or task.done():
        return

    task.cancel()
    with suppress(asyncio.CancelledError, Exception):
        await task


def _track_background_cleanup(task: asyncio.Task[Any]) -> None:
    """Keep background cleanup tasks alive until they finish."""
    _BACKGROUND_CLEANUP_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_CLEANUP_TASKS.discard)


async def _stop_box_best_effort(box: Box) -> None:
    """Best-effort asynchronous cleanup for boxes no longer held by an engine."""
    with suppress(BaseException):
        await box.stop()


async def _exec_command_with_timeout(
    box: Box,
    command: list[str],
    timeout: int,
    env: Sequence[tuple[str, str]] | None = None,
) -> tuple[Any | None, str, str, bool]:
    """Run a low-level BoxLite execution with explicit timeout kill semantics."""
    execution = await box.exec(command[0], command[1:], env=env)

    try:
        stdout_stream = execution.stdout()
    except Exception:
        stdout_stream = None

    try:
        stderr_stream = execution.stderr()
    except Exception:
        stderr_stream = None

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    stdout_task = asyncio.create_task(
        _collect_output_stream(stdout_stream, stdout_lines)
    )
    stderr_task = asyncio.create_task(
        _collect_output_stream(stderr_stream, stderr_lines)
    )
    wait_task = asyncio.ensure_future(execution.wait())

    timed_out = False
    exec_result = None

    try:
        exec_result = await asyncio.wait_for(asyncio.shield(wait_task), timeout=timeout)
        await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
    except asyncio.TimeoutError:
        timed_out = True
        with suppress(Exception):
            await execution.kill()
        if wait_task.done() and not wait_task.cancelled():
            with suppress(Exception):
                exec_result = wait_task.result()
    finally:
        await _cancel_future(wait_task)
        await _cancel_future(stdout_task)
        await _cancel_future(stderr_task)

    return exec_result, "".join(stdout_lines), "".join(stderr_lines), timed_out


def _is_running_state(state: BoxStateInfo | None) -> bool:
    """Return whether a BoxLite state object represents a running box."""
    if state is None:
        return False

    running = getattr(state, "running", None)
    if isinstance(running, bool):
        return running

    return str(getattr(state, "status", "")).lower() == "running"


class AiralogyEngine:
    """Protocol execution engine backed by a shared BoxLite runtime."""

    def __init__(
        self,
        protocol_path: str,
        boxlite_home: str | None = None,
        image: str | None = None,
        rootfs_path: str | None = None,
        timeout: int = 300,
        memory_mib: int = 512,
        cpus: int = 1,
        auto_stop: bool = True,
    ) -> None:
        proto_path = Path(protocol_path).expanduser().resolve()
        if not proto_path.is_dir():
            raise ValueError(f"protocol_path must be a directory: {protocol_path}")
        if not proto_path.joinpath("protocol.aimd").is_file():
            raise ValueError(
                f"protocol.aimd not found in protocol_path: {protocol_path}"
            )

        self.protocol_path = str(proto_path)
        self.boxlite_home = boxlite_home
        self.image = image
        self.rootfs_path = rootfs_path
        self.timeout = timeout
        self.memory_mib = memory_mib
        self.cpus = cpus
        self.auto_stop = auto_stop
        self._runtime: Boxlite | None = None
        self._box: Box | None = None
        self._box_active_counts: dict[str, int] = {}
        self._closed = False

    async def __aenter__(self) -> "AiralogyEngine":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    async def close(self) -> None:
        """Stop this engine's box and release its BoxLite runtime reference."""
        await self.stop()

        runtime = self._runtime
        self._runtime = None
        self._closed = True

        if runtime is not None:
            with suppress(Exception):
                runtime.close()

    def _get_runtime(self) -> Boxlite:
        if self._closed:
            raise ValueError("AiralogyEngine is closed")
        if self._runtime is None:
            self._runtime = (
                Boxlite.default()
                if self.boxlite_home is None
                else Boxlite(Options(home_dir=_resolve_boxlite_home(self.boxlite_home)))
            )
        return self._runtime

    def _build_box_options(self) -> BoxOptions:
        image = self.image
        rootfs_path = self.rootfs_path
        if image is None and rootfs_path is None:
            image = DEFAULT_IMAGE

        rootfs: Path | None = None
        if rootfs_path is not None:
            rootfs = Path(rootfs_path).expanduser().resolve()
            if not rootfs.is_dir():
                raise ValueError(f"rootfs_path must be a directory: {rootfs_path}")

        return BoxOptions(
            image=image if rootfs_path is None else None,
            rootfs_path=str(rootfs) if rootfs is not None else None,
            memory_mib=self.memory_mib,
            cpus=self.cpus,
            working_dir=_WORKING_DIR,
            volumes=[(self.protocol_path, _PROTOCOL_DIR, False)],
        )

    async def _create_box(self) -> Box:
        runtime = self._get_runtime()
        box = await runtime.create(self._build_box_options())
        await box.copy_in(
            _EXECUTOR_PATH,
            f"{_WORKING_DIR}/",
            _COPY_OPTIONS,
        )
        return box

    def box_status(self) -> BoxStateInfo | None:
        """Return the current box state, or None when this engine has no box."""
        box = self._box
        if box is None:
            return None
        return box.info().state

    async def _ensure_running_box(self) -> Box:
        box = self._box
        if box is not None:
            try:
                if _is_running_state(box.info().state):
                    return box
            except Exception:
                pass
            self._box = None
            self._box_active_counts.pop(box.id, None)

        new_box = await self._create_box()
        current_box = self._box
        if current_box is not None:
            try:
                if _is_running_state(current_box.info().state):
                    _track_background_cleanup(
                        asyncio.create_task(_stop_box_best_effort(new_box))
                    )
                    return current_box
            except Exception:
                pass

        self._box = new_box
        return new_box

    async def _stop_box(self, box: Box) -> None:
        try:
            await box.stop()
        except BaseException as e:
            if not _is_pyo3_panic(e):
                raise

    async def stop(self) -> None:
        """Stop the current box without closing the engine."""
        box = self._box
        self._box = None
        if box is not None:
            self._box_active_counts.pop(box.id, None)
            await self._stop_box(box)

    def _begin_box_command(self, box: Box) -> None:
        self._box_active_counts[box.id] = self._box_active_counts.get(box.id, 0) + 1

    def _finish_box_command(self, box: Box) -> int:
        active_count = self._box_active_counts.get(box.id, 0)
        if active_count <= 1:
            self._box_active_counts.pop(box.id, None)
            return 0

        self._box_active_counts[box.id] = active_count - 1
        return active_count - 1

    async def _execute_in_sandbox(
        self,
        action: str,
        params: dict,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Execute an action inside the BoxLite sandbox."""
        env_pairs = [(k, v) for k, v in (env_vars or {}).items()]
        sandbox_log_file = _SANDBOX_LOG_FILE
        if debug:
            sandbox_log_file = f"protocol_debug_{uuid.uuid4().hex}.log"
            env_pairs = [
                (k, v)
                for k, v in env_pairs
                if k not in {"PROTOCOL_DEBUG", "PROTOCOL_DEBUG_LOG_FILE"}
            ]
            env_pairs.append(("PROTOCOL_DEBUG", "1"))
            env_pairs.append(("PROTOCOL_DEBUG_LOG_FILE", sandbox_log_file))

        effective_timeout = self.timeout if timeout is None else timeout
        box: Box | None = None
        result: dict | None = None

        timed_out = False
        try:
            box = await self._ensure_running_box()
            self._begin_box_command(box)

            command = [
                "python",
                "protocol_executor.py",
                action,
                "protocol",
                json.dumps(params, separators=(",", ":")),
            ]
            exec_result, stdout, stderr, timed_out = await _exec_command_with_timeout(
                box,
                command,
                effective_timeout,
                env=env_pairs,
            )

            if timed_out:
                result = {
                    "success": False,
                    "message": f"Execution timed out after {effective_timeout} seconds",
                    "output": "",
                }
            elif exec_result is None:
                result = {
                    "success": False,
                    "message": "Sandbox execution did not return a result",
                    "output": stderr.strip(),
                }
            elif exec_result.exit_code != 0:
                result = {
                    "success": False,
                    "message": f"Protocol exec failed with return code {exec_result.exit_code}",
                    "output": stderr.strip(),
                }
            else:
                output = stdout.strip()
                try:
                    result = json.loads(output)
                except json.JSONDecodeError:
                    result = {
                        "success": False,
                        "message": "Invalid JSON output from protocol executor",
                        "output": output,
                    }
        except BoxliteError as e:
            result = {
                "success": False,
                "message": f"Sandbox error: {str(e)}",
                "output": "",
            }
        except RuntimeError as e:
            result = {
                "success": False,
                "message": f"Sandbox error: {str(e)}",
                "output": "",
            }
        except BaseException as e:
            if not _is_pyo3_panic(e):
                raise
            result = {
                "success": False,
                "message": f"Sandbox runtime error: {str(e)}",
                "output": "",
            }
        finally:
            if box is not None:
                if debug:
                    await _copy_out_log(box, sandbox_log_file, log_file)
                remaining_active = self._finish_box_command(box)
                if self.auto_stop and remaining_active == 0 and self._box is box:
                    self._box = None
                    if timed_out:
                        _track_background_cleanup(
                            asyncio.create_task(_stop_box_best_effort(box))
                        )
                    else:
                        await self._stop_box(box)

        if result is None:
            return {
                "success": False,
                "message": "Sandbox execution failed without a result",
                "output": "",
            }

        return result

    async def parse_protocol(
        self,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Parse a protocol package and return its schema, metadata, and fields."""
        return await self._execute_in_sandbox(
            "parse_protocol",
            {},
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def assign_variable(
        self,
        var_name: str,
        dependent_data: dict,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Assign a variable value using the protocol's assigner functions."""
        params = {
            "var_name": var_name,
            "dependent_data": dependent_data,
        }
        return await self._execute_in_sandbox(
            "assign_variable",
            params,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def validate_variables(
        self,
        variables: dict,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Validate variable values against the protocol's model."""
        return await self._execute_in_sandbox(
            "validate_variables",
            variables,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def import_records(
        self,
        input_filename: str,
        input_format: str = "auto",
        allow_extra_var_fields: bool = False,
        require_complete_quiz: bool = False,
        include_template_defaults: bool = True,
        validate_model_sync: bool = True,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Import protocol-local rows into Airalogy record JSON objects."""
        params = {
            "input_filename": input_filename,
            "input_format": input_format,
            "allow_extra_var_fields": allow_extra_var_fields,
            "require_complete_quiz": require_complete_quiz,
            "include_template_defaults": include_template_defaults,
            "validate_model_sync": validate_model_sync,
        }
        return await self._execute_in_sandbox(
            "import_records",
            params,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def migrate_schema(
        self,
        data: dict,
        manifest: dict,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Run a version migration without network or injected secrets."""

        return await self._execute_in_sandbox(
            "migrate_schema",
            {"data": data, "manifest": manifest},
            env_vars={},
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )
