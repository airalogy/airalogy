from airalogy.markdown import parse_aimd
from airalogy.record import (
    grade_quiz_answer,
    grade_record_quiz_answers,
    grade_record_quiz_answers_with_aimd,
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
"""


def build_record() -> dict:
    return {
        "data": {
            "quiz": {
                "quiz_choice_single_1": "B",
                "quiz_blank_1": {"b1": " 21 % ", "b2": "42.3"},
                "quiz_open_1": "Temperature changes the reaction rate and sample stability.",
                "quiz_llm_1": "Detailed answer",
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


def test_grade_record_quiz_answers_aggregates_report():
    quiz_templates = parse_aimd(AIMD_WITH_GRADING)["templates"]["quiz"]
    report = grade_record_quiz_answers(build_record(), quiz_templates)

    assert report["quiz"]["quiz_choice_single_1"]["status"] == "correct"
    assert report["quiz"]["quiz_blank_1"]["status"] == "correct"
    assert report["quiz"]["quiz_open_1"]["status"] == "correct"
    assert report["quiz"]["quiz_llm_1"]["status"] == "needs_review"
    assert report["summary"]["review_required_count"] == 1
    assert report["summary"]["total_earned_score"] == 11.0
    assert report["summary"]["total_max_score"] == 14.0


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
    assert report["summary"]["total_earned_score"] == 13.0


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
