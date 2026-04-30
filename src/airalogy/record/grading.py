from __future__ import annotations

import re
from typing import Any, Callable

from airalogy.markdown import parse_aimd


DEFAULT_BLANK_NORMALIZE = ["trim", "collapse_whitespace"]

GradeProvider = Callable[[dict[str, Any]], dict[str, Any] | None]


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def _round_score(value: float) -> float:
    return round(value, 3)


def _fullwidth_to_halfwidth(value: str) -> str:
    result: list[str] = []
    for char in value:
        code = ord(char)
        if code == 0x3000:
            result.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(char)
    return "".join(result)


def _normalize_text(value: str, rules: list[str] | None = None) -> str:
    normalized = value
    for rule in rules or []:
        if rule == "trim":
            normalized = normalized.strip()
        elif rule == "lowercase":
            normalized = normalized.lower()
        elif rule == "collapse_whitespace":
            normalized = re.sub(r"\s+", " ", normalized)
        elif rule == "remove_spaces":
            normalized = re.sub(r"\s+", "", normalized)
        elif rule == "fullwidth_to_halfwidth":
            normalized = _fullwidth_to_halfwidth(normalized)
    return normalized


def _parse_numberish_value(value: str, unit: str | None = None) -> float | None:
    normalized = _fullwidth_to_halfwidth(value).strip()
    if not normalized:
        return None

    if unit:
        escaped_unit = re.escape(unit)
        normalized = re.sub(rf"\s*{escaped_unit}\s*$", "", normalized, flags=re.IGNORECASE)

    normalized = normalized.replace(",", "")
    try:
        return float(normalized)
    except ValueError:
        return None


def _infer_status(earned_score: float, max_score: float) -> str:
    if max_score <= 0:
        return "ungraded"
    if earned_score >= max_score:
        return "correct"
    if earned_score <= 0:
        return "incorrect"
    return "partial"


