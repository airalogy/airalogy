"""Built-in reference type for lab resources, inventory, and equipment."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)


class ResourceRef(BaseModel):
    """
    Stable reference to a Platform-managed resource.

    Quantities are represented by :class:`~decimal.Decimal` in Python and are
    serialized as strings so a Record never loses precision while crossing a
    JSON or JavaScript boundary.
    """

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "airalogy_type": "ResourceRef",
        },
    )

    entity: str = Field(
        default="resource",
        description="Resource entity namespace, for example plasmid or equipment.",
        min_length=1,
        examples=["plasmid"],
    )
    id: str = Field(
        description="Stable, non-reusable resource id.",
        min_length=1,
        examples=["res_01JZX6Q46F2WZB61NTHQVAQ3DE"],
    )
    source: str | None = Field(
        default=None,
        description="Host or registry that resolved the resource.",
        examples=["airalogy-platform"],
    )
    label: str | None = Field(
        default=None,
        description="Human-readable label captured for display.",
        examples=["pUC19"],
    )
    version: str | int | None = Field(
        default=None,
        description="Resource revision observed when the Record was prepared.",
        examples=[3],
    )
    lot_id: str | None = Field(
        default=None,
        description="Selected inventory lot id.",
    )
    container_id: str | None = Field(
        default=None,
        description="Selected physical container id.",
    )
    quantity: Decimal | None = Field(
        default=None,
        ge=0,
        description="Exact requested, consumed, or produced quantity.",
        examples=["0.125"],
    )
    unit: str | None = Field(
        default=None,
        description="UCUM-compatible unit expression for quantity.",
        examples=["mg"],
    )
    reservation_id: str | None = Field(
        default=None,
        description="Optional quantity reservation id.",
    )
    booking_id: str | None = Field(
        default=None,
        description="Optional equipment booking id.",
    )
    snapshot: dict[str, Any] | None = Field(
        default=None,
        description="Optional immutable display snapshot captured by the host.",
    )

    @field_validator(
        "entity",
        "id",
        "source",
        "label",
        "lot_id",
        "container_id",
        "unit",
        "reservation_id",
        "booking_id",
        mode="before",
    )
    @classmethod
    def _coerce_string(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return value.strip()

    @field_validator("unit")
    @classmethod
    def _validate_unit(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value:
            raise ValueError("unit must be a non-empty UCUM-compatible expression")
        if any(character.isspace() or ord(character) < 32 for character in value):
            raise ValueError("unit must not contain whitespace or control characters")
        return value

    @field_serializer("quantity")
    def _serialize_quantity(self, value: Decimal | None) -> str | None:
        return str(value) if value is not None else None

    @classmethod
    def __class_getitem__(cls, item: object) -> type["ResourceRef"]:
        """
        Keep annotations such as ``ResourceRef["plasmid"]`` importable.

        The namespace is persisted in the value and AIMD field metadata rather
        than creating a distinct runtime Python type.
        """

        return cls
