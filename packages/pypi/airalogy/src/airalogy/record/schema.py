from __future__ import annotations

import json
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from pydantic import BaseModel, ValidationError as PydanticValidationError

from airalogy.markdown import generate_model, parse_aimd, validate_aimd
from airalogy.markdown.model_sync import (
    load_var_model_from_path,
    merge_var_models,
    validate_var_model_compatible_with_aimd_vars,
)

from .hash import get_data_sha1
from .validator import validate_record_quiz_answers

RECORD_FORMAT = "airalogy.record"
RECORD_SCHEMA_VERSION = 1

_DATA_SECTIONS = ("var", "step", "check", "quiz")
_SHA1_RE = re.compile(r"^[0-9a-f]{40}$")


@dataclass(frozen=True)
class RecordValidationResult:
    ok: bool
    issues: list[str]


@dataclass(frozen=True)
class _ProtocolValidationContext:
    protocol_dir: Path
    metadata: dict[str, Any]
    parsed_aimd: dict[str, Any]
    var_model: type[BaseModel]


def load_record_file(path: str | Path) -> list[dict[str, Any]]:
    record_path = Path(path)
    try:
        parsed = json.loads(record_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"Failed to read record file '{record_path}': {exc}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Record file '{record_path}' is not valid JSON: {exc.msg}") from exc

    if isinstance(parsed, dict) and isinstance(parsed.get("records"), list):
        items = parsed["records"]
    elif isinstance(parsed, dict):
        items = [parsed]
    elif isinstance(parsed, list):
        items = parsed
    else:
        raise ValueError(
            f"Record file '{record_path}' must contain an object, a list of objects, "
            "or an object with a 'records' list."
        )

    records = [item for item in items if isinstance(item, dict)]
    if len(records) != len(items):
        raise ValueError(f"Record file '{record_path}' must contain only JSON objects.")
    if not records:
        raise ValueError(f"Record file '{record_path}' does not contain any records.")
    return records


def validate_record_file(
    path: str | Path,
    *,
    protocol_dir: str | Path | Iterable[str | Path] | None = None,
    allow_extra_var_fields: bool = False,
    require_complete_quiz: bool = False,
    validate_model_sync: bool = True,
) -> RecordValidationResult:
    try:
        records = load_record_file(path)
    except ValueError as exc:
        return RecordValidationResult(ok=False, issues=[str(exc)])

    issues = validate_records(
        records,
        protocol_dir=protocol_dir,
        allow_extra_var_fields=allow_extra_var_fields,
        require_complete_quiz=require_complete_quiz,
        validate_model_sync=validate_model_sync,
        source_label=str(path),
    )
    return RecordValidationResult(ok=not issues, issues=issues)


def inspect_record_file(path: str | Path) -> dict[str, Any]:
    records = load_record_file(path)
    protocol_ids = sorted(
        {
            value
            for record in records
            if isinstance((value := _record_protocol_value(record, "protocol_id")), str)
            and value
        }
    )
    protocol_versions = sorted(
        {
            value
            for record in records
            if isinstance((value := _record_protocol_value(record, "protocol_version")), str)
            and value
        }
    )
    return {
        "path": str(path),
        "format": RECORD_FORMAT,
        "schema_version": RECORD_SCHEMA_VERSION,
        "record_count": len(records),
        "record_ids": [
            record.get("record_id")
            for record in records
            if isinstance(record.get("record_id"), str) and record.get("record_id")
        ],
        "airalogy_record_ids": [
            record.get("airalogy_record_id")
            for record in records
            if isinstance(record.get("airalogy_record_id"), str)
            and record.get("airalogy_record_id")
        ],
        "protocol_ids": protocol_ids,
        "protocol_versions": protocol_versions,
        "data_sections": sorted(
            {
                section
                for record in records
                if isinstance(record.get("data"), dict)
                for section in record["data"]
            }
        ),
    }


