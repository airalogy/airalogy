"""
Airalogy built-in code-string types
===================================
"""

from typing_extensions import Annotated
from pydantic import Field


__all__ = ["PyStr", "JsStr", "TsStr"]


# --------------------------------------------------------------------------- #
# Generic helper
# --------------------------------------------------------------------------- #
def CodeStrField(language: str):
    """
    Build a Pydantic `Field` for a code-string of language.

    Parameters
    ----------
    language :
        Programming language name in lower-case,
        e.g. "python", "javascript", "typescript".

    Returns
    -------
    pydantic.Field
        Field with appropriate description and ``json_schema_extra`` so the Airalogy UI can render the correct editor widget.
    """
    lang = language.lower()

    return Field(
        description=(
            f"Airalogy built-in type: CodeStr ({lang}). Strings of this type contain {lang} source code and are rendered in an editor with {lang} syntax highlighting."
        ),
        json_schema_extra={
            "airalogy_built_in_type": "CodeStr",
            "language": lang,
        },
    )


# --------------------------------------------------------------------------- #
# Concrete language types
# --------------------------------------------------------------------------- #
PyStr = Annotated[str, CodeStrField("python")]
JsStr = Annotated[str, CodeStrField("javascript")]
TsStr = Annotated[str, CodeStrField("typescript")]
