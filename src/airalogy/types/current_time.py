"""
Built-in type: CurrentTime
"""

from datetime import datetime

from pydantic import Field
from typing_extensions import Annotated

CurrentTime = Annotated[
    datetime,
    Field(
        description="The current time. The timezone is based on the user's browser.",
        json_schema_extra={"airalogy_type": "CurrentTime"},
    ),
]
