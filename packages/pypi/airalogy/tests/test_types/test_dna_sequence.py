import pytest
from pydantic import BaseModel, ValidationError

from airalogy.types import DNASequence
from airalogy.types.dna import DNASequenceAnnotation, DNASequenceQualifier


def test_dna_sequence_normalizes_whitespace_and_case():
    value = DNASequence(sequence="atgc nn\nry")

    assert value.sequence == "ATGCNNRY"
    assert value.length == 8


def test_dna_sequence_normalizes_optional_name():
    value = DNASequence(name="  pUC19  copy  ", sequence="ATGC")

    assert value.name == "pUC19 copy"

    unnamed = DNASequence(name="   ", sequence="ATGC")
    assert unnamed.name is None


def test_dna_sequence_rejects_invalid_letters():
    with pytest.raises(ValidationError) as error:
        DNASequence(sequence="ATGX")
    assert "IUPAC DNA letters" in str(error.value)


def test_dna_sequence_validates_annotation_bounds():
    with pytest.raises(ValidationError) as error:
        DNASequence(
            sequence="ATGC",
            annotations=[
                DNASequenceAnnotation(
                    id="feat_1",
                    name="feature",
                    segments=[{"start": 1, "end": 5}],
                )
            ],
        )
    assert "exceeds sequence length" in str(error.value)


def test_dna_sequence_migrates_legacy_annotation_shape():
    value = DNASequence(
        sequence="ATGC",
        annotations=[
            {
                "id": "feat_1",
                "name": "feature",
                "type": "CDS",
                "start": 1,
                "end": 4,
                "note": "legacy note",
            }
        ],
    )

    annotation = value.annotations[0]
    assert len(annotation.segments) == 1
    assert annotation.segments[0].start == 1
    assert annotation.segments[0].end == 4
    assert annotation.qualifiers == [DNASequenceQualifier(key="note", value="legacy note")]


def test_dna_sequence_normalizes_qualifier_mappings():
    value = DNASequence(
        sequence="ATGC",
        annotations=[
            {
                "id": "feat_1",
                "name": "feature",
                "segments": [{"start": 1, "end": 4}],
                "qualifiers": {
                    "gene": ["lacZ"],
                    "product": "beta-galactosidase",
                },
            }
        ],
    )

    assert value.annotations[0].qualifiers == [
        DNASequenceQualifier(key="gene", value="lacZ"),
        DNASequenceQualifier(key="product", value="beta-galactosidase"),
    ]


def test_dna_sequence_schema_contains_airalogy_metadata():
    class Model(BaseModel):
        dna: DNASequence

    schema = Model.model_json_schema()
    dna_schema = schema["$defs"]["DNASequence"]
    assert dna_schema["airalogy_type"] == "DNASequence"
    assert dna_schema["airalogy_storage_kind"] == "structured"
    assert dna_schema["airalogy_ui"] == "dna-sequence"


def test_dna_sequence_helpers():
    value = DNASequence(sequence="ATGCRY")

    assert value.complement() == "TACGYR"
    assert value.reverse_complement() == "RYGCAT"
