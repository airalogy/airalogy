"""
This module defines the commonly used models used in the `airalogy` package.
"""

from pydantic import BaseModel, model_validator


class AssignerResult(BaseModel):
    """
    When the assigner succeeds, it will return an instance of this class.
    """

    success: bool = True
    """
    Whether the assigner succeeded.
    """
    assigned_fields: dict | None = None
    """
    The assigned RVs with their values.
    """
    error_message: str | None = None
    """
    The error message when the assigner fails.
    """

    @model_validator(mode="after")
    def success_or_fail(self):
        """
        Validate that `success` is `True` if `assigned_fields` is not `None`.
        """
        if self.success:
            if self.assigned_fields is None:
                raise ValueError(
                    "When success is True, assigned_fields must not be None."
                )
            if self.error_message is not None:
                raise ValueError("When success is True, error_message must be None.")
        else:
            if self.assigned_fields is not None:
                raise ValueError("When success is False, assigned_fields must be None.")
            if self.error_message is None:
                raise ValueError(
                    "When success is False, error_message must not be None."
                )
        return self