def validate_records(
    records: list[dict[str, Any]],
    *,
    protocol_dir: str | Path | Iterable[str | Path] | None = None,
    allow_extra_var_fields: bool = False,
    require_complete_quiz: bool = False,
    validate_model_sync: bool = True,
    source_label: str = "record file",
) -> list[str]:
    protocol_contexts: list[_ProtocolValidationContext] = []
    issues: list[str] = []
    if protocol_dir is not None:
        try:
            protocol_contexts = [
                _load_protocol_context(path, validate_model_sync=validate_model_sync)
                for path in _normalize_protocol_dirs(protocol_dir)
            ]
        except (OSError, ValueError, TypeError) as exc:
            issues.append(f"Protocol validation setup failed: {exc}")
            return issues

    for index, record in enumerate(records, start=1):
        label = f"{source_label} record #{index}"
        protocol_context = _select_protocol_context(record, protocol_contexts)
        if protocol_contexts and protocol_context is None:
            protocol_ids = ", ".join(
                context.metadata.get("protocol_id", str(context.protocol_dir))
                for context in protocol_contexts
            )
            issues.append(
                f"{label}: no matching protocol_dir for "
                f"protocol_id '{_record_protocol_value(record, 'protocol_id') or 'missing'}' "
                f"and protocol_version '{_record_protocol_value(record, 'protocol_version') or 'missing'}'. "
                f"Available protocol IDs: {protocol_ids or 'none'}."
            )
            continue
        issues.extend(
            validate_record(
                record,
                protocol_context=protocol_context,
                allow_extra_var_fields=allow_extra_var_fields,
                require_complete_quiz=require_complete_quiz,
                label=label,
            )
        )
    return issues


def validate_record(
    record: dict[str, Any],
    *,
    protocol_dir: str | Path | None = None,
    protocol_context: _ProtocolValidationContext | None = None,
    allow_extra_var_fields: bool = False,
    require_complete_quiz: bool = False,
    validate_model_sync: bool = True,
    label: str = "Record",
) -> list[str]:
    issues = validate_record_structure(record, label=label)
    if issues:
        return issues

    context = protocol_context
    if context is None and protocol_dir is not None:
        try:
            context = _load_protocol_context(
                protocol_dir,
                validate_model_sync=validate_model_sync,
            )
        except (OSError, ValueError, TypeError) as exc:
            return [f"{label}: protocol validation setup failed: {exc}"]

    if context is not None:
        issues.extend(
            _validate_record_against_protocol(
                record,
                context,
                allow_extra_var_fields=allow_extra_var_fields,
                require_complete_quiz=require_complete_quiz,
                label=label,
            )
        )
    return issues


def validate_record_structure(record: dict[str, Any], *, label: str = "Record") -> list[str]:
    issues: list[str] = []
    if not isinstance(record, dict):
        return [f"{label} must be a JSON object."]

    record_format = record.get("format")
    if record_format is not None and record_format != RECORD_FORMAT:
        issues.append(f"{label} format must be '{RECORD_FORMAT}' when present.")

    schema_version = record.get("schema_version")
    if schema_version is not None and schema_version != RECORD_SCHEMA_VERSION:
        issues.append(f"{label} schema_version must be {RECORD_SCHEMA_VERSION} when present.")

    record_id = record.get("record_id")
    if record_id is not None and (not isinstance(record_id, str) or not record_id.strip()):
        issues.append(f"{label} record_id must be a non-empty string when present.")

    airalogy_record_id = record.get("airalogy_record_id")
    if airalogy_record_id is not None and (
        not isinstance(airalogy_record_id, str) or not airalogy_record_id.strip()
    ):
        issues.append(
            f"{label} airalogy_record_id must be a non-empty string when present."
        )

    record_version = record.get("record_version")
    if record_version is not None and (
        isinstance(record_version, bool)
        or not isinstance(record_version, int)
        or record_version < 1
    ):
        issues.append(f"{label} record_version must be a positive integer when present.")

    metadata = record.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        issues.append(f"{label} metadata must be an object when present.")
    if isinstance(metadata, dict):
        sha1 = metadata.get("sha1")
        if sha1 is not None:
            if not isinstance(sha1, str) or not sha1:
                issues.append(f"{label} metadata.sha1 must be a non-empty string when present.")
            elif _SHA1_RE.fullmatch(sha1):
                actual_sha1 = get_data_sha1(record)
                if sha1 != actual_sha1:
                    issues.append(
                        f"{label} metadata.sha1 mismatch: expected {sha1}, got {actual_sha1}."
                    )

    data = record.get("data")
    if not isinstance(data, dict):
        issues.append(f"{label} data must be an object.")
        return issues

    var_data = data.get("var")
    if not isinstance(var_data, dict):
        issues.append(f"{label} data.var must be an object.")

    for section in _DATA_SECTIONS[1:]:
        value = data.get(section)
        if value is not None and not isinstance(value, dict):
            issues.append(f"{label} data.{section} must be an object when present.")

    files = record.get("files")
    if files is not None:
        if not isinstance(files, list):
            issues.append(f"{label} files must be a list when present.")
        else:
            for index, file_ref in enumerate(files, start=1):
                if not isinstance(file_ref, dict):
                    issues.append(f"{label} files[{index}] must be an object.")
                    continue
                if not any(
                    isinstance(file_ref.get(key), str) and file_ref.get(key)
                    for key in ("file_id", "source_uri", "blob_id")
                ):
                    issues.append(
                        f"{label} files[{index}] must include file_id, source_uri, or blob_id."
                    )

    return issues


