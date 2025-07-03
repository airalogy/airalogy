# Variable Table

## Syntax

在Airalogy Protocol中，可能存在一种特殊的记录情况，即期望一个`{{var}}`的值是一个列表，且列表中的每个元素都是一个子Variable，并且列表通常是非定长的。在这种情况下，在Airalogy Protocol的记录前端，其Variable对应的样式将会从一个简单的值变为一个表格。为了支持这种情况，我们引入了`var_table`模板。

其基本语法如下：

```aimd
{{var_table|<var_id>, subvars=[<subvar_id_1>, <subvar_id_2>, ...]}}
```

注意，这里之所以是`var_id`的原因是，`var_table`本质上是一种特殊的`var`，因此其在数据存储时，其相关数据也存储于`var`模板下，而并不单列于`var_table`模板下。

当`subvars`较多时，为了便于阅读，也可以使用多行的方式进行书写，如下：

```aimd
{{var_table|<var_id>, subvars=[
    <subvar_id_1>, 
    <subvar_id_2>, 
    ...
]
}}
```

在上述语法中，我们可以看到，`{{var_table}}`的语法与`{{var}}`的语法基本一致，只是在`{{var_table}}`中，我们需要指定`subvars`参数，其值为一个列表，列表中的每个元素都对应一个子Variable的`var_id`。这里`subvars`必须被指定的原因是，我们要求所有`var`及其子`var`的名字必须是唯一的，并且必须出现过于AIMD中。

例：

```aimd
<!-- File: protocol.aimd -->

{{var_table|testees, subvars=[name, age]}}
```

其在前端展示为一个表格，如下：

| name    | age |
| ------- | --- |
| [to_be_filled] | [to_be_filled] |

`var_table`的本质实际上也是一个`var`，因此其相关的`var`模型也和普通`var`s一样，在`VarModel`中进行定义。其定义方式如下：

```py
# File: model.py

from pydantic import BaseModel

class Testee(BaseModel):
    # Testee是一个为了实现模型嵌套而定义的中间类。因此其命名实际上可以是任意的，只要保证其与VarModel中list内引用的类名一致即可。根据习惯，我们一般将其命名为对应var_id的PascalCase形式的单数形式。
    name: str
    age: float

class VarModel(BaseModel):
    testees: list[Testee]
    # testees即为上述AIMD中的testees，约束testees的数据类型为Testee的列表
```

### `<var_id>`, `<subvar_id>`命名规则

- `<var_id>`, `<subvar_id>`的命名规则与`<var_name>`的命名规则一致。
- 所有的`var_id`, `subvar_id`亦不得有重名。

### Variable Table / Sub Variables的标题和描述

当然，如同普通的Variables一般，我们也可以为`var_table`及其Sub Variables添加标题和描述。

其方法为在`VarModel`中使用`Field`进行相关信息的添加。例：

```py
# File: model.py

from pydantic import BaseModel, Field

class Testee(BaseModel):
    name: str = Field(title="Name", description="The name of the testee.")
    age: float = Field(title="Age", description="The age of the testee.")

class VarModel(BaseModel):
    testees: list[Testee] = Field(title="Testees", description="The testees of the experiment.")
```

当然`title`和`description`不是必须的，其可以全无、全有、部分有，均可。

当定义了`title`和`description`后，其在前端展示时将会被展示出来。

## Assigner for Variable Table

### 基于Variable Table中的一些Sub Variables赋值另一些Sub Variables

在真实的科研方案中，对于一个Variable Table，其Sub Variables的值也可以通过其他Sub Variables计算得到。为了满足这种依赖的自动计算，我们可以也可以使用Assigner来实现。

例如，`var_table_1`中的`var_1_2_sum`的值可以通过`var_1`和`var_2`的值来自动计算获得。对于该实例，我们可以通过分别编写以下三个文件来实现：

**文件1：AIMD文件**。在该文件中，我们显式定义了`var_table_1`。

```aimd
<!-- File: protocol.aimd -->

{{var_table|var_table_1, subvars=[var_1, var_2, var_1_2_sum]}}
```

