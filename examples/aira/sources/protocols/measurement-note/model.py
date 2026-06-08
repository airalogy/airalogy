from pydantic import BaseModel


class VarModel(BaseModel):
    sample_name: str
    measurement_value: float
    measurement_unit: str
    operator: str
