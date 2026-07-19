"""Core AIMD parser orchestration."""

import re
import textwrap
from typing import Any, Dict, List, Optional

import yaml

from ..ast_nodes import (
    AssignerBlockNode,
    CheckNode,
    CollectorsNode,
    ConnectorsNode,
    MediaNode,
    ReferenceNode,
    StepNode,
    VarNode,
    VarTableNode,
    WorkflowNode,
)
from ..errors import (
    AimdParseError,
    DuplicateNameError,
    ErrorCollector,
    InvalidSyntaxError,
    InvalidNameError,
)
from ..lexer import Lexer
from ..tokens import Position, Token, TokenType
from .common import BLANK_PLACEHOLDER_PATTERN, NAME_PATTERN
from .connectors import parse_connectors_content
from .collectors import parse_collectors_content
from .quiz import QuizParserMixin
from .refs import parse_refs_content
from .step import StepParserMixin
from .var import VarParserMixin
from .workflow import WorkflowParserMixin


class AimdParser(VarParserMixin, QuizParserMixin, StepParserMixin, WorkflowParserMixin):
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

    def _parse_refs_blocks(self) -> List[ReferenceNode]:
        """
        Extract refs code blocks from AIMD content.

        Returns:
            List of ReferenceNode objects.
        """
        references: List[ReferenceNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip().lower()
            if lang != "refs":
                continue

            raw = match.group(0)
            code = match.group("code").rstrip("\n\r")
            code = textwrap.dedent(code)
            position = self._get_position_from_offset(match.start(), len(raw))
            references.extend(parse_refs_content(code, position))

        return references

    def _parse_connectors_blocks(self) -> List[ConnectorsNode]:
        """
        Extract connector registry code blocks from AIMD content.

        Returns:
            List of ConnectorsNode objects.
        """
        blocks: List[ConnectorsNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip().lower()
            if lang != "connectors":
                continue

            raw = match.group(0)
            code = textwrap.dedent(match.group("code").rstrip("\n\r"))
            position = self._get_position_from_offset(match.start(), len(raw))
            blocks.append(parse_connectors_content(code, position))

        return blocks

    def _parse_collectors_blocks(self) -> List[CollectorsNode]:
        """Extract Collector registry code blocks from AIMD content."""

        blocks: List[CollectorsNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip().lower()
            if lang != "collectors":
                continue

            raw = match.group(0)
            code = textwrap.dedent(match.group("code").rstrip("\n\r"))
            position = self._get_position_from_offset(match.start(), len(raw))
            blocks.append(parse_collectors_content(code, position))

        return blocks

    def _validate_collector_references(
        self,
        vars_list: List[VarNode],
        steps: list,
        connector_blocks: List[ConnectorsNode],
        collector_blocks: List[CollectorsNode],
    ) -> None:
        connectors: Dict[str, Dict[str, Any]] = {}
        for block in connector_blocks:
            for connector_id, connector in block.connectors.items():
                if connector_id in connectors:
                    raise InvalidSyntaxError(f"Duplicate connector id: {connector_id}")
                connectors[connector_id] = connector

        collectors: Dict[str, Dict[str, Any]] = {}
        step_ids = {step.name for step in steps}
        for block in collector_blocks:
            for collector_id, collector in block.collectors.items():
                if collector_id in collectors:
                    raise InvalidSyntaxError(f"Duplicate collector id: {collector_id}")
                collectors[collector_id] = collector
                connector_id = collector["connector"]
                connector = connectors.get(connector_id)
                if connector is None:
                    raise InvalidSyntaxError(
                        f"Collector {collector_id} references unknown connector {connector_id}"
                    )
                if connector.get("kind") != "data_source":
                    raise InvalidSyntaxError(
                        f"Collector {collector_id} requires connector {connector_id} to use kind data_source"
                    )
                lifecycle = collector.get("lifecycle", {})
                for trigger in (lifecycle.get("start"), lifecycle.get("stop")):
                    if isinstance(trigger, dict) and trigger.get("step") not in step_ids:
                        raise InvalidSyntaxError(
                            f"Collector {collector_id} references unknown step {trigger.get('step')}"
                        )

        bindings: Dict[str, str] = {}
        for var in vars_list:
            raw_collector = var.kwargs.get("collector")
            if raw_collector is None:
                continue
            if isinstance(var, VarTableNode):
                raise InvalidSyntaxError(
                    f"Variable table {var.name} cannot bind a Collector in the initial runtime"
                )
            if not isinstance(raw_collector, str) or not raw_collector.strip():
                raise InvalidSyntaxError(
                    f"Variable {var.name} collector metadata must be a non-empty string"
                )
            collector_id = raw_collector.strip()
            collector = collectors.get(collector_id)
            if collector is None:
                raise InvalidSyntaxError(
                    f"Variable {var.name} references unknown collector {collector_id}"
                )
            previous = bindings.get(collector_id)
            if previous and previous != var.name:
                raise InvalidSyntaxError(
                    f"Collector {collector_id} cannot write directly to both {previous} and {var.name}"
                )
            bindings[collector_id] = var.name

            normalized_type = re.sub(r"\s+", "", var.type_annotation or "").lower()
            observation = normalized_type.startswith("observation[")
            observation_list = normalized_type.startswith("list[observation[")
            series = normalized_type.startswith("observationseriesref[")
            if not observation and not observation_list and not series:
                raise InvalidSyntaxError(
                    f"Variable {var.name} bound to Collector {collector_id} must use Observation[T], list[Observation[T]], or ObservationSeriesRef[T]"
                )
            if collector["mode"] in {"polling", "stream"} and not (
                observation_list or series
            ):
                raise InvalidSyntaxError(
                    f"Variable {var.name} must use list[Observation[T]] or ObservationSeriesRef[T] for {collector['mode']} Collector {collector_id}"
                )

    def _normalize_media_string(
        self, data: Dict[str, Any], key: str
    ) -> Optional[str]:
        value = data.get(key)
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    def _parse_media_blocks(self) -> List[MediaNode]:
        """
        Extract media code blocks from AIMD content.

        Returns:
            List of MediaNode objects.
        """
        media_items: List[MediaNode] = []
        for match in self.lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip().lower()
            if lang != "media":
                continue

            raw = match.group(0)
            code = textwrap.dedent(match.group("code").rstrip("\n\r"))
            position = self._get_position_from_offset(match.start(), len(raw))

            try:
                parsed = yaml.safe_load(code) if code.strip() else {}
            except yaml.YAMLError as exc:
                self._handle_error(
                    InvalidSyntaxError(
                        f"Invalid media block YAML: {exc}", position=position
                    )
                )
                continue

            if not isinstance(parsed, dict):
                self._handle_error(
                    InvalidSyntaxError(
                        "Media block must be a mapping", position=position
                    )
                )
                continue

            media_id = self._normalize_media_string(parsed, "id")
            src = self._normalize_media_string(parsed, "src")
            if not media_id:
                self._handle_error(
                    InvalidSyntaxError("Media block requires id", position=position)
                )
                continue
            if not src:
                self._handle_error(
                    InvalidSyntaxError("Media block requires src", position=position)
                )
                continue

            kind = (
                self._normalize_media_string(parsed, "kind")
                or "file"
            )

            media_items.append(
                MediaNode(
                    position=position,
                    id=media_id,
                    kind=kind,
                    src=src,
                    mime=self._normalize_media_string(parsed, "mime"),
                    provider=self._normalize_media_string(parsed, "provider"),
                    poster=self._normalize_media_string(parsed, "poster"),
                    title=self._normalize_media_string(parsed, "title"),
                    legend=self._normalize_media_string(parsed, "legend"),
                )
            )

        return media_items

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
                    "ref_media": [RefMediaNode, ...],
                    "cite": [CiteNode, ...],
                    "media": [MediaNode, ...],
                    "refs": [ReferenceNode, ...],
                    "assigner": [AssignerBlockNode, ...],
                    "connectors": [ConnectorsNode, ...],
                    "workflow": [WorkflowNode, ...],
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
        ref_medias = []
        cites = []
        media = self._parse_media_blocks()
        refs = self._parse_refs_blocks()
        assigners = self._parse_assigner_blocks()
        connectors = self._parse_connectors_blocks()
        collectors = self._parse_collectors_blocks()
        workflows = self._parse_workflow_blocks()

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
            elif token.type == TokenType.REF_MEDIA:
                ref_medias.append(self._parse_ref_media(token))
            elif token.type == TokenType.CITE:
                cites.append(self._parse_cite(token))
            elif token.type == TokenType.EOF:
                break

        # Validate uniqueness (only if we have valid items)
        unique_name_items = vars_list + quizzes
        if unique_name_items or steps or checks:
            self._validate_uniqueness(unique_name_items, steps, checks)

        self._validate_collector_references(vars_list, steps, connectors, collectors)

        templates = {
            "var": vars_list,
            "quiz": quizzes,
            "step": steps,
            "check": checks,
            "ref_var": ref_vars,
            "ref_step": ref_steps,
            "ref_fig": ref_figs,
            "ref_media": ref_medias,
            "cite": cites,
            "media": media,
            "refs": refs,
            "assigner": assigners,
            "connectors": connectors,
            "collectors": collectors,
            "workflow": workflows,
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
            "ref_media": [
                ref_media.to_dict()
                for ref_media in result["templates"]["ref_media"]
            ],
            "cite": [cite.to_dict() for cite in result["templates"]["cite"]],
            "media": [media.to_dict() for media in result["templates"]["media"]],
            "refs": [ref.to_dict() for ref in result["templates"]["refs"]],
            "assigner": [
                assigner.to_dict() for assigner in result["templates"]["assigner"]
            ],
            "connectors": [
                connectors.to_dict()
                for connectors in result["templates"]["connectors"]
            ],
            "collectors": [
                collectors.to_dict()
                for collectors in result["templates"]["collectors"]
            ],
            "workflow": [
                workflow.to_dict() for workflow in result["templates"]["workflow"]
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
