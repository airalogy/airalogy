"""Protocol-kind and ResourceRef metadata contracts shared by Airalogy hosts."""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, field_validator


class ProtocolKind(StrEnum):
    EXPERIMENT = "experiment"
    RESOURCE_DEFINITION = "resource_definition"


class ResourceRole(StrEnum):
    INPUT = "input"
    OUTPUT = "output"
    REFERENCE = "reference"
    EQUIPMENT = "equipment"


class ProtocolMetadata(BaseModel):
    """Protocol metadata relevant to shared AIMD behavior."""

    model_config = ConfigDict(extra="allow")

    kind: ProtocolKind = ProtocolKind.EXPERIMENT


class ResourceFieldContract(BaseModel):
    """Normalized metadata for one ResourceRef variable."""

    model_config = ConfigDict(extra="forbid")

    resource_role: ResourceRole
    quantity_field: str | None = None
    container_required: bool = False
    booking_required: bool = False

    @field_validator("quantity_field", mode="before")
    @classmethod
    def _normalize_quantity_field(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


class ResourceValidationIssue(BaseModel):
    code: str
    message: str
    field: str | None = None
    path: str | None = None


RESOURCE_DEFINITION_FORBIDDEN_FIELDS = {
    "assigner",
    "check",
    "client_assigner",
    "collector",
    "collectors",
    "quiz",
    "step",
    "workflow",
    "workflow_assigner",
}

_RESOURCE_REF_PATTERN = re.compile(
    r"(^|[\[|,\s])ResourceRef(?:\s*\[[^\]]+\])?(?=$|[\]|,\s])"
)
_NUMERIC_PATTERN = re.compile(
    r"(^|[\[|,\s])(int|float|Decimal|PositiveInt|PositiveFloat|NonNegativeInt|NonNegativeFloat)(?=$|[\]|,\s])"
)


def normalize_protocol_kind(value: object) -> ProtocolKind:
    if value is None or value == "":
        return ProtocolKind.EXPERIMENT
    try:
        return ProtocolKind(value)
    except ValueError as error:
        raise ValueError(
            'Protocol kind must be "experiment" or "resource_definition".'
        ) from error


def _value(item: object, name: str, default: Any = None) -> Any:
    if isinstance(item, Mapping):
        return item.get(name, default)
    return getattr(item, name, default)


def _templates(parsed_fields: Mapping[str, Any]) -> Mapping[str, Any]:
    nested = parsed_fields.get("templates")
    return nested if isinstance(nested, Mapping) else parsed_fields


def _collect_variables(parsed_fields: Mapping[str, Any]) -> dict[str, object]:
    templates = _templates(parsed_fields)
    variables: dict[str, object] = {}
    for key in ("var", "var_definitions", "var_table"):
        for item in templates.get(key, []) or []:
            name = _value(item, "name", _value(item, "id"))
            if isinstance(name, str):
                variables[name] = item
            for subvar in _value(item, "subvars", []) or []:
                subvar_name = _value(subvar, "name", _value(subvar, "id"))
                if isinstance(name, str) and isinstance(subvar_name, str):
                    variables[f"{name}.{subvar_name}"] = subvar
    return variables


def _type_annotation(variable: object) -> str:
    raw = _value(variable, "type_annotation", _value(variable, "type", ""))
    return raw if isinstance(raw, str) else ""


def _resource_metadata(variable: object) -> dict[str, object]:
    kwargs = _value(variable, "kwargs", {})
    if not isinstance(kwargs, Mapping):
        return {}
    return {
        key: kwargs[key]
        for key in (
            "resource_role",
            "quantity_field",
            "container_required",
            "booking_required",
        )
        if key in kwargs
    }


def validate_protocol_contract(
    metadata: ProtocolMetadata | Mapping[str, Any],
    parsed_fields: Mapping[str, Any],
) -> list[ResourceValidationIssue]:
    """Validate Protocol kind restrictions and ResourceRef field metadata."""

    normalized_metadata = (
        metadata
        if isinstance(metadata, ProtocolMetadata)
        else ProtocolMetadata.model_validate(metadata)
    )
    templates = _templates(parsed_fields)
    issues: list[ResourceValidationIssue] = []

    if normalized_metadata.kind == ProtocolKind.RESOURCE_DEFINITION:
        for field_name in sorted(RESOURCE_DEFINITION_FORBIDDEN_FIELDS):
            if templates.get(field_name):
                issues.append(
                    ResourceValidationIssue(
                        code="resource_definition_forbidden_feature",
                        path=field_name,
                        message=(
                            "resource_definition Protocols cannot contain "
                            f"{field_name} fields"
                        ),
                    )
                )

    variables = _collect_variables(parsed_fields)
    for field_name, variable in variables.items():
        metadata_values = _resource_metadata(variable)
        is_resource_ref = bool(
            _RESOURCE_REF_PATTERN.search(_type_annotation(variable))
        )
        if metadata_values and not is_resource_ref:
            issues.append(
                ResourceValidationIssue(
                    code="resource_metadata_requires_resource_ref",
                    field=field_name,
                    message=(
                        f"{field_name} uses resource metadata but is not typed as ResourceRef"
                    ),
                )
            )
            continue
        if not is_resource_ref:
            continue
        if "resource_role" not in metadata_values:
            issues.append(
                ResourceValidationIssue(
                    code="resource_role_required",
                    field=field_name,
                    message=f"{field_name} must declare resource_role",
                )
            )
            continue
        try:
            contract = ResourceFieldContract.model_validate(metadata_values)
        except ValueError as error:
            issues.append(
                ResourceValidationIssue(
                    code="invalid_resource_metadata",
                    field=field_name,
                    message=str(error),
                )
            )
            continue
        if (
            contract.booking_required
            and contract.resource_role != ResourceRole.EQUIPMENT
        ):
            issues.append(
                ResourceValidationIssue(
                    code="booking_requires_equipment_role",
                    field=field_name,
                    message=(
                        f"{field_name} can require a booking only when "
                        "resource_role=equipment"
                    ),
                )
            )
        if (
            contract.container_required
            and contract.resource_role == ResourceRole.EQUIPMENT
        ):
            issues.append(
                ResourceValidationIssue(
                    code="equipment_cannot_require_container",
                    field=field_name,
                    message=(
                        f"{field_name} cannot require an inventory container when "
                        "resource_role=equipment"
                    ),
                )
            )
        if not contract.quantity_field:
            continue
        target = variables.get(contract.quantity_field)
        if target is None and "." not in contract.quantity_field:
            table_prefix = (
                field_name.rsplit(".", 1)[0] if "." in field_name else None
            )
            if table_prefix:
                target = variables.get(f"{table_prefix}.{contract.quantity_field}")
        if target is None:
            issues.append(
                ResourceValidationIssue(
                    code="unknown_quantity_field",
                    field=field_name,
                    message=(
                        f"{field_name} references unknown quantity_field "
                        f"{contract.quantity_field}"
                    ),
                )
            )
        elif not _NUMERIC_PATTERN.search(_type_annotation(target)):
            issues.append(
                ResourceValidationIssue(
                    code="quantity_field_must_be_numeric",
                    field=field_name,
                    message=(
                        f"{field_name} quantity_field {contract.quantity_field} "
                        "must use a numeric type"
                    ),
                )
            )
    return issues


def validate_protocol_kind(
    metadata: dict[str, Any],
    fields: dict[str, Any] | None = None,
) -> list[str]:
    """Backward-compatible string-only Protocol kind validator."""

    try:
        kind = normalize_protocol_kind(metadata.get("kind"))
    except ValueError as error:
        return [str(error)]
    if kind != ProtocolKind.RESOURCE_DEFINITION:
        return []
    templates = _templates(fields or {})
    return [
        f'Resource definition Protocols must not contain "{field_name}" fields.'
        for field_name in sorted(RESOURCE_DEFINITION_FORBIDDEN_FIELDS)
        if templates.get(field_name)
    ]
