from typing import Any

from airalogy.markdown import parse_aimd


def all_var_ids_in_records(records: list[dict], var_ids: list[str]) -> bool:
    if not records:
        raise ValueError("The records list cannot be empty.")
    if not var_ids:
        raise ValueError("The var_ids list cannot be empty.")
    var_ids_set = set(var_ids)
    for record in records:
        try:
            var_dict = record["data"]["var"]
            if not isinstance(var_dict, dict):
                raise ValueError("The 'var' section must be a dictionary.")
        except (KeyError, TypeError) as exc:
            raise ValueError(
                "Each record must have a 'data' dict containing a 'var' dict."
            ) from exc
        if not var_ids_set.issubset(var_dict.keys()):
            return False
    return True


def validate_record_quiz_answers(
    record: dict,
    quiz_templates: list[dict],
    require_complete: bool = True,
) -> tuple[bool, list[str]]:
    """
    Validate `record["data"]["quiz"]` against parsed quiz template definitions.

    Args:
        record: Record JSON object containing `data.quiz`.
        quiz_templates: Parsed quiz template list from `parse_aimd(...)[\"templates\"][\"quiz\"]`.
        require_complete: Whether to require every quiz item to have an answer.

    Returns:
        (is_valid, errors)

    Raises:
        ValueError: If the record/template container structure is invalid.
    """
    if not isinstance(record, dict):
        raise ValueError("The record must be a dictionary.")
    if not isinstance(quiz_templates, list):
        raise ValueError("The quiz_templates must be a list.")

    try:
        quiz_answers = record["data"]["quiz"]
    except (KeyError, TypeError) as exc:
        raise ValueError(
            "The record must have a 'data' dict containing a 'quiz' dict."
        ) from exc

    if not isinstance(quiz_answers, dict):
        raise ValueError("The 'quiz' section must be a dictionary.")

    template_by_id: dict[str, dict[str, Any]] = {}
    for template in quiz_templates:
        if not isinstance(template, dict):
            raise ValueError("Each quiz template must be a dictionary.")
        quiz_id = template.get("id") or template.get("name")
        if not isinstance(quiz_id, str) or not quiz_id:
            raise ValueError("Each quiz template must include non-empty `id` or `name`.")
        if quiz_id in template_by_id:
            raise ValueError(f"Duplicate quiz id in templates: {quiz_id}")
        template_by_id[quiz_id] = template

    errors: list[str] = []

    unknown_quiz_ids = sorted(qid for qid in quiz_answers if qid not in template_by_id)
    for quiz_id in unknown_quiz_ids:
        errors.append(f"Unknown quiz id in record data: {quiz_id}")

    for quiz_id, template in template_by_id.items():
        if quiz_id not in quiz_answers:
            if require_complete:
                errors.append(f"Missing answer for quiz id: {quiz_id}")
            continue

        answer = quiz_answers[quiz_id]
        quiz_type = template.get("type")

        if quiz_type == "choice":
            mode = template.get("mode")
            options = template.get("options")
            option_keys: list[str] = []
            if isinstance(options, list):
                for option in options:
                    if isinstance(option, dict) and isinstance(option.get("key"), str):
                        option_keys.append(option["key"])

            if mode == "single":
                if not isinstance(answer, str):
                    errors.append(
                        f"Choice(single) answer for {quiz_id} must be a string option key."
                    )
                elif answer not in option_keys:
                    errors.append(
                        f"Choice(single) answer for {quiz_id} must be one of: {', '.join(option_keys)}."
                    )
            elif mode == "multiple":
                if not isinstance(answer, list):
                    errors.append(
                        f"Choice(multiple) answer for {quiz_id} must be a list of option keys."
                    )
                else:
                    invalid_items = [
                        item
                        for item in answer
                        if not isinstance(item, str) or item not in option_keys
                    ]
                    if invalid_items:
                        errors.append(
                            f"Choice(multiple) answer for {quiz_id} contains invalid option keys: {invalid_items}."
                        )
            else:
                errors.append(f"Invalid choice mode in quiz template {quiz_id}: {mode}.")

        elif quiz_type == "blank":
            blanks = template.get("blanks")
            blank_keys: list[str] = []
            if isinstance(blanks, list):
                for blank in blanks:
                    if isinstance(blank, dict) and isinstance(blank.get("key"), str):
                        blank_keys.append(blank["key"])
            if not blank_keys:
                errors.append(
                    f"Invalid blank quiz template {quiz_id}: blanks must contain at least one key."
                )
                continue

            if not isinstance(answer, dict):
                errors.append(
                    f"Blank answer for {quiz_id} must be a dict keyed by blank key."
                )
                continue

            unknown_blank_keys = sorted(k for k in answer.keys() if k not in blank_keys)
            if unknown_blank_keys:
                errors.append(
                    f"Blank answer for {quiz_id} contains unknown keys: {', '.join(unknown_blank_keys)}."
                )

            if require_complete:
                missing_blank_keys = sorted(k for k in blank_keys if k not in answer)
                if missing_blank_keys:
                    errors.append(
                        f"Blank answer for {quiz_id} is missing keys: {', '.join(missing_blank_keys)}."
                    )

            for key, value in answer.items():
                if key in blank_keys and not isinstance(value, str):
                    errors.append(
                        f"Blank answer value for {quiz_id}.{key} must be a string."
                    )

        elif quiz_type == "open":
            if not isinstance(answer, str):
                errors.append(f"Open answer for {quiz_id} must be a string.")
        else:
            errors.append(f"Invalid quiz type in template {quiz_id}: {quiz_type}.")

    return len(errors) == 0, errors


def validate_record_quiz_answers_with_aimd(
    record: dict,
    aimd_content: str,
    require_complete: bool = True,
) -> tuple[bool, list[str]]:
    """
    Validate `record["data"]["quiz"]` directly from AIMD content.
    """
    parsed = parse_aimd(aimd_content)
    quiz_templates = parsed["templates"]["quiz"]
    return validate_record_quiz_answers(
        record=record,
        quiz_templates=quiz_templates,
        require_complete=require_complete,
    )
