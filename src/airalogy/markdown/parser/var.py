"""Variable parsing helpers for AIMD."""

import ast
import re
import textwrap
from typing import Any, Dict, List, Optional, Tuple

from ..ast_nodes import VarNode, VarTableNode
from ..errors import InvalidSyntaxError
from ..tokens import Token, TokenType


class VarParserMixin:
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
