from pydantic import Field


def Recommended(protocol_id: str | None = None):
    """
    Returns a Field object that represents a recommended field.
    """
    json_schema_extra = {}
    if protocol_id:
        json_schema_extra["recommended_protocol_id"] = protocol_id

    return Field(
        json_schema_extra=json_schema_extra,
    )
