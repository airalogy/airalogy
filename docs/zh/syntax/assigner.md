# Syntax for Assigner

## Assigner

在真实的科研方案中，有很多的Data Fields（比如`var`s、`step`s、`check`s）是可以通过其他Fields计算得到的（也即存在一些Fields依赖于另一些Fields的关系）。为了满足这种依赖的自动计算，Airalogy提供了高级功能/语法：赋值器（Assigner）。

例如，`var_3`可以基于`var_1`和`var_2`的值来自动计算获得。对于该实例，我们可以通过分别编写以下3个文件来实现：

**文件1：AIMD**。在该文件中，我们显式定义了`var_1`、`var_2`和`var_3`。

```aimd
<!-- File: protocol.aimd -->

The value of `var_1`: {{var|var_1}}

The value of `var_2`: {{var|var_2}}

The value of `var_3`: {{var|var_3}}

Note: `var_3` = `var_1` + `var_2`
```

**文件2：Model**。在该文件中，我们定义了`var_1`、`var_2`和`var_3`的数据类型。

```py
# File: model.py

from pydantic import BaseModel

class VarModel(BaseModel):
    var_1: float
    var_2: float
    var_3: float
```

**文件3：Assigner**。在该文件中，我们定义了`var_3`的计算逻辑。

```py
# File: assigner.py

# 首先，我们从`airalogy`中的相关模块导入必要的类和函数
from airalogy.assigner import (
    AssignerBase, # 用于定义Assigner的基类
    AssignerResult, # 用于约束Assigner的返回结果的数据结构
    assigner, # 用于定义Assigner的装饰器
)

class Assigner(AssignerBase): # 必须定义一个继承自`AssignerBase`的名为`Assigner`的类
    @assigner( # 被该装饰器装饰的函数被视为Assigner类中的一个静态方法，用于定义一个Assigner的赋值单元
        assigned_fields=[ # 所赋值的Fields的名称
            "var_3",
        ],
        dependent_fields=[ # 依赖的Fields的名称
            "var_1",
            "var_2",
        ],
        mode="auto", # 用于定义Assigner的模式。
        # 不同模式的含义如下：
        # "auto": 自动计算的赋值单元，即只要其依赖的Fields的值发生变化，该Assigner就会自动执行，以更新其赋值的Fields的值
        # "manual": 手动计算的赋值单元，即需要用户手动点击前端的赋值按钮来执行
    )
    def calculate_var_3(dependent_fields: dict) -> AssignerResult: # 赋值函数的函数名可以任意命名，但其接收的参数必须为`dependent_fields`，且返回值必须为一个AssignerResult对象。其中`dependent_fields`字典必须包含所有依赖的Fields的值（即`dependent_fields`中的key-value对应于Fields的名称和值，且必须一一对应）
        var_1_value = dependent_fields["var_1"] # 从`dependent_fields`字典中取出`var_1`的值
        var_2_value = dependent_fields["var_2"] # 从`dependent_fields`字典中取出`var_2`的值
        
        var_3_value = var_1_value * var_2_value # 计算`var_3`的值

        # 该函数的返回值为一个AssignerResult对象，其中包含了Assigner的执行结果
        return AssignerResult(
            success=True, # 用于表示Assigner是否成功执行
            assigned_fields={ # 用于表示Assigner执行成功后，所赋值的Fields的名称和值。该字典中的keys对应于`assigned_rvs`中的`var`s的名称，且必须一一对应
                "var_3": var_3_value,
            },
            error_message=None, # 当Assigner执行失败时，用于表示失败的原因。由于此时`success`为True，因此该字段必须为None
        )
```

注意：

- 在上述案例中我们展示了从2个Fields计算得到1个RF的情况。实际上，Assigner支持从任意多个Fields计算得到任意多个Fields的情况，即被赋值Fields和依赖Fields的关系可以为多对多（multiple-to-multiple）。
- 在真实Airalogy Protocol中，Assigner的`dependent_fields`也可以是`check`或`step`。

上述Assigner的返还中，`success`和`error_message`也可以省略，此时`success`默认为`True`，`error_message`默认为`None`。则此时上述Assigner的返还可以简化为：

```py
return AssignerResult(
    assigned_fields={
        "var_3": var_3_value,
    },
)
```

### `dependent_fields`/`assigned_fields`的数据结构

如前所示，在每被`@assigner`装饰的赋值函数中，其参数总是`dependent_fields`，并且其返还值`AssignerResult`中总是包含`assigned_fields`。那么`dependent_fields`/`assigned_fields`的数据结构是什么呢？为了保证通信的通用性，这里我们遵从以下规则：