def _validate_record_against_protocol(
    record: dict[str, Any],
    context: _ProtocolValidationContext,
    *,
    allow_extra_var_fields: bool,
    require_complete_quiz: bool,
    label: str,
) -> list[str]:
    issues: list[str] = []
    protocol_id = context.metadata.get("protocol_id")
    protocol_version = context.metadata.get("protocol_version")

    record_protocol_id = _record_protocol_value(record, "protocol_id")
    if protocol_id and record_protocol_id != protocol_id:
        issues.append(
            f"{label} metadata.protocol_id must match protocol '{protocol_id}', "
            f"got '{record_protocol_id or 'missing'}'."
        )

    record_protocol_version = _record_protocol_value(record, "protocol_version")
    if protocol_version and record_protocol_version != protocol_version:
        issues.append(
            f"{label} metadata.protocol_version must match protocol version "
            f"'{protocol_version}', got '{record_protocol_version or 'missing'}'."
        )

    var_data = record["data"]["var"]
    model_fields = set(context.var_model.model_fields)
    unknown_fields = sorted(key for key in var_data if key not in model_fields)
    if unknown_fields and not allow_extra_var_fields:
        issues.append(
            f"{label} data.var contains unknown fields for this protocol: "
            f"{', '.join(unknown_fields)}."
        )

    try:
        context.var_model.model_validate(var_data)
    except PydanticValidationError as exc:
        for error in exc.errors():
            loc = ".".join(str(part) for part in error["loc"])
            issues.append(f"{label} data.var.{loc or '<root>'}: {error['msg']}.")

    quiz_data = record["data"].get("quiz")
    if quiz_data is not None or require_complete_quiz:
        try:
            is_valid, quiz_issues = validate_record_quiz_answers(
                {"data": {"quiz": quiz_data or {}}},
                context.parsed_aimd["templates"]["quiz"],
                require_complete=require_complete_quiz,
            )
        except ValueError as exc:
            issues.append(f"{label} data.quiz: {exc}")
        else:
            if not is_valid:
                issues.extend(f"{label} data.quiz: {issue}" for issue in quiz_issues)

    return issues


