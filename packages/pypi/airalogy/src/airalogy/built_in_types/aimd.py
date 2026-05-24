"""
Built-in type: AiralogyMarkdown
"""

from pydantic import Field
from typing_extensions import Annotated

AiralogyMarkdown = Annotated[
    str,
    Field(
        description="An Airalogy Markdown string",
        json_schema_extra={"airalogy_built_in_type": "AiralogyMarkdown"},
    ),
]
"""
Airalogy's built-in type: AiralogyMarkdown.

Airalogy Markdown (AIMD) is a Markdown-like format used in Airalogy for writing and rendering text. It is designed to be user-friendly and easy to read, while also being powerful enough to support a wide range of formatting options. 

Strings of this type are parsed and rendered according to the Airalogy Markdown specification.

We explicitly refer to the format as Airalogy Markdown—rather than simply Markdown, because "Markdown" is a broad term: different platforms interpret it with their own extensions and syntax rules. Without a clear label, users may be unsure which rules to follow. Declaring Airalogy Markdown as the default Markdown flavor in Airalogy makes the applicable syntax and standards unambiguous.
"""
