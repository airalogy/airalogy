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

CurrentProtocolId = Annotated[
    str,
    Field(
        description="The ID of the current Airalogy Protocol.",
        json_schema_extra={"airalogy_type": "CurrentProtocolId"},
        examples=[
            "airalogy.id.lab.my_lab.project.my_project.protocol.my_protocol.v.0.1.0"
        ],
    ),
]

CurrentRecordId = Annotated[
    str,
    Field(
        description="The ID of the current Airalogy Record.",
        json_schema_extra={"airalogy_type": "CurrentRecordId"},
        examples=["airalogy.id.record.12345678-1234-1234-1234-1234567890ab.v.1"],
    ),
]
