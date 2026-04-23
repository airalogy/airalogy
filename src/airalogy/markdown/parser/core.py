"""Core AIMD parser orchestration."""

import re
import textwrap
from typing import Any, Dict, List, Optional

from ..ast_nodes import AssignerBlockNode, CheckNode, StepNode, VarNode
from ..errors import (
    AimdParseError,
    DuplicateNameError,
    ErrorCollector,
    InvalidNameError,
)
from ..lexer import Lexer
from ..tokens import Position, Token, TokenType
from .common import BLANK_PLACEHOLDER_PATTERN, NAME_PATTERN
from .quiz import QuizParserMixin
from .step import StepParserMixin
from .var import VarParserMixin


class AimdParser(VarParserMixin, QuizParserMixin, StepParserMixin):
    """
    Main AIMD parser.

    Parses AIMD content into structured AST nodes with position information.
    Supports syntax validation and VarModel generation.
    """

    NAME_PATTERN = NAME_PATTERN
    BLANK_PLACEHOLDER_PATTERN = BLANK_PLACEHOLDER_PATTERN

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
