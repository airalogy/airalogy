"""
Define the model for the Checkpoint Value.
"""

from pydantic import BaseModel


class CheckValue(BaseModel):
    """
    Model for the value of a Checkpoint.
    """

    checked: bool
    annotation: str
