"""
Model for the Research Record.
"""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

RecordId = Annotated[
    str,
    Field(
        description="ID of an Airalogy Record. This ID is globally unique for each record in the Airalogy platform.",
        examples=["airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
        json_schema_extra={
            "airalogy_built_in_type": "RecordId",
        },
    ),
]


class RecordMetadata(BaseModel):
    """
    Model for the metadata of a Research Record.
    """

    initial_submission_user_id: str = Field(
        description="ID of the user who initially submitted the record.",
        examples=["zhang_san"],
    )
    initial_submission_time: datetime = Field(
        description="Time when the record was initially submitted.",
        examples=["2024-01-01T00:00:00+08:00"],
    )
    current_submission_user_id: str = Field(
        description="ID of the user who submitted the record at the current version.",
        examples=["zhang_san"],
    )
    current_submission_time: datetime = Field(
        description="Time when the record was submitted at the current version.",
        examples=["2024-01-01T00:00:00+08:00"],
    )
    lab_id: str = Field(
        description="Airalogy Lab ID. This ID is globally unique for each lab in the Airalogy platform.",
        examples=["airalogy"],
    )
    project_local_id: str = Field(
        description="Airalogy Project Local ID. This ID is unique within the lab. `project_local_id` is used to identify the project that the record belongs to.",
        examples=["airalogy_dev"],
    )
    rn_local_id: str = Field(
        description="Airalogy Research Node Local ID. This ID is unique within the project. `rn_local_id` is used to identify the research node that the record belongs to.",
        examples=["rn_test"],
    )
    rn_ver: str = Field(
        description="Research Node Version. `rn_ver` is used to identify the version of the Research Node that the record was recorded under.",
        examples=["0.1.0"],
    )
    record_num: int = Field(
        description="Record Number. `record_num` is used to identify the record's submission order under the Research Node. `1` means the first record under the Research Node.",
        examples=[1],
    )
    record_ver: int = Field(
        description="Record Version: `record_ver` is used to identify the edit submission number within the Research Node. `1` indicates the first submission. Starting from `2`, it indicates a submission that is edited based on the previous submission.",
        examples=[1],
    )
    sha1: str = Field(
        description="SHA-1 hash value of the `data` field of the record.",
    )


class RecordData(BaseModel):
    """
    Model for the `data` field of a Research Record.
    """

    rv: dict = Field(
        description="The data under the Research Variable template.",
    )
    rs: dict = Field(
        description="The data under the Research Step template.",
    )
    rc: dict = Field(
        description="The data under the Research Checkpoint template.",
    )


class Record(BaseModel):
    """
    Model for a Research Record. It primarily consists of 3 fields:
    - `record_id`: The ID of the record.
    - `metadata`: The metadata of the record.
    - `data`: The data of the record.
    """

    id: RecordId
    metadata: RecordMetadata
    data: RecordData