def _load_protocol_context(
    protocol_dir: str | Path,
    *,
    validate_model_sync: bool,
) -> _ProtocolValidationContext:
    protocol_path = Path(protocol_dir)
    if not protocol_path.exists():
        raise ValueError(f"Protocol directory '{protocol_path}' not found.")
    if not protocol_path.is_dir():
        raise ValueError(f"Protocol path '{protocol_path}' must be a directory.")

    aimd_path = protocol_path / "protocol.aimd"
    if not aimd_path.is_file():
        raise ValueError(f"Protocol directory '{protocol_path}' must contain protocol.aimd.")
    aimd_content = aimd_path.read_text(encoding="utf-8")
    is_valid, aimd_errors = validate_aimd(aimd_content, protocol_dir=protocol_path)
    if not is_valid:
        messages = "; ".join(str(error) for error in aimd_errors)
        raise ValueError(f"Protocol '{protocol_path}' failed validation: {messages}")

    parsed_aimd = parse_aimd(aimd_content)
    var_model = _load_var_model(protocol_path, aimd_content)
    if validate_model_sync:
        validate_var_model_compatible_with_aimd_vars(
            parsed_aimd["templates"]["var"],
            var_model,
        )
    return _ProtocolValidationContext(
        protocol_dir=protocol_path,
        metadata=_load_protocol_metadata(protocol_path),
        parsed_aimd=parsed_aimd,
        var_model=var_model,
    )


def _normalize_protocol_dirs(
    protocol_dir: str | Path | Iterable[str | Path],
) -> list[str | Path]:
    if isinstance(protocol_dir, (str, Path)):
        return [protocol_dir]
    return list(protocol_dir)


def _select_protocol_context(
    record: dict[str, Any],
    contexts: list[_ProtocolValidationContext],
) -> _ProtocolValidationContext | None:
    if not contexts:
        return None

    record_protocol_id = _record_protocol_value(record, "protocol_id")
    record_protocol_version = _record_protocol_value(record, "protocol_version")
    if record_protocol_id is None and len(contexts) == 1:
        return contexts[0]

    exact_matches = [
        context
        for context in contexts
        if context.metadata.get("protocol_id") == record_protocol_id
        and context.metadata.get("protocol_version") == record_protocol_version
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]

    id_only_matches = [
        context
        for context in contexts
        if context.metadata.get("protocol_id") == record_protocol_id
    ]
    if len(id_only_matches) == 1:
        return id_only_matches[0]
    return None


def _load_var_model(protocol_dir: Path, aimd_content: str) -> type[BaseModel]:
    namespace: dict[str, Any] = {"__name__": "_airalogy_record_generated_model"}
    exec(
        compile(generate_model(aimd_content), "<airalogy generated VarModel>", "exec"),
        namespace,
    )
    generated_model = namespace.get("VarModel")
    if generated_model is None:
        raise ValueError("Generated model code did not define VarModel.")
    if not isinstance(generated_model, type) or not issubclass(generated_model, BaseModel):
        raise TypeError("Generated VarModel must be a pydantic BaseModel subclass.")

    model_path = protocol_dir / "model.py"
    if model_path.is_file():
        override_model = load_var_model_from_path(model_path)
        return merge_var_models(generated_model, override_model)
    return generated_model


def _load_protocol_metadata(protocol_dir: Path) -> dict[str, Any]:
    metadata: dict[str, Any] = {"protocol_id": protocol_dir.name}
    protocol_toml = protocol_dir / "protocol.toml"
    if not protocol_toml.is_file():
        return metadata

    with protocol_toml.open("rb") as handle:
        parsed = tomllib.load(handle)

    protocol_data = parsed.get("airalogy_protocol")
    if not isinstance(protocol_data, dict):
        return metadata

    protocol_id = protocol_data.get("id")
    protocol_version = protocol_data.get("version")
    if isinstance(protocol_id, str) and protocol_id.strip():
        metadata["protocol_id"] = protocol_id.strip()
    if isinstance(protocol_version, str) and protocol_version.strip():
        metadata["protocol_version"] = protocol_version.strip()
    return metadata


def _record_protocol_value(record: dict[str, Any], key: str) -> str | None:
    metadata = record.get("metadata")
    if isinstance(metadata, dict):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    protocol = record.get("protocol")
    if isinstance(protocol, dict):
        protocol_key = "id" if key == "protocol_id" else "version"
        value = protocol.get(protocol_key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
