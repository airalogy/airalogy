"""
This module contains the built-in types for Airalogy. These types could be used to define the Airalogy Protocol Model.
"""

__all__ = [
    "UserName",
    "CurrentTime",
    "CurrentProtocolId",
    "CurrentRecordId",
    "ChineseEducationLevel",
    "ChineseEthnicGroup",
    "ChineseGender",
    "ChineseMaritalStatus",
    "ChineseProvinceLevelRegion",
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
    "PyStr",
    "JsStr",
    "TsStr",
    "JsonStr",
    "TomlStr",
    "YamlStr",
    "ATCG",
    "SnakeStr",
    "VersionStr",
    "ProtocolId",
    "RecordId",
]


from .recommended import Recommended
from .current import CurrentTime, CurrentProtocolId, CurrentRecordId
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
    FileIdDNA,
)
from .user_name import UserName
from .ignore import IgnoreStr
from .code_str import PyStr, JsStr, TsStr, JsonStr, TomlStr, YamlStr
from .atcg import ATCG
from .aimd import AiralogyMarkdown
from .protocol import SnakeStr, VersionStr, ProtocolId, RecordId
from .chinese import (
    ChineseEthnicGroup,
    ChineseEducationLevel,
    ChineseProvinceLevelRegion,
    ChineseGender,
    ChineseMaritalStatus,
)
