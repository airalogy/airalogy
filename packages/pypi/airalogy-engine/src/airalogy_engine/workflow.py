"""Workflow orchestration support for Airalogy Engine."""

from __future__ import annotations

import asyncio
import dataclasses
import importlib.util
import inspect
import json
import re
import sys
import uuid
from collections.abc import Mapping, Sequence
from contextlib import suppress
from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

from airalogy.markdown import parse_aimd, parse_workflow_content
from boxlite import Box, BoxOptions, BoxStateInfo, Boxlite, Options
from boxlite.errors import BoxliteError

from airalogy_engine.engine import (
    DEFAULT_IMAGE,
    _COPY_OPTIONS,
    _WORKING_DIR,
    _copy_out_log,
    _exec_command_with_timeout,
    _is_pyo3_panic,
    _is_running_state,
    _resolve_boxlite_home,
    _stop_box_best_effort,
    _track_background_cleanup,
)

_WORKFLOW_DIR = f"{_WORKING_DIR}/workflow"
_WORKFLOW_EXECUTOR_PATH = str(Path(__file__).parent / "workflow_executor.py")
_SANDBOX_LOG_FILE = "workflow_debug.log"
_REFERENCE_PATTERN = re.compile(
    r"^\$\{(?P<root>[A-Za-z][A-Za-z0-9_]*)(?P<path>(?:\.[A-Za-z][A-Za-z0-9_]*)+)\}$"
)
_REFERENCE_FIND_PATTERN = re.compile(
    r"\$\{[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+\}"
)
_WHEN_PATTERN = re.compile(
    r"^\s*(?P<left>\$\{[^}]+\})(?:\s*(?P<op>==|!=|>=|<=|>|<)\s*(?P<right>.+?))?\s*$"
)
_RECORD_DATA_SECTIONS = {"var", "step", "check", "quiz", "workflow"}


class WorkflowExecutionError(ValueError):
    """Raised when a workflow transition cannot be executed."""


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {"success": True, "data": data}


def _failure(message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"success": False, "message": message}
    if data is not None:
        result["data"] = data
    return result


def _normalize_outputs(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "model_dump") and callable(value.model_dump):
        dumped = value.model_dump()
        if isinstance(dumped, Mapping):
            return dict(dumped)
    if dataclasses.is_dataclass(value):
        dumped = dataclasses.asdict(value)
        if isinstance(dumped, Mapping):
            return dict(dumped)
    raise WorkflowExecutionError("workflow assigner must return a dict-like value")


def _record_template() -> dict[str, Any]:
    return {"data": {section: {} for section in sorted(_RECORD_DATA_SECTIONS)}}


def _nested_get(value: Any, path: Sequence[str], context: str) -> Any:
    current = value
    for part in path:
        if isinstance(current, Mapping) and part in current:
            current = current[part]
        else:
            raise WorkflowExecutionError(f"Cannot resolve {context}: missing {part}")
    return current


def _record_get(record: Mapping[str, Any], path: Sequence[str], context: str) -> Any:
    if not path:
        return record

    first = path[0]
    data = record.get("data")
    if (
        first in _RECORD_DATA_SECTIONS
        and isinstance(data, Mapping)
        and first in data
    ):
        return _nested_get(data, path, context)
    return _nested_get(record, path, context)


def _record_set(record: dict[str, Any], path: Sequence[str], value: Any) -> None:
    if not path:
        raise WorkflowExecutionError("assignment field path must not be empty")

    first = path[0]
    if first in _RECORD_DATA_SECTIONS:
        data = record.setdefault("data", {})
        if not isinstance(data, dict):
            raise WorkflowExecutionError("record.data must be a mapping/object")
        current: dict[str, Any] = data
    else:
        current = record

    for part in path[:-1]:
        child = current.get(part)
        if child is None:
            child = {}
            current[part] = child
        if not isinstance(child, dict):
            raise WorkflowExecutionError(
                f"Cannot assign {'.'.join(path)} through non-object field {part}"
            )
        current = child
    current[path[-1]] = deepcopy(value)


