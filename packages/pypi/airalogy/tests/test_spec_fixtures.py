import json
from pathlib import Path

from airalogy.examples.protocols import (
    get_protocol_example,
    iter_protocol_examples,
    load_index,
    protocols_root,
)
from airalogy.markdown import parse_aimd
from airalogy_protocol_examples_validation import validate_protocol_examples


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
    validate_protocol_examples(PROTOCOL_EXAMPLES_ROOT)

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


def test_packaged_protocol_examples_match_repository_sources():
    repository_index = json.loads(
        PROTOCOL_EXAMPLES_ROOT.joinpath("index.json").read_text(encoding="utf-8")
    )

    assert load_index() == repository_index

    resource_paths = {"index.json", "README.md", "README.zh-CN.md"}
    for example in repository_index["examples"]:
        for key in ("entry", "toml", "assigner"):
            resource_paths.update(example.get(key, {}).values())
        for paths in example.get("sample_data", {}).values():
            resource_paths.update(paths)
        for paths in example.get("assets", {}).values():
            resource_paths.update(paths)

    for relative_path in sorted(resource_paths):
        packaged_resource = protocol_example_resource(relative_path)
        repository_file = PROTOCOL_EXAMPLES_ROOT / relative_path

        assert repository_file.is_file(), f"Missing repository example file {relative_path}"
        assert packaged_resource.is_file(), f"Missing packaged example file {relative_path}"
        assert packaged_resource.read_bytes() == repository_file.read_bytes()


def test_packaged_protocol_examples_parse_with_python_parser():
    examples = iter_protocol_examples()

    assert examples
    for example in examples:
        metadata = example.load_metadata()
        assert example.id == metadata["id"]
        assert get_protocol_example(metadata["id"]) == example
        parse_aimd(example.read_aimd())


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


def test_entity_ref_connectors_fixture_extracts_python_templates():
    content = (
        PROTOCOL_FIXTURES_ROOT
        / "entity-ref-connectors/protocol/protocol.aimd"
    ).read_text(encoding="utf-8")

    parsed = parse_aimd(content)

    assert [field_name(field) for field in parsed["templates"]["var"]] == [
        "parent_plasmid",
        "parent_plasmids",
    ]
    assert parsed["templates"]["connectors"][0]["connectors"]["lab_plasmid_registry"] == {
        "id": "lab_plasmid_registry",
        "kind": "entity_source",
        "entity": "plasmid",
        "descriptor": "https://lims.example.com/airalogy/entity-sources/plasmid.json",
        "auth": {
            "type": "bearer",
            "token_env": "LAB_PLASMID_TOKEN",
        },
    }
    parent_plasmid = parsed["templates"]["var"][0]
    assert parent_plasmid["type_annotation"] == "EntityRef | None"
    assert parent_plasmid["kwargs"]["entity"] == "plasmid"
    assert parent_plasmid["kwargs"]["source"] == "lab_plasmid_registry"


def protocol_example_resource(relative_path: str):
    resource = protocols_root()
    for part in relative_path.split("/"):
        resource = resource.joinpath(part)
    return resource
