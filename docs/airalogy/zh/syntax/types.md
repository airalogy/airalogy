# Commonly-used types in Airalogy Protocol Model

```py
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field


class VarModel(BaseModel):
    a_date: date = Field(
        date.today(),  # 默认值为今天的日期，格式为YYYY-MM-DD
        title="日期",
        description="记录的日期，格式为YYYY-MM-DD",
    )
    a_datetime: date = Field(
        datetime.now(),  # 默认值为当前的日期和时间，格式为YYYY-MM-DDTHH:MM:SS
        title="日期时间",
        description="记录的日期和时间，格式为YYYY-MM-DDTHH:MM:SS",
    )
    a_timedelta: timedelta = Field(
        timedelta(hours=1, minutes=1, seconds=1),  # 默认值为1小时1分钟1秒
        title="时间间隔",
        description="记录的时间间隔，采用ISO 8601格式",
        examples=["PT1H1M1S"],  # ISO 8601格式的时间间隔
    )
```
