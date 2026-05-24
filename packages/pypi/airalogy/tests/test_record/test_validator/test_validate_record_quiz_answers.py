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
id: quiz_true_false_1
type: true_false
stem: The sample can be stored at room temperature overnight.
answer: false
```

```quiz
id: quiz_open_1
type: open
stem: Explain the reason
```

```quiz
id: quiz_scale_1
type: scale
stem: 在过去两周里，你有多少天出现以下症状？
items:
  - key: s1
    stem: 感到不安
  - key: s2
    stem: 无法放松
options:
  - key: not_at_all
    text: 没有
    points: 0
  - key: several_days
    text: 有几天
    points: 1
  - key: more_than_half_the_days
    text: 一半以上时间
    points: 2
```
"""

AIMD_WITH_CHOICE_FOLLOWUPS = """
```quiz
id: quiz_smoking
type: choice
mode: single
stem: 是否吸烟？
options:
  - key: "yes"
    text: 是
    followups:
      - key: years
        type: int
        title: 年
      - key: cigarettes_per_day
        type: int
        title: 支/天
  - key: "no"
    text: 否
  - key: "passive"
    text: 被动吸烟
    followups:
      - key: years
        type: int
        title: 年
        required: false
```
"""

AIMD_WITH_TRUE_FALSE_FOLLOWUPS = """
```quiz
id: quiz_precipitate
type: true_false
stem: 是否出现沉淀？
options:
  - key: true
    text: 是
    followups:
      - key: color
        type: str
        title: 颜色
  - key: false
    text: 否
```
"""


def build_valid_record() -> dict:
    return {
        "data": {
            "quiz": {
                "quiz_choice_single_1": "A",
                "quiz_blank_1": {"b1": "21%"},
                "quiz_true_false_1": False,
                "quiz_open_1": "Because of temperature and pressure.",
                "quiz_scale_1": {"s1": "not_at_all", "s2": "more_than_half_the_days"},
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


def test_validate_record_quiz_answers_invalid_true_false_answer():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()
    record["data"]["quiz"]["quiz_true_false_1"] = "false"

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "True/false answer for quiz_true_false_1 must be a boolean." in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_choice_followups_valid():
    quiz_templates = parse_aimd(AIMD_WITH_CHOICE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_smoking": {
                    "selected": "yes",
                    "followups": {
                        "yes": {
                            "years": 8,
                            "cigarettes_per_day": 10,
                        }
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is True
    assert errors == []


def test_validate_record_quiz_answers_choice_followups_missing_required_key():
    quiz_templates = parse_aimd(AIMD_WITH_CHOICE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_smoking": {
                    "selected": "yes",
                    "followups": {
                        "yes": {
                            "years": 8,
                        }
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Choice followups for quiz_smoking.yes are missing required keys: cigarettes_per_day."
        in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_choice_followups_reject_unselected_option():
    quiz_templates = parse_aimd(AIMD_WITH_CHOICE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_smoking": {
                    "selected": "no",
                    "followups": {
                        "yes": {
                            "years": 8,
                            "cigarettes_per_day": 10,
                        }
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Choice followups for quiz_smoking contain unselected option keys: yes."
        in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_choice_followups_reject_wrong_type():
    quiz_templates = parse_aimd(AIMD_WITH_CHOICE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_smoking": {
                    "selected": "yes",
                    "followups": {
                        "yes": {
                            "years": "8",
                            "cigarettes_per_day": 10,
                        }
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Choice followup answer for quiz_smoking.yes.years must be an int." in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_true_false_followups_valid():
    quiz_templates = parse_aimd(AIMD_WITH_TRUE_FALSE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_precipitate": {
                    "selected": True,
                    "followups": {
                        "true": {
                            "color": "白色",
                        }
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is True
    assert errors == []


def test_validate_record_quiz_answers_true_false_followups_missing_required_key():
    quiz_templates = parse_aimd(AIMD_WITH_TRUE_FALSE_FOLLOWUPS)["templates"]["quiz"]
    record = {
        "data": {
            "quiz": {
                "quiz_precipitate": {
                    "selected": True,
                    "followups": {
                        "true": {}
                    },
                }
            }
        }
    }

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "True/false followups for quiz_precipitate.true are missing required keys: color."
        in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_true_false_followups_reject_legacy_bool():
    quiz_templates = parse_aimd(AIMD_WITH_TRUE_FALSE_FOLLOWUPS)["templates"]["quiz"]
    record = {"data": {"quiz": {"quiz_precipitate": True}}}

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "True/false answer for quiz_precipitate with followups must be a dict containing selected."
        in msg
        for msg in errors
    )


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


def test_validate_record_quiz_answers_invalid_scale_option():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()
    record["data"]["quiz"]["quiz_scale_1"]["s2"] = "9"

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Scale answer value for quiz_scale_1.s2 must be one of: not_at_all, several_days, more_than_half_the_days." in msg
        for msg in errors
    )


def test_validate_record_quiz_answers_missing_scale_key():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]
    record = build_valid_record()
    record["data"]["quiz"]["quiz_scale_1"] = {"s1": "not_at_all"}

    is_valid, errors = validate_record_quiz_answers(record, quiz_templates)

    assert is_valid is False
    assert any(
        "Scale answer for quiz_scale_1 is missing keys: s2." in msg for msg in errors
    )


def test_validate_record_quiz_answers_requires_record_structure():
    quiz_templates = parse_aimd(AIMD_WITH_QUIZ)["templates"]["quiz"]

    with pytest.raises(ValueError):
        validate_record_quiz_answers({"data": {}}, quiz_templates)
