# Assigner赋值需满足JSON Schema类型约束

通过Assigner赋值Fields时，所赋值的Fields的值的类型必须满足`model.py`中对应数据字段的JSON Schema约束格式，并为JSON所能表示的格式（如字符串、数字、布尔值等）。

一个最直观的例子是Python `timedelta`类。

例如假设我定义如下一个Airalogy Protocol:

`protocol.aimd`:

```aimd
秒：{{var|seconds}}
将上值以`duration`格式表示：{{var|duration}}
```

`model.py`:

```python
from datetime import timedelta
from pydantic import BaseModel

class TimeModel(BaseModel):
    seconds: int
    duration: timedelta
```

如果我们想编写一个Assigner来自动处理`seconds`到`duration`的转换，我们需要确保赋值的`duration`字段符合JSON Schema的格式要求。
由于`timedelta`类在JSON Schema中表示为`duration`格式（例如1天2小时30分钟表示为`P1DT2H30M`，1小时30分钟表示为`PT1H30M`），我们需要将`timedelta`转换为ISO 8601格式的字符串。

`assigner.py`:

```python
from datetime import timedelta
from airalogy.iso import timedelta_to_iso

class Assigner(AssignerBase):
    @assigner(
        assigned_fields=["duration"],
        dependent_fields=["seconds"],
        mode="auto",
    )
    def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:
        seconds = dependent_fields["seconds"]
        duration = timedelta(seconds=seconds)
        return AssignerResult(
            assigned_fields={
                "duration": timedelta_to_iso(duration),
            },
        )
```

如果写为如下，则可能会导致错误：

```python
@assigner(
    assigned_fields=["duration"],
    dependent_fields=["seconds"],
    mode="auto",
)
def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:
    seconds = dependent_fields["seconds"]
    duration = timedelta(seconds=seconds)
    return AssignerResult(
        assigned_fields={
            "duration": duration,  # 不安全赋值，可能导致JSON Schema验证失败
        },
    )
```

## `airalogy.iso`模块

为了帮助方便的将常见的Python复杂数据类型转换为ISO格式的字符串，`airalogy.iso`模块提供了一些实用函数。

### `timedelta_to_iso`

将`timedelta`对象转换为ISO 8601格式的字符串。

```python
from datetime import timedelta
from airalogy.iso import timedelta_to_iso

timedelta_obj = timedelta(days=1, hours=2, minutes=30)
iso_string = timedelta_to_iso(timedelta_obj)
print(iso_string)  # 输出: P1DT2H30M
```
