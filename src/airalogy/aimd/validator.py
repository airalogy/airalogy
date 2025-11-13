"""
Syntax validator for AIMD.
"""

from typing import List, Tuple

from .errors import AimdParseError
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

    def __init__(self, content: str):
        """
        Initialize validator with AIMD content.

        Args:
            content: AIMD document content
        """
        self.content = content
        self.parser = AimdParser(content)

    def validate(self) -> Tuple[bool, List[ValidationError]]:
        """
        Validate AIMD syntax.

        Returns:
            Tuple of (is_valid, list_of_errors)
            If is_valid is True, list_of_errors is empty
            If is_valid is False, list_of_errors contains ValidationError objects
        """
        errors = []

        try:
            # Try to parse
            result = self.parser.parse()

            # Additional validations can be added here
            # For example: check that ref_var/ref_step references exist

            # Check that referenced variables exist
            var_names = {var.name for var in result["vars"]}
            step_names = {step.name for step in result["steps"]}

            for ref_var in result["ref_vars"]:
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

            for ref_step in result["ref_steps"]:
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

        except AimdParseError as e:
            # Convert parse error to validation error
            if e.position:
                errors.append(
                    ValidationError(
                        str(e).split(" at ")[0],  # Get message without position
                        e.position.start_line,
                        e.position.end_line,
                        e.position.start_col,
                        e.position.end_col,
                    )
                )
            else:
                errors.append(ValidationError(str(e), 0, 0, 0, 0))

        return (len(errors) == 0, errors)


def validate_aimd(aimd_content: str) -> Tuple[bool, List[ValidationError]]:
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
    validator = AimdValidator(aimd_content)
    return validator.validate()