1. `dependent_fields`/`assigned_fields`的本质可以被视为是一个API请求的JSON数据结构，其通信协议遵循Airalogy Protocol Model的JSON Schema。
2. `dependent_fields`/`assigned_fields`是一个Python字典（`dict`），其key为Fields的名称，其value为Fields的值。
3. key总是一个字符串。
4. value的数据类型根据Fields的JSON Schema（可在Airalogy Record记录界面左边Fields列表中查看）而定。换言之，value的数据类型总是JSON Schema支持的数据类型，只不过由于Assigner是在Python中进行，因此这些Fields的数据类型是从JSON Schema转换为Python后的等价数据类型。
5. 对于`assigned_fields`而言，由于某些特殊的Assigner（如`check`）其所需返还的Fields可能存在特殊的数据结构，在这些情况下，可能通过某些特殊的`airalogy`中特定的数据类型进行返还约束（如`CheckValue`）。

### 含有复杂数据类型的Assigner

当`dependent_fields`中含有具有复杂数据类型的`var`s时，如果我们需要在Assigner中对其进行基于复杂类型的计算，我们应该显式的将其从简单数据类型转换为复杂数据类型。

例如，

**文件1：AIMD**

```aimd
<!-- File: /protocol.aimd -->

实验记录时间：{{var|record_time}}
实验记录时间+1天：{{var|record_time_plus_1_day}}
```

**文件2：Model**

```py
# File: model.py

from datetime import datetime
from pydantic import BaseModel

class VarModel(BaseModel):
    record_time: datetime
    record_time_plus_1_day: datetime
```

**文件3：Assigner**

```py
# File: assigner.py

from datetime import datetime, timedelta
from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)

class Assigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "record_time_plus_1_day",
        ],
        dependent_fields=[
            "record_time",
        ],
        mode="auto",
    )
    def calculate_rerecord_time_plus_1_day(dependent_fields: dict) -> AssignerResult:
        record_time_str = dependent_fields["rerecord_time"] # datetime类型在JSON Schema中储存为字符串
        record_time = datetime.fromisoformat(rerecord_time_str) # 将字符串转换为datetime类型

        record_time_plus_1_day = rerecord_time + timedelta(days=1)
        record_time_plus_1_day_str = record_time_plus_1_day.isoformat() # 将datetime类型转换为字符串以保证通信可行性

        return AssignerResult(
            assigned_fields={
                "record_time_plus_1_day": record_time_plus_1_day_str,
            },
        )
```

## Assigner for Checkpoint-class Fields

在真实的科研方案中，有很多的`check`s是可以通过其他Fields计算得到的。为了满足这种依赖的自动计算，也可以使用Assigner来实现。

例如，`check_1`可以基于`var_1`和`var_2`的值来自动计算获得。对于该实例，我们可以通过分别编写以下三个文件来实现：

**文件1：AIMD**。在该文件中，我们显式定义了`var_1`、`var_2`、`var_1_2_sum`、`check_sum_gt_10`。

```aimd
<!-- File: protocol.aimd -->

The int value of `var_1`: {{var|var_1}}

The int value of `var_2`: {{var|var_2}}

The sum of `var_1` and `var_2`: {{var|var_1_2_sum}}

{{rc|check_sum_gt_10}} `var_1` + `var_2` > 10

Note: if `var_1` + `var_2` > 10, `check_sum_gt_10.checked` = `True`; otherwise, `check_sum_gt_10.checked` = `False`
```

**文件2：Model**。在该文件中，我们定义了`var_1`、`var_2`的数据类型。

```py
# File: model.py

from pydantic import BaseModel

class VarModel(BaseModel):
    var_1: int
    var_2: int
    var_1_2_sum: int
```

**文件3：Assigner**。在该文件中，我们定义了`check_sum_gt_10`的计算逻辑。

```py
# File: assigner.py

from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)
from airalogy.model import CheckValue # 用于约束`check`的值的数据类型

class Assigner(AssignerBase):
    @rc_assigner(
        assigned_fields=[
            "var_1_2_sum", # 注意这里被赋值的是一个RV
            "check_sum_gt_10", # 注意这里被赋值的是一个`check`
        ],
        dependent_fields=[
            "var_1",
            "var_2",
        ],
        mode="auto",
    )
    def check_sum_gt_10(dependent_fields: dict) -> AssignerResult:
        var_1_value = dependent_fields["var_1"]
        var_2_value = dependent_fields["var_2"]

        var_1_2_sum = var_1_value + var_2_value
        check_sum_gt_10_checked = var_1_2_sum > 10

        return AssignerResult(
            assigned_fields={
                "var_1_2_sum": var_1_2_sum,
                "check_sum_gt_10": CheckValue( # 由于`check`的值有特殊的数据结构，即包含`checked`和`annotation`两个字段，因此在赋值时需要使用`CheckValue`类对数据结构进行约束
                    checked=check_sum_gt_10_checked, 
                    annotation=f"var_1 + var_2 = {var_1_2_sum}, which is {'>' if check_sum_gt_10_checked else '<='} 10"
                )
            },
        )
```

注：`step`也可以通过Assigner进行自动计算，其方法与`check`类似。

## 其他Assigner

- [Assigner for Variable Table](var_table.md#assigner-for-variable-table)
