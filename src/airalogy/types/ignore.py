from typing_extensions import Annotated

from pydantic import Field

__all__ = ["IgnoreStr"]


IgnoreStr = Annotated[
    str,
    Field(
        default="",
        json_schema_extra={"airalogy_type": "IgnoreStr"},
        description="In an Airalogy Field of this type, a user may provide a string; however, when the Airalogy Record is submitted, the string is not persisted. This is intended for sensitive input (such as an API key) that the Airalogy Protocol Assigner can consume during processing but that should never be stored in the final Record.",
    ),
]
