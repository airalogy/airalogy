"""
Built-in types related to files.
"""

from typing import Annotated

from pydantic import Field


def FileIdField(file_extension: str):
    """
    Return a Field object for a FileId type.
    """
    return Field(
        description=f"Airalogy built-in type: FileId{file_extension.upper()}. This type allows users to upload a .{file_extension.lower()} file and inject it into the related data field.",
        examples=[
            f"airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.{file_extension.lower()}"
        ],
        json_schema_extra={
            "airalogy_type": "FileId",
            "file_extension": file_extension.lower(),
        },
    )


FileIdPNG = Annotated[str, FileIdField("png")]

FileIdJPG = Annotated[str, FileIdField("jpg")]

FileIdSVG = Annotated[str, FileIdField("svg")]

FileIdWEBP = Annotated[str, FileIdField("webp")]

FileIdTIFF = Annotated[str, FileIdField("tiff")]

FileIdMP4 = Annotated[str, FileIdField("mp4")]

FileIdMP3 = Annotated[str, FileIdField("mp3")]

FileIdAIMD = Annotated[str, FileIdField("aimd")]

FileIdMD = Annotated[str, FileIdField("md")]

FileIdTXT = Annotated[str, FileIdField("txt")]

FileIdCSV = Annotated[str, FileIdField("csv")]

FileIdJSON = Annotated[str, FileIdField("json")]

FileIdDOCX = Annotated[str, FileIdField("docx")]

FileIdXLSX = Annotated[str, FileIdField("xlsx")]

FileIdPPTX = Annotated[str, FileIdField("pptx")]

FileIdPDF = Annotated[str, FileIdField("pdf")]

FileIdDNA = Annotated[str, FileIdField("dna")]