def _parse_literal(value: str) -> Any:
    normalized = value.strip()
    lowered = normalized.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if lowered == "null":
        return None
    try:
        return json.loads(normalized)
    except json.JSONDecodeError:
        return normalized


def _compare(left: Any, op: str, right: Any) -> bool:
    if op == "==":
        return left == right
    if op == "!=":
        return left != right
    if op == ">":
        return left > right
    if op == "<":
        return left < right
    if op == ">=":
        return left >= right
    if op == "<=":
        return left <= right
    raise WorkflowExecutionError(f"Unsupported workflow condition operator: {op}")


class AiralogyWorkflowEngine:
    """Execute declarative AIMD workflow transitions.

    The engine returns Record drafts and transition outputs. It does not persist
    Records or create Record versions; platform code should decide how to store
    returned drafts.
    """

    def __init__(
        self,
        workflow_path: str,
        workflow_id: str | None = None,
        *,
        assigner_runtime: Literal["local", "sandbox"] = "sandbox",
        boxlite_home: str | None = None,
        image: str | None = None,
        rootfs_path: str | None = None,
        timeout: int = 300,
        memory_mib: int = 512,
        cpus: int = 1,
        auto_stop: bool = True,
    ) -> None:
        path = Path(workflow_path).expanduser().resolve()
        if path.is_dir():
            path = path / "workflow.aimd"
        if not path.is_file():
            raise ValueError(f"workflow_path must be a workflow file: {workflow_path}")
        if assigner_runtime not in {"local", "sandbox"}:
            raise ValueError("assigner_runtime must be 'local' or 'sandbox'")

        self.workflow_path = str(path)
        self.workflow_root = str(path.parent)
        self.workflow = self._load_workflow(path, workflow_id)
        self.assigner_runtime = assigner_runtime
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

    async def __aenter__(self) -> "AiralogyWorkflowEngine":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    def _load_workflow(self, path: Path, workflow_id: str | None) -> dict[str, Any]:
        content = path.read_text(encoding="utf-8")
        parsed = parse_aimd(content)
        workflows = parsed["templates"]["workflow"]
        if not workflows:
            workflows = [parse_workflow_content(content).to_dict()]
        if workflow_id is not None:
            workflows = [
                workflow for workflow in workflows if workflow.get("id") == workflow_id
            ]
            if not workflows:
                raise ValueError(f"workflow id not found: {workflow_id}")
        if len(workflows) != 1:
            raise ValueError("workflow_path must contain exactly one workflow block")
        return workflows[0]

    def _assigner_by_id(self) -> dict[str, dict[str, Any]]:
        return {assigner["id"]: assigner for assigner in self.workflow["assigners"]}

    def _transition_by_id(self) -> dict[str, dict[str, Any]]:
        return {transition["id"]: transition for transition in self.workflow["transitions"]}

    def _get_runtime(self) -> Boxlite:
        if self._closed:
            raise ValueError("AiralogyWorkflowEngine is closed")
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
            volumes=[(self.workflow_root, _WORKFLOW_DIR, False)],
        )

    async def _create_box(self) -> Box:
        runtime = self._get_runtime()
        box = await runtime.create(self._build_box_options())
        await box.copy_in(_WORKFLOW_EXECUTOR_PATH, f"{_WORKING_DIR}/", _COPY_OPTIONS)
        return box

    def box_status(self) -> BoxStateInfo | None:
        """Return the current workflow sandbox state, or None when no box exists."""
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
        except BaseException as exc:
            if not _is_pyo3_panic(exc):
                raise

    async def stop(self) -> None:
        """Stop the current workflow sandbox without closing this engine."""
        box = self._box
        self._box = None
        if box is not None:
            self._box_active_counts.pop(box.id, None)
            await self._stop_box(box)

    async def close(self) -> None:
        """Stop this workflow engine and release its BoxLite runtime."""
        await self.stop()
        runtime = self._runtime
        self._runtime = None
        self._closed = True
        if runtime is not None:
            with suppress(Exception):
                runtime.close()

    def _begin_box_command(self, box: Box) -> None:
        self._box_active_counts[box.id] = self._box_active_counts.get(box.id, 0) + 1

    def _finish_box_command(self, box: Box) -> int:
        active_count = self._box_active_counts.get(box.id, 0)
        if active_count <= 1:
            self._box_active_counts.pop(box.id, None)
            return 0
        self._box_active_counts[box.id] = active_count - 1
        return active_count - 1

    def resolve_value(
        self,
        value: Any,
        records: Mapping[str, Any],
        transition_outputs: Mapping[str, Any],
        node_iterations: Mapping[str, int] | None = None,
    ) -> Any:
        """Resolve one workflow value, preserving constants as constants."""
        if not isinstance(value, str):
            return deepcopy(value)

        match = _REFERENCE_PATTERN.fullmatch(value.strip())
        if match:
            return deepcopy(
                self._resolve_reference(
                    value.strip(), records, transition_outputs, node_iterations or {}
                )
            )

        def replace_reference(match: re.Match[str]) -> str:
            resolved = self._resolve_reference(
                match.group(0), records, transition_outputs, node_iterations or {}
            )
            return str(resolved)

        if _REFERENCE_FIND_PATTERN.search(value):
            return _REFERENCE_FIND_PATTERN.sub(replace_reference, value)
        return value

    def _resolve_reference(
        self,
        reference: str,
        records: Mapping[str, Any],
        transition_outputs: Mapping[str, Any],
        node_iterations: Mapping[str, int],
    ) -> Any:
        match = _REFERENCE_PATTERN.fullmatch(reference)
        if not match:
            raise WorkflowExecutionError(f"Invalid workflow reference: {reference}")

        root = match.group("root")
        path = match.group("path").lstrip(".").split(".")
        if path[0] == "outputs":
            if root not in transition_outputs:
                raise WorkflowExecutionError(
                    f"Transition output not available: {root}.outputs"
                )
            return _nested_get(
                transition_outputs[root],
                path[1:],
                f"{root}.{'.'.join(path)}",
            )
        if path == ["iteration"]:
            return node_iterations.get(root, 0)
        if path == ["status"]:
            if root not in records:
                raise WorkflowExecutionError(f"Record not available for node: {root}")
            record = records[root]
            if isinstance(record, Mapping):
                if "status" in record:
                    return record["status"]
                metadata = record.get("metadata")
                if isinstance(metadata, Mapping) and "status" in metadata:
                    return metadata["status"]
            return None

        if root not in records:
            raise WorkflowExecutionError(f"Record not available for node: {root}")
        record = records[root]
        if not isinstance(record, Mapping):
            raise WorkflowExecutionError(f"Record for node {root} must be a mapping")
        return _record_get(record, path, f"{root}.{'.'.join(path)}")

    def evaluate_when(
        self,
        when: str | None,
        records: Mapping[str, Any],
        transition_outputs: Mapping[str, Any],
        node_iterations: Mapping[str, int] | None = None,
    ) -> bool:
        """Evaluate the limited workflow condition syntax."""
        if when is None or not when.strip():
            return True
        match = _WHEN_PATTERN.fullmatch(when)
        if not match:
            raise WorkflowExecutionError(f"Unsupported workflow condition: {when}")

        left = self.resolve_value(
            match.group("left"), records, transition_outputs, node_iterations or {}
        )
        op = match.group("op")
        if op is None:
            return bool(left)

        right_raw = match.group("right")
        assert right_raw is not None
        right = self.resolve_value(
            right_raw, records, transition_outputs, node_iterations or {}
        )
        if isinstance(right, str) and not _REFERENCE_PATTERN.fullmatch(right.strip()):
            right = _parse_literal(right)
        return _compare(left, op, right)

    def _resolve_inputs(
        self,
        transition: Mapping[str, Any],
        records: Mapping[str, Any],
        transition_outputs: Mapping[str, Any],
        node_iterations: Mapping[str, int],
    ) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, raw_value in transition.get("inputs", {}).items():
            result[key] = self.resolve_value(
                raw_value, records, transition_outputs, node_iterations
            )
        return result

    async def _run_local_assigner(
        self,
        assigner: Mapping[str, Any],
        inputs: dict[str, Any],
    ) -> dict[str, Any]:
        entrypoint = assigner.get("entrypoint")
        if not isinstance(entrypoint, str):
            raise WorkflowExecutionError("python workflow assigner requires entrypoint")
        if ":" not in entrypoint:
            raise WorkflowExecutionError(
                "entrypoint must use file_path:function_name format"
            )

        file_path, function_name = entrypoint.rsplit(":", 1)
        module_path = (Path(self.workflow_root) / file_path).resolve()
        workflow_root = Path(self.workflow_root).resolve()
        if not module_path.is_file():
            raise WorkflowExecutionError(f"workflow assigner file not found: {file_path}")
        if not module_path.is_relative_to(workflow_root):
            raise WorkflowExecutionError(
                "workflow assigner entrypoint must stay inside workflow root"
            )

        sys.path.insert(0, str(workflow_root))
        sys.path.insert(0, str(module_path.parent))
        try:
            module_name = f"_airalogy_workflow_assigner_{uuid.uuid4().hex}"
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if spec is None or spec.loader is None:
                raise WorkflowExecutionError(
                    f"workflow assigner file cannot be loaded: {file_path}"
                )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            func = getattr(module, function_name, None)
            if not callable(func):
                raise WorkflowExecutionError(
                    f"workflow assigner function not found: {function_name}"
                )

            output = func(**inputs)
            if inspect.isawaitable(output):
                output = await output
            return _normalize_outputs(output)
        finally:
            with suppress(ValueError):
                sys.path.remove(str(module_path.parent))
            with suppress(ValueError):
                sys.path.remove(str(workflow_root))

    async def _run_sandbox_assigner(
        self,
        assigner: Mapping[str, Any],
        inputs: dict[str, Any],
        *,
        env_vars: dict[str, str] | None,
        timeout: int | None,
        debug: bool,
        log_file: str,
    ) -> dict[str, Any]:
        entrypoint = assigner.get("entrypoint")
        if not isinstance(entrypoint, str):
            raise WorkflowExecutionError("python workflow assigner requires entrypoint")

        env_pairs = [(key, value) for key, value in (env_vars or {}).items()]
        sandbox_log_file = _SANDBOX_LOG_FILE
        if debug:
            sandbox_log_file = f"workflow_debug_{uuid.uuid4().hex}.log"
            env_pairs = [
                (key, value)
                for key, value in env_pairs
                if key not in {"PROTOCOL_DEBUG", "PROTOCOL_DEBUG_LOG_FILE"}
            ]
            env_pairs.append(("PROTOCOL_DEBUG", "1"))
            env_pairs.append(("PROTOCOL_DEBUG_LOG_FILE", sandbox_log_file))

        effective_timeout = self.timeout if timeout is None else timeout
        box: Box | None = None
        timed_out = False
        try:
            box = await self._ensure_running_box()
            self._begin_box_command(box)
            params = {"entrypoint": entrypoint, "inputs": inputs}
            command = [
                "python",
                "workflow_executor.py",
                json.dumps(params, separators=(",", ":"), ensure_ascii=False),
            ]
            exec_result, stdout, stderr, timed_out = await _exec_command_with_timeout(
                box, command, effective_timeout, env=env_pairs
            )
            if timed_out:
                raise WorkflowExecutionError(
                    f"Execution timed out after {effective_timeout} seconds"
                )
            if exec_result is None:
                raise WorkflowExecutionError(
                    f"Sandbox execution did not return a result: {stderr.strip()}"
                )
            if exec_result.exit_code != 0:
                raise WorkflowExecutionError(
                    f"Workflow assigner failed with return code {exec_result.exit_code}: {stderr.strip()}"
                )
            try:
                result = json.loads(stdout.strip())
            except json.JSONDecodeError as exc:
                raise WorkflowExecutionError(
                    f"Invalid JSON output from workflow executor: {stdout.strip()}"
                ) from exc
            if not result.get("success"):
                message = result.get("message") or "Workflow assigner failed"
                output = result.get("output")
                if output:
                    message = f"{message}\n{output}"
                raise WorkflowExecutionError(message)
            return _normalize_outputs(result.get("data", {}).get("outputs", {}))
        except BoxliteError as exc:
            raise WorkflowExecutionError(f"Sandbox error: {exc}") from exc
        except RuntimeError as exc:
            raise WorkflowExecutionError(f"Sandbox error: {exc}") from exc
        except BaseException as exc:
            if not _is_pyo3_panic(exc):
                raise
            raise WorkflowExecutionError(f"Sandbox runtime error: {exc}") from exc
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

    async def _run_assigner(
        self,
        assigner: Mapping[str, Any],
        inputs: dict[str, Any],
        *,
        env_vars: dict[str, str] | None,
        timeout: int | None,
        debug: bool,
        log_file: str,
    ) -> dict[str, Any]:
        runtime = assigner.get("runtime")
        if runtime != "python":
            raise WorkflowExecutionError(
                f"Unsupported workflow assigner runtime: {runtime}"
            )
        if self.assigner_runtime == "local":
            return await self._run_local_assigner(assigner, inputs)
        return await self._run_sandbox_assigner(
            assigner,
            inputs,
            env_vars=env_vars,
            timeout=timeout,
            debug=debug,
            log_file=log_file,
        )

    async def run_transition(
        self,
        transition_id: str,
        records: Mapping[str, Any],
        *,
        transition_outputs: Mapping[str, Any] | None = None,
        node_iterations: Mapping[str, int] | None = None,
        env_vars: dict[str, str] | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "workflow_debug.log",
    ) -> dict[str, Any]:
        """Run one transition and return updated Record drafts."""
        transition = self._transition_by_id().get(transition_id)
        if transition is None:
            return _failure(f"workflow transition not found: {transition_id}")

        state_records = deepcopy(dict(records))
        outputs = deepcopy(dict(transition_outputs or {}))
        iterations = dict(node_iterations or {})
        attempts: list[dict[str, Any]] = []
        executed: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        try:
            if not self.evaluate_when(
                transition.get("when"), state_records, outputs, iterations
            ):
                skipped.append({"id": transition_id, "reason": "when_false"})
                return _success(
                    {
                        "workflow": self.workflow,
                        "records": state_records,
                        "transition_outputs": outputs,
                        "executed_transitions": executed,
                        "skipped_transitions": skipped,
                        "attempts": attempts,
                        "node_iterations": iterations,
                    }
                )

            assigner_outputs: dict[str, Any] = {}
            run_id = transition.get("run")
            if run_id:
                assigner = self._assigner_by_id()[run_id]
                inputs = self._resolve_inputs(
                    transition, state_records, outputs, iterations
                )
                attempt = {
                    "transition": transition_id,
                    "assigner": run_id,
                    "runtime": self.assigner_runtime,
                    "status": "running",
                }
                attempts.append(attempt)
                assigner_outputs = await self._run_assigner(
                    assigner,
                    inputs,
                    env_vars=env_vars,
                    timeout=timeout,
                    debug=debug,
                    log_file=log_file,
                )
                attempt["status"] = "succeeded"
                attempt["outputs"] = deepcopy(assigner_outputs)
                outputs[transition_id] = deepcopy(assigner_outputs)

            for target_node, assignments in transition.get("assign", {}).items():
                target_record = state_records.get(target_node)
                if target_record is None:
                    target_record = _record_template()
                elif not isinstance(target_record, Mapping):
                    raise WorkflowExecutionError(
                        f"Record for target node {target_node} must be a mapping"
                    )
                target_record = deepcopy(dict(target_record))
                for field_path, raw_value in assignments.items():
                    value = self.resolve_value(
                        raw_value, state_records, outputs, iterations
                    )
                    _record_set(target_record, field_path.split("."), value)
                state_records[target_node] = target_record

            for target_node in transition.get("to", []):
                iterations[target_node] = iterations.get(target_node, 0) + 1

            executed.append(
                {
                    "id": transition_id,
                    "from": transition.get("from", []),
                    "to": transition.get("to", []),
                    "run": run_id,
                }
            )
            return _success(
                {
                    "workflow": self.workflow,
                    "records": state_records,
                    "transition_outputs": outputs,
                    "executed_transitions": executed,
                    "skipped_transitions": skipped,
                    "attempts": attempts,
                    "node_iterations": iterations,
                }
            )
        except Exception as exc:
            for attempt in attempts:
                if attempt.get("status") == "running":
                    attempt["status"] = "failed"
                    attempt["message"] = str(exc)
            return _failure(
                str(exc),
                data={
                    "workflow": self.workflow,
                    "records": state_records,
                    "transition_outputs": outputs,
                    "executed_transitions": executed,
                    "skipped_transitions": skipped,
                    "attempts": attempts,
                    "node_iterations": iterations,
                },
            )

    async def run(
        self,
        records: Mapping[str, Any],
        *,
        transition_ids: Sequence[str] | None = None,
        transition_outputs: Mapping[str, Any] | None = None,
        node_iterations: Mapping[str, int] | None = None,
        max_passes: int = 1,
        env_vars: dict[str, str] | None = None,
        timeout: int | None = None,
        debug: bool = False,
        log_file: str = "workflow_debug.log",
    ) -> dict[str, Any]:
        """Run workflow transitions in declaration order.

        ``max_passes`` defaults to ``1``. Higher values let callers model loop
        passes while transition-level ``max_iterations`` limits are enforced.
        """
        if max_passes < 1:
            return _failure("max_passes must be a positive integer")

        known_transitions = self._transition_by_id()
        if transition_ids is None:
            selected = [transition["id"] for transition in self.workflow["transitions"]]
        else:
            selected = list(transition_ids)
            for transition_id in selected:
                if transition_id not in known_transitions:
                    return _failure(f"workflow transition not found: {transition_id}")

        state_records = deepcopy(dict(records))
        outputs = deepcopy(dict(transition_outputs or {}))
        iterations = dict(node_iterations or {})
        transition_counts: dict[str, int] = {}
        executed: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        attempts: list[dict[str, Any]] = []

        for _pass_index in range(max_passes):
            for transition_id in selected:
                transition = known_transitions[transition_id]
                count = transition_counts.get(transition_id, 0)
                max_iterations = transition.get("max_iterations")
                if isinstance(max_iterations, int) and count >= max_iterations:
                    skipped.append({"id": transition_id, "reason": "max_iterations"})
                    continue

                result = await self.run_transition(
                    transition_id,
                    state_records,
                    transition_outputs=outputs,
                    node_iterations=iterations,
                    env_vars=env_vars,
                    timeout=timeout,
                    debug=debug,
                    log_file=log_file,
                )
                data = result.get("data", {})
                attempts.extend(data.get("attempts", []))
                skipped.extend(data.get("skipped_transitions", []))
                if not result.get("success"):
                    data["attempts"] = attempts
                    data["skipped_transitions"] = skipped
                    data["executed_transitions"] = executed
                    return result

                state_records = data["records"]
                outputs = data["transition_outputs"]
                iterations = data.get("node_iterations", iterations)
                transition_executed = data.get("executed_transitions", [])
                if transition_executed:
                    transition_counts[transition_id] = count + 1
                    executed.extend(transition_executed)

        return _success(
            {
                "workflow": self.workflow,
                "records": state_records,
                "transition_outputs": outputs,
                "executed_transitions": executed,
                "skipped_transitions": skipped,
                "attempts": attempts,
                "node_iterations": iterations,
            }
        )


__all__ = ["AiralogyWorkflowEngine", "WorkflowExecutionError"]
