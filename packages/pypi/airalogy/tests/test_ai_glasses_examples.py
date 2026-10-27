from pathlib import Path

import pytest
from pydantic import ValidationError

from airalogy.markdown import generate_model, parse_aimd


EXAMPLES = Path(__file__).resolve().parents[4] / "examples/protocols"


def load_example(slug):
    return (EXAMPLES / slug / "zh-CN/protocol.aimd").read_text(encoding="utf-8")


def models_for(slug):
    namespace = {}
    exec(generate_model(load_example(slug)), namespace)
    namespace["VarModel"].model_json_schema()
    return namespace


@pytest.mark.parametrize("slug,count,timer,ms", [
    ("ai-glasses-vinegar-titration", 18, "confirm_endpoint", 30_000),
    ("ai-glasses-leaf-disk-photosynthesis", 19, "vacuum_infiltrate", 10_000),
])
def test_glasses_examples_preserve_steps_references_and_timers(slug, count, timer, ms):
    templates = parse_aimd(load_example(slug))["templates"]
    names = [step["name"] for step in templates["step"]]
    assert len(names) == len(set(names)) == count
    assert all(step.get("title") for step in templates["step"])
    for ref in templates["ref_step"]:
        assert ref["ref_id"] in names
    timed = next(step for step in templates["step"] if step["name"] == timer)
    assert timed["estimated_duration_ms"] == ms
    assert timed["timer"] == "both"
    models_for(slug)


def test_titration_rows_keep_unknown_values_and_reject_invalid_readings():
    model = models_for("ai-glasses-vinegar-titration")["Titration"]
    row = dict(trial_id="T1", kind="正式", initial_ml=1.25, final_ml=None,
               titre_ml=None, endpoint=None, accepted=None, note=None)
    assert model(**row).accepted is None
    for invalid in ({"initial_ml": -1}, {"final_ml": 51}, {"titre_ml": 0}, {"endpoint": "自动通过"}):
        with pytest.raises(ValidationError):
            model(**(row | invalid))


def test_leaf_observations_preserve_missing_counts_instead_of_zero():
    model = models_for("ai-glasses-leaf-disk-photosynthesis")["LeafObservation"]
    row = dict(cup_id="L1", elapsed_s=60, floating_count=None, note="漏测")
    assert model(**row).floating_count is None
    assert model(**(row | {"floating_count": 0})).floating_count == 0
    for count in (-1, 11):
        with pytest.raises(ValidationError):
            model(**(row | {"floating_count": count}))


def test_unreached_et50_keeps_empty_bounds():
    model = models_for("ai-glasses-leaf-disk-photosynthesis")["Et50Result"]
    row = model(cup_id="W1", status="观察期内未达到", lower_s=None,
                upper_s=None, last_observed_s=1800, note=None)
    assert row.lower_s is None and row.upper_s is None
