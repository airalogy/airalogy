import pytest
from airalogy.types import ATCG


def test_valid_atcg():
    s = ATCG("ATCGGATC")
    assert str(s) == "ATCGGATC"


def test_invalid_atcg():
    with pytest.raises(ValueError):
        ATCG("ATCX")
    with pytest.raises(ValueError):
        ATCG("atcg")  # lower case not allowed
    with pytest.raises(TypeError):
        ATCG(123)


def test_complement():
    s = ATCG("ATCG")
    assert s.complement() == "TAGC"
    s2 = ATCG("AATTCCGG")
    assert s2.complement() == "TTAAGGCC"


def test_pydantic_model_with_atcg():
    from pydantic import BaseModel, ValidationError

    class DNA(BaseModel):
        seq: ATCG

    # Valid case
    m = DNA(seq="ATCGGATC")
    assert isinstance(m.seq, ATCG)
    assert m.seq == "ATCGGATC"

    # Invalid case
    with pytest.raises(ValidationError):
        DNA(seq="ATCX")
    with pytest.raises(ValidationError):
        DNA(seq=123)

    # Schema should contain airalogy_built_in_type
    schema = DNA.model_json_schema()
    assert schema["properties"]["seq"]["airalogy_type"] == "ATCG"