def _normalize_provider_result(
    quiz: dict[str, Any],
    max_score: float,
    fallback_method: str,
    fallback_provider: str | None,
    result: dict[str, Any] | None,
) -> dict[str, Any]:
    if not result:
        return {
            "quiz_id": quiz["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "needs_review",
            "method": fallback_method,
            "provider": fallback_provider,
            "review_required": True,
            "feedback": "A grading provider was requested but no result was returned.",
        }

    if not isinstance(result, dict):
        return {
            "quiz_id": quiz["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "needs_review",
            "method": fallback_method,
            "provider": fallback_provider,
            "review_required": True,
            "feedback": "A grading provider must return a structured result object.",
        }

    normalized_max = float(result["max_score"]) if _is_number(result.get("max_score")) else max_score
    normalized_earned = _clamp(float(result["earned_score"]) if _is_number(result.get("earned_score")) else 0.0, 0.0, normalized_max)
    normalized_status = result.get("status") or _infer_status(normalized_earned, normalized_max)
    return {
        **result,
        "quiz_id": result.get("quiz_id") or quiz["id"],
        "earned_score": _round_score(normalized_earned),
        "max_score": _round_score(normalized_max),
        "status": normalized_status,
        "method": result.get("method") or fallback_method,
        "provider": result.get("provider") or fallback_provider,
        "review_required": bool(result.get("review_required", normalized_status == "needs_review")),
    }


def _get_choice_option_points(config: dict[str, Any] | None) -> dict[str, float] | None:
    option_points = config.get("option_points") if isinstance(config, dict) else None
    return option_points if isinstance(option_points, dict) else None


def _get_choice_scoring_strategy(config: dict[str, Any] | None) -> str:
    strategy = config.get("strategy") if isinstance(config, dict) else None
    if isinstance(strategy, str) and strategy and strategy != "auto":
        return strategy
    return "option_points" if _get_choice_option_points(config) else "exact_match"


def _normalize_true_false_answer_key(value: Any) -> str | None:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "false"}:
            return normalized
    return None


def _option_template_has_followups(quiz_template: dict[str, Any]) -> bool:
    options = quiz_template.get("options")
    if not isinstance(options, list):
        return False
    return any(
        isinstance(option, dict)
        and isinstance(option.get("followups"), list)
        and bool(option["followups"])
        for option in options
    )


def _get_option_selected_answer(quiz_template: dict[str, Any], answer: Any) -> Any:
    if _option_template_has_followups(quiz_template) and isinstance(answer, dict):
        return answer.get("selected")
    return answer


def _get_scale_scoring_strategy(config: dict[str, Any] | None) -> str:
    strategy = config.get("strategy") if isinstance(config, dict) else None
    if isinstance(strategy, str) and strategy and strategy != "auto":
        return strategy
    return "sum"


def _request_provider_grade(
    quiz: dict[str, Any],
    answer: Any,
    config: dict[str, Any] | None,
    max_score: float,
    fallback_method: str,
    grading_provider: GradeProvider | None,
) -> dict[str, Any]:
    provider_name = config.get("provider") if isinstance(config, dict) else None
    if grading_provider is None:
        return {
            "quiz_id": quiz["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "needs_review",
            "method": fallback_method,
            "provider": provider_name,
            "review_required": True,
            "feedback": "This quiz requires an external grading provider.",
        }

    provider_result = grading_provider(
        {
            "quiz": quiz,
            "answer": answer,
            "config": config,
            "max_score": max_score,
        }
    )
    return _normalize_provider_result(
        quiz,
        max_score,
        fallback_method,
        provider_name,
        provider_result,
    )


def resolve_quiz_max_score(quiz_template: dict[str, Any]) -> float:
    score = quiz_template.get("score")
    if _is_number(score) and score >= 0:
        return _round_score(float(score))

    if quiz_template.get("type") in {"choice", "true_false"}:
        grading = quiz_template.get("grading")
        option_points = _get_choice_option_points(grading if isinstance(grading, dict) else None)
        options = quiz_template.get("options")
        if option_points and isinstance(options, list) and options:
            values: list[float] = []
            for option in options:
                if isinstance(option, dict):
                    option_key = option.get("key")
                    if isinstance(option_key, str) and _is_number(option_points.get(option_key)):
                        values.append(float(option_points[option_key]))
                    else:
                        values.append(0.0)
            if quiz_template.get("type") == "true_false" or quiz_template.get("mode") == "single":
                return _round_score(max([0.0, *values]))
            return _round_score(max(sum(value for value in values if value > 0), 0.0))

    if quiz_template.get("type") == "blank":
        blanks = quiz_template.get("blanks")
        if isinstance(blanks, list) and blanks:
            return float(len(blanks))

    if quiz_template.get("type") == "scale":
        items = quiz_template.get("items")
        options = quiz_template.get("options")
        if isinstance(items, list) and items and isinstance(options, list) and options:
            max_per_item = max(
                [
                    0.0,
                    *[
                        float(option.get("points", 0.0))
                        for option in options
                        if isinstance(option, dict) and _is_number(option.get("points"))
                    ],
                ]
            )
            return _round_score(max_per_item * len(items))

    if quiz_template.get("type") == "open":
        grading = quiz_template.get("grading")
        rubric_items = grading.get("rubric_items") if isinstance(grading, dict) else None
        if isinstance(rubric_items, list) and rubric_items:
            total = sum(
                float(item.get("points", 0))
                for item in rubric_items
                if isinstance(item, dict) and _is_number(item.get("points"))
            )
            if total > 0:
                return _round_score(total)

    return 1.0


def _is_unanswered_quiz_answer(quiz_template: dict[str, Any], answer: Any) -> bool:
    if answer is None:
        return True

    quiz_type = quiz_template.get("type")
    if quiz_type == "choice":
        answer = _get_option_selected_answer(quiz_template, answer)
        if quiz_template.get("mode") == "single":
            return isinstance(answer, str) and not answer.strip()
        if quiz_template.get("mode") == "multiple":
            return isinstance(answer, list) and not [
                item for item in answer if isinstance(item, str) and item.strip()
            ]
        return False

    if quiz_type == "true_false":
        return isinstance(answer, str) and not answer.strip()

    if quiz_type == "blank":
        if not isinstance(answer, dict):
            return False
        return all(not isinstance(value, str) or not value.strip() for value in answer.values())

    if quiz_type == "scale":
        if not isinstance(answer, dict):
            return False
        string_values = [
            value for value in answer.values() if isinstance(value, str)
        ]
        return not string_values or all(not value.strip() for value in string_values)

    if quiz_type == "open":
        return isinstance(answer, str) and not answer.strip()

    return False


def _as_scale_answer_map(answer: Any) -> dict[str, str] | None:
    if not isinstance(answer, dict):
        return None

    normalized: dict[str, str] = {}
    for key, value in answer.items():
        if isinstance(key, str) and isinstance(value, str):
            normalized[key] = value
    return normalized


def is_scale_quiz_answer_complete(quiz_template: dict[str, Any], answer: Any) -> bool:
    items = quiz_template.get("items")
    if quiz_template.get("type") != "scale" or not isinstance(items, list) or not items:
        return False

    answer_map = _as_scale_answer_map(answer)
    if answer_map is None:
        return False

    for item in items:
        if not isinstance(item, dict):
            return False
        item_key = item.get("key")
        if not isinstance(item_key, str) or not answer_map.get(item_key, "").strip():
            return False
    return True


def _resolve_scale_band(
    score: float, config: dict[str, Any] | None
) -> dict[str, Any] | None:
    bands = config.get("bands") if isinstance(config, dict) else None
    if not isinstance(bands, list):
        return None

    for band in bands:
        if not isinstance(band, dict):
            continue
        min_value = band.get("min")
        max_value = band.get("max")
        if _is_number(min_value) and _is_number(max_value) and float(min_value) <= score <= float(max_value):
            return dict(band)
    return None


def grade_scale_quiz_locally(quiz_template: dict[str, Any], answer: Any) -> dict[str, Any]:
    max_score = resolve_quiz_max_score(quiz_template)

    if quiz_template.get("type") != "scale":
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "Local scale grading expects a scale quiz definition.",
        }

    items = quiz_template.get("items")
    if not isinstance(items, list) or not items:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
            "feedback": "This scale does not define any items.",
        }

    options = quiz_template.get("options")
    if not isinstance(options, list) or not options:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
            "feedback": "This scale does not define any answer options.",
        }

    answer_map = _as_scale_answer_map(answer)
    if answer_map is None:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "Scale grading expects a dict keyed by item key.",
        }

    option_points = {
        option["key"]: float(option.get("points", 0.0))
        for option in options
        if isinstance(option, dict) and isinstance(option.get("key"), str)
    }
    missing_items = []
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("key"), str):
            continue
        if not answer_map.get(item["key"], "").strip():
            missing_items.append(item["key"])

    if missing_items:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "scale_sum",
            "feedback": f"This scale is incomplete ({len(items) - len(missing_items)} / {len(items)} item(s) answered).",
        }

    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("key"), str):
            continue
        selected_key = answer_map[item["key"]]
        if selected_key not in option_points:
            return {
                "quiz_id": quiz_template["id"],
                "earned_score": 0.0,
                "max_score": max_score,
                "status": "error",
                "method": "invalid_answer",
                "feedback": f"Scale answer for {quiz_template['id']}.{item['key']} must be one option key.",
            }

    grading = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    strategy = _get_scale_scoring_strategy(grading)
    if strategy != "sum":
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": f"Unsupported scale grading strategy: {strategy}.",
        }

    earned_score = _round_score(
        sum(
            option_points.get(answer_map[item["key"]], 0.0)
            for item in items
            if isinstance(item, dict) and isinstance(item.get("key"), str)
        )
    )
    band = _resolve_scale_band(earned_score, grading)
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": earned_score,
        "max_score": max_score,
        "status": "scored",
        "method": "scale_sum",
        "band": band,
    }


