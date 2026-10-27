import json
from pathlib import Path

import pytest

from airalogy.markdown import parse_aimd
from airalogy.markdown.errors import InvalidSyntaxError


FIXTURE = Path(__file__).resolve().parents[5] / "spec/fixtures/protocols/step-titles"


def test_shared_step_titles():
    content = (FIXTURE / "protocol/protocol.aimd").read_text()
    expected = json.loads((FIXTURE / "expected.json").read_text())
    parsed = parse_aimd(content)["templates"]
    assert [{"id": step["name"], "title": step.get("title")} for step in parsed["step"]] == expected
    assert parsed["step"][0]["estimated_duration_ms"] == 30_000
    assert parsed["step"][0]["timer"] == "both"
    assert parsed["step"][1]["level"] == 2
    assert parsed["ref_step"][0]["ref_id"] == "prepare"


@pytest.mark.parametrize("title", ["42", "True", "None", "unquoted", "[]"])
def test_step_title_requires_string(title):
    with pytest.raises(InvalidSyntaxError):
        parse_aimd("{{step|prepare, title=" + title + "}}")


def test_title_does_not_capture_parameters_inside_quotes():
    step = parse_aimd('''{{step|prepare, title="duration=30s, check=True", checked_message='done, title="not a title"'}}''')["templates"]["step"][0]
    assert step["title"] == "duration=30s, check=True"
    assert step["checked_message"] == 'done, title="not a title"'
    assert "duration" not in step
    assert "check" not in step
