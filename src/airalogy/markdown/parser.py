"""
Main AIMD parser - parses tokens into AST nodes.
"""

import ast
import re
import textwrap
from typing import Any, Dict, List, Optional, Tuple

from .ast_nodes import (
    AssignerBlockNode,
    CheckNode,
    CiteNode,
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


class AimdParser:
    """
    Main AIMD parser.

    Parses AIMD content into structured AST nodes with position information.
    Supports syntax validation and VarModel generation.
    """

    # Name validation pattern: must not start with _, no spaces, valid Python identifier
    NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")

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
        self.parse_result: Optional[Dict[str, List]] = None

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

        Syntax: {{step|step_id, level, check=True, checked_message="..."}}

        Args:
            token: STEP token

        Returns:
            StepNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        # Extract checked_message first (it may contain commas)
        checked_message = None
        checked_message_pattern = re.compile(
            r'checked_message\s*=\s*"([^"]*)"', re.DOTALL
        )
        msg_match = checked_message_pattern.search(value)
        if msg_match:
            checked_message = msg_match.group(1)
            # Remove the checked_message part for easier parsing
            value = checked_message_pattern.sub("", value)

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
            elif part.startswith("check="):
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

        # Extract checked_message
        checked_message = None
        checked_message_pattern = re.compile(
            r'checked_message\s*=\s*"([^"]*)"', re.DOTALL
        )
        msg_match = checked_message_pattern.search(value)
        if msg_match:
            checked_message = msg_match.group(1)
            # Remove the checked_message part
            value = checked_message_pattern.sub("", value)

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

            raw = match.group(0)
            code = match.group("code").rstrip("\n\r")
            code = textwrap.dedent(code)
            position = self._get_position_from_offset(match.start(), len(raw))
            blocks.append(AssignerBlockNode(position=position, code=code))

        return blocks

    def parse(self) -> Dict[str, List]:
        """
        Parse all tokens into AST nodes.

        Returns:
            Dictionary containing lists of parsed nodes:
            {
                "vars": [VarNode, ...],
                "steps": [StepNode, ...],
                "checks": [CheckNode, ...],
                "ref_vars": [RefVarNode, ...],
                "ref_steps": [RefStepNode, ...],
                "ref_figs": [RefFigNode, ...],
                "cites": [CiteNode, ...],
                "assigners": [AssignerBlockNode, ...]
            }

        Raises:
            AimdParseError: If parsing fails
        """
        if self.parse_result is not None:
            return self.parse_result

        vars_list = []
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
        if vars_list or steps or checks:
            self._validate_uniqueness(vars_list, steps, checks)

        self.parse_result = {
            "vars": vars_list,
            "steps": steps,
            "checks": checks,
            "ref_vars": ref_vars,
            "ref_steps": ref_steps,
            "ref_figs": ref_figs,
            "cites": cites,
            "assigners": assigners,
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

        # Check vars
        for var in vars_list:
            normalized = self._normalize_name(var.name)
            if normalized in seen_names:
                error = DuplicateNameError(
                    f"Duplicate var name '{var.name}' (conflicts with '{seen_names[normalized][1]}' at line {seen_names[normalized][0]})",
                    position=var.position,
                )
                if self.strict:
                    raise error
                else:
                    self.error_collector.add_error(error)
            else:
                seen_names[normalized] = (var.position.start_line, var.name, "var")

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


def extract_vars(aimd_content: str) -> dict:
    """
    Extract variables from AIMD content (backwards compatible API).

    Args:
        aimd_content: AIMD document content

    Returns:
        Dictionary with 'steps', 'vars', and 'checks' lists in old format

    Raises:
        AimdParseError: If parsing fails
    """
    parser = AimdParser(aimd_content)
    result = parser.parse()

    # Convert to old format for backwards compatibility
    return {
        "steps": [step.to_dict() for step in result["steps"]],
        "vars": [var.to_dict() for var in result["vars"]],
        "checks": [check.to_dict() for check in result["checks"]],
        "ref_vars": [ref_var.to_dict() for ref_var in result["ref_vars"]],
        "ref_steps": [ref_step.to_dict() for ref_step in result["ref_steps"]],
        "ref_figs": [ref_fig.to_dict() for ref_fig in result["ref_figs"]],
        "cites": [cite.to_dict() for cite in result["cites"]],
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
    return [block.to_dict() for block in result["assigners"]]