def _grade_choice_quiz(quiz_template: dict[str, Any], answer: Any, max_score: float) -> dict[str, Any]:
    config = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    strategy = _get_choice_scoring_strategy(config)
    option_points = _get_choice_option_points(config)
    selected_answer = _get_option_selected_answer(quiz_template, answer)

    if quiz_template.get("mode") == "single":
        if not isinstance(selected_answer, str):
            return {
                "quiz_id": quiz_template["id"],
                "earned_score": 0.0,
                "max_score": max_score,
                "status": "error",
                "method": "invalid_answer",
                "feedback": "Choice(single) grading expects a string option key.",
            }

        if strategy == "option_points":
            raw_score = (
                float(option_points.get(selected_answer, 0.0))
                if option_points and _is_number(option_points.get(selected_answer))
                else 0.0
            )
            earned_score = _round_score(_clamp(raw_score, 0.0, max_score))
            return {
                "quiz_id": quiz_template["id"],
                "earned_score": earned_score,
                "max_score": max_score,
                "status": _infer_status(earned_score, max_score),
                "method": "option_points",
            }

        official_answer = quiz_template.get("answer")
        if official_answer is None:
            return {
                "quiz_id": quiz_template["id"],
                "earned_score": 0.0,
                "max_score": max_score,
                "status": "ungraded",
                "method": "manual",
                "feedback": "This choice quiz does not define an answer key.",
            }
        correct = isinstance(official_answer, str) and selected_answer == official_answer
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": max_score if correct else 0.0,
            "max_score": max_score,
            "status": "correct" if correct else "incorrect",
            "method": "exact_match",
        }

    if not isinstance(selected_answer, list):
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "Choice(multiple) grading expects a list of option keys.",
        }

    selected = {item for item in selected_answer if isinstance(item, str)}
    if strategy == "option_points":
        raw_score = sum(
            float(option_points.get(item, 0.0))
            for item in selected
            if option_points and _is_number(option_points.get(item))
        )
        earned_score = _round_score(_clamp(raw_score, 0.0, max_score))
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": earned_score,
            "max_score": max_score,
            "status": _infer_status(earned_score, max_score),
            "method": "option_points",
            "feedback": (
                f"Selected option scores totaled {_round_score(raw_score)} before score limits were applied."
                if raw_score != earned_score
                else None
            ),
        }

    official_answer = quiz_template.get("answer")
    if official_answer is None:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
            "feedback": "This choice quiz does not define an answer key.",
        }

    expected = {item for item in official_answer if isinstance(item, str)} if isinstance(official_answer, list) else set()
    if strategy == "partial_credit":
        correct_selections = len([item for item in selected if item in expected])
        wrong_selections = len([item for item in selected if item not in expected])
        denominator = len(expected) or 1
        raw_fraction = (correct_selections - wrong_selections) / denominator
        earned_score = _round_score(_clamp(raw_fraction, 0.0, 1.0) * max_score)
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": earned_score,
            "max_score": max_score,
            "status": _infer_status(earned_score, max_score),
            "method": "partial_credit",
            "feedback": (
                f"Matched {correct_selections} correct option(s) with {wrong_selections} wrong selection(s)."
                if 0 < earned_score < max_score
                else None
            ),
        }

    exact_match = len(selected) == len(expected) and all(item in selected for item in expected)
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": max_score if exact_match else 0.0,
        "max_score": max_score,
        "status": "correct" if exact_match else "incorrect",
        "method": "exact_match",
    }


