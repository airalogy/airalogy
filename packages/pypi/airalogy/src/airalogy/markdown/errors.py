"""
Parser exceptions and error handling.
"""

from typing import List, Optional

from .tokens import Position


class AimdParseError(Exception):
    """Base exception for AIMD parsing errors."""

    message: str

    def __init__(
        self,
        message: str,
        position: Optional[Position] = None,
        line_number: Optional[int] = None,
    ):
        """
        Initialize parse error.

        Args:
            message: Error message
            position: Position object (preferred)
            line_number: Line number (for backwards compatibility)
        """
        self.message = message
        self.position = position
        if line_number is not None and position is None:
            # Backwards compatibility
            self.position = Position(
                start_line=line_number, end_line=line_number, start_col=0, end_col=0
            )
            self.line_number = line_number

        if position:
            full_message = f"{message} at {position}"
        elif line_number is not None:
            full_message = f"{message} at line {line_number}."
        else:
            full_message = message

        super().__init__(full_message)


class InvalidNameError(AimdParseError):
    """Error for invalid variable/step/check names."""

    pass


class DuplicateNameError(AimdParseError):
    """Error for duplicate names."""

    pass


class InvalidSyntaxError(AimdParseError):
    """Error for invalid syntax."""

    pass


class TypeAnnotationError(AimdParseError):
    """Error for type annotation parsing."""

    pass


class ErrorCollector:
    """Collects parsing errors instead of raising exceptions immediately."""

    def __init__(self):
        self.errors: List[AimdParseError] = []

    def add_error(self, error: AimdParseError):
        """Add an error to the collection."""
        self.errors.append(error)

    def has_errors(self) -> bool:
        """Check if any errors have been collected."""
        return len(self.errors) > 0

    def get_errors(self) -> List[AimdParseError]:
        """Get all collected errors."""
        return self.errors.copy()

    def clear(self):
        """Clear all collected errors."""
        self.errors.clear()