**文件2：Model文件**。在该文件中，我们定义了`var_table_1`的数据类型。

```py
# File: model.py

from pydantic import BaseModel

class VarTable1(BaseModel):
    var_1: int
    var_2: int
    var_1_2_sum: int

class VarModel(BaseModel):
    var_table_1: list[VarTable1]
```

**文件3：Assigner文件**。在该文件中，我们定义了`var_table_1`中的`var_1_2_sum`的计算逻辑。

```py
# File: assigner.py

from airalogy.assigner import (
    AssignerBase,
    AssignerResult
    assigner,
)

class Assigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "var_table_1.var_1_2_sum",
        ],
        dependent_fields=[
            "var_table_1.var_1",
            "var_table_1.var_2",
        ], # 注意，当Variable Table参与Assigner计算时，其assigned_fields和dependent_fields的名称需要加上Variable Table的名称前缀，并且最多来源于一个Variable Table。不得跨Variable Table进行计算
        mode="auto",
    )
    def calculate_var_table_1(dependent_fields: dict) -> AssignerResult:
        var_1 = dependent_fields["var_table_1.var_1"]
        var_2 = dependent_fields["var_table_1.var_2"]

        var_1_2_sum = var_1 + var_2

        return AssignerResult(
            assigned_fields={
                "var_table_1.var_1_2_sum": var_1_2_sum,
            },
        )
```

在使用Variable Table Assigner时，我们需要注意以下几点：

1. Variable Table中，由于每一行的数据是独立的，因此Variable Table Assigner的计算逻辑也是基于每一行的数据进行计算的。不同行之间的数据不能相互影响。
2. Variable Table的Sub Variables的值是以列的形式存在的，用户在填写Variable Table时，通常是一行一行的填写，因此在自动计算的时候为了节约计算资源，我们在前端监听用户填写的行，当此行所有的`dependent_fields`都填写完毕时，才会触发Variable Table Assigner的计算逻辑，并计算获得此行的`assigned_fields`的值。对于其他行，我们不会进行计算，直到用户填写完毕。

### 将整个Variable Table作为Dependent Field

Variable Table的一种常见用法是用于批量的参数设置。例如，如果我们想要使用一个Variable Table来设置多个和绘制图表相关的参数，我们可以将整个Variable Table作为一个Dependent Field，然后在Assigner中对整个Variable Table进行计算。

`model.py`:

```py
class VarTable1(BaseModel):
    font_size: int
    font_color: str

class VarModel(BaseModel):
    var_table_1: list[VarTable1]
    font_config_summary: str
```

则如果我们记录了以下的Variable Table的数据：

| font_size | font_color |
| --------- | ---------- |
| 12        | red        |
| 14        | blue       |

则其对应的JSON数据如下：

```json
{
    "var_table_1": [
        {
            "font_size": 12,
            "font_color": "red"
        },
        {
            "font_size": 14,
            "font_color": "blue"
        }
    ],
}
```

为此，我们可以编写以下的Assigner来计算`font_config_summary`：

`assigner.py`:

```py
class Assigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "font_config_summary",
        ],
        dependent_fields=[
            "var_table_1",
        ],
        mode="auto",
    )
    def calculate_font_config_summary(dependent_fields: dict) -> AssignerResult:
        font_config_summary = "\n".join(
            [
                f"font_size: {row['font_size']}, font_color: {row['font_color']}"
                for row in dependent_fields["var_table_1"]
            ]
        )

        return AssignerResult(
            assigned_fields={
                "font_config_summary": font_config_summary,
            },
        )
```

当然，我们也可以把一个Variable Table作为一个Assigned Field作为Assigner的传出。注意此时，每次Assigner的计算都会返回一个完整的Variable Table，而不是单行的Variable Table。因此如果Variable Table已经有数据了，则此种情况下会覆盖原有的Variable Table数据。注意，当将整个Variable Table作为Assigned Field时，不支持再在此基础上进行基于行的Assigner计算，因为本质上既然都能够返回整个Variable Table了，那么就不需要再进行行级的计算了（因为可以在整个Table计算的过程中将行计算的逻辑也包含在内）。
