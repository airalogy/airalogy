"""
This module contains the built-in types for Airalogy. These types could be used to define the Airalogy Protocol Model.

.. deprecated::
   `airalogy.built_in_types` is deprecated. Use `airalogy.types` instead.
"""

import warnings

# Re-export everything from the original modules for backward compatibility
from ..models.record import RecordId
from .recommended import Recommended
from .current_time import CurrentTime
from .file import (
    FileIdCSV,
    FileIdDOCX,
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
    "Recommended",
    "IgnoreStr",
]
