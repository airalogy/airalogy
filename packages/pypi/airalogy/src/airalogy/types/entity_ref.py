"""
Built-in type for references to external or protocol-backed entities.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EntityRef(BaseModel):
    """
    Reference to a named entity in a connector-backed source.

    `entity` is the entity namespace, such as plasmid or strain. `id` is the
    stable identifier inside that namespace/source. Extra fields are allowed so
    hosts can retain display snapshots or source-specific reference metadata.
    """

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "airalogy_type": "EntityRef",
        },
    )

    entity: str = Field(
        description="Entity namespace, for example plasmid, strain, sample, or protocol.",
        min_length=1,
        examples=["plasmid"],
    )
    id: str = Field(
        description="Stable entity id inside the connector source.",
        min_length=1,
        examples=["pUC19"],
    )
    source: str | None = Field(
        default=None,
        description="Connector id or source namespace that resolved this entity.",
        examples=["lab_plasmid_registry"],
    )
    label: str | None = Field(
        default=None,
        description="Human-readable entity label captured for display.",
        examples=["pUC19 cloning vector"],
    )
    version: str | int | None = Field(
        default=None,
        description="Optional entity version or revision identifier.",
        examples=["v3"],
    )
    snapshot: dict[str, Any] | None = Field(
        default=None,
        description="Optional lightweight display snapshot copied from the source.",
    )

    @field_validator("entity", "id", "source", "label", mode="before")
    @classmethod
    def _coerce_string(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return value.strip()

    @classmethod
    def __class_getitem__(cls, item: object) -> type["EntityRef"]:
        """
        Keep AIMD annotations such as EntityRef["plasmid"] importable.

        The entity namespace is still stored in the value and in AIMD field
        metadata, not encoded as a distinct Python type.
        """
        return cls
