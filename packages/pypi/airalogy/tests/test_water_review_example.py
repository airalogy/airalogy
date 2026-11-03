import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from airalogy.markdown import generate_model, parse_aimd


ROOT = Path(__file__).resolve().parents[4] / "examples/protocols/surface-water-quality-review/zh-CN"
CONTENT = (ROOT / "protocol.aimd").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def models():
    namespace = {}
    exec(generate_model(CONTENT), namespace)
    namespace["VarModel"].model_json_schema()
    return namespace


def test_water_review_has_unique_titled_steps_and_resolvable_references():
    templates = parse_aimd(CONTENT)["templates"]
    steps = templates["step"]
    names = [step["name"] for step in steps]
    assert len(names) == len(set(names)) == 8
    assert names == [
        "register_task", "record_readings", "review_comparison", "document_actions",
        "verify_equipment", "pair_source_data", "track_samples", "human_review",
    ]
    assert all(step.get("title") for step in steps)
    assert all(ref["ref_id"] in names for ref in templates["ref_step"])
    assert len({check["name"] for check in templates["check"]}) == 2


def test_synthetic_records_validate_without_claiming_review_completion(models):
    records = json.loads((ROOT / "demo-records.json").read_text(encoding="utf-8"))["records"]
    assert len({record["record_id"] for record in records}) == 3
    for record in records:
        value = models["VarModel"].model_validate(record["data"]["var"])
        assert value.task_id.startswith("DEMO-")
        assert value.reviewer is None
        assert value.comparison_results == []
        assert record["data"]["step"] == record["data"]["check"] == {}


def test_raw_readings_keep_unknown_values_and_reject_negative_measurements(models):
    model = models["WaterReadingPair"]
    raw = dict(pair_id="PAIR-TEST", auto_do=None, field_do_1=None, field_do_2=None,
               calibration_valid=None, comparable=None)
    empty = model(**raw)
    assert empty.auto_do is None
    assert empty.calibration_valid is None
    assert empty.comparable is None
    assert model(**(raw | {"auto_do": 0})).auto_do == 0
    with pytest.raises(ValidationError):
        model(**(raw | {"field_do_1": -1}))


def test_method_and_measurement_identity_are_not_prefilled(models):
    for name in ("task_id", "field_operator", "method_reference", "auto_observed_at", "field_observed_at"):
        assert models["VarModel"].model_fields[name].is_required()
