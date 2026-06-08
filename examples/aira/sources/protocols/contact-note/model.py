from pydantic import BaseModel


class VarModel(BaseModel):
    person_name: str
    channel: str
    summary: str
