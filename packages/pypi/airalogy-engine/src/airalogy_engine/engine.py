import asyncio
import atexit
import json
import os
import tempfile
import threading
from contextlib import suppress
from pathlib import Path
from typing import Any

from boxlite import Box, Boxlite, BoxOptions, CopyOptions, Options
from boxlite.errors import BoxliteError

# Locate protocol_executor.py relative to this file
_EXECUTOR_PATH = str(Path(__file__).parent / "protocol_executor.py")
_WORKING_DIR = "/home/airalogy/protocols"
_SANDBOX_LOG_FILE = "protocol_debug.log"
DEFAULT_IMAGE = "numbcoder/airalogy-engine:0.1"
_COPY_OPTIONS = CopyOptions(
    recursive=True,
    overwrite=True,
    follow_symlinks=False,
    include_parent=False,
)
_BACKGROUND_CLEANUP_TASKS: set[asyncio.Task[Any]] = set()
_RUNTIME_REGISTRY_LOCK = threading.Lock()
_RUNTIME_REGISTRY: dict[str, "_RuntimeEntry"] = {}


class _RuntimeEntry:
    def __init__(self, runtime: Boxlite) -> None:
        self.runtime = runtime
        self.ref_count = 0


def _resolve_boxlite_home(boxlite_home: str | None) -> str:
    if boxlite_home is not None:
        return str(Path(boxlite_home).expanduser().resolve())

    configured_home = os.environ.get("BOXLITE_HOME")
    if configured_home:
        return str(Path(configured_home).expanduser().resolve())

    return str(Path.home().joinpath(".boxlite").resolve())


def _acquire_runtime(boxlite_home: str | None) -> tuple[str, Boxlite]:
    key = _resolve_boxlite_home(boxlite_home)

    with _RUNTIME_REGISTRY_LOCK:
        entry = _RUNTIME_REGISTRY.get(key)
        if entry is None:
            runtime = (
                Boxlite.default()
                if boxlite_home is None
                else Boxlite(Options(home_dir=key))
            )
            entry = _RuntimeEntry(runtime)
            _RUNTIME_REGISTRY[key] = entry

        entry.ref_count += 1
        return key, entry.runtime


def _release_runtime(key: str) -> None:
    runtime: Boxlite | None = None

    with _RUNTIME_REGISTRY_LOCK:
        entry = _RUNTIME_REGISTRY.get(key)
        if entry is None:
            return

        entry.ref_count -= 1
        if entry.ref_count <= 0:
            runtime = entry.runtime
            del _RUNTIME_REGISTRY[key]

    if runtime is not None:
        with suppress(Exception):
            runtime.close()


def _close_all_runtimes() -> None:
    with _RUNTIME_REGISTRY_LOCK:
        runtimes = [entry.runtime for entry in _RUNTIME_REGISTRY.values()]
        _RUNTIME_REGISTRY.clear()

    for runtime in runtimes:
        with suppress(Exception):
            runtime.close()


def _is_pyo3_panic(exc: BaseException) -> bool:
    exc_type = type(exc)
    return (
        exc_type.__module__ == "pyo3_runtime" and exc_type.__name__ == "PanicException"
    )


atexit.register(_close_all_runtimes)


async def _copy_out_log(box: Box, log_file: str) -> None:
    """Copy the executor log from sandbox and append to the host log file."""
    tmp_dir = tempfile.mkdtemp()
    try:
        await box.copy_out(
            f"{_WORKING_DIR}/{_SANDBOX_LOG_FILE}",
            tmp_dir,
            _COPY_OPTIONS,
        )
        tmp_log = Path(tmp_dir) / _SANDBOX_LOG_FILE
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


async def _cleanup_box(box: Box, runtime: Boxlite) -> None:
    """Best-effort asynchronous cleanup for timed-out boxes."""
    with suppress(Exception):
        await box.stop()
    with suppress(Exception):
        await runtime.remove(box.id, force=True)


async def _exec_command_with_timeout(
    box: Box,
    command: list[str],
    timeout: int,
) -> tuple[Any | None, str, str, bool]:
    """Run a low-level BoxLite execution with explicit timeout kill semantics."""
    execution = await box.exec(command[0], command[1:])

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
        if not timed_out:
            await _cancel_future(wait_task)
            await _cancel_future(stdout_task)
            await _cancel_future(stderr_task)

    return exec_result, "".join(stdout_lines), "".join(stderr_lines), timed_out


