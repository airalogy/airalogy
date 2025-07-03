"""
Define the model for the Aimd Step.
"""

from pydantic import BaseModel


class StepValue(BaseModel):
    """
    Model for the value of a Aimd Step.
    """

    checked: bool | None
    annotation: str
