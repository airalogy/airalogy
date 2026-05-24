from datetime import timedelta

from pydantic import BaseModel


class VarModel(BaseModel):
    seconds: int
    duration: timedelta
    endpoint: str