def _grade_true_false_quiz(
    quiz_template: dict[str, Any], answer: Any, max_score: float
) -> dict[str, Any]:
    config = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    strategy = _get_choice_scoring_strategy(config)
    if strategy not in {"exact_match", "option_points"}:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": f"Unsupported true_false grading strategy: {strategy}.",
        }

    selected_key = _normalize_true_false_answer_key(
        _get_option_selected_answer(quiz_template, answer)
    )
    if selected_key is None:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "True/false grading expects a boolean, true/false string, or structured answer with selected.",
        }

    option_points = _get_choice_option_points(config)
    if strategy == "option_points":
        raw_score = (
            float(option_points.get(selected_key, 0.0))
            if option_points and _is_number(option_points.get(selected_key))
            else 0.0
        )
        earned_score = _round_score(_clamp(raw_score, 0.0, max_score))
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": earned_score,
            "max_score": max_score,
            "status": _infer_status(earned_score, max_score),
            "method": "option_points",
        }

    official_answer = quiz_template.get("answer")
    if official_answer is None:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
            "feedback": "This true_false quiz does not define an answer key.",
        }

    expected_key = _normalize_true_false_answer_key(official_answer)
    if expected_key is None:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "True/false answer key must be a boolean or true/false string.",
        }

    correct = selected_key == expected_key
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": max_score if correct else 0.0,
        "max_score": max_score,
        "status": "correct" if correct else "incorrect",
        "method": "exact_match",
    }


