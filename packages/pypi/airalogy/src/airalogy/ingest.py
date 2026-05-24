from __future__ import annotations

import csv
import json
import tomllib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping

from pydantic import BaseModel, ValidationError as PydanticValidationError

from .markdown import generate_model, parse_aimd
from .markdown.model_sync import (
    load_var_model_from_path,
    merge_var_models,
    validate_var_model_compatible_with_aimd_vars,
)
from .record.hash import get_data_sha1
from .record.validator import validate_record_quiz_answers

InputFormat = Literal["auto", "csv", "tsv", "json", "jsonl"]
OutputFormat = Literal["auto", "json", "jsonl"]

_STEP_CHECK_FIELDS = {"checked", "annotation"}
_TOP_LEVEL_FIELDS = {"airalogy_record_id", "record_id", "record_version"}


@dataclass(frozen=True)
class ImportErrorDetail:
    """A row-level import error."""

    row_number: int
    message: str
    column: str | None = None

    def __str__(self) -> str:
        location = f"row {self.row_number}"
        if self.column:
            location += f", column {self.column}"
        return f"{location}: {self.message}"


@dataclass(frozen=True)
class ImportResult:
    """Result returned by `import_records`."""

    records: list[dict[str, Any]]
    errors: list[ImportErrorDetail]

    @property
    def ok(self) -> bool:
        return not self.errors

    def error_messages(self) -> list[str]:
        return [str(error) for error in self.errors]


@dataclass(frozen=True)
class _ProtocolContext:
    parsed_aimd: dict[str, Any]
    var_model: type[BaseModel]
    protocol_metadata: dict[str, Any]


def import_records(
    *,
    protocol_dir: str | Path | None = None,
    aimd_content: str | None = None,
    input_path: str | Path | None = None,
    rows: Iterable[Mapping[str, Any]] | None = None,
    input_format: InputFormat = "auto",
    output_path: str | Path | None = None,
    output_format: OutputFormat = "auto",
    force: bool = False,
    base_metadata: Mapping[str, Any] | None = None,
    var_model: type[BaseModel] | None = None,
    allow_extra_var_fields: bool = False,
    require_complete_quiz: bool = False,
    include_template_defaults: bool = True,
    generate_record_ids: bool = True,
    validate_model_sync: bool = True,
    record_version: int = 1,
    empty_values: Iterable[str] = ("",),
) -> ImportResult:
    """
    Import tabular or JSON rows into Airalogy Record JSON objects.

    Each input row becomes one record. Unprefixed columns are imported as
    `data.var.<column>`. Prefixed columns can target `var`, `quiz`, `step`,
    `check`, `metadata`, or top-level record fields.
    """
    if input_path is None and rows is None:
        raise ValueError("Either input_path or rows must be provided.")
    if input_path is not None and rows is not None:
        raise ValueError("Provide only one of input_path or rows.")
    if record_version < 1:
        raise ValueError("record_version must be a positive integer.")

    context = _load_protocol_context(
        protocol_dir=protocol_dir,
        aimd_content=aimd_content,
        var_model=var_model,
        validate_model_sync=validate_model_sync,
    )
    input_rows = (
        _load_rows_from_file(Path(input_path), input_format)
        if input_path is not None
        else _normalize_rows(rows or [])
    )
    if not input_rows:
        raise ValueError("No input rows found.")

    empty_value_set = {str(value) for value in empty_values}
    records: list[dict[str, Any]] = []
    errors: list[ImportErrorDetail] = []

    for row_number, row in enumerate(input_rows, start=1):
        record, row_errors = _row_to_record(
            row=row,
            row_number=row_number,
            context=context,
            base_metadata=dict(base_metadata or {}),
            allow_extra_var_fields=allow_extra_var_fields,
            require_complete_quiz=require_complete_quiz,
            include_template_defaults=include_template_defaults,
            generate_record_ids=generate_record_ids,
            record_version=record_version,
            empty_values=empty_value_set,
        )
        if row_errors:
            errors.extend(row_errors)
        else:
            records.append(record)

    result = ImportResult(records=records, errors=errors)
    if output_path is not None and result.ok:
        _write_records(records, Path(output_path), output_format, force=force)
    return result


