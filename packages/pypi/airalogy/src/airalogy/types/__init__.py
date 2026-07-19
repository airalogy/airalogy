"""
This module contains the built-in types for Airalogy. These types could be used to define the Airalogy Protocol Model.
"""

from .registry import (
    AiralogyTypeDescriptor,
    export_airalogy_type_metadata,
    register_airalogy_type,
)

__all__ = [
    "UserName",
    "CurrentTime",
    "CurrentProtocolId",
    "CurrentRecordId",
    "EntityRef",
    "BloodType",
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
    "CodeStr",
    "PyStr",
    "JsStr",
    "TsStr",
    "JsonStr",
    "TomlStr",
    "YamlStr",
    "ATCG",
    "DNASequence",
    "SnakeStr",
    "VersionStr",
    "ProtocolId",
    "RecordId",
    "AiralogyTypeDescriptor",
    "export_airalogy_type_metadata",
    "register_airalogy_type",
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
from .code_str import CodeStr, PyStr, JsStr, TsStr, JsonStr, TomlStr, YamlStr
from .atcg import ATCG
from .dna import DNASequence
from .aimd import AiralogyMarkdown
from .blood import BloodType
from .entity_ref import EntityRef
from .protocol import SnakeStr, VersionStr, ProtocolId, RecordId
from .chinese import (
    ChineseEthnicGroup,
    ChineseEducationLevel,
    ChineseProvinceLevelRegion,
    ChineseGender,
    ChineseMaritalStatus,
)

for descriptor in (
    AiralogyTypeDescriptor("UserName", storage_kind="scalar", ui_kind="current-user"),
    AiralogyTypeDescriptor("CurrentTime", storage_kind="scalar", ui_kind="current-time"),
    AiralogyTypeDescriptor("CurrentProtocolId", storage_kind="scalar"),
    AiralogyTypeDescriptor("CurrentRecordId", storage_kind="scalar"),
    AiralogyTypeDescriptor("EntityRef", storage_kind="reference", ui_kind="entity-ref"),
    AiralogyTypeDescriptor("BloodType", storage_kind="scalar"),
    AiralogyTypeDescriptor("ChineseEducationLevel", storage_kind="scalar"),
    AiralogyTypeDescriptor("ChineseEthnicGroup", storage_kind="scalar"),
    AiralogyTypeDescriptor("ChineseGender", storage_kind="scalar"),
    AiralogyTypeDescriptor("ChineseMaritalStatus", storage_kind="scalar"),
    AiralogyTypeDescriptor("ChineseProvinceLevelRegion", storage_kind="scalar"),
    AiralogyTypeDescriptor("AiralogyMarkdown", storage_kind="scalar", ui_kind="markdown"),
    AiralogyTypeDescriptor("RecordId", storage_kind="scalar"),
    AiralogyTypeDescriptor("FileIdPNG", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdJPG", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdSVG", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdWEBP", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdTIFF", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdMP4", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdMP3", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdAIMD", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdMD", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdTXT", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdCSV", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdJSON", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdDOCX", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdXLSX", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdPPTX", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdPDF", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("FileIdDNA", storage_kind="file-id", ui_kind="file"),
    AiralogyTypeDescriptor("Recommended", storage_kind="scalar"),
    AiralogyTypeDescriptor("IgnoreStr", storage_kind="scalar"),
    AiralogyTypeDescriptor("CodeStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("PyStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("JsStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("TsStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("JsonStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("TomlStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("YamlStr", storage_kind="scalar", ui_kind="code"),
    AiralogyTypeDescriptor("ATCG", storage_kind="scalar", ui_kind="dna-text"),
    AiralogyTypeDescriptor("DNASequence", storage_kind="structured", ui_kind="dna-sequence"),
    AiralogyTypeDescriptor("SnakeStr", storage_kind="scalar"),
    AiralogyTypeDescriptor("VersionStr", storage_kind="scalar"),
    AiralogyTypeDescriptor("ProtocolId", storage_kind="scalar"),
):
    register_airalogy_type(descriptor, replace=True)
