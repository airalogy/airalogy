from typing_extensions import Annotated

from pydantic import Field

__all__ = ["IgnoreStr"]


IgnoreStr = Annotated[
    str,
    Field(
        default="",
        json_schema_extra={"airalogy_built_in_type": "IgnoreStr"},
    ),
]