def _normalize_blank_rule(blank: dict[str, Any], config_rule: dict[str, Any] | None) -> dict[str, Any]:
    normalize_rules = config_rule.get("normalize") if isinstance(config_rule, dict) else None
    accepted_answers = config_rule.get("accepted_answers") if isinstance(config_rule, dict) else None
    return {
        "key": blank["key"],
        "normalize": normalize_rules if isinstance(normalize_rules, list) and normalize_rules else DEFAULT_BLANK_NORMALIZE,
        "accepted_answers": accepted_answers if isinstance(accepted_answers, list) and accepted_answers else [blank["answer"]],
        "numeric": config_rule.get("numeric") if isinstance(config_rule, dict) else None,
    }


def _match_blank_value(value: str, rule: dict[str, Any]) -> dict[str, Any]:
    numeric_rule = rule.get("numeric")
    if isinstance(numeric_rule, dict):
        parsed_value = _parse_numberish_value(value, numeric_rule.get("unit"))
        tolerance = float(numeric_rule.get("tolerance", 0)) if _is_number(numeric_rule.get("tolerance")) else 0.0
        if parsed_value is not None and abs(parsed_value - float(numeric_rule["target"])) <= tolerance:
            return {
                "matched": True,
                "method": "numeric_tolerance",
                "matched_value": str(numeric_rule["target"]),
            }

    normalize_rules = rule.get("normalize") if isinstance(rule.get("normalize"), list) else DEFAULT_BLANK_NORMALIZE
    normalized_value = _normalize_text(value, normalize_rules)
    for candidate in rule.get("accepted_answers", []):
        if isinstance(candidate, str) and normalized_value == _normalize_text(candidate, normalize_rules):
            return {
                "matched": True,
                "method": "normalized_match",
                "matched_value": candidate,
            }
    return {"matched": False, "method": "normalized_match"}


