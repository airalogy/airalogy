from airalogy.markdown import parse_aimd
from airalogy.record import (
    grade_quiz_answer,
    grade_scale_quiz_locally,
    grade_record_quiz_answers,
    grade_record_quiz_answers_with_aimd,
    is_scale_quiz_answer_complete,
)


AIMD_WITH_GRADING = """
```quiz
id: quiz_choice_single_1
type: choice
mode: single
score: 2
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
answer: B
```

```quiz
id: quiz_blank_1
type: blank
score: 4
stem: Fill [[b1]] and [[b2]]
blanks:
  - key: b1
    answer: 21%
  - key: b2
    answer: "42"
grading:
  strategy: normalized_match
  blanks:
    - key: b1
      accepted_answers: ["21%", "21 %"]
      normalize: ["trim", "remove_spaces"]
    - key: b2
      numeric:
        target: 42
        tolerance: 0.5
```

```quiz
id: quiz_open_1
type: open
score: 5
stem: Explain why this happens
grading:
  strategy: keyword_rubric
  rubric_items:
    - id: rate
      points: 2
      desc: Mention reaction rate
      keywords: [rate]
    - id: stability
      points: 3
      desc: Mention stability
      keywords: [stability]
```

```quiz
id: quiz_llm_1
type: open
score: 3
stem: Explain further
grading:
  strategy: llm_rubric
  provider: teacher_default
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
grading:
  strategy: sum
  bands:
    - min: 0
      max: 1
      label: 低
    - min: 2
      max: 4
      label: 中
      interpretation: 需要进一步关注
```
"""


def build_record() -> dict:
    return {
        "data": {
            "quiz": {
                "quiz_choice_single_1": "B",
                "quiz_blank_1": {"b1": " 21 % ", "b2": "42.3"},
                "quiz_open_1": "Temperature changes the reaction rate and sample stability.",
                "quiz_llm_1": "Detailed answer",
                "quiz_scale_1": {"s1": "several_days", "s2": "more_than_half_the_days"},
            }
        }
    }


def test_grade_quiz_answer_keyword_rubric():
    quiz_templates = parse_aimd(AIMD_WITH_GRADING)["templates"]["quiz"]
    open_quiz = next(quiz for quiz in quiz_templates if quiz["id"] == "quiz_open_1")

    result = grade_quiz_answer(
        open_quiz,
        "Temperature changes the reaction rate and sample stability.",
    )

    assert result["status"] == "correct"
    assert result["earned_score"] == 5.0
    assert result["method"] == "keyword_rubric"
    assert len(result["rubric_results"]) == 2


def test_grade_quiz_answer_choice_option_points():
    result = grade_quiz_answer(
        {
            "id": "quiz_choice_option_points",
            "type": "choice",
            "mode": "single",
            "stem": "Pick the best answer",
            "options": [
                {"key": "A", "text": "Option A"},
                {"key": "B", "text": "Option B"},
                {"key": "C", "text": "Option C"},
            ],
            "grading": {
                "strategy": "option_points",
                "option_points": {
                    "A": 0,
                    "B": 5,
                    "C": 2,
                },
            },
        },
        "C",
    )

    assert result["status"] == "partial"
    assert result["earned_score"] == 2.0
    assert result["max_score"] == 5.0
    assert result["method"] == "option_points"


def test_grade_quiz_answer_unanswered_choice_is_ungraded():
    result = grade_quiz_answer(
        {
            "id": "quiz_choice_unanswered",
            "type": "choice",
            "mode": "single",
            "score": 2,
            "stem": "Pick one",
            "options": [
                {"key": "A", "text": "Option A"},
                {"key": "B", "text": "Option B"},
            ],
            "answer": "B",
        },
        None,
    )

    assert result["status"] == "ungraded"
    assert result["earned_score"] == 0.0
    assert result["method"] == "manual"


def test_grade_quiz_answer_choice_option_points_multiple():
    result = grade_quiz_answer(
        {
            "id": "quiz_choice_option_points_multiple",
            "type": "choice",
            "mode": "multiple",
            "score": 4,
            "stem": "Pick all that apply",
            "options": [
                {"key": "A", "text": "Option A"},
                {"key": "B", "text": "Option B"},
                {"key": "C", "text": "Option C"},
                {"key": "D", "text": "Option D"},
            ],
            "grading": {
                "strategy": "option_points",
                "option_points": {
                    "A": 1.5,
                    "B": 1.5,
                    "C": 1,
                    "D": -1,
                },
            },
        },
        ["A", "B", "D"],
    )

    assert result["status"] == "partial"
    assert result["earned_score"] == 2.0
    assert result["method"] == "option_points"


