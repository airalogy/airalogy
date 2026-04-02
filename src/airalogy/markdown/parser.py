"""
Main AIMD parser - parses tokens into AST nodes.
"""

import ast
import re
import textwrap
from typing import Any, Dict, List, Optional, Tuple

import yaml

from .ast_nodes import (
    AssignerBlockNode,
    CheckNode,
    CiteNode,
    QuizNode,
    RefFigNode,
    RefStepNode,
    RefVarNode,
    StepNode,
    VarNode,
    VarTableNode,
)
from .errors import (
    AimdParseError,
    DuplicateNameError,
    ErrorCollector,
    InvalidNameError,
    InvalidSyntaxError,
)
from .lexer import Lexer
from .tokens import Position, Token, TokenType

_DURATION_PART_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)", re.IGNORECASE)
_STEP_TIMER_MODES = {"elapsed", "countdown", "both"}


def _extract_quoted_param_value(value: str, name: str) -> tuple[Optional[str], str]:
    pattern = re.compile(
        rf"{name}\s*=\s*(?:\"((?:[^\"\\]|\\.)*)\"|'((?:[^'\\]|\\.)*)')",
        re.DOTALL,
    )
    match = pattern.search(value)
    if not match:
        return None, value

    extracted_value = match.group(1) if match.group(1) is not None else match.group(2)
    return extracted_value, pattern.sub("", value, count=1)


