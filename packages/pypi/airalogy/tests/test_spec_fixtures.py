import json
from pathlib import Path

from airalogy.markdown import parse_aimd


MONOREPO_ROOT = Path(__file__).resolve().parents[4]
BASIC_FIXTURE = MONOREPO_ROOT / "spec/fixtures/basic-protocol"


def field_name(field):
    return field["name"] if isinstance(field, dict) else field.name


def test_basic_protocol_fixture_fields_match_python_parser():
    content = BASIC_FIXTURE.joinpath("protocol.aimd").read_text(encoding="utf-8")
    expected = json.loads(
        BASIC_FIXTURE.joinpath("expected-fields.json").read_text(encoding="utf-8")
    )

    parsed = parse_aimd(content)

    assert [field_name(field) for field in parsed["templates"]["var"]] == expected["var"]
    assert [field_name(field) for field in parsed["templates"]["step"]] == expected["step"]
    assert [field_name(field) for field in parsed["templates"]["check"]] == expected["check"]