def _load_protocol_context(
    *,
    protocol_dir: str | Path | None,
    aimd_content: str | None,
    var_model: type[BaseModel] | None,
    validate_model_sync: bool,
) -> _ProtocolContext:
    protocol_path = Path(protocol_dir) if protocol_dir is not None else None

    if aimd_content is None:
        if protocol_path is None:
            raise ValueError("Either protocol_dir or aimd_content must be provided.")
        aimd_path = protocol_path / "protocol.aimd"
        if not aimd_path.is_file():
            raise ValueError(
                f"Protocol directory '{protocol_path}' must contain protocol.aimd."
            )
        aimd_content = aimd_path.read_text(encoding="utf-8")

    parsed_aimd = parse_aimd(aimd_content)
    model = var_model or _load_var_model(protocol_path, aimd_content)
    if not isinstance(model, type) or not issubclass(model, BaseModel):
        raise TypeError("var_model must be a pydantic BaseModel subclass.")
    if validate_model_sync:
        validate_var_model_compatible_with_aimd_vars(
            parsed_aimd["templates"]["var"],
            model,
        )

    return _ProtocolContext(
        parsed_aimd=parsed_aimd,
        var_model=model,
        protocol_metadata=_load_protocol_metadata(protocol_path),
    )


def _load_var_model(protocol_dir: Path | None, aimd_content: str) -> type[BaseModel]:
    if protocol_dir is not None:
        model_path = protocol_dir / "model.py"
        if model_path.is_file():
            aimd_model = _generate_var_model(aimd_content)
            override_model = load_var_model_from_path(model_path)
            return merge_var_models(aimd_model, override_model)

    return _generate_var_model(aimd_content)


def _generate_var_model(aimd_content: str) -> type[BaseModel]:
    namespace: dict[str, Any] = {"__name__": "_airalogy_ingest_generated_model"}
    exec(
        compile(generate_model(aimd_content), "<airalogy generated VarModel>", "exec"),
        namespace,
    )
    model = namespace.get("VarModel")
    if model is None:
        raise ValueError("Generated model code did not define VarModel.")
    return model


def _load_protocol_metadata(protocol_dir: Path | None) -> dict[str, Any]:
    if protocol_dir is None:
        return {}

    metadata: dict[str, Any] = {}
    protocol_toml = protocol_dir / "protocol.toml"
    if not protocol_toml.is_file():
        metadata["protocol_id"] = protocol_dir.name
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


def _load_rows_from_file(path: Path, input_format: InputFormat) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ValueError(f"Input file '{path}' not found.")

    resolved_format = _resolve_input_format(path, input_format)
    if resolved_format in {"csv", "tsv"}:
        delimiter = "\t" if resolved_format == "tsv" else ","
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=delimiter)
            return _normalize_rows(reader)

    if resolved_format == "jsonl":
        rows: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise ValueError(f"JSONL line {line_number} must be an object.")
                rows.append(dict(value))
        return rows

    parsed = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(parsed, dict) and isinstance(parsed.get("records"), list):
        return _normalize_rows(parsed["records"])
    if isinstance(parsed, dict):
        return [dict(parsed)]
    if isinstance(parsed, list):
        return _normalize_rows(parsed)
    raise ValueError(
        "JSON input must be an object, a list of objects, or {'records': [...]}."
    )


def _resolve_input_format(path: Path, input_format: InputFormat) -> str:
    if input_format != "auto":
        return input_format
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return "csv"
    if suffix == ".tsv":
        return "tsv"
    if suffix == ".jsonl":
        return "jsonl"
    if suffix == ".json":
        return "json"
    raise ValueError(f"Cannot infer input format from '{path.suffix}'.")


