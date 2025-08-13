"""
Built-in type: CurrentTime
"""

from datetime import datetime

from pydantic import Field
from typing_extensions import Annotated

_ISO_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"

CurrentTime = Annotated[
    datetime,
    Field(
        description="The current time. The timezone is based on the user's browser.",
        json_schema_extra={"airalogy_type": "CurrentTime"},
        pattern=_ISO_PATTERN,
    ),
]
