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


def test_refs_fixture_extracts_python_refs_templates():
    content = (
        PROTOCOL_FIXTURES_ROOT
        / "refs/protocol/protocol.aimd"
    ).read_text(encoding="utf-8")

    parsed = parse_aimd(content)

    assert parsed["templates"]["cite"][0]["ref_ids"] == [
        "yang2025airalogy",
        "doe2024protocol",
    ]
    assert len(parsed["templates"]["refs"]) == 2
    assert parsed["templates"]["refs"][0]["id"] == "yang2025airalogy"
    assert (
        parsed["templates"]["refs"][0]["title"]
        == "Airalogy: Universal Research Automation"
    )
    assert parsed["templates"]["refs"][1]["url"] == "https://example.com/protocol"


def test_media_fixture_extracts_python_media_templates():
    content = (
        PROTOCOL_FIXTURES_ROOT
        / "media/protocol/protocol.aimd"
    ).read_text(encoding="utf-8")

    parsed = parse_aimd(content)

    assert [field_name(field) for field in parsed["templates"]["step"]] == [
        "review_media"
    ]
    assert parsed["templates"]["ref_media"][0]["ref_id"] == "lecture_video"
    media = parsed["templates"]["media"][0]
    assert media["id"] == "lecture_video"
    assert media["kind"] == "video"
    assert media["src"] == "files/lecture.mp4"
    assert media["mime"] == "video/mp4"
    assert media["poster"] == "files/lecture-poster.jpg"
    assert media["title"] == "Lecture Video"
    assert media["legend"] == "A local video resource packaged with the AIMD protocol."