def _normalize_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    normalized_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, Mapping):
            raise ValueError(f"Input row {index} must be a mapping.")
        if None in row:
            raise ValueError(f"Input row {index} contains extra unnamed columns.")
        normalized_rows.append(dict(row))
    return normalized_rows


def _row_to_record(
    *,
    row: Mapping[str, Any],
    row_number: int,
    context: _ProtocolContext,
    base_metadata: dict[str, Any],
    allow_extra_var_fields: bool,
    require_complete_quiz: bool,
    include_template_defaults: bool,
    generate_record_ids: bool,
    record_version: int,
    empty_values: set[str],
) -> tuple[dict[str, Any], list[ImportErrorDetail]]:
    sections, metadata, top_level, errors = _split_row(row, row_number, empty_values)
    if errors:
        return {}, errors

    if include_template_defaults:
        _apply_template_defaults(sections, context.parsed_aimd)

    validated_var, var_errors = _validate_var_data(
        sections["var"],
        context.var_model,
        row_number=row_number,
        allow_extra_var_fields=allow_extra_var_fields,
    )
    if var_errors:
        errors.extend(var_errors)
    else:
        sections["var"] = validated_var

    errors.extend(
        _validate_quiz_data(
            sections["quiz"],
            context.parsed_aimd,
            row_number=row_number,
            require_complete_quiz=require_complete_quiz,
        )
    )
    errors.extend(
        _validate_step_data(sections["step"], context.parsed_aimd, row_number)
    )
    errors.extend(
        _validate_check_data(sections["check"], context.parsed_aimd, row_number)
    )
    if errors:
        return {}, errors

    data = {key: value for key, value in sections.items() if value}
    if "var" not in data:
        data["var"] = {}

    record: dict[str, Any] = {
        "metadata": {
            **context.protocol_metadata,
            **base_metadata,
            **metadata,
        },
        "data": data,
    }
    if "record_version" in top_level:
        try:
            normalized_record_version = _normalize_record_version(
                top_level["record_version"]
            )
        except ValueError as exc:
            return {}, [
                ImportErrorDetail(row_number, str(exc), column="record_version")
            ]
    else:
        normalized_record_version = record_version

    if generate_record_ids:
        record["record_id"] = str(top_level.get("record_id") or uuid.uuid4())
    elif "record_id" in top_level:
        record["record_id"] = top_level["record_id"]

    if "airalogy_record_id" in top_level:
        record["airalogy_record_id"] = top_level["airalogy_record_id"]
    record["record_version"] = normalized_record_version
    record["metadata"]["sha1"] = get_data_sha1(record)
    return record, []


def _normalize_record_version(value: Any) -> int:
    if isinstance(value, bool):
        raise ValueError("record_version must be a positive integer.")
    if isinstance(value, int):
        version = value
    elif isinstance(value, str) and value.strip().isdigit():
        version = int(value.strip())
    else:
        raise ValueError("record_version must be a positive integer.")
    if version < 1:
        raise ValueError("record_version must be a positive integer.")
    return version


def _split_row(
    row: Mapping[str, Any],
    row_number: int,
    empty_values: set[str],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, Any],
    dict[str, Any],
    list[ImportErrorDetail],
]:
    sections: dict[str, dict[str, Any]] = {
        "var": {},
        "quiz": {},
        "step": {},
        "check": {},
    }
    metadata: dict[str, Any] = {}
    top_level: dict[str, Any] = {}
    errors: list[ImportErrorDetail] = []

    for raw_column, raw_value in row.items():
        column = str(raw_column).strip()
        if not column:
            continue
        if _is_empty_value(raw_value, empty_values):
            continue

        try:
            value = _parse_cell_value(raw_value)
        except ValueError as exc:
            errors.append(ImportErrorDetail(row_number, str(exc), column=column))
            continue

        parts = column.split(".")
        if parts[0] == "data":
            parts = parts[1:]
            if not parts:
                errors.append(
                    ImportErrorDetail(
                        row_number,
                        "Missing data section.",
                        column=column,
                    )
                )
                continue

        section = parts[0]
        if section in _TOP_LEVEL_FIELDS:
            if len(parts) != 1:
                errors.append(
                    ImportErrorDetail(
                        row_number,
                        "Top-level record fields cannot have nested paths.",
                        column=column,
                    )
                )
                continue
            top_level[section] = value
        elif section == "metadata":
            if len(parts) < 2:
                errors.append(
                    ImportErrorDetail(
                        row_number,
                        "Missing metadata field.",
                        column=column,
                    )
                )
                continue
            metadata[".".join(parts[1:])] = value
        elif section in {"var", "quiz"}:
            if len(parts) != 2:
                errors.append(
                    ImportErrorDetail(
                        row_number,
                        f"{section} columns must use {section}.<field_id>.",
                        column=column,
                    )
                )
                continue
            sections[section][parts[1]] = value
        elif section in {"step", "check"}:
            if len(parts) != 3 or parts[2] not in _STEP_CHECK_FIELDS:
                errors.append(
                    ImportErrorDetail(
                        row_number,
                        f"{section} columns must use {section}.<id>.checked "
                        f"or {section}.<id>.annotation.",
                        column=column,
                    )
                )
                continue
            sections[section].setdefault(parts[1], {})[parts[2]] = value
        else:
            sections["var"][column] = value

    return sections, metadata, top_level, errors


def _is_empty_value(value: Any, empty_values: set[str]) -> bool:
    return isinstance(value, str) and value.strip() in empty_values


def _parse_cell_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    stripped = value.strip()
    lowered = stripped.lower()
    if lowered in {"true", "false", "null"}:
        return json.loads(lowered)
    if stripped.startswith(("{", "[")):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON cell value: {exc.msg}") from exc
    return value


def _validate_var_data(
    var_data: dict[str, Any],
    var_model: type[BaseModel],
    *,
    row_number: int,
    allow_extra_var_fields: bool,
) -> tuple[dict[str, Any], list[ImportErrorDetail]]:
    errors: list[ImportErrorDetail] = []
    model_fields = set(var_model.model_fields)
    unknown_fields = sorted(key for key in var_data if key not in model_fields)
    if unknown_fields and not allow_extra_var_fields:
        for field in unknown_fields:
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "Unknown variable field for this protocol.",
                    column=field,
                )
            )
        return {}, errors

    try:
        model = var_model.model_validate(var_data)
    except PydanticValidationError as exc:
        for error in exc.errors():
            loc = ".".join(str(part) for part in error["loc"])
            errors.append(
                ImportErrorDetail(
                    row_number,
                    error["msg"],
                    column=loc or None,
                )
            )
        return {}, errors

    validated = model.model_dump(mode="json")
    if allow_extra_var_fields:
        for field in unknown_fields:
            validated[field] = var_data[field]
    return validated, []


def _validate_quiz_data(
    quiz_data: dict[str, Any],
    parsed_aimd: dict[str, Any],
    *,
    row_number: int,
    require_complete_quiz: bool,
) -> list[ImportErrorDetail]:
    if not quiz_data and not require_complete_quiz:
        return []

    is_valid, errors = validate_record_quiz_answers(
        {"data": {"quiz": quiz_data}},
        parsed_aimd["templates"]["quiz"],
        require_complete=require_complete_quiz,
    )
    if is_valid:
        return []
    return [ImportErrorDetail(row_number, message, column="quiz") for message in errors]


def _apply_template_defaults(
    sections: dict[str, dict[str, Any]],
    parsed_aimd: dict[str, Any],
) -> None:
    for step in parsed_aimd["templates"]["step"]:
        name = step["name"]
        current = sections["step"].setdefault(name, {})
        current.setdefault("annotation", "")
        current.setdefault("checked", False if step.get("check") else None)

    for check in parsed_aimd["templates"]["check"]:
        name = check["name"]
        current = sections["check"].setdefault(name, {})
        current.setdefault("annotation", "")
        current.setdefault("checked", False)


