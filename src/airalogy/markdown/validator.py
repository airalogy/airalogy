"""
Syntax validator for AIMD.
"""

from pathlib import Path
from typing import List, Optional, Tuple

from airalogy.assigner.graph import (
    AssignerGraphValidationError,
    extract_assigner_graph_nodes_from_aimd,
    extract_server_assigner_graph_nodes_from_file,
    validate_assigner_graph,
)
from .parser import AimdParser


class ValidationError:
    """Represents a validation error with position information."""

    def __init__(
        self,
        message: str,
        start_line: int,
        end_line: int,
        start_col: int,
        end_col: int,
    ):
        self.message = message
        self.start_line = start_line
        self.end_line = end_line
        self.start_col = start_col
        self.end_col = end_col

    def __repr__(self) -> str:
        if self.start_line == self.end_line:
            return f"ValidationError(line={self.start_line}, col={self.start_col}-{self.end_col}: {self.message})"
        else:
            return f"ValidationError(line={self.start_line}-{self.end_line}, col={self.start_col}-{self.end_col}: {self.message})"

    def __str__(self) -> str:
        if self.start_line == self.end_line:
            return f"Line {self.start_line}, Col {self.start_col}-{self.end_col}: {self.message}"
        else:
            return f"Line {self.start_line}-{self.end_line}, Col {self.start_col}-{self.end_col}: {self.message}"


class AimdValidator:
    """
    Validator for AIMD syntax.

    Performs comprehensive syntax validation and returns detailed error
    information including line and column positions.
    """

    def __init__(self, content: str, protocol_dir: Optional[str | Path] = None):
        """
        Initialize validator with AIMD content.

        Args:
            content: AIMD document content
        """
        self.content = content
        self.protocol_dir = Path(protocol_dir) if protocol_dir is not None else None
        # Use non-strict mode parser to collect all errors
        self.parser = AimdParser(content, strict=False)

    def validate(self) -> Tuple[bool, List[ValidationError]]:
        """
        Validate AIMD syntax.

        Returns:
            Tuple of (is_valid, list_of_errors)
            If is_valid is True, list_of_errors is empty
            If is_valid is False, list_of_errors contains ValidationError objects
        """
        errors = []

        # Parse with error collection (non-strict mode)
        result = self.parser.parse()

        # Convert parser errors to validation errors
        parser_errors = self.parser.get_errors()
        for parser_error in parser_errors:
            if parser_error.position:
                errors.append(
                    ValidationError(
                        parser_error.message,
                        parser_error.position.start_line,
                        parser_error.position.end_line,
                        parser_error.position.start_col,
                        parser_error.position.end_col,
                    )
                )
            else:
                errors.append(ValidationError(str(parser_error), 0, 0, 0, 0))

        # Additional semantic validations
        # Check that referenced variables exist
        var_names = {var.name for var in result["templates"]["var"] if var}
        var_names.update(quiz.id for quiz in result["templates"]["quiz"] if quiz)
        step_names = {step.name for step in result["templates"]["step"]}

        for ref_var in result["templates"]["ref_var"]:
            if ref_var.ref_id not in var_names:
                errors.append(
                    ValidationError(
                        f"Reference to undefined variable: {ref_var.ref_id}",
                        ref_var.position.start_line,
                        ref_var.position.end_line,
                        ref_var.position.start_col,
                        ref_var.position.end_col,
                    )
                )

        for ref_step in result["templates"]["ref_step"]:
            if ref_step.ref_id not in step_names:
                errors.append(
                    ValidationError(
                        f"Reference to undefined step: {ref_step.ref_id}",
                        ref_step.position.start_line,
                        ref_step.position.end_line,
                        ref_step.position.start_col,
                        ref_step.position.end_col,
                    )
                )

        assigner_file = (
            self.protocol_dir / "assigner.py" if self.protocol_dir is not None else None
        )
        try:
            graph_nodes = extract_assigner_graph_nodes_from_aimd(self.content)

            if assigner_file is not None and assigner_file.exists():
                inline_server_nodes = [
                    node for node in graph_nodes if node.runtime == "server"
                ]
                if inline_server_nodes:
                    raise AssignerGraphValidationError(
                        "Inline assigner blocks are not allowed when assigner.py exists.",
                        inline_server_nodes[0],
                    )

                graph_nodes.extend(
                    extract_server_assigner_graph_nodes_from_file(assigner_file)
                )

            validate_assigner_graph(graph_nodes)
        except (AssignerGraphValidationError, ValueError) as exc:
            node = exc.node if isinstance(exc, AssignerGraphValidationError) else None
            if node is not None:
                message = str(exc)
                if node.source != "protocol.aimd":
                    message = f"{node.source}: {message}"
                errors.append(
                    ValidationError(
                        message,
                        node.position.start_line,
                        node.position.end_line,
                        node.position.start_col,
                        node.position.end_col,
                    )
                )
            else:
                errors.append(ValidationError(str(exc), 0, 0, 0, 0))

        # Sort errors by position (line first, then column)
        errors.sort(key=lambda error: (error.start_line, error.start_col))

        return (len(errors) == 0, errors)


def validate_aimd(
    aimd_content: str,
    protocol_dir: Optional[str | Path] = None,
) -> Tuple[bool, List[ValidationError]]:
    """
    Validate AIMD content.

    Args:
        aimd_content: AIMD document content

    Returns:
        Tuple of (is_valid, list_of_errors)

    Example:
        >>> is_valid, errors = validate_aimd(content)
        >>> if not is_valid:
        ...     for error in errors:
        ...         print(error)
    """
    validator = AimdValidator(aimd_content, protocol_dir=protocol_dir)
    return validator.validate()