def test_grade_scale_quiz_locally():
    result = grade_scale_quiz_locally(
        {
            "id": "quiz_scale_1",
            "type": "scale",
            "stem": "Scale",
            "items": [
                {"key": "s1", "stem": "Item 1"},
                {"key": "s2", "stem": "Item 2"},
            ],
            "options": [
                {"key": "never", "text": "Never", "points": 0},
                {"key": "sometimes", "text": "Sometimes", "points": 1},
                {"key": "often", "text": "Often", "points": 2},
            ],
            "grading": {
                "strategy": "sum",
                "bands": [
                    {"min": 0, "max": 1, "label": "Low"},
                    {"min": 2, "max": 4, "label": "Medium", "interpretation": "Monitor"},
                ],
            },
        },
        {"s1": "sometimes", "s2": "often"},
    )

    assert result["status"] == "scored"
    assert result["earned_score"] == 3.0
    assert result["max_score"] == 4.0
    assert result["method"] == "scale_sum"
    assert result["band"]["label"] == "Medium"
    assert result["band"]["interpretation"] == "Monitor"
    assert result.get("feedback") is None


def test_is_scale_quiz_answer_complete():
    quiz = {
        "id": "quiz_scale_1",
        "type": "scale",
        "stem": "Scale",
        "items": [
            {"key": "s1", "stem": "Item 1"},
            {"key": "s2", "stem": "Item 2"},
        ],
        "options": [
            {"key": "never", "text": "Never", "points": 0},
            {"key": "sometimes", "text": "Sometimes", "points": 1},
        ],
    }

    assert is_scale_quiz_answer_complete(quiz, {"s1": "never", "s2": "sometimes"}) is True
    assert is_scale_quiz_answer_complete(quiz, {"s1": "never"}) is False


def test_grade_record_quiz_answers_aggregates_report():
    quiz_templates = parse_aimd(AIMD_WITH_GRADING)["templates"]["quiz"]
    report = grade_record_quiz_answers(build_record(), quiz_templates)

    assert report["quiz"]["quiz_choice_single_1"]["status"] == "correct"
    assert report["quiz"]["quiz_blank_1"]["status"] == "correct"
    assert report["quiz"]["quiz_open_1"]["status"] == "correct"
    assert report["quiz"]["quiz_llm_1"]["status"] == "needs_review"
    assert report["quiz"]["quiz_scale_1"]["status"] == "scored"
    assert report["summary"]["review_required_count"] == 1
    assert report["summary"]["total_earned_score"] == 14.0
    assert report["summary"]["total_max_score"] == 18.0


def test_grade_record_quiz_answers_with_provider():
    quiz_templates = parse_aimd(AIMD_WITH_GRADING)["templates"]["quiz"]

    def provider(payload: dict) -> dict:
        return {
            "quiz_id": payload["quiz"]["id"],
            "earned_score": 2,
            "max_score": payload["max_score"],
            "status": "partial",
            "method": "llm",
            "provider": payload["config"]["provider"],
            "confidence": 0.9,
        }

    report = grade_record_quiz_answers(
        build_record(),
        quiz_templates,
        grading_provider=provider,
    )

    assert report["quiz"]["quiz_llm_1"]["status"] == "partial"
    assert report["quiz"]["quiz_llm_1"]["provider"] == "teacher_default"
    assert report["summary"]["total_earned_score"] == 16.0


def test_grade_record_quiz_answers_with_malformed_provider_result():
    quiz_templates = parse_aimd(AIMD_WITH_GRADING)["templates"]["quiz"]

    report = grade_record_quiz_answers(
        build_record(),
        quiz_templates,
        grading_provider=lambda payload: "raw free-text answer from model",
    )

    assert report["quiz"]["quiz_llm_1"]["status"] == "needs_review"
    assert report["quiz"]["quiz_llm_1"]["earned_score"] == 0.0
    assert report["quiz"]["quiz_llm_1"]["provider"] == "teacher_default"
    assert report["quiz"]["quiz_llm_1"]["feedback"] == "A grading provider must return a structured result object."


def test_grade_record_quiz_answers_with_aimd_entrypoint():
    report = grade_record_quiz_answers_with_aimd(
        build_record(),
        AIMD_WITH_GRADING,
    )

    assert report["quiz"]["quiz_choice_single_1"]["earned_score"] == 2.0
    assert report["quiz"]["quiz_blank_1"]["earned_score"] == 4.0
    assert report["quiz"]["quiz_scale_1"]["earned_score"] == 3.0
