"""
This module contains the built-in types for Airalogy. These types could be used to define the Airalogy Protocol Model.
"""

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
    "FileIdDna",
    "Recommended",
    "IgnoreStr",
    "ATCG",
]


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
    FileIdDna,
)
from .aimd import AiralogyMarkdown
from .user_name import UserName
from .ignore import IgnoreStr
from .atcg import ATCG
