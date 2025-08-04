"""
Built-in type: UserName
"""

from pydantic import Field
from typing_extensions import Annotated

UserName = Annotated[
    str,
    Field(
        description="The user name of the current Airalogy user",
        json_schema_extra={"airalogy_type": "UserName"},
    ),
]