async def _copy_protocol_into_box(box: Box, protocol_path: Path) -> None:
    """Copy the protocol directory into the sandbox to isolate host files."""
    await box.copy_in(
        f"{protocol_path.absolute()}/",
        f"{_WORKING_DIR}/protocol/",
        _COPY_OPTIONS,
    )


class AiralogyEngine:
    """Protocol execution engine backed by a shared BoxLite runtime."""

    def __init__(
        self,
        boxlite_home: str | None = None,
        image: str | None = None,
        rootfs_path: str | None = None,
        timeout: int = 300,
        memory_mib: int = 512,
        cpus: int = 1,
    ) -> None:
        self.boxlite_home = boxlite_home
        self.image = image
        self.rootfs_path = rootfs_path
        self.timeout = timeout
        self.memory_mib = memory_mib
        self.cpus = cpus
        self._runtime_key: str | None = None
        self._runtime: Boxlite | None = None
        self._runtime_lock = threading.Lock()
        self._closed = False

    async def __aenter__(self) -> "AiralogyEngine":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    async def close(self) -> None:
        """Release this engine's BoxLite runtime reference."""
        with self._runtime_lock:
            runtime_key = self._runtime_key
            self._runtime_key = None
            self._runtime = None
            self._closed = True

        if runtime_key is not None:
            _release_runtime(runtime_key)

    def _get_runtime(self) -> Boxlite:
        with self._runtime_lock:
            if self._closed:
                raise ValueError("AiralogyEngine is closed")
            if self._runtime is None:
                self._runtime_key, self._runtime = _acquire_runtime(self.boxlite_home)
            return self._runtime

    async def _execute_in_sandbox(
        self,
        action: str,
        protocol_path: str,
        params: dict,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Execute an action inside the BoxLite sandbox."""
        image = self.image
        rootfs_path = self.rootfs_path
        if image is None and rootfs_path is None:
            image = DEFAULT_IMAGE

        proto_path = Path(protocol_path)
        if not proto_path.is_dir():
            raise ValueError(f"protocol_path must be a directory: {protocol_path}")
        if not proto_path.joinpath("protocol.aimd").is_file():
            raise ValueError(
                f"protocol.aimd not found in protocol_path: {protocol_path}"
            )

        if rootfs_path is not None:
            rootfs = Path(rootfs_path).resolve()
            if not rootfs.is_dir():
                raise ValueError(f"rootfs_path must be a directory: {rootfs_path}")

        env_pairs = [(k, v) for k, v in (env_vars or {}).items()]
        if debug:
            env_pairs.append(("PROTOCOL_DEBUG", "1"))

        box_options = BoxOptions(
            image=image if rootfs_path is None else None,
            rootfs_path=str(rootfs) if rootfs_path is not None else None,
            memory_mib=self.memory_mib,
            cpus=self.cpus,
            working_dir=_WORKING_DIR,
            env=env_pairs,
        )

        effective_timeout = self.timeout if timeout is None else timeout
        box: Box | None = None
        runtime: Boxlite | None = None
        result: dict | None = None
        timed_out = False
        try:
            runtime = self._get_runtime()
            box = await runtime.create(box_options)
            await box.copy_in(
                _EXECUTOR_PATH,
                f"{_WORKING_DIR}/",
                _COPY_OPTIONS,
            )
            await _copy_protocol_into_box(box, proto_path)

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
                    await _copy_out_log(box, log_file)
                if timed_out and runtime is not None:
                    _track_background_cleanup(
                        asyncio.create_task(_cleanup_box(box, runtime))
                    )
                else:
                    try:
                        await box.stop()
                    except BaseException as e:
                        if result is None or not _is_pyo3_panic(e):
                            raise

        if result is None:
            return {
                "success": False,
                "message": "Sandbox execution failed without a result",
                "output": "",
            }

        return result

    async def parse_protocol(
        self,
        protocol_path: str,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Parse a protocol package and return its schema, metadata, and fields."""
        return await self._execute_in_sandbox(
            "parse_protocol",
            protocol_path,
            {},
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def assign_variable(
        self,
        protocol_path: str,
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
            protocol_path,
            params,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def validate_variables(
        self,
        protocol_path: str,
        variables: dict,
        env_vars: dict | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "protocol_debug.log",
    ) -> dict:
        """Validate variable values against the protocol's model."""
        return await self._execute_in_sandbox(
            "validate_variables",
            protocol_path,
            variables,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )
