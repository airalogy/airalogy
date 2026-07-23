"""Deterministic JSON Schema compatibility comparison for Protocol releases."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

Compatibility = Literal["compatible", "conditional", "breaking", "unknown"]
SemverBump = Literal["patch", "minor", "major"]

_ANNOTATION_KEYS = {"title", "description", "examples", "$comment", "deprecated"}
_CONSTRAINT_KEYS = {
    "additionalProperties",
    "const",
    "default",
    "minimum",
    "exclusiveMinimum",
    "maximum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "format",
    "multipleOf",
}


@dataclass(frozen=True)
class SchemaChange:
    path: str
    kind: str
    classification: Compatibility
    message: str
    before: Any = None
    after: Any = None


@dataclass(frozen=True)
class SchemaCompatibilityReport:
    status: Compatibility
    recommended_bump: SemverBump
    changes: tuple[SchemaChange, ...]

    def model_dump(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "recommended_bump": self.recommended_bump,
            "changes": [asdict(change) for change in self.changes],
        }


def _property_map(schema: dict[str, Any]) -> dict[str, Any]:
    properties = schema.get("properties", {})
    return properties if isinstance(properties, dict) else {}


def _required(schema: dict[str, Any]) -> set[str]:
    value = schema.get("required", [])
    return {item for item in value if isinstance(item, str)} if isinstance(value, list) else set()


def _type_signature(schema: Any) -> Any:
    if not isinstance(schema, dict):
        return None
    if "$ref" in schema:
        return ("$ref", schema["$ref"])
    any_of = schema.get("anyOf")
    if isinstance(any_of, list):
        return ("anyOf", tuple(sorted((repr(_type_signature(item)) for item in any_of))))
    one_of = schema.get("oneOf")
    if isinstance(one_of, list):
        return ("oneOf", tuple(sorted((repr(_type_signature(item)) for item in one_of))))
    return schema.get("type")


def _has_default(schema: Any) -> bool:
    return isinstance(schema, dict) and "default" in schema


def _path(prefix: str, suffix: str) -> str:
    return f"{prefix}.{suffix}" if prefix else suffix


def _compare_schema_node(
    previous: dict[str, Any],
    current: dict[str, Any],
    *,
    path: str,
    changes: list[SchemaChange],
) -> None:
    previous_properties = _property_map(previous)
    current_properties = _property_map(current)
    previous_required = _required(previous)
    current_required = _required(current)

    before_type = _type_signature(previous)
    after_type = _type_signature(current)
    if before_type != after_type:
        changes.append(
            SchemaChange(
                _path(path, "type"),
                "type_changed",
                "breaking",
                f'Schema at "{path or "$"}" changed type.',
                before_type,
                after_type,
            )
        )

    before_enum = previous.get("enum")
    after_enum = current.get("enum")
    if isinstance(before_enum, list) and isinstance(after_enum, list) and before_enum != after_enum:
        removed = [item for item in before_enum if item not in after_enum]
        changes.append(
            SchemaChange(
                _path(path, "enum"),
                "enum_narrowed" if removed else "enum_expanded",
                "breaking" if removed else "compatible",
                (
                    f'Schema at "{path or "$"}" no longer accepts existing enum values.'
                    if removed
                    else f'Schema at "{path or "$"}" accepts additional enum values.'
                ),
                before_enum,
                after_enum,
            )
        )

    for key in sorted(_CONSTRAINT_KEYS):
        if previous.get(key) != current.get(key):
            changes.append(
                SchemaChange(
                    _path(path, key),
                    "constraint_changed",
                    "conditional",
                    f'Constraint "{key}" changed at "{path or "$"}"; existing values require validation.',
                    previous.get(key),
                    current.get(key),
                )
            )

    for key in sorted(_ANNOTATION_KEYS):
        if previous.get(key) != current.get(key):
            changes.append(
                SchemaChange(
                    _path(path, key),
                    "annotation_changed",
                    "compatible",
                    f'Annotation "{key}" changed at "{path or "$"}".',
                    previous.get(key),
                    current.get(key),
                )
            )

    for field in sorted(previous_properties.keys() - current_properties.keys()):
        field_path = _path(_path(path, "properties"), field)
        changes.append(
            SchemaChange(
                field_path,
                "field_removed",
                "breaking",
                f'Field "{field_path}" was removed.',
                previous_properties[field],
                None,
            )
        )

    for field in sorted(current_properties.keys() - previous_properties.keys()):
        field_path = _path(_path(path, "properties"), field)
        required = field in current_required
        has_default = _has_default(current_properties[field])
        classification: Compatibility = (
            "breaking" if required and not has_default else "conditional" if required else "compatible"
        )
        changes.append(
            SchemaChange(
                field_path,
                "field_added",
                classification,
                (
                    f'Required field "{field_path}" was added without a default.'
                    if classification == "breaking"
                    else f'Required field "{field_path}" was added with an explicit default.'
                    if classification == "conditional"
                    else f'Optional field "{field_path}" was added.'
                ),
                None,
                current_properties[field],
            )
        )

    for field in sorted(previous_properties.keys() & current_properties.keys()):
        before = previous_properties[field]
        after = current_properties[field]
        field_path = _path(_path(path, "properties"), field)
        if isinstance(before, dict) and isinstance(after, dict):
            _compare_schema_node(before, after, path=field_path, changes=changes)
        elif before != after:
            changes.append(
                SchemaChange(
                    field_path,
                    "schema_changed",
                    "unknown",
                    f'Field "{field_path}" has an unsupported schema change.',
                    before,
                    after,
                )
            )

    for field in sorted((current_required - previous_required) & previous_properties.keys()):
        field_path = _path(_path(path, "required"), field)
        changes.append(
            SchemaChange(
                field_path,
                "field_became_required",
                "conditional" if _has_default(current_properties.get(field)) else "breaking",
                f'Existing field "{field_path}" became required.',
                False,
                True,
            )
        )
    for field in sorted((previous_required - current_required) & current_properties.keys()):
        field_path = _path(_path(path, "required"), field)
        changes.append(
            SchemaChange(
                field_path,
                "field_became_optional",
                "compatible",
                f'Existing field "{field_path}" became optional.',
                True,
                False,
            )
        )

    before_items = previous.get("items")
    after_items = current.get("items")
    if isinstance(before_items, dict) and isinstance(after_items, dict):
        _compare_schema_node(
            before_items,
            after_items,
            path=_path(path, "items"),
            changes=changes,
        )
    elif before_items != after_items:
        changes.append(
            SchemaChange(
                _path(path, "items"),
                "items_changed",
                "unknown",
                f'Array item Schema changed at "{path or "$"}".',
                before_items,
                after_items,
            )
        )


def compare_json_schemas(
    previous: dict[str, Any],
    current: dict[str, Any],
) -> SchemaCompatibilityReport:
    """Compare Record-facing JSON Schemas and recommend a SemVer bump."""

    changes: list[SchemaChange] = []
    _compare_schema_node(previous, current, path="", changes=changes)

    classifications = {change.classification for change in changes}
    if "breaking" in classifications:
        status: Compatibility = "breaking"
        bump: SemverBump = "major"
    elif "unknown" in classifications:
        status = "unknown"
        bump = "major"
    elif "conditional" in classifications:
        status = "conditional"
        bump = "major"
    elif any(change.kind not in {"annotation_changed"} for change in changes):
        status = "compatible"
        bump = "minor"
    else:
        status = "compatible"
        bump = "patch"

    return SchemaCompatibilityReport(status, bump, tuple(changes))
