"""Built-in models for observed values and file-backed observation series."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

T = TypeVar("T")


class ObservationSource(BaseModel):
    """Structured provenance for an Observation."""

    model_config = ConfigDict(extra="allow")

    kind: str = Field(min_length=1)
    connector: str | None = None
    collector: str | None = None
    device_id: str | None = None
    actor_id: str | None = None
    reason: str | None = None

    @field_validator(
        "kind", "connector", "collector", "device_id", "actor_id", "reason",
        mode="before",
    )
    @classmethod
    def _normalize_strings(cls, value: object) -> str | None:
        if value is None:
            return None
        return str(value).strip()

    @model_validator(mode="after")
    def _validate_source_kind(self) -> "ObservationSource":
        if self.kind == "collector" and (not self.connector or not self.collector):
            raise ValueError(
                "collector Observation sources require connector and collector"
            )
        if self.kind == "manual" and (not self.collector or not self.reason):
            raise ValueError(
                "manual Observation sources require collector and reason"
            )
        return self


class Observation(BaseModel, Generic[T]):
    """A typed value with observation time, receipt time, and provenance."""

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "airalogy_type": "Observation",
        },
    )

    value: T
    observed_at: datetime
    received_at: datetime
    source: ObservationSource
    unit: str | None = None
    quality: str | None = None
    sequence: int | None = Field(default=None, ge=0)
    metadata: dict[str, Any] | None = None

    @field_validator("observed_at", "received_at")
    @classmethod
    def _require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Observation timestamps must include a timezone")
        return value

    @field_validator("unit", "quality", mode="before")
    @classmethod
    def _normalize_optional_strings(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


class ObservationSeriesRef(BaseModel, Generic[T]):
    """Reference to a file-backed high-volume observation series."""

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "airalogy_type": "ObservationSeriesRef",
        },
    )

    file_id: str | None = None
    source_uri: str | None = None
    blob_id: str | None = None
    filename: str | None = None
    mime_type: str | None = None
    size: int | None = Field(default=None, ge=0)
    sha256: str | None = None
    format: str | None = None
    started_at: datetime
    ended_at: datetime
    point_count: int = Field(ge=0)
    source: ObservationSource
    unit: str | None = None
    summary: dict[str, Any] | None = None

    @field_validator("started_at", "ended_at")
    @classmethod
    def _require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Observation series timestamps must include a timezone")
        return value

    @model_validator(mode="after")
    def _validate_reference(self) -> "ObservationSeriesRef[T]":
        if not self.file_id and not self.source_uri and not self.blob_id:
            raise ValueError(
                "ObservationSeriesRef requires file_id, source_uri, or blob_id"
            )
        if self.ended_at < self.started_at:
            raise ValueError("ObservationSeriesRef ended_at must not precede started_at")
        return self
