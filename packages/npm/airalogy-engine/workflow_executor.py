"""Sandbox-side executor for Airalogy workflow-level assigners."""

from __future__ import annotations

import asyncio
import dataclasses
import importlib.util
import inspect
import json
import os
import sys
import traceback
from collections.abc import Mapping
from pathlib import Path
from typing import Any

WORKFLOW_DIR = Path(
    os.environ.get("AIRALOGY_WORKFLOW_DIR", "/home/airalogy/protocols/workflow")
).resolve()


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
    raise TypeError("workflow assigner must return a dict-like value")


def _load_entrypoint(entrypoint: str) -> Any:
    if ":" not in entrypoint:
        raise ValueError("entrypoint must use file_path:function_name format")

    file_path, function_name = entrypoint.rsplit(":", 1)
    if not file_path or not function_name:
        raise ValueError("entrypoint must use file_path:function_name format")

    module_path = (WORKFLOW_DIR / file_path).resolve()
    if not module_path.is_file():
        raise ValueError(f"workflow assigner file not found: {file_path}")
    if not module_path.is_relative_to(WORKFLOW_DIR):
        raise ValueError("workflow assigner entrypoint must stay inside workflow root")

    sys.path.insert(0, str(WORKFLOW_DIR))
    sys.path.insert(0, str(module_path.parent))
    module_name = f"_airalogy_workflow_assigner_{abs(hash(str(module_path)))}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"workflow assigner file cannot be loaded: {file_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    func = getattr(module, function_name, None)
    if not callable(func):
        raise ValueError(f"workflow assigner function not found: {function_name}")
    return func


async def _run_assigner(entrypoint: str, inputs: dict[str, Any]) -> dict[str, Any]:
    func = _load_entrypoint(entrypoint)
    result = func(**inputs)
    if inspect.isawaitable(result):
        result = await result
    return _normalize_outputs(result)


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {"success": True, "data": data}


def _failure(message: str, output: str = "") -> dict[str, Any]:
    return {"success": False, "message": message, "output": output}


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps(_failure("workflow executor expects one JSON parameter")))
        raise SystemExit(0)

    try:
        params = json.loads(sys.argv[1])
        entrypoint = params["entrypoint"]
        inputs = params.get("inputs") or {}
        if not isinstance(entrypoint, str):
            raise ValueError("entrypoint must be a string")
        if not isinstance(inputs, dict):
            raise ValueError("inputs must be a dict")
        outputs = asyncio.run(_run_assigner(entrypoint, inputs))
        print(json.dumps(_success({"outputs": outputs}), ensure_ascii=False))
    except Exception as exc:
        print(
            json.dumps(
                _failure(str(exc), traceback.format_exc()),
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    main()
