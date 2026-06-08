from pydantic import BaseModel


class VarModel(BaseModel):
    sample_name: str
    sample_file: str
