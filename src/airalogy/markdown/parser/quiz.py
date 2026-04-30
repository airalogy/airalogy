"""Quiz block parsing and validation helpers for AIMD."""

import textwrap
from typing import Any, Dict, List, Optional

import yaml

from ..ast_nodes import QuizNode
from ..errors import InvalidSyntaxError
from ..tokens import Position, Token, TokenType


class QuizParserMixin:
    TRUE_FALSE_OPTION_KEYS = {"true", "false"}

    def _normalize_choice_mode(self, mode: str, position: Position) -> Optional[str]:
        """
        Normalize choice mode to either "single" or "multiple".
        """
        normalized = mode.strip().lower()
        if normalized in {"single", "multiple"}:
            return normalized

        error = InvalidSyntaxError(
            "Invalid choice mode, expected one of: single, multiple",
            position=position,
        )
        self._handle_error(error)
        return None

    def _normalize_scale_display(
        self, display: str, position: Position
    ) -> Optional[str]:
        """
        Normalize scale display to either "matrix" or "list".
        """
        normalized = display.strip().lower()
        if normalized in {"matrix", "list"}:
            return normalized

        error = InvalidSyntaxError(
            "scale display must be one of: matrix, list",
            position=position,
        )
        self._handle_error(error)
        return None

    def _normalize_followup_type(
        self, value: Any, field_name: str, position: Position
    ) -> Optional[str]:
        if not isinstance(value, str) or not value.strip():
            error = InvalidSyntaxError(
                f"{field_name}.type must be one of: str, int, float, bool",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized = value.strip()
        if normalized in {"str", "int", "float", "bool"}:
            return normalized

        error = InvalidSyntaxError(
            f"{field_name}.type must be one of: str, int, float, bool",
            position=position,
        )
        self._handle_error(error)
        return None

    def _followup_value_matches_type(self, value: Any, field_type: str) -> bool:
        if field_type == "str":
            return isinstance(value, str)
        if field_type == "int":
            return isinstance(value, int) and not isinstance(value, bool)
        if field_type == "float":
            return isinstance(value, (int, float)) and not isinstance(value, bool)
        if field_type == "bool":
            return isinstance(value, bool)
        return False

    def _normalize_option_followups(
        self, value: Any, option_key: str, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                f"options.{option_key}.followups must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_followups: List[Dict[str, Any]] = []
        seen_keys = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    f"options.{option_key}.followups must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            key = item.get("key")
            if not isinstance(key, str) or not key.strip():
                error = InvalidSyntaxError(
                    f"Each options.{option_key}.followups item must include a non-empty key",
                    position=position,
                )
                self._handle_error(error)
                return None
            key = key.strip()
            if not self.NAME_PATTERN.match(key):
                error = InvalidSyntaxError(
                    f"Invalid key in options.{option_key}.followups: {key}. "
                    "Keys must start with a letter and contain only letters, digits, and underscores",
                    position=position,
                )
                self._handle_error(error)
                return None
            if key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in options.{option_key}.followups: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(key)

            field_type = self._normalize_followup_type(
                item.get("type"),
                f"options.{option_key}.followups.{key}",
                position,
            )
            if field_type is None:
                return None

            normalized_item: Dict[str, Any] = {
                "key": key,
                "type": field_type,
                "required": True,
            }
            required = item.get("required")
            if required is not None:
                if not isinstance(required, bool):
                    error = InvalidSyntaxError(
                        f"options.{option_key}.followups.{key}.required must be a boolean",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                normalized_item["required"] = required

            for field in ["title", "description", "unit"]:
                field_value = item.get(field)
                if field_value is None:
                    continue
                if not isinstance(field_value, str) or not field_value.strip():
                    error = InvalidSyntaxError(
                        f"options.{option_key}.followups.{key}.{field} must be a non-empty string",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                normalized_item[field] = field_value.strip()

            if "default" in item:
                default_value = item["default"]
                if not self._followup_value_matches_type(default_value, field_type):
                    error = InvalidSyntaxError(
                        f"options.{option_key}.followups.{key}.default must match type {field_type}",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                normalized_item["default"] = (
                    float(default_value) if field_type == "float" else default_value
                )

            normalized_followups.append(normalized_item)

        return normalized_followups

    def _normalize_choice_options(
        self, value: Any, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                "options must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_options: List[Dict[str, Any]] = []
        seen_keys = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "options must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            key = item.get("key")
            text = item.get("text")
            key = key.strip() if isinstance(key, str) else ""
            text = str(text).strip() if text is not None else ""

            if not key or not text:
                error = InvalidSyntaxError(
                    "Each options item must include non-empty fields: key, text",
                    position=position,
                )
                self._handle_error(error)
                return None
            if not self.NAME_PATTERN.match(key):
                error = InvalidSyntaxError(
                    f"Invalid key in options: {key}. Keys must start with a letter and contain only letters, digits, and underscores",
                    position=position,
                )
                self._handle_error(error)
                return None
            if key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in options: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(key)

            normalized_option: Dict[str, Any] = {
                "key": key,
                "text": text,
            }
            for field, field_value in item.items():
                field = str(field)
                if field in {"key", "text", "followups"}:
                    continue
                normalized_value = str(field_value).strip()
                if normalized_value:
                    normalized_option[field] = normalized_value

            followups = item.get("followups")
            if followups is not None:
                normalized_followups = self._normalize_option_followups(
                    followups,
                    key,
                    position,
                )
                if normalized_followups is None:
                    return None
                normalized_option["followups"] = normalized_followups

            normalized_options.append(normalized_option)

        return normalized_options

    def _normalize_true_false_key(self, value: Any) -> Optional[str]:
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in self.TRUE_FALSE_OPTION_KEYS:
                return normalized
        return None

    def _normalize_true_false_answer(
        self, value: Any, field_name: str, position: Position
    ) -> Optional[bool]:
        normalized_key = self._normalize_true_false_key(value)
        if normalized_key is not None:
            return normalized_key == "true"

        error = InvalidSyntaxError(
            f"{field_name} must be a boolean or one of: true, false",
            position=position,
        )
        self._handle_error(error)
        return None

    def _normalize_true_false_options(
        self, value: Any, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if value is None:
            return [
                {"key": "true", "text": "True"},
                {"key": "false", "text": "False"},
            ]

        if not isinstance(value, list) or len(value) != 2:
            error = InvalidSyntaxError(
                "true_false options must contain exactly true and false",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_options: List[Dict[str, Any]] = []
        seen_keys = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "true_false options must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            key = self._normalize_true_false_key(item.get("key"))
            text = item.get("text")
            text = str(text).strip() if text is not None else ""
            if key is None or not text:
                error = InvalidSyntaxError(
                    "Each true_false options item must include key true/false and non-empty text",
                    position=position,
                )
                self._handle_error(error)
                return None
            if key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in true_false options: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(key)

            normalized_option: Dict[str, Any] = {
                "key": key,
                "text": text,
            }
            explanation = item.get("explanation")
            if isinstance(explanation, str) and explanation.strip():
                normalized_option["explanation"] = explanation.strip()

            followups = item.get("followups")
            if followups is not None:
                normalized_followups = self._normalize_option_followups(
                    followups,
                    key,
                    position,
                )
                if normalized_followups is None:
                    return None
                normalized_option["followups"] = normalized_followups
            normalized_options.append(normalized_option)

        if seen_keys != self.TRUE_FALSE_OPTION_KEYS:
            error = InvalidSyntaxError(
                "true_false options must contain exactly true and false",
                position=position,
            )
            self._handle_error(error)
            return None

        return normalized_options

    def _normalize_quiz_type(
        self, quiz_type: str, position: Position
    ) -> Optional[str]:
        """
        Normalize quiz type.
        """
        normalized = quiz_type.strip().lower()
        if normalized in {"choice", "true_false", "blank", "open", "scale"}:
            return normalized

        error = InvalidSyntaxError(
            "Invalid quiz type, expected one of: choice, true_false, blank, open, scale",
            position=position,
        )
        self._handle_error(error)
        return None

    def _parse_quiz_yaml_mapping(
        self, code: str, position: Position
    ) -> Optional[Dict[str, Any]]:
        """
        Parse one `quiz` code block payload as a YAML mapping.
        """
        try:
            parsed = yaml.safe_load(code) if code.strip() else {}
        except yaml.YAMLError as exc:
            error_message = "Invalid quiz YAML syntax"
            if getattr(exc, "problem", None):
                error_message = f"{error_message}: {exc.problem}"

            error_position = position
            mark = getattr(exc, "problem_mark", None)
            if mark is not None:
                line = position.start_line + 1 + mark.line
                col = mark.column + 1
                error_position = Position(
                    start_line=line,
                    end_line=line,
                    start_col=col,
                    end_col=col + 1,
                )

            error = InvalidSyntaxError(error_message, position=error_position)
            self._handle_error(error)
            return None

        if parsed is None:
            return {}

        if not isinstance(parsed, dict):
            error = InvalidSyntaxError(
                "quiz block must be a YAML mapping/object",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized: Dict[str, Any] = {}
        for key, value in parsed.items():
            if not isinstance(key, str):
                error = InvalidSyntaxError(
                    "quiz field names must be strings",
                    position=position,
                )
                self._handle_error(error)
                return None
            normalized[key] = value

        return normalized

    def _normalize_keyed_items(
        self,
        items: Any,
        section_name: str,
        required_fields: List[str],
        position: Position,
        optional_fields: Optional[List[str]] = None,
    ) -> Optional[List[Dict[str, str]]]:
        """
        Normalize list items with a required `key` and other required fields.
        """
        if not isinstance(items, list) or not items:
            error = InvalidSyntaxError(
                f"{section_name} must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_items: List[Dict[str, str]] = []
        seen_keys = set()
        for item in items:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    f"{section_name} must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            normalized_item: Dict[str, str] = {}
            for key, value in item.items():
                normalized_item[str(key)] = str(value).strip()

            missing_fields = [
                field
                for field in required_fields
                if field not in normalized_item or not normalized_item[field]
            ]
            if missing_fields:
                error = InvalidSyntaxError(
                    f"Each {section_name} item must include non-empty fields: {', '.join(required_fields)}",
                    position=position,
                )
                self._handle_error(error)
                return None

            item_key = normalized_item["key"]
            if not self.NAME_PATTERN.match(item_key):
                error = InvalidSyntaxError(
                    "Invalid key in "
                    + section_name
                    + f": {item_key}. Keys must start with a letter and contain only letters, digits, and underscores",
                    position=position,
                )
                self._handle_error(error)
                return None
            if item_key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in {section_name}: {item_key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(item_key)
            for field in optional_fields or []:
                raw_value = item.get(field)
                if raw_value is None:
                    continue
                normalized_value = str(raw_value).strip()
                if normalized_value:
                    normalized_item[field] = normalized_value
            normalized_items.append(normalized_item)

        return normalized_items

    def _normalize_string_list(
        self, value: Any, field_name: str, position: Position
    ) -> Optional[List[str]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                f"{field_name} must be a non-empty list of strings",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized: List[str] = []
        for item in value:
            if not isinstance(item, str) or not item.strip():
                error = InvalidSyntaxError(
                    f"{field_name} must contain only non-empty strings",
                    position=position,
                )
                self._handle_error(error)
                return None
            normalized.append(item.strip())
        return normalized

    def _normalize_numeric_rule(
        self, value: Any, field_name: str, position: Position
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            error = InvalidSyntaxError(
                f"{field_name} must be an object",
                position=position,
            )
            self._handle_error(error)
            return None

        target = value.get("target")
        if isinstance(target, bool) or not isinstance(target, (int, float)):
            error = InvalidSyntaxError(
                f"{field_name}.target must be a number",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized: Dict[str, Any] = {"target": float(target)}
        tolerance = value.get("tolerance")
        if tolerance is not None:
            if isinstance(tolerance, bool) or not isinstance(tolerance, (int, float)) or tolerance < 0:
                error = InvalidSyntaxError(
                    f"{field_name}.tolerance must be a non-negative number",
                    position=position,
                )
                self._handle_error(error)
                return None
            normalized["tolerance"] = float(tolerance)

        unit = value.get("unit")
        if unit is not None:
            if not isinstance(unit, str) or not unit.strip():
                error = InvalidSyntaxError(
                    f"{field_name}.unit must be a non-empty string",
                    position=position,
                )
                self._handle_error(error)
                return None
            normalized["unit"] = unit.strip()

        return normalized

    def _normalize_blank_grading_rules(
        self, value: Any, blank_keys: List[str], position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                "grading.blanks must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_rules: List[Dict[str, Any]] = []
        seen_keys = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "grading.blanks must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            key = item.get("key")
            if not isinstance(key, str) or not key.strip():
                error = InvalidSyntaxError(
                    "Each grading.blanks item must include a non-empty key",
                    position=position,
                )
                self._handle_error(error)
                return None
            key = key.strip()
            if key not in blank_keys:
                error = InvalidSyntaxError(
                    f"grading.blanks contains unknown blank key: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            if key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in grading.blanks: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(key)

            normalized_rule: Dict[str, Any] = {"key": key}
            accepted_answers = item.get("accepted_answers")
            if accepted_answers is not None:
                normalized_list = self._normalize_string_list(
                    accepted_answers,
                    f"grading.blanks.{key}.accepted_answers",
                    position,
                )
                if normalized_list is None:
                    return None
                normalized_rule["accepted_answers"] = normalized_list

            normalize_rules = item.get("normalize")
            if normalize_rules is not None:
                normalized_list = self._normalize_string_list(
                    normalize_rules,
                    f"grading.blanks.{key}.normalize",
                    position,
                )
                if normalized_list is None:
                    return None
                valid_rules = {
                    "trim",
                    "lowercase",
                    "collapse_whitespace",
                    "remove_spaces",
                    "fullwidth_to_halfwidth",
                }
                invalid_rules = [rule for rule in normalized_list if rule not in valid_rules]
                if invalid_rules:
                    error = InvalidSyntaxError(
                        "Invalid grading.blanks."
                        + key
                        + ".normalize item(s): "
                        + ", ".join(invalid_rules),
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                normalized_rule["normalize"] = normalized_list

            numeric = item.get("numeric")
            if numeric is not None:
                normalized_numeric = self._normalize_numeric_rule(
                    numeric,
                    f"grading.blanks.{key}.numeric",
                    position,
                )
                if normalized_numeric is None:
                    return None
                normalized_rule["numeric"] = normalized_numeric

            normalized_rules.append(normalized_rule)

        return normalized_rules

    def _normalize_rubric_items(
        self, value: Any, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                "grading.rubric_items must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_items: List[Dict[str, Any]] = []
        seen_ids = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "grading.rubric_items must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            rubric_id = item.get("id")
            if not isinstance(rubric_id, str) or not rubric_id.strip():
                error = InvalidSyntaxError(
                    "Each grading.rubric_items item must include a non-empty id",
                    position=position,
                )
                self._handle_error(error)
                return None
            rubric_id = rubric_id.strip()
            if rubric_id in seen_ids:
                error = InvalidSyntaxError(
                    f"Duplicate id in grading.rubric_items: {rubric_id}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_ids.add(rubric_id)

            desc = item.get("desc")
            if not isinstance(desc, str) or not desc.strip():
                error = InvalidSyntaxError(
                    f"grading.rubric_items.{rubric_id}.desc must be a non-empty string",
                    position=position,
                )
                self._handle_error(error)
                return None

            points = item.get("points")
            if isinstance(points, bool) or not isinstance(points, (int, float)) or points < 0:
                error = InvalidSyntaxError(
                    f"grading.rubric_items.{rubric_id}.points must be a non-negative number",
                    position=position,
                )
                self._handle_error(error)
                return None

            normalized_item: Dict[str, Any] = {
                "id": rubric_id,
                "desc": desc.strip(),
                "points": float(points),
            }

            keywords = item.get("keywords")
            if keywords is not None:
                normalized_keywords = self._normalize_string_list(
                    keywords,
                    f"grading.rubric_items.{rubric_id}.keywords",
                    position,
                )
                if normalized_keywords is None:
                    return None
                normalized_item["keywords"] = normalized_keywords

            normalized_items.append(normalized_item)

        return normalized_items

    def _normalize_scale_options(
        self, value: Any, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                "options must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_options: List[Dict[str, Any]] = []
        seen_keys = set()
        for item in value:
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "options must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            key = item.get("key")
            text = item.get("text")
            points = item.get("points")

            key = key.strip() if isinstance(key, str) else ""
            text = text.strip() if isinstance(text, str) else ""

            if not key or not text:
                error = InvalidSyntaxError(
                    "Each options item must include non-empty fields: key, text, points",
                    position=position,
                )
                self._handle_error(error)
                return None
            if not self.NAME_PATTERN.match(key):
                error = InvalidSyntaxError(
                    f"Invalid key in options: {key}. Keys must start with a letter and contain only letters, digits, and underscores",
                    position=position,
                )
                self._handle_error(error)
                return None
            if key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in options: {key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(key)

            if isinstance(points, bool) or not isinstance(points, (int, float)):
                error = InvalidSyntaxError(
                    f"options.{key}.points must be a finite number",
                    position=position,
                )
                self._handle_error(error)
                return None

            normalized_option: Dict[str, Any] = {
                "key": key,
                "text": text,
                "points": float(points),
            }
            explanation = item.get("explanation")
            if isinstance(explanation, str) and explanation.strip():
                normalized_option["explanation"] = explanation.strip()

            normalized_options.append(normalized_option)

        return normalized_options

    def _normalize_scale_bands(
        self, value: Any, position: Position
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(value, list) or not value:
            error = InvalidSyntaxError(
                "grading.bands must be a non-empty list",
                position=position,
            )
            self._handle_error(error)
            return None

        normalized_bands: List[Dict[str, Any]] = []
        for index, item in enumerate(value):
            if not isinstance(item, dict):
                error = InvalidSyntaxError(
                    "grading.bands must be a list of objects",
                    position=position,
                )
                self._handle_error(error)
                return None

            min_value = item.get("min")
            max_value = item.get("max")
            label = item.get("label")

            if isinstance(min_value, bool) or not isinstance(min_value, (int, float)):
                error = InvalidSyntaxError(
                    f"grading.bands[{index}].min must be a finite number",
                    position=position,
                )
                self._handle_error(error)
                return None
            if isinstance(max_value, bool) or not isinstance(max_value, (int, float)):
                error = InvalidSyntaxError(
                    f"grading.bands[{index}].max must be a finite number",
                    position=position,
                )
                self._handle_error(error)
                return None
            if float(max_value) < float(min_value):
                error = InvalidSyntaxError(
                    f"grading.bands[{index}].max must be greater than or equal to min",
                    position=position,
                )
                self._handle_error(error)
                return None
            if not isinstance(label, str) or not label.strip():
                error = InvalidSyntaxError(
                    f"grading.bands[{index}].label must be a non-empty string",
                    position=position,
                )
                self._handle_error(error)
                return None

            normalized_band: Dict[str, Any] = {
                "min": float(min_value),
                "max": float(max_value),
                "label": label.strip(),
            }
            interpretation = item.get("interpretation")
            if isinstance(interpretation, str) and interpretation.strip():
                normalized_band["interpretation"] = interpretation.strip()

            normalized_bands.append(normalized_band)

        return normalized_bands

    def _normalize_grading_config(
        self,
        value: Any,
        quiz_type: str,
        position: Position,
        *,
        blank_keys: Optional[List[str]] = None,
        option_keys: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            error = InvalidSyntaxError(
                "grading must be a YAML mapping/object",
                position=position,
            )
            self._handle_error(error)
            return None

        strategy = value.get("strategy")
        if strategy is not None and (not isinstance(strategy, str) or not strategy.strip()):
            error = InvalidSyntaxError(
                "grading.strategy must be a non-empty string",
                position=position,
            )
            self._handle_error(error)
            return None
        strategy = strategy.strip() if isinstance(strategy, str) else None

        config: Dict[str, Any] = {}

        if quiz_type in {"choice", "true_false"}:
            valid_strategies = {"auto", "exact_match", "option_points"}
            if quiz_type == "choice":
                valid_strategies.add("partial_credit")
            if strategy is not None and strategy not in valid_strategies:
                valid_strategy_text = (
                    "auto, exact_match, partial_credit, option_points"
                    if quiz_type == "choice"
                    else "auto, exact_match, option_points"
                )
                error = InvalidSyntaxError(
                    f"{quiz_type} grading.strategy must be one of: {valid_strategy_text}",
                    position=position,
                )
                self._handle_error(error)
                return None
            if strategy is not None:
                config["strategy"] = strategy
            option_points = value.get("option_points")
            if option_points is not None:
                if strategy is not None and strategy not in {"auto", "option_points"}:
                    error = InvalidSyntaxError(
                        f"grading.option_points can only be used with {quiz_type} grading strategy auto or option_points",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                if not isinstance(option_points, dict) or not option_points:
                    error = InvalidSyntaxError(
                        "grading.option_points must be a non-empty mapping from option key to score",
                        position=position,
                    )
                    self._handle_error(error)
                    return None

                normalized_option_points: Dict[str, float] = {}
                valid_option_keys = set(option_keys or [])
                for option_key, option_score in option_points.items():
                    normalized_option_key = (
                        self._normalize_true_false_key(option_key)
                        if quiz_type == "true_false"
                        else option_key
                    )
                    if normalized_option_key not in valid_option_keys:
                        error = InvalidSyntaxError(
                            f"grading.option_points contains unknown option key: {option_key}",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    if not isinstance(option_score, (int, float)) or isinstance(option_score, bool):
                        error = InvalidSyntaxError(
                            f"grading.option_points.{option_key} must be a finite number",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    normalized_option_points[normalized_option_key] = float(option_score)

                config["option_points"] = normalized_option_points

            if strategy == "option_points" and "option_points" not in config:
                error = InvalidSyntaxError(
                    f"grading.option_points is required when {quiz_type} grading.strategy is option_points",
                    position=position,
                )
                self._handle_error(error)
                return None
            return config

        if quiz_type == "scale":
            valid_strategies = {"auto", "sum"}
            if strategy is not None and strategy not in valid_strategies:
                error = InvalidSyntaxError(
                    "scale grading.strategy must be one of: auto, sum",
                    position=position,
                )
                self._handle_error(error)
                return None
            if strategy is not None:
                config["strategy"] = strategy

            bands = value.get("bands")
            if bands is not None:
                normalized_bands = self._normalize_scale_bands(bands, position)
                if normalized_bands is None:
                    return None
                config["bands"] = normalized_bands

            return config

        if quiz_type == "blank":
            valid_strategies = {"auto", "normalized_match", "llm"}
            if strategy is not None and strategy not in valid_strategies:
                error = InvalidSyntaxError(
                    "blank grading.strategy must be one of: auto, normalized_match, llm",
                    position=position,
                )
                self._handle_error(error)
                return None
            if strategy is not None:
                config["strategy"] = strategy
            provider = value.get("provider")
            if provider is not None:
                if not isinstance(provider, str) or not provider.strip():
                    error = InvalidSyntaxError(
                        "grading.provider must be a non-empty string",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                config["provider"] = provider.strip()
            prompt = value.get("prompt")
            if prompt is not None:
                if not isinstance(prompt, str) or not prompt.strip():
                    error = InvalidSyntaxError(
                        "grading.prompt must be a non-empty string",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                config["prompt"] = prompt.strip()
            blank_rules = value.get("blanks")
            if blank_rules is not None:
                normalized_rules = self._normalize_blank_grading_rules(
                    blank_rules,
                    blank_keys or [],
                    position,
                )
                if normalized_rules is None:
                    return None
                config["blanks"] = normalized_rules
            return config

        valid_strategies = {"manual", "keyword_rubric", "llm_rubric", "llm"}
        if strategy is not None and strategy not in valid_strategies:
            error = InvalidSyntaxError(
                "open grading.strategy must be one of: manual, keyword_rubric, llm_rubric, llm",
                position=position,
            )
            self._handle_error(error)
            return None
        if strategy is not None:
            config["strategy"] = strategy

        provider = value.get("provider")
        if provider is not None:
            if not isinstance(provider, str) or not provider.strip():
                error = InvalidSyntaxError(
                    "grading.provider must be a non-empty string",
                    position=position,
                )
                self._handle_error(error)
                return None
            config["provider"] = provider.strip()

        prompt = value.get("prompt")
        if prompt is not None:
            if not isinstance(prompt, str) or not prompt.strip():
                error = InvalidSyntaxError(
                    "grading.prompt must be a non-empty string",
                    position=position,
                )
                self._handle_error(error)
                return None
            config["prompt"] = prompt.strip()

        rubric_items = value.get("rubric_items")
        if rubric_items is not None:
            normalized_items = self._normalize_rubric_items(rubric_items, position)
            if normalized_items is None:
                return None
            config["rubric_items"] = normalized_items

        require_review_below = value.get("require_review_below")
        if require_review_below is not None:
            if (
                isinstance(require_review_below, bool)
                or not isinstance(require_review_below, (int, float))
                or require_review_below < 0
                or require_review_below > 1
            ):
                error = InvalidSyntaxError(
                    "grading.require_review_below must be a number between 0 and 1",
                    position=position,
                )
                self._handle_error(error)
                return None
            config["require_review_below"] = float(require_review_below)

        return config

    def _validate_blank_placeholders(
        self, stem: str, blank_keys: List[str], position: Position
    ) -> bool:
        """
        Validate that blank placeholders in stem match `blanks` definitions.
        """
        placeholder_keys = self.BLANK_PLACEHOLDER_PATTERN.findall(stem)
        if not placeholder_keys:
            error = InvalidSyntaxError(
                "blank stem must include placeholders like [[b1]]",
                position=position,
            )
            self._handle_error(error)
            return False

        duplicate_placeholder_keys: List[str] = []
        seen_placeholder_keys = set()
        for key in placeholder_keys:
            if key in seen_placeholder_keys and key not in duplicate_placeholder_keys:
                duplicate_placeholder_keys.append(key)
            seen_placeholder_keys.add(key)
        if duplicate_placeholder_keys:
            error = InvalidSyntaxError(
                "blank stem contains duplicate placeholders: "
                + ", ".join(duplicate_placeholder_keys),
                position=position,
            )
            self._handle_error(error)
            return False

        unknown_placeholder_keys: List[str] = []
        for key in placeholder_keys:
            if key not in blank_keys and key not in unknown_placeholder_keys:
                unknown_placeholder_keys.append(key)
        if unknown_placeholder_keys:
            error = InvalidSyntaxError(
                "blank stem contains undefined placeholders: "
                + ", ".join(unknown_placeholder_keys),
                position=position,
            )
            self._handle_error(error)
            return False

        missing_placeholder_keys = [
            key for key in blank_keys if key not in seen_placeholder_keys
        ]
        if missing_placeholder_keys:
            error = InvalidSyntaxError(
                "blank stem is missing placeholders for blank keys: "
                + ", ".join(missing_placeholder_keys),
                position=position,
            )
            self._handle_error(error)
            return False

        return True

    def _parse_quiz_block(self, code: str, position: Position) -> Optional[QuizNode]:
        """
        Parse one `quiz` code block into a QuizNode.
        """
        data = self._parse_quiz_yaml_mapping(code, position)
        if data is None:
            return None

        item_name = data.get("id")
        if not isinstance(item_name, str) or not item_name.strip():
            error = InvalidSyntaxError(
                "quiz id is required",
                position=position,
            )
            self._handle_error(error)
            return None
        item_name = item_name.strip()

        name_token = Token(
            type=TokenType.VAR,
            value=item_name,
            position=position,
            raw=item_name,
        )
        is_valid_name = self._validate_name(item_name, "quiz", name_token)
        if not self.strict and not is_valid_name:
            return None

        item_type_value = data.get("type")
        if item_type_value is None:
            error = InvalidSyntaxError(
                "quiz type is required (choice, true_false, blank, open, scale)",
                position=position,
            )
            self._handle_error(error)
            return None
        item_type = self._normalize_quiz_type(str(item_type_value), position)
        if item_type is None:
            return None

        stem = data.get("stem")
        if not isinstance(stem, str) or not stem.strip():
            error = InvalidSyntaxError(
                "quiz stem is required",
                position=position,
            )
            self._handle_error(error)
            return None
        stem = stem.strip()

        score = data.get("score")
        if score is not None:
            if isinstance(score, bool) or not isinstance(score, (int, float)):
                error = InvalidSyntaxError(
                    "quiz score must be a non-negative number",
                    position=position,
                )
                self._handle_error(error)
                return None
            if score < 0:
                error = InvalidSyntaxError(
                    "quiz score must be a non-negative number",
                    position=position,
                )
                self._handle_error(error)
                return None

        title = data.get("title")
        if title is not None and not isinstance(title, str):
            error = InvalidSyntaxError(
                "quiz title must be a string",
                position=position,
            )
            self._handle_error(error)
            return None

        description = data.get("description")
        if description is not None and not isinstance(description, str):
            error = InvalidSyntaxError(
                "quiz description must be a string",
                position=position,
            )
            self._handle_error(error)
            return None

        default_value = data.get("default")
        quiz_mode: Optional[str] = None
        quiz_display: Optional[str] = None
        quiz_options: List[Dict[str, Any]] = []
        quiz_answer: Optional[Any] = None
        quiz_blanks: List[Dict[str, str]] = []
        quiz_items: List[Dict[str, str]] = []
        quiz_rubric: Optional[str] = None
        quiz_grading: Optional[Dict[str, Any]] = None

        if item_type == "choice":
            mode_value = data.get("mode")
            if mode_value is None:
                error = InvalidSyntaxError(
                    "choice quiz requires mode (single or multiple)",
                    position=position,
                )
                self._handle_error(error)
                return None
            mode = self._normalize_choice_mode(str(mode_value), position)
            if mode is None:
                return None

            options = self._normalize_choice_options(
                data.get("options"),
                position=position,
            )
            if options is None:
                return None

            option_keys = [option["key"] for option in options]
            answer_value = data.get("answer")
            if answer_value is not None:
                if mode == "single":
                    if not isinstance(answer_value, str) or answer_value not in option_keys:
                        error = InvalidSyntaxError(
                            "choice answer must be one option key",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                else:
                    if not isinstance(answer_value, list):
                        error = InvalidSyntaxError(
                            "multiple choice answer must be a list of option keys",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    invalid_answers = [
                        item
                        for item in answer_value
                        if not isinstance(item, str) or item not in option_keys
                    ]
                    if invalid_answers:
                        error = InvalidSyntaxError(
                            "multiple choice answer must contain only option keys",
                            position=position,
                        )
                        self._handle_error(error)
                        return None

            if default_value is not None:
                if mode == "single":
                    if not isinstance(default_value, str) or default_value not in option_keys:
                        error = InvalidSyntaxError(
                            "single choice default must be one option key",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                else:
                    if not isinstance(default_value, list):
                        error = InvalidSyntaxError(
                            "multiple choice default must be a list of option keys",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    invalid_defaults = [
                        item
                        for item in default_value
                        if not isinstance(item, str) or item not in option_keys
                    ]
                    if invalid_defaults:
                        error = InvalidSyntaxError(
                            "multiple choice default must contain only option keys",
                            position=position,
                        )
                        self._handle_error(error)
                        return None

            quiz_mode = mode
            quiz_options = options
            if answer_value is not None:
                quiz_answer = answer_value
            grading_value = data.get("grading")
            if grading_value is not None:
                quiz_grading = self._normalize_grading_config(
                    grading_value,
                    item_type,
                    position,
                    option_keys=option_keys,
                )
                if quiz_grading is None:
                    return None

            reserved_keys = {
                "id",
                "type",
                "mode",
                "stem",
                "options",
                "score",
                "answer",
                "default",
                "grading",
                "title",
                "description",
            }
        elif item_type == "true_false":
            options = self._normalize_true_false_options(
                data.get("options"),
                position=position,
            )
            if options is None:
                return None

            option_keys = [option["key"] for option in options]
            answer_value = data.get("answer")
            if answer_value is not None:
                quiz_answer = self._normalize_true_false_answer(
                    answer_value,
                    "true_false answer",
                    position,
                )
                if quiz_answer is None:
                    return None

            if default_value is not None:
                default_value = self._normalize_true_false_answer(
                    default_value,
                    "true_false default",
                    position,
                )
                if default_value is None:
                    return None

            quiz_mode = "single"
            quiz_options = options
            grading_value = data.get("grading")
            if grading_value is not None:
                quiz_grading = self._normalize_grading_config(
                    grading_value,
                    item_type,
                    position,
                    option_keys=option_keys,
                )
                if quiz_grading is None:
                    return None

            reserved_keys = {
                "id",
                "type",
                "stem",
                "options",
                "score",
                "answer",
                "default",
                "grading",
                "title",
                "description",
            }
        elif item_type == "scale":
            items = self._normalize_keyed_items(
                data.get("items"),
                section_name="items",
                required_fields=["key", "stem"],
                position=position,
                optional_fields=["description"],
            )
            if items is None:
                return None

            options = self._normalize_scale_options(
                data.get("options"),
                position=position,
            )
            if options is None:
                return None

            display_value = data.get("display")
            display = "matrix"
            if display_value is not None:
                if not isinstance(display_value, str):
                    error = InvalidSyntaxError(
                        "scale display must be one of: matrix, list",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                normalized_display = self._normalize_scale_display(
                    display_value,
                    position,
                )
                if normalized_display is None:
                    return None
                display = normalized_display

            item_keys = [item["key"] for item in items]
            option_keys = [option["key"] for option in options]
            if default_value is not None:
                if not isinstance(default_value, dict):
                    error = InvalidSyntaxError(
                        "scale default must be a dict keyed by item key",
                        position=position,
                    )
                    self._handle_error(error)
                    return None

                normalized_default: Dict[str, str] = {}
                for item_key, selected_key in default_value.items():
                    if item_key not in item_keys:
                        error = InvalidSyntaxError(
                            f"scale default contains unknown item key: {item_key}",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    if not isinstance(selected_key, str) or selected_key not in option_keys:
                        error = InvalidSyntaxError(
                            f"scale default value for {item_key} must be one option key",
                            position=position,
                        )
                        self._handle_error(error)
                        return None
                    normalized_default[item_key] = selected_key
                default_value = normalized_default

            quiz_display = display
            quiz_items = items
            quiz_options = options
            grading_value = data.get("grading")
            if grading_value is not None:
                quiz_grading = self._normalize_grading_config(
                    grading_value,
                    item_type,
                    position,
                    option_keys=option_keys,
                )
                if quiz_grading is None:
                    return None

            reserved_keys = {
                "id",
                "type",
                "stem",
                "score",
                "display",
                "items",
                "options",
                "default",
                "grading",
                "title",
                "description",
            }
        elif item_type == "blank":
            blanks = self._normalize_keyed_items(
                data.get("blanks"),
                section_name="blanks",
                required_fields=["key", "answer"],
                position=position,
            )
            if blanks is None:
                return None

            blank_keys = [blank["key"] for blank in blanks]
            if not self._validate_blank_placeholders(stem, blank_keys, position):
                return None

            if default_value is not None:
                if isinstance(default_value, str) and len(blank_keys) == 1:
                    default_value = {blank_keys[0]: default_value}
                if not isinstance(default_value, dict):
                    error = InvalidSyntaxError(
                        "blank default must be a dict keyed by blank key",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                invalid_default_keys = [
                    key for key in default_value.keys() if key not in blank_keys
                ]
                if invalid_default_keys:
                    error = InvalidSyntaxError(
                        "blank default contains unknown blank keys",
                        position=position,
                    )
                    self._handle_error(error)
                    return None
                if any(not isinstance(value, str) for value in default_value.values()):
                    error = InvalidSyntaxError(
                        "blank default values must be strings",
                        position=position,
                    )
                    self._handle_error(error)
                    return None

            quiz_blanks = blanks
            grading_value = data.get("grading")
            if grading_value is not None:
                quiz_grading = self._normalize_grading_config(
                    grading_value,
                    item_type,
                    position,
                    blank_keys=blank_keys,
                )
                if quiz_grading is None:
                    return None

            reserved_keys = {
                "id",
                "type",
                "stem",
                "blanks",
                "score",
                "default",
                "grading",
                "title",
                "description",
            }
        else:
            rubric = data.get("rubric")
            if rubric is not None and not isinstance(rubric, str):
                error = InvalidSyntaxError(
                    "open rubric must be a string",
                    position=position,
                )
                self._handle_error(error)
                return None

            if default_value is not None and not isinstance(default_value, str):
                error = InvalidSyntaxError(
                    "open default must be a string",
                    position=position,
                )
                self._handle_error(error)
                return None

            if rubric is not None:
                quiz_rubric = rubric
            grading_value = data.get("grading")
            if grading_value is not None:
                quiz_grading = self._normalize_grading_config(
                    grading_value,
                    item_type,
                    position,
                )
                if quiz_grading is None:
                    return None

            reserved_keys = {
                "id",
                "type",
                "stem",
                "rubric",
                "score",
                "default",
                "grading",
                "title",
                "description",
            }

        unknown_fields = sorted(key for key in data.keys() if key not in reserved_keys)
        if unknown_fields:
            error = InvalidSyntaxError(
                "Unsupported quiz fields: " + ", ".join(unknown_fields),
                position=position,
            )
            self._handle_error(error)
            return None

        return QuizNode(
            position=position,
            id=item_name,
            quiz_type=item_type,
            stem=stem,
            default=default_value,
            mode=quiz_mode,
            display=quiz_display,
            options=quiz_options,
            answer=quiz_answer,
            blanks=quiz_blanks,
            items=quiz_items,
            rubric=quiz_rubric,
            grading=quiz_grading,
            score=score,
            title=title if isinstance(title, str) else None,
            description=description if isinstance(description, str) else None,
        )

    def _parse_quiz_blocks(self) -> List[QuizNode]:
        """
        Extract and parse `quiz` code blocks into QuizNode objects.
        """
        quiz_vars: List[QuizNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip()
            if lang != "quiz":
                continue

            raw = match.group(0)
            code = match.group("code").rstrip("\n\r")
            code = textwrap.dedent(code)
            position = self._get_position_from_offset(match.start(), len(raw))
            quiz_var = self._parse_quiz_block(code, position)
            if quiz_var is not None:
                quiz_vars.append(quiz_var)

        return quiz_vars
