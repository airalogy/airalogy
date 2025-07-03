# Data models used in Airalogy

在Airalogy中我们使用词语“Model”来代指数据模型。其通常是一个继承自`pydantic.BaseModel`的Python类，用于定义数据结构。

暴露外部使用的Models的入口均类似如下：

```py
from airalogy.models import CheckValue
```

## Models

### CheckValue

用于约束Airalogy Checkpoint的数据结构。

入口：

```py
from airalogy.models import CheckValue
```

定义：

```py
from pydantic import BaseModel

class CheckValue(BaseModel):
    checked: bool
    annotation: str
```

### StepValue

用于约束Airalogy Step的数据结构。

入口：

```py
from airalogy.models import StepValue
```

定义：

```py
from pydantic import BaseModel

class StepValue(BaseModel):
    checked: bool | None
    annotation: str
```

和`CheckValue`的区别在于，`StepValue`的`checked`字段可以为`None`，用于表示该Step未被检查。

## Models和Built-in Types的区别

在Airalogy中，我们提供了一些内置类型，如`UserName`、`CurrentTime`、`Md`等。这些内置类型是一些特殊的字段类型，用于在Airalogy平台上自动赋值、自动生成界面等。由于这些内置类型实际上和前端用户Recording Interface的生成和交互密切相关，因此我们将其独立出来，而统一放在`built_in_types`模块中。其入口均类似如下：

```py
from airalogy.built_in_types import UserName
```

我们可以在Airalogy Model中使用这些内置类型，例如：

`model.py`:

```py
from pydantic import BaseModel
from airalogy.built_in_types import UserName


class VarModel(BaseModel):
    user_name: UserName
```

而普通的Model则是用于约束Airalogy内部的数据结构，以便于Airalogy Python代码的数据校验、数据处理等，而通常不会涉及到Recording Interface的生成和交互。例如，在我们定义一个有关于Airalogy Checkpoint的Assigner时，我们会调度到Airalogy Checkpoint相关的Model：

`assigner.py`:

```py
from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)
from airalogy.models import CheckValue


class Assigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "a_gt_b",
        ],
        dependent_fields=[
            "a",  # float
            "b",  # float
        ],
        mode="auto",
    )
    def check_a_gt_b(dependent_fields: dict) -> AssignerResult:
        a = dependent_fields["a"]
        b = dependent_fields["b"]
        a_gt_b = a > b
        return AssignerResult(
            assigned_fields={"a_gt_b": CheckValue(checked=a_gt_b, annotation="a > b")},
        )
```
