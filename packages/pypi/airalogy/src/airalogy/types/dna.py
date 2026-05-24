"""
Built-in types for structured DNA sequence editing.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_DNA_SEQUENCE_PATTERN = re.compile(r"^[ACGTRYSWKMBDHVN]*$")
_DNA_COMPLEMENT = str.maketrans(
    "ACGTRYSWKMBDHVN",
    "TGCAYRSWMKVHDBN",
)


def _normalize_sequence_text(value: str) -> str:
    return re.sub(r"\s+", "", value).upper()


def _normalize_qualifier_rows(value: object) -> list[object]:
    if value is None:
        return []

    if isinstance(value, Mapping):
        rows: list[dict[str, str]] = []
        for raw_key, raw_value in value.items():
            key = str(raw_key).strip()
            if not key:
                continue

            values = raw_value if isinstance(raw_value, list) else [raw_value]
            for item in values:
                rows.append({
                    "key": key,
                    "value": "" if item is None else str(item),
                })
        return rows

    if isinstance(value, list):
        return value

    return []


class DNASequenceSegment(BaseModel):
    """
    A GenBank-aligned contiguous location segment.

    Positions are stored as 1-based inclusive coordinates so they map naturally
    to common biology-facing formats such as GenBank.
    """

    model_config = ConfigDict(extra="forbid")

    start: int = Field(
        ge=1,
        description="1-based inclusive start position.",
        examples=[121],
    )
    end: int = Field(
        ge=1,
        description="1-based inclusive end position.",
        examples=[980],
    )
    partial_start: bool = Field(
        default=False,
        description="Whether the segment has a partial or fuzzy start boundary.",
    )
    partial_end: bool = Field(
        default=False,
        description="Whether the segment has a partial or fuzzy end boundary.",
    )

    @model_validator(mode="after")
    def _validate_range(self) -> "DNASequenceSegment":
        if self.end < self.start:
            raise ValueError("segment end must be greater than or equal to start")
        return self


class DNASequenceQualifier(BaseModel):
    """
    A GenBank-style qualifier entry.
    """

    model_config = ConfigDict(extra="forbid")

    key: str = Field(
        description="Qualifier key, for example gene, product, label, or note.",
        min_length=1,
        examples=["gene"],
    )
    value: str = Field(
        default="",
        description="Qualifier value stored as text.",
        examples=["lacZ"],
    )

    @field_validator("key", mode="before")
    @classmethod
    def _coerce_key(cls, value: object) -> str:
        if not isinstance(value, str):
            value = str(value)
        return value.strip()

    @field_validator("value", mode="before")
    @classmethod
    def _coerce_value(cls, value: object) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            return str(value)
        return value


class DNASequenceAnnotation(BaseModel):
    """
    A GenBank-aligned editable DNA annotation.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        description="Stable annotation id.",
        min_length=1,
        examples=["feat_lacz"],
    )
    name: str = Field(
        description="Human-readable annotation label.",
        min_length=1,
        examples=["lacZ CDS"],
    )
    type: str = Field(
        default="misc_feature",
        description="Feature type, such as gene, CDS, promoter, or misc_feature.",
        min_length=1,
        examples=["CDS"],
    )
    strand: Literal[1, -1] = Field(
        default=1,
        description="Feature strand direction. 1 is forward, -1 is reverse.",
    )
    color: str | None = Field(
        default=None,
        description="Optional hex color used by the frontend editor.",
        examples=["#2563eb"],
    )
    segments: list[DNASequenceSegment] = Field(
        default_factory=list,
        description="One or more contiguous segments for this feature location.",
    )
    qualifiers: list[DNASequenceQualifier] = Field(
        default_factory=list,
        description="GenBank-style qualifier rows such as gene, product, label, or note.",
    )

    @model_validator(mode="before")
    @classmethod
    def _upgrade_legacy_shape(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value

        data = dict(value)

        if "segments" not in data and ("start" in data or "end" in data):
            start = data.pop("start", 1)
            end = data.pop("end", start)
            partial_start = data.pop("partial_start", False)
            partial_end = data.pop("partial_end", False)
            data["segments"] = [{
                "start": start,
                "end": end,
                "partial_start": partial_start,
                "partial_end": partial_end,
            }]

        qualifiers = _normalize_qualifier_rows(data.get("qualifiers"))
        note = data.pop("note", None)
        if note is not None and str(note).strip():
            qualifiers.append({"key": "note", "value": str(note)})
        data["qualifiers"] = qualifiers
        return data

    @model_validator(mode="after")
    def _validate_range(self) -> "DNASequenceAnnotation":
        if not self.segments:
            raise ValueError("annotation must contain at least one segment")
        return self


class DNASequence(BaseModel):
    """
    Structured DNA sequence value used by Airalogy's dedicated sequence editor.

    This model intentionally stays simpler than full GenBank flatfiles while
    preserving the core pieces needed for practical import/export alignment:
    multi-segment feature locations, partial flags, and qualifier rows.
    """

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "airalogy_type": "DNASequence",
            "airalogy_storage_kind": "structured",
            "airalogy_ui": "dna-sequence",
        },
    )

    format: Literal["airalogy_dna_v1"] = Field(
        default="airalogy_dna_v1",
        description="Internal Airalogy DNA payload format version.",
    )
    name: str | None = Field(
        default=None,
        description="Optional human-readable sequence name, for example a plasmid name.",
        examples=["pUC19"],
    )
    sequence: str = Field(
        default="",
        description=(
            "DNA sequence stored as uppercase contiguous IUPAC DNA letters. "
            "Whitespace is removed automatically during validation."
        ),
        examples=["ATGCGTNNNATGC"],
    )
    topology: Literal["linear", "circular"] = Field(
        default="linear",
        description="Sequence topology.",
    )
    annotations: list[DNASequenceAnnotation] = Field(
        default_factory=list,
        description=(
            "Sequence annotations with GenBank-aligned segments and qualifier rows."
        ),
    )

    @field_validator("name", mode="before")
    @classmethod
    def _coerce_name(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        normalized = re.sub(r"\s+", " ", value).strip()
        return normalized or None

    @field_validator("sequence", mode="before")
    @classmethod
    def _coerce_sequence(cls, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError("DNASequence.sequence must be a string.")
        return _normalize_sequence_text(value)

    @field_validator("sequence")
    @classmethod
    def _validate_sequence(cls, value: str) -> str:
        if not _DNA_SEQUENCE_PATTERN.fullmatch(value):
            raise ValueError(
                "DNASequence.sequence may only contain IUPAC DNA letters "
                "(A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N)."
            )
        return value

    @model_validator(mode="after")
    def _validate_annotations(self) -> "DNASequence":
        if not self.sequence and self.annotations:
            raise ValueError("DNASequence.annotations require a non-empty sequence.")

        sequence_length = len(self.sequence)
        for annotation in self.annotations:
            for segment in annotation.segments:
                if segment.end > sequence_length:
                    raise ValueError(
                        f'annotation "{annotation.id}" segment ends at {segment.end}, '
                        f"which exceeds sequence length {sequence_length}"
                    )
        return self

    @property
    def length(self) -> int:
        return len(self.sequence)

    def complement(self) -> str:
        return self.sequence.translate(_DNA_COMPLEMENT)

    def reverse_complement(self) -> str:
        return self.complement()[::-1]
