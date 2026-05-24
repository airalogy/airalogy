"""
Deprecated compatibility entrypoint for Airalogy built-in types.

.. deprecated::
   `airalogy.built_in_types` is deprecated. Use `airalogy.types` instead.

This package exists only for backward-compatible re-exports of legacy names.
Do not add new built-in type definitions here.
New built-in types must be implemented and exported only from `airalogy.types`.
Do not expose newly introduced types from this deprecated namespace.
"""

import warnings

# Deprecated compatibility layer only.
# Keep re-exports here for existing imports, but do not treat this package as
# the canonical place to add new built-in types.
from ..models.record import RecordId
from .recommended import Recommended
from .current_time import CurrentTime
from .file import (
    FileIdCSV,
    FileIdDOCX,
    FileIdDNA,
    FileIdJPG,
    FileIdJSON,
    FileIdMD,
    FileIdMP3,
    FileIdMP4,
    FileIdPDF,
    FileIdPNG,
    FileIdPPTX,
    FileIdAIMD,
    FileIdSVG,
    FileIdTIFF,
    FileIdTXT,
    FileIdWEBP,
    FileIdXLSX,
)
from .aimd import AiralogyMarkdown
from .user_name import UserName
from .ignore import IgnoreStr


# Issue deprecation warning
warnings.warn(
    "airalogy.built_in_types is deprecated and will be removed in a future version. "
    "Please use airalogy.types instead.",
    DeprecationWarning,
    stacklevel=2,
)

__all__ = [
    "UserName",
    "CurrentTime",
    "AiralogyMarkdown",
    "RecordId",
    "FileIdPNG",
    "FileIdJPG",
    "FileIdSVG",
    "FileIdWEBP",
    "FileIdTIFF",
    "FileIdMP4",
    "FileIdMP3",
    "FileIdAIMD",
    "FileIdMD",
    "FileIdTXT",
    "FileIdCSV",
    "FileIdJSON",
    "FileIdDOCX",
    "FileIdXLSX",
    "FileIdPPTX",
    "FileIdPDF",
    "FileIdDNA",
    "Recommended",
    "IgnoreStr",
]