def _grade_blank_quiz_deterministic(
    quiz_template: dict[str, Any], answer: Any, max_score: float
) -> dict[str, Any]:
    blanks = quiz_template.get("blanks")
    if not isinstance(blanks, list) or not blanks:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
            "feedback": "This blank quiz does not define blank answers.",
        }

    if not isinstance(answer, dict):
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "Blank grading expects a dict keyed by blank key.",
        }

    grading = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    config_rules = grading.get("blanks") if isinstance(grading.get("blanks"), list) else []
    rule_map = {
        rule["key"]: rule
        for rule in config_rules
        if isinstance(rule, dict) and isinstance(rule.get("key"), str)
    }
    score_per_blank = max_score / len(blanks)
    blank_results: list[dict[str, Any]] = []
    earned_score = 0.0

    for blank in blanks:
        if not isinstance(blank, dict) or not isinstance(blank.get("key"), str):
            continue
        raw_value = answer.get(blank["key"])
        value = raw_value if isinstance(raw_value, str) else ""
        rule = _normalize_blank_rule(blank, rule_map.get(blank["key"]))
        matched = _match_blank_value(value, rule)
        blank_score = score_per_blank if matched["matched"] else 0.0
        earned_score += blank_score
        blank_results.append(
            {
                "key": blank["key"],
                "earned_score": _round_score(blank_score),
                "max_score": _round_score(score_per_blank),
                "status": "correct" if matched["matched"] else "incorrect",
                "method": matched["method"],
                "matched_value": matched.get("matched_value") if matched["matched"] else None,
                "feedback": None if matched["matched"] else "Answer did not match the accepted responses.",
            }
        )

    normalized_earned = _round_score(earned_score)
    correct_count = len([item for item in blank_results if item["status"] == "correct"])
    method = "numeric_tolerance" if any(item["method"] == "numeric_tolerance" for item in blank_results) else "normalized_match"
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": normalized_earned,
        "max_score": max_score,
        "status": _infer_status(normalized_earned, max_score),
        "method": method,
        "blank_results": blank_results,
        "feedback": None if correct_count == len(blanks) else f"{correct_count} / {len(blanks)} blank(s) matched.",
    }


def _find_keyword_evidence(answer: str, keywords: list[str]) -> str | None:
    lowered = _normalize_text(answer, ["fullwidth_to_halfwidth", "lowercase", "collapse_whitespace"])
    for keyword in keywords:
        normalized_keyword = _normalize_text(keyword, ["fullwidth_to_halfwidth", "lowercase", "collapse_whitespace"])
        if not normalized_keyword:
            continue
        index = lowered.find(normalized_keyword)
        if index >= 0:
            return answer[index : min(len(answer), index + len(keyword) + 24)].strip()
    return None


def _grade_open_quiz_keyword_rubric(
    quiz_template: dict[str, Any], answer: Any, max_score: float
) -> dict[str, Any]:
    if not isinstance(answer, str):
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "error",
            "method": "invalid_answer",
            "feedback": "Open-question grading expects a string answer.",
        }

    grading = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    rubric_items = grading.get("rubric_items")
    if not isinstance(rubric_items, list) or not rubric_items:
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "needs_review",
            "method": "manual",
            "review_required": True,
            "feedback": "Keyword rubric grading requires grading.rubric_items.",
        }

    rubric_results: list[dict[str, Any]] = []
    earned_score = 0.0
    matched_count = 0
    for item in rubric_items:
        if not isinstance(item, dict):
            continue
        keywords = [
            keyword for keyword in item.get("keywords", [])
            if isinstance(keyword, str) and keyword.strip()
        ]
        evidence = _find_keyword_evidence(answer, keywords) if keywords else None
        matched = bool(evidence)
        points = float(item["points"]) if _is_number(item.get("points")) else 0.0
        if matched:
            earned_score += points
            matched_count += 1
        rubric_results.append(
            {
                "id": item.get("id"),
                "earned_score": points if matched else 0.0,
                "max_score": points,
                "matched": matched,
                "evidence": evidence,
                "feedback": None if matched else item.get("desc"),
            }
        )

    normalized_earned = _round_score(_clamp(earned_score, 0.0, max_score))
    confidence = matched_count / len(rubric_items) if rubric_items else None
    review_required = (
        _is_number(grading.get("require_review_below"))
        and confidence is not None
        and confidence < float(grading["require_review_below"])
    )
    missing_ids = [
        str(item.get("id"))
        for item in rubric_items
        if isinstance(item, dict) and not next(
            (result for result in rubric_results if result.get("id") == item.get("id") and result.get("matched")),
            None,
        )
    ]
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": normalized_earned,
        "max_score": max_score,
        "status": _infer_status(normalized_earned, max_score),
        "method": "keyword_rubric",
        "rubric_results": rubric_results,
        "confidence": confidence,
        "review_required": review_required,
        "feedback": None if not missing_ids else "Missing rubric items: " + ", ".join(missing_ids) + ".",
    }