def _validate_step_data(
    step_data: dict[str, Any],
    parsed_aimd: dict[str, Any],
    row_number: int,
) -> list[ImportErrorDetail]:
    templates = {step["name"]: step for step in parsed_aimd["templates"]["step"]}
    errors: list[ImportErrorDetail] = []
    for step_id, value in step_data.items():
        if step_id not in templates:
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "Unknown step id for this protocol.",
                    column=f"step.{step_id}",
                )
            )
            continue
        if not isinstance(value, dict):
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "Step value must be an object.",
                    column=f"step.{step_id}",
                )
            )
            continue
        errors.extend(
            _validate_annotation_checked_object(
                value,
                row_number=row_number,
                column_prefix=f"step.{step_id}",
                checked_can_be_none=True,
            )
        )
        if not templates[step_id].get("check") and value.get("checked") is not None:
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "checked must be null for a step without check=True.",
                    column=f"step.{step_id}.checked",
                )
            )
    return errors


def _validate_check_data(
    check_data: dict[str, Any],
    parsed_aimd: dict[str, Any],
    row_number: int,
) -> list[ImportErrorDetail]:
    check_ids = {check["name"] for check in parsed_aimd["templates"]["check"]}
    errors: list[ImportErrorDetail] = []
    for check_id, value in check_data.items():
        if check_id not in check_ids:
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "Unknown check id for this protocol.",
                    column=f"check.{check_id}",
                )
            )
            continue
        if not isinstance(value, dict):
            errors.append(
                ImportErrorDetail(
                    row_number,
                    "Check value must be an object.",
                    column=f"check.{check_id}",
                )
            )
            continue
        errors.extend(
            _validate_annotation_checked_object(
                value,
                row_number=row_number,
                column_prefix=f"check.{check_id}",
                checked_can_be_none=False,
            )
        )
    return errors


def _validate_annotation_checked_object(
    value: dict[str, Any],
    *,
    row_number: int,
    column_prefix: str,
    checked_can_be_none: bool,
) -> list[ImportErrorDetail]:
    errors: list[ImportErrorDetail] = []
    unsupported_fields = sorted(set(value) - _STEP_CHECK_FIELDS)
    for field in unsupported_fields:
        errors.append(
            ImportErrorDetail(
                row_number,
                "Unsupported field.",
                column=f"{column_prefix}.{field}",
            )
        )

    if "annotation" in value and not isinstance(value["annotation"], str):
        errors.append(
            ImportErrorDetail(
                row_number,
                "annotation must be a string.",
                column=f"{column_prefix}.annotation",
            )
        )

    checked = value.get("checked")
    if checked is None and checked_can_be_none:
        return errors
    if not isinstance(checked, bool):
        errors.append(
            ImportErrorDetail(
                row_number,
                "checked must be a boolean.",
                column=f"{column_prefix}.checked",
            )
        )
    return errors


def _write_records(
    records: list[dict[str, Any]],
    output_path: Path,
    output_format: OutputFormat,
    *,
    force: bool,
) -> None:
    if output_path.exists() and not force:
        raise FileExistsError(f"Output file '{output_path}' already exists.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_format = _resolve_output_format(output_path, output_format)
    if resolved_format == "jsonl":
        content = "\n".join(
            json.dumps(record, ensure_ascii=False) for record in records
        )
        if content:
            content += "\n"
        output_path.write_text(content, encoding="utf-8")
        return

    output_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _resolve_output_format(path: Path, output_format: OutputFormat) -> str:
    if output_format != "auto":
        return output_format
    if path.suffix.lower() == ".jsonl":
        return "jsonl"
    return "json"


__all__ = [
    "ImportErrorDetail",
    "ImportResult",
    "import_records",
]
