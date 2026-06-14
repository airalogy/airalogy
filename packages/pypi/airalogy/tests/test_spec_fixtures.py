import json
from pathlib import Path

from airalogy.markdown import parse_aimd


MONOREPO_ROOT = Path(__file__).resolve().parents[4]
BASIC_FIXTURE = MONOREPO_ROOT / "spec/fixtures/basic-protocol"
PROTOCOL_EXAMPLES_ROOT = MONOREPO_ROOT / "examples/protocols"
PROTOCOL_FIXTURES_ROOT = MONOREPO_ROOT / "spec/fixtures/protocols"


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


def test_protocol_example_registry_entries_parse_with_python_parser():
    registry = json.loads(
        PROTOCOL_EXAMPLES_ROOT.joinpath("index.json").read_text(encoding="utf-8")
    )

    for example in registry["examples"]:
        for locale, entry in example["entry"].items():
            aimd_path = PROTOCOL_EXAMPLES_ROOT / entry
            toml_path = PROTOCOL_EXAMPLES_ROOT / example["toml"][locale]

            assert aimd_path.exists(), f"Missing AIMD entry for {example['id']} {locale}"
            assert toml_path.exists(), f"Missing TOML entry for {example['id']} {locale}"
            parse_aimd(aimd_path.read_text(encoding="utf-8"))


def test_protocol_fixtures_parse_with_python_parser():
    aimd_paths = sorted(PROTOCOL_FIXTURES_ROOT.glob("*/protocol/protocol.aimd"))

    assert aimd_paths
    for aimd_path in aimd_paths:
        parse_aimd(aimd_path.read_text(encoding="utf-8"))


def test_critic_markup_fixture_keeps_review_marks_out_of_python_templates():
    content = (
        PROTOCOL_FIXTURES_ROOT
        / "critic-markup/protocol/protocol.aimd"
    ).read_text(encoding="utf-8")

    parsed = parse_aimd(content)

    assert [field_name(field) for field in parsed["templates"]["step"]] == [
        "review_protocol_text"
    ]
    assert [field_name(field) for field in parsed["templates"]["var"]] == [
        "review_summary"
    ]
