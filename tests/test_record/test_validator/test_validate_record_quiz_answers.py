import pytest

from airalogy.markdown import parse_aimd
from airalogy.record.validator import (
    validate_record_quiz_answers,
    validate_record_quiz_answers_with_aimd,
)


AIMD_WITH_QUIZ = """
```quiz
id: quiz_choice_single_1
type: choice
mode: single
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```

```quiz
id: quiz_blank_1
type: blank
stem: Fill [[b1]]
blanks:
  - key: b1
    answer: 21%
```

```quiz
id: quiz_open_1
type: open
stem: Explain the reason
```
"""


def build_valid_record() -> dict:
    return {
        "data": {
            "quiz": {
                "quiz_choice_single_1": "A",
                "quiz_blank_1": {"b1": "21%"},
                "quiz_open_1": "Because of temperature and pressure.",
            }
        }
    }


def test_validate_record_quiz_answers_valid():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is True
    assert errors == []


def test_validate_record_quiz_answers_invalid_choice_option():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()
    record["data"]["quiz"]["quiz_choice_single_1"] = "C"

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any("Choice(single) answer for quiz_choice_single_1" in msg for msg in errors)


def test_validate_record_quiz_answers_invalid_blank_keys():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()
    record["data"]["quiz"]["quiz_blank_1"] = {"b2": "21%"}

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Blank answer for quiz_blank_1 contains unknown keys: b2." in msg
        for msg in errors
    )
    assert any(
        "Blank answer for quiz_blank_1 is missing keys: b1." in msg for msg in errors
    )


def test_validate_record_quiz_answers_with_aimd_entrypoint():
    record = build_valid_record()

    is_valid, errors = validate_record_quiz_answers_with_aimd(
        record=record,
        aimd_content=AIMD_WITH_QUIZ,
    )

    assert is_valid is True
    assert errors == []


def test_validate_record_quiz_answers_requires_record_structure():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]

    with pytest.raises(ValueError):
        validate_record_quiz_answers({"data": {}}, quiz_templates)
