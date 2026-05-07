from __future__ import annotations

import importlib.util
import sys
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any, Iterable

from pydantic import BaseModel, create_model


class ModelSyncError(ValueError):
    """Raised when `model.py::VarModel` is incompatible with AIMD vars."""


def load_var_model_from_path(path: str | Path) -> type[BaseModel]:
    model_path = Path(path)
    module = _load_module_from_path(model_path)
    model = getattr(module, "VarModel", None)
    if model is None:
        raise ValueError(f"'{model_path}' does not define VarModel.")
    if not isinstance(model, type) or not issubclass(model, BaseModel):
        raise TypeError(f"'{model_path}' VarModel must be a pydantic BaseModel subclass.")
    return model


def validate_var_model_compatible_with_aimd_vars(
    aimd_vars: Iterable[Any],
    var_model: type[BaseModel],
) -> None:
    if not isinstance(var_model, type) or not issubclass(var_model, BaseModel):
        raise TypeError("var_model must be a pydantic BaseModel subclass.")

    vars_list = list(aimd_vars)
    errors = [
        *_find_var_model_extra_fields(vars_list, var_model),
        *_find_var_model_type_mismatches(vars_list, var_model),
    ]
    if errors:
        raise ModelSyncError(
            "VarModel is incompatible with protocol.aimd: "
            + "; ".join(errors)
            + "."
        )


def merge_var_models(
    aimd_model: type[BaseModel],
    override_model: type[BaseModel],
) -> type[BaseModel]:
    if not isinstance(aimd_model, type) or not issubclass(aimd_model, BaseModel):
        raise TypeError("aimd_model must be a pydantic BaseModel subclass.")
    if not isinstance(override_model, type) or not issubclass(override_model, BaseModel):
        raise TypeError("override_model must be a pydantic BaseModel subclass.")

    missing_aimd_fields = {
        name: (field_info.annotation, field_info)
        for name, field_info in aimd_model.model_fields.items()
        if name not in override_model.model_fields
    }
    if not missing_aimd_fields:
        return override_model

    return create_model(
        "VarModel",
        __base__=override_model,
        __module__=override_model.__module__,
        **missing_aimd_fields,
    )


def _load_module_from_path(path: Path) -> ModuleType:
    module_name = f"_airalogy_protocol_model_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Cannot load Python module from '{path}'.")

    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(path.parent))
    try:
        spec.loader.exec_module(module)
    finally:
        if sys.path and sys.path[0] == str(path.parent):
            sys.path.pop(0)
    return module


def _find_var_model_type_mismatches(
    aimd_vars: list[Any],
    var_model: type[BaseModel],
) -> list[str]:
    simple_types = {
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
    }
    errors: list[str] = []
    for var in aimd_vars:
        name = _get_var_name(var)
        if name not in var_model.model_fields:
            continue
        if _is_var_table(var):
            continue

        aimd_type = _get_var_type_annotation(var)
        if aimd_type is None:
            continue
        expected_type = simple_types.get(aimd_type)
        if expected_type is None:
            continue

        model_annotation = var_model.model_fields[name].annotation
        if model_annotation == expected_type:
            continue
        if isinstance(model_annotation, str) and model_annotation == aimd_type:
            continue

        errors.append(
            f"field '{name}' AIMD type is {aimd_type} but VarModel type is "
            f"{_format_annotation(model_annotation)}"
        )
    return errors


def _find_var_model_extra_fields(
    aimd_vars: list[Any],
    var_model: type[BaseModel],
) -> list[str]:
    aimd_names = {_get_var_name(var) for var in aimd_vars}
    extra_fields = sorted(set(var_model.model_fields) - aimd_names)
    if not extra_fields:
        return []
    return [
        "VarModel defines fields that are not AIMD vars: "
        + ", ".join(extra_fields)
    ]


def _get_var_name(var: Any) -> str:
    if isinstance(var, dict):
        return var["name"]
    return var.name


def _get_var_type_annotation(var: Any) -> str | None:
    if isinstance(var, dict):
        return var.get("type_annotation")
    return getattr(var, "type_annotation", None)


def _is_var_table(var: Any) -> bool:
    if isinstance(var, dict):
        return "subvars" in var
    return bool(getattr(var, "subvars", None))


def _format_annotation(annotation: Any) -> str:
    if isinstance(annotation, str):
        return annotation
    return getattr(annotation, "__name__", repr(annotation))


__all__ = [
    "ModelSyncError",
    "load_var_model_from_path",
    "merge_var_models",
    "validate_var_model_compatible_with_aimd_vars",
]
