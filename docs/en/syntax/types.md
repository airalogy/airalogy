# Commonly-used Types in an Airalogy Protocol Model

```python
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field


class VarModel(BaseModel):
    a_date: date = Field(
        date.today(),  # Default is today's date, format is YYYY-MM-DD
        title="Date",
        description="Record date in YYYY-MM-DD format.",
    )
    a_datetime: date = Field(
        datetime.now(),  # Default is current date and time, format is YYYY-MM-DDTHH:MM:SS
        title="Datetime",
        description="Record date and time in YYYY-MM-DDTHH:MM:SS format.",
    )
    a_timedelta: timedelta = Field(
        timedelta(hours=1, minutes=1, seconds=1),  # Default is 1 hour 1 minute 1 second
        title="Duration",
        description="Record duration in ISO 8601 format.",
        examples=["PT1H1M1S"],  # ISO 8601 format duration
    )
```