def _strip_optional_quotes(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        return stripped[1:-1]
    return stripped


def _parse_duration_to_ms(value: str) -> Optional[int]:
    trimmed = value.strip()
    if not trimmed:
        return None

    total_ms = 0.0
    last_index = 0
    matched = False

    for match in _DURATION_PART_PATTERN.finditer(trimmed):
        if trimmed[last_index : match.start()].strip():
            return None

        matched = True
        amount = float(match.group(1))
        unit = match.group(2).lower()
        multiplier = (
            24 * 60 * 60 * 1000
            if unit == "d"
            else 60 * 60 * 1000
            if unit == "h"
            else 60 * 1000
            if unit == "m"
            else 1000
            if unit == "s"
            else 1
        )
        total_ms += amount * multiplier
        last_index = match.end()

    if not matched or trimmed[last_index:].strip():
        return None

    return round(total_ms)


def _parse_step_timer_mode(value: str) -> Optional[str]:
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized in _STEP_TIMER_MODES:
        return normalized
    return None


class AimdParser:
    """
    Main AIMD parser.

    Parses AIMD content into structured AST nodes with position information.
    Supports syntax validation and VarModel generation.
    """

    # Name validation pattern: must not start with _, no spaces, valid Python identifier
    NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")
    BLANK_PLACEHOLDER_PATTERN = re.compile(r"\[\[([^\[\]\s]+)\]\]")

    def __init__(self, content: str, strict: bool = True):
        """
        Initialize parser with AIMD content.

        Args:
            content: AIMD document content
            strict: If True, raise exceptions on first error. If False, collect all errors.
        """
        self.content = content
        self.lexer = Lexer(content)
        self.tokens = list(self.lexer.tokenize())
        self.current_index = 0
        self.strict = strict
        self.error_collector = ErrorCollector() if not strict else None
        self.parse_result: Optional[Dict[str, Any]] = None

    def _handle_error(self, error: AimdParseError):
        """
        Handle parsing error based on strict mode.

        Args:
            error: The parsing error to handle

        Returns:
            None if in strict mode (exception will be raised),
            or a placeholder value if in non-strict mode
        """
        if self.strict:
            raise error
        else:
            self.error_collector.add_error(error)
            return None

    def _normalize_name(self, name: str) -> str:
        """
        Normalize a name by collapsing consecutive underscores.

        According to naming rules, names differing only by number of underscores
        are treated as the same (e.g., user_a and user__a collide).

        Args:
            name: Original name

        Returns:
            Normalized name with consecutive underscores collapsed
        """
        return re.sub(r"_+", "_", name)

    def _validate_name(self, name: str, name_type: str, token: Token) -> bool:
        """
        Validate a variable/step/check name.

        Args:
            name: Name to validate
            name_type: Type of name (for error messages)
            token: Token for position information

        Returns:
            True if name is valid, False otherwise

        Raises:
            InvalidNameError: If name is invalid and in strict mode
        """
        if not name:
            error = InvalidNameError(f"Empty {name_type} name", position=token.position)
            if self.strict:
                raise error
            else:
                self.error_collector.add_error(error)
                return False

        if name.startswith("_"):
            error = InvalidNameError(
                f"{name_type.capitalize()} name cannot start with underscore: {name}",
                position=token.position,
            )
            if self.strict:
                raise error
            else:
                self.error_collector.add_error(error)
                return False

        if not self.NAME_PATTERN.match(name):
            error = InvalidNameError(
                f"Invalid {name_type} name: {name}", position=token.position
            )
            if self.strict:
                raise error
            else:
                self.error_collector.add_error(error)
                return False

        return True

    def _parse_var_typed(
        self, token: Token
    ) -> Tuple[str, Optional[str], Optional[Any], Dict[str, Any]]:
        """
        Parse variable syntax with support for types and kwargs.

        Supports multiple formats:
        - Simple: var_id
        - Typed: var_id: type = default, **kwargs
        - With kwargs: var_id, subvars=[...], title="..."
        - Typed with kwargs: var_id: type, subvars=[...], **kwargs

        Args:
            token: Token containing the variable definition

        Returns:
            Tuple of (name, type_annotation, default_value, kwargs)

        Raises:
            TypeAnnotationError: If syntax is invalid
        """
        value = token.value.strip()

        # Find the first colon that's not inside brackets
        first_colon_outside_brackets = self._find_first_colon_outside_brackets(value)

        if first_colon_outside_brackets == -1:
            # No type annotation, parse as: name, key1 = val1, key2 = val2, ...
            return self._parse_var_without_type(value)

        # Has type annotation, parse as: name: type [= default], key1 = val1, ...
        return self._parse_var_with_type(value)

    def _find_first_colon_outside_brackets(self, value: str) -> int:
        """
        Find the first colon that's not inside brackets or strings.

        Args:
            value: String to search

        Returns:
            Index of first colon outside brackets, -1 if none found
        """
        bracket_count = 0
        paren_count = 0
        in_string = False
        quote_char = None

        for i, char in enumerate(value):
            if char in ('"', "'") and not in_string:
                in_string = True
                quote_char = char
            elif char == quote_char and in_string:
                in_string = False
                quote_char = None
            elif not in_string:
                if char == "[":
                    bracket_count += 1
                elif char == "]":
                    bracket_count = max(0, bracket_count - 1)
                elif char == "(":
                    paren_count += 1
                elif char == ")":
                    paren_count = max(0, paren_count - 1)
                elif char == ":" and bracket_count == 0 and paren_count == 0:
                    return i

        return -1

    def _parse_var_without_type(
        self, value: str
    ) -> Tuple[str, Optional[str], Optional[Any], Dict[str, Any]]:
        """
        Parse variable without type annotation.

        Format: name, key1 = val1, key2 = val2, ...
        """
        # Split by commas, respecting strings and brackets
        tokens_list = self._split_by_comma(value)

        if not tokens_list:
            raise InvalidSyntaxError("Empty variable definition")

        # First token is the variable name
        name = tokens_list[0].strip()

        # Remaining tokens are kwargs
        kwargs = {}
        for token_str in tokens_list[1:]:
            if "=" in token_str:
                key, val = token_str.split("=", 1)
                key = key.strip()
                val = val.strip()

                # Special handling for subvars parameter
                if key == "subvars":
                    kwargs[key] = self._parse_subvars_value(val)
                else:
                    # Try to evaluate the value, keep as string if it fails
                    try:
                        kwargs[key] = ast.literal_eval(val)
                    except (ValueError, SyntaxError):
                        kwargs[key] = val

        return name, None, None, kwargs

    def _parse_var_with_type(
        self, value: str
    ) -> Tuple[str, Optional[str], Optional[Any], Dict[str, Any]]:
        """
        Parse variable with type annotation.

        Format: name: type [= default], key1 = val1, key2 = val2, ...
        """
        # Split by first colon to get name and rest
        parts = value.split(":", 1)
        if len(parts) != 2:
            return self._parse_var_without_type(value)

        name = parts[0].strip()
        rest = parts[1].strip()

        # Split by commas, respecting strings and brackets
        tokens_list = self._split_by_comma(rest)

        if not tokens_list:
            return name, None, None, {}

        # First token should be: type [= default]
        first_token = tokens_list[0].strip()
        type_annotation = None
        default_value = None

        if "=" in first_token:
            type_part, default_part = first_token.split("=", 1)
            type_annotation = type_part.strip()
            default_str = default_part.strip()
            # Try to evaluate the default
            try:
                default_value = ast.literal_eval(default_str)
            except (ValueError, SyntaxError):
                default_value = default_str
        else:
            type_annotation = first_token.strip()

        # Remaining tokens are kwargs
        kwargs = {}
        for token_str in tokens_list[1:]:
            if "=" in token_str:
                key, val = token_str.split("=", 1)
                key = key.strip()
                val = val.strip()

                # Special handling for subvars parameter
                if key == "subvars":
                    kwargs[key] = self._parse_subvars_value(val)
                else:
                    # Try to evaluate the value, keep as string if it fails
                    try:
                        kwargs[key] = ast.literal_eval(val)
                    except (ValueError, SyntaxError):
                        kwargs[key] = val

        return name, type_annotation, default_value, kwargs

    def _parse_subvars_value(self, subvars_str: str) -> List[Any]:
        """
        Parse subvars value from string to list.

        Handles syntax like: [name, age, grade] or [name: str, age: int]

        Args:
            subvars_str: String representation of the subvars list

        Returns:
            List of subvar items
        """
        subvars_str = subvars_str.strip()

        # Remove surrounding brackets if present
        if subvars_str.startswith("[") and subvars_str.endswith("]"):
            subvars_str = subvars_str[1:-1].strip()

        if not subvars_str:
            return []

        # Split by commas, respecting strings and nested structures
        items = self._split_by_comma(subvars_str)

        result = []
        for item in items:
            item = item.strip()
            if not item:
                continue

            # Try to evaluate as literal first
            try:
                result.append(ast.literal_eval(item))
            except (ValueError, SyntaxError):
                # Keep as string for simple parsing
                result.append(item)

        return result

    def _split_by_comma(self, content: str) -> List[str]:
        """
        Split content by commas while respecting strings, brackets, and parentheses.

        Args:
            content: Content to split

        Returns:
            List of parts
        """
        parts = []
        current = []
        bracket_count = 0
        paren_count = 0
        in_string = False
        quote_char = None

        i = 0
        while i < len(content):
            char = content[i]

            if char in ('"', "'") and not in_string:
                in_string = True
                quote_char = char
                current.append(char)
            elif char == quote_char and in_string:
                in_string = False
                quote_char = None
                current.append(char)
            elif not in_string:
                if char == "[":
                    bracket_count += 1
                    current.append(char)
                elif char == "]":
                    bracket_count = max(0, bracket_count - 1)
                    current.append(char)
                elif char == "(":
                    paren_count += 1
                    current.append(char)
                elif char == ")":
                    paren_count = max(0, paren_count - 1)
                    current.append(char)
                elif char == "," and bracket_count == 0 and paren_count == 0:
                    # Found a separator
                    parts.append("".join(current).strip())
                    current = []
                else:
                    current.append(char)
            else:
                current.append(char)

            i += 1

        # Add the last part
        if current:
            parts.append("".join(current).strip())

        # Filter out empty parts
        return [part for part in parts if part]

    def _parse_subvars_list(self, subvars_value: Any, token: Token) -> List[VarNode]:
        """
        Parse the subvars value into a list of VarNode objects.

        Args:
            subvars_value: The subvars parameter value (should be a list)
            token: Original token for position info

        Returns:
            List of VarNode objects representing subvars

        Raises:
            InvalidSyntaxError: If subvars format is invalid
        """
        if not isinstance(subvars_value, list):
            raise InvalidSyntaxError(
                f"subvars must be a list, got {type(subvars_value).__name__}",
                position=token.position,
            )

        subvars = []
        for item in subvars_value:
            if isinstance(item, str):
                # Simple syntax: just name or typed syntax like "name: str"
                item_str = item.strip()
                if not item_str:
                    continue

                # Check if this is a var() call
                if item_str.startswith("var(") and item_str.endswith(")"):
                    # Remove var() wrapper and parse the content
                    var_content = item_str[4:-1].strip()
                    name, type_annotation, default_value, kwargs = (
                        self._parse_var_typed(
                            Token(
                                type=TokenType.VAR,
                                value=var_content,
                                position=token.position,
                                raw=item_str,
                            )
                        )
                    )
                    if name:
                        self._validate_name(name, "subvar", token)
                        subvars.append(
                            VarNode(
                                position=token.position,
                                name=name,
                                type_annotation=type_annotation,
                                default_value=default_value,
                                kwargs=kwargs,
                            )
                        )
                else:
                    # Try to parse as typed syntax
                    name, type_annotation, default_value, kwargs = (
                        self._parse_var_typed(
                            Token(
                                type=TokenType.VAR,
                                value=item_str,
                                position=token.position,
                                raw=item_str,
                            )
                        )
                    )
                    if name:
                        self._validate_name(name, "subvar", token)
                        subvars.append(
                            VarNode(
                                position=token.position,
                                name=name,
                                type_annotation=type_annotation,
                                default_value=default_value,
                                kwargs=kwargs,
                            )
                        )
            elif isinstance(item, dict):
                # var() call syntax: dict with keys like 'name', 'type', etc.
                name = item.get("name")
                if not name:
                    continue

                self._validate_name(name, "subvar", token)
                subvars.append(
                    VarNode(
                        position=token.position,
                        name=name,
                        type_annotation=item.get("type"),
                        default_value=item.get("default"),
                        kwargs=item.get("kwargs", {}),
                    )
                )
            else:
                # For now, convert to string and parse as simple var
                item_str = str(item).strip()
                if item_str:
                    name, type_annotation, default_value, kwargs = (
                        self._parse_var_typed(
                            Token(
                                type=TokenType.VAR,
                                value=item_str,
                                position=token.position,
                                raw=item_str,
                            )
                        )
                    )
                    if name:
                        self._validate_name(name, "subvar", token)
                        subvars.append(
                            VarNode(
                                position=token.position,
                                name=name,
                                type_annotation=type_annotation,
                                default_value=default_value,
                                kwargs=kwargs,
                            )
                        )

        return subvars

    def _parse_var(self, token: Token):
        """
        Parse a variable token.

        Supports both traditional var tables (with subvars parameter) and list-typed vars
        (which are treated as var tables even without subvars parameter).

        Args:
            token: VAR token

        Returns:
            VarNode or VarTableNode

        Raises:
            InvalidNameError: If variable name is invalid
            InvalidSyntaxError: If syntax is invalid
        """
        # Parse the variable using the updated logic
        name, type_annotation, default_value, kwargs = self._parse_var_typed(token)
        is_valid_name = self._validate_name(name, "variable", token)

        # Skip processing invalid variables in non-strict mode
        if not self.strict and not is_valid_name:
            return None

        # Determine if this is a var table based on:
        # 1. Presence of subvars parameter (traditional syntax)
        # 2. List type annotation (e.g., "list" or "list[Item]") without subvars
        is_var_table = False
        list_item_type = None

        if "subvars" in kwargs:
            # Traditional var table with subvars parameter
            is_var_table = True
            has_explicit_subvars = True
        elif type_annotation:
            # Check for list type (e.g., "list" or "list[Item]")
            if type_annotation == "list" or (
                type_annotation.startswith("list[") and type_annotation.endswith("]")
            ):
                is_var_table = True
                has_explicit_subvars = False
                if type_annotation.startswith("list["):
                    list_item_type = type_annotation[5:-1]

        if is_var_table:
            # Parse subvars if present
            subvars = []
            kwargs_clean = dict(kwargs)

            if has_explicit_subvars:
                # Parse the provided subvars
                subvars = self._parse_subvars_list(kwargs_clean["subvars"], token)
                del kwargs_clean["subvars"]

                # Validate type annotation if present
                if type_annotation:
                    if not re.match(r"^list$|^list\[.*\]$", type_annotation):
                        error = InvalidSyntaxError(
                            f"Invalid type annotation for var table: {type_annotation}, var table type must be a list",
                            position=token.position,
                        )
                        if self.strict:
                            raise error
                        else:
                            self.error_collector.add_error(error)
                            # Continue with default type annotation
                            type_annotation = "list"
                    elif type_annotation.startswith("list["):
                        list_item_type = type_annotation[5:-1]
            else:
                # No explicit subvars - validate that list item type is basic if specified
                if list_item_type:
                    # Define basic types that are allowed without subvars
                    basic_types = {"str", "int", "float", "bool"}

                    # Strip any whitespace from the item type
                    list_item_type = list_item_type.strip()

                    if list_item_type not in basic_types:
                        error = InvalidSyntaxError(
                            f"Invalid type annotation '{type_annotation}': when subvars is empty, list item type must be a basic type (str, int, float, bool). "
                            f"Custom type '{list_item_type}' requires explicit subvars definition.",
                            position=token.position,
                        )
                        if self.strict:
                            raise error
                        else:
                            self.error_collector.add_error(error)
                            # Reset list_item_type to continue processing
                            list_item_type = None

            # Return VarTableNode
            return VarTableNode(
                position=token.position,
                name=name,
                subvars=subvars,
                type_annotation=type_annotation or "list",  # Default to "list"
                default_value=default_value,
                kwargs=kwargs_clean,
                list_item_type=list_item_type,
            )

        # Regular variable
        return VarNode(
            position=token.position,
            name=name,
            type_annotation=type_annotation,
            default_value=default_value,
            kwargs=kwargs,
        )

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

    def _normalize_quiz_type(
        self, quiz_type: str, position: Position
    ) -> Optional[str]:
        """
        Normalize quiz type.
        """
        normalized = quiz_type.strip().lower()
        if normalized in {"choice", "blank", "open"}:
            return normalized

        error = InvalidSyntaxError(
            "Invalid quiz type, expected one of: choice, blank, open",
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
            if item_key in seen_keys:
                error = InvalidSyntaxError(
                    f"Duplicate key in {section_name}: {item_key}",
                    position=position,
                )
                self._handle_error(error)
                return None
            seen_keys.add(item_key)
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

        if quiz_type == "choice":
            valid_strategies = {"auto", "exact_match", "partial_credit", "option_points"}
            if strategy is not None and strategy not in valid_strategies:
                error = InvalidSyntaxError(
                    "choice grading.strategy must be one of: auto, exact_match, partial_credit, option_points",
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
                        "grading.option_points can only be used with choice grading strategy auto or option_points",
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
                    if option_key not in valid_option_keys:
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
                    normalized_option_points[option_key] = float(option_score)

                config["option_points"] = normalized_option_points

            if strategy == "option_points" and "option_points" not in config:
                error = InvalidSyntaxError(
                    "grading.option_points is required when choice grading.strategy is option_points",
                    position=position,
                )
                self._handle_error(error)
                return None
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
                "quiz type is required (choice, blank, open)",
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
        quiz_options: List[Dict[str, str]] = []
        quiz_answer: Optional[Any] = None
        quiz_blanks: List[Dict[str, str]] = []
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

            options = self._normalize_keyed_items(
                data.get("options"),
                section_name="options",
                required_fields=["key", "text"],
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
            options=quiz_options,
            answer=quiz_answer,
            blanks=quiz_blanks,
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

    def _parse_var_table(self, token: Token) -> VarTableNode:
        """
        Parse a variable table token (legacy syntax).

        Syntax: {{var_table|table_id, subvars=[sub1, sub2, ...]}}

        Args:
            token: VAR_TABLE token

        Returns:
            VarTableNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        # Match pattern: table_id, subvars=[...]
        pattern = re.compile(
            r"^([^,]+),\s*subvars\s*=\s*\[([^\]]*)\]", re.MULTILINE | re.DOTALL
        )
        match = pattern.match(value)

        if not match:
            raise InvalidSyntaxError(
                f"Invalid var_table syntax: {value}", position=token.position
            )

        table_name = match.group(1).strip()
        subvars_str = match.group(2).strip()

        self._validate_name(table_name, "var_table", token)

        # Parse subvars - convert to VarNode objects for compatibility
        subvars = []
        if subvars_str:
            # Parse the subvars string into a list first
            subvars_list = self._parse_subvars_value("[" + subvars_str + "]")
            # Then convert to VarNode objects
            subvars = self._parse_subvars_list(subvars_list, token)

        return VarTableNode(
            position=token.position,
            name=table_name,
            subvars=subvars,
            type_annotation="list",  # Default to list type for legacy syntax
            default_value=None,
            kwargs={},  # No additional kwargs for legacy syntax
            list_item_type=None,  # Will be auto-derived in __post_init__
            auto_item_type=None,  # Will be auto-derived in __post_init__
        )

    def _parse_step(self, token: Token) -> StepNode:
        """
        Parse a step token.

        Syntax: {{step|step_id, level, duration="10m", timer="countdown", check=True, checked_message="..."}}

        Args:
            token: STEP token

        Returns:
            StepNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        # Extract quoted params first so commas inside checked_message do not break splitting.
        checked_message, value = _extract_quoted_param_value(value, "checked_message")
        duration, value = _extract_quoted_param_value(value, "duration")
        timer, value = _extract_quoted_param_value(value, "timer")
        estimated_duration_ms = (
            _parse_duration_to_ms(duration) if duration is not None else None
        )
        if duration is not None and estimated_duration_ms is None:
            raise InvalidSyntaxError(
                f"Invalid duration value: {duration}", position=token.position
            )
        timer_mode = _parse_step_timer_mode(timer) if timer is not None else None
        if timer is not None and timer_mode is None:
            raise InvalidSyntaxError(
                f"Invalid timer mode: {timer}", position=token.position
            )

        # Split by comma
        parts = [p.strip() for p in value.split(",") if p.strip()]

        if not parts:
            raise InvalidSyntaxError("Empty step definition", position=token.position)

        # First part is the step name
        step_name = parts[0]
        self._validate_name(step_name, "step", token)

        # Parse optional parameters
        level = 1
        check = False

        for part in parts[1:]:
            # Check if it's a level (number)
            if part.isdigit():
                level = int(part)
                if level < 1:
                    raise InvalidSyntaxError(
                        f"Step level must be positive: {level}",
                        position=token.position,
                    )
            # Check if it's check=True/False
            elif re.fullmatch(r"check\s*=\s*(True|False)", part):
                check_value = part.split("=", 1)[1].strip()
                if check_value == "True":
                    check = True
                elif check_value == "False":
                    check = False
                else:
                    raise InvalidSyntaxError(
                        f"Invalid check value: {check_value}",
                        position=token.position,
                    )
            elif re.fullmatch(r"duration\s*=\s*.+", part, flags=re.DOTALL):
                duration = _strip_optional_quotes(part.split("=", 1)[1])
                estimated_duration_ms = _parse_duration_to_ms(duration)
                if estimated_duration_ms is None:
                    raise InvalidSyntaxError(
                        f"Invalid duration value: {duration}",
                        position=token.position,
                    )
            elif re.fullmatch(r"timer\s*=\s*.+", part, flags=re.DOTALL):
                timer = _strip_optional_quotes(part.split("=", 1)[1])
                timer_mode = _parse_step_timer_mode(timer)
                if timer_mode is None:
                    raise InvalidSyntaxError(
                        f"Invalid timer mode: {timer}",
                        position=token.position,
                    )
            # Ignore checked_message here (already extracted)
            elif not part.startswith("checked_message"):
                raise InvalidSyntaxError(
                    f"Unknown step parameter: {part}", position=token.position
                )

        return StepNode(
            position=token.position,
            name=step_name,
            level=level,
            check=check,
            duration=duration,
            estimated_duration_ms=estimated_duration_ms,
            timer=timer_mode,
            checked_message=checked_message,
        )

    def _parse_check(self, token: Token) -> CheckNode:
        """
        Parse a checkpoint token.

        Syntax: {{check|check_id, checked_message="..."}}

        Args:
            token: CHECK token

        Returns:
            CheckNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        checked_message, value = _extract_quoted_param_value(value, "checked_message")

        # Clean up remaining value
        check_name = value.split(",")[0].strip()

        if not check_name:
            raise InvalidSyntaxError("Empty check definition", position=token.position)

        self._validate_name(check_name, "check", token)

        return CheckNode(
            position=token.position,
            name=check_name,
            checked_message=checked_message,
        )

    def _parse_ref_var(self, token: Token) -> RefVarNode:
        """Parse a variable reference: {{ref_var|var_id}}"""
        ref_id = token.value.strip()
        return RefVarNode(position=token.position, ref_id=ref_id)

    def _parse_ref_step(self, token: Token) -> RefStepNode:
        """Parse a step reference: {{ref_step|step_id}}"""
        ref_id = token.value.strip()
        return RefStepNode(position=token.position, ref_id=ref_id)

    def _parse_ref_fig(self, token: Token) -> RefFigNode:
        """Parse a figure reference: {{ref_fig|fig_id}}"""
        ref_id = token.value.strip()
        return RefFigNode(position=token.position, ref_id=ref_id)

    def _parse_cite(self, token: Token) -> CiteNode:
        """Parse a citation: {{cite|ref_id1,ref_id2,...}}"""
        value = token.value.strip()
        ref_ids = [ref.strip() for ref in value.split(",") if ref.strip()]
        return CiteNode(position=token.position, ref_ids=ref_ids)

    def _get_position_from_offset(self, offset: int, length: int) -> Position:
        """
        Convert byte offset to line/column position.

        Args:
            offset: Start offset in content
            length: Length of the span

        Returns:
            Position object with row and column info
        """
        span_text = self.content[offset : offset + length]
        newlines_in_span = span_text.count("\n")

        start_line = self.content[:offset].count("\n") + 1
        end_line = start_line + newlines_in_span

        line_start = self.content.rfind("\n", 0, offset) + 1
        start_col = offset - line_start + 1

        if newlines_in_span > 0:
            last_newline_in_span = span_text.rfind("\n")
            end_col = length - last_newline_in_span - 1
        else:
            end_col = start_col + length - 1

        return Position(
            start_line=start_line,
            end_line=end_line,
            start_col=start_col,
            end_col=end_col,
        )

    def _parse_assigner_blocks(self) -> List[AssignerBlockNode]:
        """
        Extract inline assigner code blocks from AIMD content.

        Returns:
            List of AssignerBlockNode objects.
        """
        blocks: List[AssignerBlockNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = match.group("lang") or ""
            if lang != "assigner":
                continue

            meta = (match.group("meta") or "").strip()
            if re.search(
                r"""(?:^|\s)runtime\s*=\s*(?:"client"|'client'|client)(?:\s|$)""",
                meta,
            ):
                continue

            raw = match.group(0)
            code = match.group("code").rstrip("\n\r")
            code = textwrap.dedent(code)
            position = self._get_position_from_offset(match.start(), len(raw))
            blocks.append(AssignerBlockNode(position=position, code=code))

        return blocks

    def parse(self) -> Dict[str, Any]:
        """
        Parse all tokens into AST nodes.

        Returns:
            Dictionary containing parsed templates:
            {
                "assigners": [AssignerBlockNode, ...],
                "templates": {
                    "var": [VarNode, ...],
                    "quiz": [QuizNode, ...],
                    "step": [StepNode, ...],
                    "check": [CheckNode, ...],
                    "ref_var": [RefVarNode, ...],
                    "ref_step": [RefStepNode, ...],
                    "ref_fig": [RefFigNode, ...],
                    "cite": [CiteNode, ...],
                    "assigner": [AssignerBlockNode, ...],
                }
            }

        Raises:
            AimdParseError: If parsing fails
        """
        if self.parse_result is not None:
            return self.parse_result

        vars_list: List[VarNode] = []
        quizzes = self._parse_quiz_blocks()
        steps = []
        checks = []
        ref_vars = []
        ref_steps = []
        ref_figs = []
        cites = []
        assigners = self._parse_assigner_blocks()

        for token in self.tokens:
            if token.type == TokenType.VAR:
                var_result = self._parse_var(token)
                if var_result is not None:
                    vars_list.append(var_result)
            elif token.type == TokenType.VAR_TABLE:
                vars_list.append(self._parse_var_table(token))
            elif token.type == TokenType.STEP:
                steps.append(self._parse_step(token))
            elif token.type == TokenType.CHECK:
                checks.append(self._parse_check(token))
            elif token.type == TokenType.REF_VAR:
                ref_vars.append(self._parse_ref_var(token))
            elif token.type == TokenType.REF_STEP:
                ref_steps.append(self._parse_ref_step(token))
            elif token.type == TokenType.REF_FIG:
                ref_figs.append(self._parse_ref_fig(token))
            elif token.type == TokenType.CITE:
                cites.append(self._parse_cite(token))
            elif token.type == TokenType.EOF:
                break

        # Validate uniqueness (only if we have valid items)
        unique_name_items = vars_list + quizzes
        if unique_name_items or steps or checks:
            self._validate_uniqueness(unique_name_items, steps, checks)

        templates = {
            "var": vars_list,
            "quiz": quizzes,
            "step": steps,
            "check": checks,
            "ref_var": ref_vars,
            "ref_step": ref_steps,
            "ref_fig": ref_figs,
            "cite": cites,
            "assigner": assigners,
        }

        self.parse_result = {
            "templates": templates,
        }
        return self.parse_result

    def _validate_uniqueness(
        self, vars_list: List, steps: List[StepNode], checks: List[CheckNode]
    ) -> None:
        """
        Validate that all names are unique (considering normalization).

        Args:
            vars_list: List of VarNode and VarTableNode
            steps: List of StepNode
            checks: List of CheckNode

        Raises:
            DuplicateNameError: If duplicate names are found and in strict mode
        """
        seen_names = {}

        # Check steps
        for step in steps:
            normalized = self._normalize_name(step.name)
            if normalized in seen_names:
                error = DuplicateNameError(
                    f"Duplicate step name '{step.name}' (conflicts with '{seen_names[normalized][1]}' at line {seen_names[normalized][0]})",
                    position=step.position,
                )
                if self.strict:
                    raise error
                else:
                    self.error_collector.add_error(error)
            else:
                seen_names[normalized] = (step.position.start_line, step.name, "step")

        # Check vars and quizzes
        for var in vars_list:
            item_name = getattr(var, "name", None)
            if item_name is None:
                item_name = getattr(var, "id", None)
            if not item_name:
                continue

            normalized = self._normalize_name(item_name)
            if normalized in seen_names:
                error = DuplicateNameError(
                    f"Duplicate var name '{item_name}' (conflicts with '{seen_names[normalized][1]}' at line {seen_names[normalized][0]})",
                    position=var.position,
                )
                if self.strict:
                    raise error
                else:
                    self.error_collector.add_error(error)
            else:
                seen_names[normalized] = (var.position.start_line, item_name, "var")

        # Check checks
        for check in checks:
            normalized = self._normalize_name(check.name)
            if normalized in seen_names:
                error = DuplicateNameError(
                    f"Duplicate check name '{check.name}' (conflicts with '{seen_names[normalized][1]}' at line {seen_names[normalized][0]})",
                    position=check.position,
                )
                if self.strict:
                    raise error
                else:
                    self.error_collector.add_error(error)
            else:
                seen_names[normalized] = (
                    check.position.start_line,
                    check.name,
                    "check",
                )

    def get_errors(self) -> List[AimdParseError]:
        """
        Get all collected errors (only in non-strict mode).

        Returns:
            List of collected errors, empty list if in strict mode or no errors
        """
        if self.error_collector:
            return self.error_collector.get_errors()
        return []

    def has_errors(self) -> bool:
        """
        Check if any errors were collected (only in non-strict mode).

        Returns:
            True if errors were collected, False otherwise
        """
        if self.error_collector:
            return self.error_collector.has_errors()
        return False


def parse_aimd(aimd_content: str) -> dict:
    """
    Parse AIMD content into a dictionary structure.

    Args:
        aimd_content: AIMD document content

    Returns:
        Dictionary containing parsed templates in dictionary format.

    Raises:
        AimdParseError: If parsing fails
    """
    parser = AimdParser(aimd_content)
    result = parser.parse()

    return {
        "templates": {
            "var": [var.to_dict() for var in result["templates"]["var"]],
            "quiz": [quiz.to_dict() for quiz in result["templates"]["quiz"]],
            "step": [step.to_dict() for step in result["templates"]["step"]],
            "check": [check.to_dict() for check in result["templates"]["check"]],
            "ref_var": [ref_var.to_dict() for ref_var in result["templates"]["ref_var"]],
            "ref_step": [ref_step.to_dict() for ref_step in result["templates"]["ref_step"]],
            "ref_fig": [ref_fig.to_dict() for ref_fig in result["templates"]["ref_fig"]],
            "cite": [cite.to_dict() for cite in result["templates"]["cite"]],
            "assigner": [
                assigner.to_dict() for assigner in result["templates"]["assigner"]
            ],
        },
    }


def extract_assigner_blocks(aimd_content: str) -> list[dict]:
    """
    Extract inline assigner blocks from AIMD content.

    Args:
        aimd_content: AIMD document content

    Returns:
        List of assigner block dictionaries.
    """
    parser = AimdParser(aimd_content)
    result = parser.parse()
    return [block.to_dict() for block in result["templates"]["assigner"]]
