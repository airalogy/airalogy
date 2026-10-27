import json
from pathlib import Path

import pytest

from airalogy.markdown import parse_aimd
from airalogy.markdown.errors import InvalidSyntaxError


FIXTURE = Path(__file__).resolve().parents[5] / "spec/fixtures/protocols/check-titles"


def test_shared_check_titles():
    content = (FIXTURE / "protocol/protocol.aimd").read_text()
    expected = json.loads((FIXTURE / "expected.json").read_text())
    parsed = parse_aimd(content)["templates"]
    assert [{"id": check["name"], "title": check.get("title")} for check in parsed["check"]] == expected
    assert parsed["check"][0]["checked_message"] == "Confirmed"
    assert parsed["check"][-1]["checked_message"] == 'done, title="not a title"'
    assert parsed["var"][0]["name"] == "reading"


@pytest.mark.parametrize("title", ["42", "True", "None", "unquoted", "[]"])
def test_check_title_requires_string(title):
    with pytest.raises(InvalidSyntaxError):
        parse_aimd("{{check|safety_ready, title=" + title + "}}")


def test_title_changes_do_not_change_checkpoint_identity():
    for suffix in ['', ', title="Safety check"', ', title="Updated check"']:
        check = parse_aimd("{{check|safety_ready" + suffix + "}}")["templates"]["check"][0]
        assert check["name"] == "safety_ready"
