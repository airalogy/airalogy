"""
Syntax validator for AIMD.
"""

from typing import List, Tuple

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
        var_names = {var.name for var in result["vars"] if var}
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

        # Sort errors by position (line first, then column)
        errors.sort(key=lambda error: (error.start_line, error.start_col))

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