def grade_quiz_answer(
    quiz_template: dict[str, Any],
    answer: Any,
    grading_provider: GradeProvider | None = None,
) -> dict[str, Any]:
    max_score = resolve_quiz_max_score(quiz_template)
    quiz_type = quiz_template.get("type")

    if _is_unanswered_quiz_answer(quiz_template, answer):
        return {
            "quiz_id": quiz_template["id"],
            "earned_score": 0.0,
            "max_score": max_score,
            "status": "ungraded",
            "method": "manual",
        }

    if quiz_type == "choice":
        return _grade_choice_quiz(quiz_template, answer, max_score)

    if quiz_type == "true_false":
        return _grade_true_false_quiz(quiz_template, answer, max_score)

    if quiz_type == "blank":
        grading = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
        if grading.get("strategy") == "llm":
            return _request_provider_grade(
                quiz_template,
                answer,
                grading,
                max_score,
                "llm",
                grading_provider,
            )
        return _grade_blank_quiz_deterministic(quiz_template, answer, max_score)

    if quiz_type == "scale":
        return grade_scale_quiz_locally(quiz_template, answer)

    grading = quiz_template.get("grading") if isinstance(quiz_template.get("grading"), dict) else {}
    strategy = grading.get("strategy", "manual")
    if strategy == "keyword_rubric":
        return _grade_open_quiz_keyword_rubric(quiz_template, answer, max_score)
    if strategy in {"llm", "llm_rubric"}:
        return _request_provider_grade(
            quiz_template,
            answer,
            grading,
            max_score,
            "llm",
            grading_provider,
        )
    return {
        "quiz_id": quiz_template["id"],
        "earned_score": 0.0,
        "max_score": max_score,
        "status": "needs_review",
        "method": "manual",
        "review_required": True,
        "feedback": "This open question requires manual or provider-based grading.",
    }


def grade_record_quiz_answers(
    record: dict,
    quiz_templates: list[dict],
    grading_provider: GradeProvider | None = None,
) -> dict[str, Any]:
    try:
        quiz_answers = record["data"]["quiz"]
    except (KeyError, TypeError) as exc:
        raise ValueError(
            "The record must have a 'data' dict containing a 'quiz' dict."
        ) from exc

    if not isinstance(quiz_answers, dict):
        raise ValueError("The 'quiz' section must be a dictionary.")
    if not isinstance(quiz_templates, list):
        raise ValueError("The quiz_templates must be a list.")

    quiz_results: dict[str, dict[str, Any]] = {}
    total_earned_score = 0.0
    total_max_score = 0.0
    review_required_count = 0

    for template in quiz_templates:
        if not isinstance(template, dict):
            raise ValueError("Each quiz template must be a dictionary.")
        quiz_id = template.get("id") or template.get("name")
        if not isinstance(quiz_id, str) or not quiz_id:
            raise ValueError("Each quiz template must include non-empty `id` or `name`.")
        result = grade_quiz_answer(
            template,
            quiz_answers.get(quiz_id),
            grading_provider=grading_provider,
        )
        quiz_results[quiz_id] = result
        total_earned_score += float(result["earned_score"])
        total_max_score += float(result["max_score"])
        if result.get("review_required"):
            review_required_count += 1

    return {
        "quiz": quiz_results,
        "summary": {
            "total_earned_score": _round_score(total_earned_score),
            "total_max_score": _round_score(total_max_score),
            "review_required_count": review_required_count,
        },
    }


def grade_record_quiz_answers_with_aimd(
    record: dict,
    aimd_content: str,
    grading_provider: GradeProvider | None = None,
) -> dict[str, Any]:
    parsed = parse_aimd(aimd_content)
    quiz_templates = parsed["templates"]["quiz"]
    return grade_record_quiz_answers(
        record=record,
        quiz_templates=quiz_templates,
        grading_provider=grading_provider,
    )
