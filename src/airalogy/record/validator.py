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


def _get_choice_option_metadata(
    options: Any,
) -> tuple[list[str], dict[str, list[dict[str, Any]]]]:
    option_keys: list[str] = []
    followups_by_option: dict[str, list[dict[str, Any]]] = {}

    if not isinstance(options, list):
        return option_keys, followups_by_option

    for option in options:
        if not isinstance(option, dict) or not isinstance(option.get("key"), str):
            continue
        option_key = option["key"]
        option_keys.append(option_key)

        followups = option.get("followups")
        if not isinstance(followups, list):
            continue

        normalized_followups = [
            followup
            for followup in followups
            if isinstance(followup, dict) and isinstance(followup.get("key"), str)
        ]
        if normalized_followups:
            followups_by_option[option_key] = normalized_followups

    return option_keys, followups_by_option


def _followup_type_label(field_type: str) -> str:
    return {
        "str": "a string",
        "int": "an int",
        "float": "a float",
        "bool": "a boolean",
    }.get(field_type, field_type)


def _followup_value_matches_type(value: Any, field_type: str) -> bool:
    if field_type == "str":
        return isinstance(value, str)
    if field_type == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if field_type == "float":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if field_type == "bool":
        return isinstance(value, bool)
    return False


def _validate_choice_answer_with_followups(
    quiz_id: str,
    mode: Any,
    answer: Any,
    option_keys: list[str],
    followups_by_option: dict[str, list[dict[str, Any]]],
    require_complete: bool,
    errors: list[str],
) -> None:
    if not isinstance(answer, dict):
        errors.append(
            f"Choice answer for {quiz_id} with followups must be a dict containing selected."
        )
        return

    unsupported_keys = sorted(
        str(key) for key in answer.keys() if key not in {"selected", "followups"}
    )
    if unsupported_keys:
        errors.append(
            f"Choice answer for {quiz_id} contains unsupported keys: {', '.join(unsupported_keys)}."
        )

    selected = answer.get("selected")
    selected_keys: list[str] = []
    if mode == "single":
        if not isinstance(selected, str):
            errors.append(
                f"Choice(single) selected value for {quiz_id} must be a string option key."
            )
            return
        if selected not in option_keys:
            errors.append(
                f"Choice(single) selected value for {quiz_id} must be one of: {', '.join(option_keys)}."
            )
            return
        selected_keys = [selected]
    elif mode == "multiple":
        if not isinstance(selected, list):
            errors.append(
                f"Choice(multiple) selected value for {quiz_id} must be a list of option keys."
            )
            return
        invalid_items = [
            item for item in selected if not isinstance(item, str) or item not in option_keys
        ]
        if invalid_items:
            errors.append(
                f"Choice(multiple) selected value for {quiz_id} contains invalid option keys: {invalid_items}."
            )
            return
        selected_keys = [item for item in selected if isinstance(item, str)]
    else:
        errors.append(f"Invalid choice mode in quiz template {quiz_id}: {mode}.")
        return

    followup_answers = answer.get("followups", {})
    if followup_answers is None:
        followup_answers = {}
    if not isinstance(followup_answers, dict):
        errors.append(
            f"Choice followups for {quiz_id} must be a dict keyed by selected option key."
        )
        return

    unknown_option_keys = sorted(
        str(key) for key in followup_answers.keys() if key not in option_keys
    )
    if unknown_option_keys:
        errors.append(
            f"Choice followups for {quiz_id} contain unknown option keys: {', '.join(unknown_option_keys)}."
        )

    unselected_option_keys = sorted(
        str(key)
        for key in followup_answers.keys()
        if key in option_keys and key not in selected_keys
    )
    if unselected_option_keys:
        errors.append(
            f"Choice followups for {quiz_id} contain unselected option keys: {', '.join(unselected_option_keys)}."
        )

    for selected_key in selected_keys:
        followup_defs = followups_by_option.get(selected_key, [])
        raw_field_answers = followup_answers.get(selected_key, {})
        if raw_field_answers is None:
            raw_field_answers = {}

        if not followup_defs:
            if isinstance(raw_field_answers, dict) and raw_field_answers:
                errors.append(
                    f"Choice followups for {quiz_id}.{selected_key} are not defined."
                )
            continue

        if not isinstance(raw_field_answers, dict):
            errors.append(
                f"Choice followups for {quiz_id}.{selected_key} must be a dict keyed by followup key."
            )
            continue

        followup_keys = [
            followup["key"]
            for followup in followup_defs
            if isinstance(followup.get("key"), str)
        ]
        unknown_field_keys = sorted(
            str(key) for key in raw_field_answers.keys() if key not in followup_keys
        )
        if unknown_field_keys:
            errors.append(
                f"Choice followups for {quiz_id}.{selected_key} contain unknown keys: {', '.join(unknown_field_keys)}."
            )

        if require_complete:
            missing_required_keys = sorted(
                followup["key"]
                for followup in followup_defs
                if isinstance(followup.get("key"), str)
                and followup.get("required", True)
                and followup["key"] not in raw_field_answers
            )
            if missing_required_keys:
                errors.append(
                    f"Choice followups for {quiz_id}.{selected_key} are missing required keys: {', '.join(missing_required_keys)}."
                )

        for followup in followup_defs:
            followup_key = followup.get("key")
            field_type = followup.get("type")
            if not isinstance(followup_key, str) or not isinstance(field_type, str):
                continue
            if followup_key not in raw_field_answers:
                continue
            value = raw_field_answers[followup_key]
            if not _followup_value_matches_type(value, field_type):
                errors.append(
                    f"Choice followup answer for {quiz_id}.{selected_key}.{followup_key} "
                    f"must be {_followup_type_label(field_type)}."
                )


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
            option_keys, followups_by_option = _get_choice_option_metadata(options)

            if followups_by_option:
                _validate_choice_answer_with_followups(
                    quiz_id=quiz_id,
                    mode=mode,
                    answer=answer,
                    option_keys=option_keys,
                    followups_by_option=followups_by_option,
                    require_complete=require_complete,
                    errors=errors,
                )
                continue

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

        elif quiz_type == "true_false":
            if not isinstance(answer, bool):
                errors.append(f"True/false answer for {quiz_id} must be a boolean.")

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

        elif quiz_type == "scale":
            items = template.get("items")
            options = template.get("options")
            item_keys: list[str] = []
            option_keys: list[str] = []

            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and isinstance(item.get("key"), str):
                        item_keys.append(item["key"])
            if isinstance(options, list):
                for option in options:
                    if isinstance(option, dict) and isinstance(option.get("key"), str):
                        option_keys.append(option["key"])

            if not item_keys:
                errors.append(
                    f"Invalid scale quiz template {quiz_id}: items must contain at least one key."
                )
                continue
            if not option_keys:
                errors.append(
                    f"Invalid scale quiz template {quiz_id}: options must contain at least one key."
                )
                continue

            if not isinstance(answer, dict):
                errors.append(
                    f"Scale answer for {quiz_id} must be a dict keyed by item key."
                )
                continue

            unknown_item_keys = sorted(k for k in answer.keys() if k not in item_keys)
            if unknown_item_keys:
                errors.append(
                    f"Scale answer for {quiz_id} contains unknown keys: {', '.join(unknown_item_keys)}."
                )

            if require_complete:
                missing_item_keys = sorted(k for k in item_keys if k not in answer)
                if missing_item_keys:
                    errors.append(
                        f"Scale answer for {quiz_id} is missing keys: {', '.join(missing_item_keys)}."
                    )

            for key, value in answer.items():
                if key not in item_keys:
                    continue
                if not isinstance(value, str):
                    errors.append(
                        f"Scale answer value for {quiz_id}.{key} must be a string option key."
                    )
                elif value not in option_keys:
                    errors.append(
                        f"Scale answer value for {quiz_id}.{key} must be one of: {', '.join(option_keys)}."
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
