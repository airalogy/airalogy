import json
from decimal import Decimal
from pathlib import Path

import pytest

from airalogy.migrations import apply_declarative_migration
from airalogy.protocol_contract import (
    ProtocolMetadata,
    validate_protocol_contract,
)
from airalogy.schema_compatibility import compare_json_schemas
from airalogy.types import ResourceRef
from airalogy.markdown import parse_aimd
from airalogy.markdown.errors import InvalidSyntaxError


MONOREPO_ROOT = Path(__file__).resolve().parents[4]
FIXTURE = json.loads(
    (
        MONOREPO_ROOT / "spec/fixtures/resource-contract/contracts.json"
    ).read_text(encoding="utf-8")
)


def test_resource_ref_preserves_exact_quantity():
    value = ResourceRef.model_validate(FIXTURE["resource_ref"]["valid"])

    assert value.quantity == Decimal("0.125")
    assert value.model_dump(mode="json")["quantity"] == "0.125"
    assert ResourceRef["plasmid"] is ResourceRef


def test_protocol_kind_defaults_to_experiment():
    assert ProtocolMetadata().kind == "experiment"
    assert ProtocolMetadata(kind="resource_definition").kind == "resource_definition"


def test_resource_field_contract_validates_role_and_quantity_target():
    fields = {
        "templates": {
            "var": [
                {
                    "name": "source",
                    "type_annotation": 'ResourceRef["plasmid"]',
                    "kwargs": {
                        "resource_role": "input",
                        "quantity_field": "amount",
                        "container_required": True,
                    },
                },
                {"name": "amount", "type_annotation": "Decimal"},
            ]
        }
    }

    assert validate_protocol_contract({"kind": "experiment"}, fields) == []


def test_resource_definition_rejects_experiment_runtime_features():
    issues = validate_protocol_contract(
        {"kind": "resource_definition"},
        {
            "templates": {
                "var": [{"name": "name", "type_annotation": "str"}],
                "step": [{"name": "prepare"}],
                "check": [{"name": "confirm"}],
                "assigner": [{"code": "print('unsafe')"}],
            }
        },
    )

    assert {issue.code for issue in issues} == {
        "resource_definition_forbidden_feature"
    }
    assert {issue.path for issue in issues} == {"step", "check", "assigner"}


def test_resource_metadata_rejects_invalid_references():
    issues = validate_protocol_contract(
        {"kind": "experiment"},
        {
            "templates": {
                "var": [
                    {
                        "name": "equipment",
                        "type_annotation": "ResourceRef",
                        "kwargs": {
                            "resource_role": "equipment",
                            "quantity_field": "duration",
                        },
                    },
                    {"name": "duration", "type_annotation": "str"},
                ]
            }
        },
    )

    assert [issue.code for issue in issues] == ["quantity_field_must_be_numeric"]


def test_python_parser_requires_resource_role():
    with pytest.raises(InvalidSyntaxError, match="must declare resource_role"):
        parse_aimd('{{var|source: ResourceRef["plasmid"]}}')


def test_compatibility_fixture_matches_expected_reports():
    for case in FIXTURE["compatibility"]:
        report = compare_json_schemas(case["before"], case["after"])
        assert report.status == case["level"], case["name"]
        assert report.recommended_bump == case["recommended_bump"], case["name"]


def test_declarative_migration_fixture_is_deterministic():
    fixture = FIXTURE["migration"]
    first = apply_declarative_migration(fixture["input"], fixture["manifest"])
    second = apply_declarative_migration(fixture["input"], fixture["manifest"])

    assert first.data == fixture["output"]
    assert first.rule_hash == second.rule_hash
    assert first.status == "completed"


def test_custom_migration_requires_host_sandbox():
    manifest = {
        "version": "airalogy.migration.v1",
        "from": "1.0.0",
        "to": "2.0.0",
        "transform": {
            "entrypoint": "migrations/normalize.py:transform",
            "code_hash": "a" * 64,
        },
    }

    result = apply_declarative_migration({}, manifest)
    assert result.status == "needs_review"
    assert result.data == {}
