# 在Airalogy Markdown中使用类型

在Airalogy Protocol的基本设计中，对于Airalogy字段（Airalogy Fields, AFs）而言，Airalogy Markdown（`protocol.aimd`）主要用于定义AFs的ID和位置，而关于该AF的类型信息则通过Airalogy Protocol Model（`model.py`）进行定义。这种设计主要是出于功能的分离和解耦，并实现对全面的类型和校验支持（包括支持多个AFs关联的校验关系，如AF1 > AF2）。

然而，在真实的场景下，用户常常无需要复杂的类型和校验关系，而是希望在Markdown中直接定义AF的类型，以简化使用流程。为此，Airalogy Protocol引入了在Airalogy Markdown中指定AF类型的功能。这样，通过一个AIMD可以同时实现`protocol.aimd`和`model.py`的功能，极大地方便了用户的使用。当然，这种简化可以理解为一种语法糖。

## 简单示例

例如，如果我要定义一个Airalogy Protocol记录学生的姓名和年龄，在经典语法下，其通过如下像个文件定义：

`protocol.aimd`:

```aimd
姓名：{{var|name}}
年龄：{{var|age}}
学院: {{var|school}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    name: str
    age: int
    school: str
```

而使用新的AIMD语法糖后，可以将上述两个文件合并为一个`protocol.aimd`文件：

```aimd
姓名：{{var|name: str}}
年龄：{{var|age: int}}
学院: {{var|school: str}}
```

在这个新的语法中，我们通过在变量名后使用`:`（该语法和Python的类型注解类似）来添加类型信息（如`:str`和`:int`）。

## 可选或可清空的值

当某个字段允许用户留空时，可以在类型注解中追加 `| None`。如果这个字段默认也应该为空，可以同时把默认值写成 `None`：

```aimd
血型：{{var|blood_type: BloodType | None = None}}
审核类型：{{var|review_type: Literal["quick", "scoping"] | None = None}}
是否观察到皮疹：{{var|reaction_rash: bool | None = None}}
```

这个语法表示记录值可以是声明的类型，也可以是 `None`。在浏览器 recorder UI 中，带 `None` 的下拉型字段会显示本地化的空值选项，例如 `未填写`；选择该项后，JSON Record 中保存为 `null`。如果用户必须选择一个真实值，就不要写 `| None`。

## 为Airalogy字段添加额外信息

在传统双文件语法下，我们可以通过在`model.py`中为AF添加额外的信息，例如描述、默认值等：

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str = Field(default="未知", title="学生姓名", description="学生的全名", max_length=50)
    age: int = Field(default=0, title="学生年龄", description="学生的年龄，单位为岁", ge=0)
    school: str = "生科院"
```

而在新的AIMD语法中，我们也可以通过类似的方式为AF添加这些额外信息：

```aimd
姓名：{{var|name: str = "未知", title = "学生姓名", description = "学生的全名", max_length = 50}}
年龄：{{var|age: int = 0, title = "学生年龄", description = "学生的年龄，单位为岁", ge = 0}}
学院: {{var|school: str = "生科院"}}
```

这样，Airalogy会自动将这些信息转换为相应的Pydantic字段定义，从而实现类型和校验功能。

## 在AIMD中定义含有Sub Vars的Var Table

在某些场景下，我们需要定义一个含有多个子字段（Sub Vars）的复合字段（Var Table）。例如，假设我们需要记录多个学生的信息，每个学生包含姓名和年龄两个字段。在传统的双文件语法下，我们可以通过如下方式定义：

`protocol.aimd`:

```aimd
学生列表：{{var|students, subvars=[name, age]}}
```

`model.py`:

```py
from pydantic import BaseModel, Field

class Student(BaseModel):
    name: str = Field(title="学生姓名", description="学生的全名", max_length=50)
    age: int = Field(title="学生年龄", description="学生的年龄，单位为岁", ge=0)

class VarModel(BaseModel):
    students: list[Student] = Field(title="学生列表", description="记录学生的姓名和年龄")
```

在AIMD类型语法糖中，其可以在`protocol.aimd`中通过如下方式定义：

```aimd
{{var|students: list[Student], 
    title="学生信息",
    description="记录学生的姓名和年龄",
    subvars=[
        var(
            name: str = "张三",
            title="学生姓名",
            description="学生的全名",
            max_length=50
        ),
        var(
            age: int = 18,
            title="学生年龄",
            description="学生的年龄，单位为岁",
            ge=0
        )
    ]
}}
```

如果`subvar`中每个字段不需要额外的信息，则可以简化为如下语法糖：

```aimd
{{var|students: list[Student], subvars=[name: str = "张三", age: int = 18]}}
```

额外的：

1. Sub Vars的定义顺序会影响前端显示顺序，例如上述案例中，`name`会显示在`age`的前面。
2. 当我们不对主`var`定义类型时，Airalogy会默认将其类型设置为`list[xxx]`，其中`xxx`根据`subvars`的名字自动构造一个PascalCase的Pydantic Model类名，例如上述案例中，主`var`的类型会被自动设置为`list[NameAge]`，其中`NameAge`为`subvars`中字段名`name`和`age`构造的PascalCase类名。

## `var`类型语法糖语法的通用结构和语法原理

可以看到，在上述AIMD语法糖中，`var`类型的通用结构如下：

```aimd
{{var|<var_id>: <var_type> = <default_value>, **kwargs}}
```

其语法表达结构本质可以被理解为一种特殊的语法糖，其对应等价为一次抽象的Python函数调用：

```py
def var(<var_id>: <var_type> = <default_value>, **kwargs):
    pass
```

因此，该语法天然具有可解析性。为此，`default_value`的引号包裹原则和Python完全一致，对于`str`类型的默认值，必须使用双引号`""`包裹，而对于`int`、`float`、`bool`等类型的默认值，则不需要引号包裹。

### 含有`subvars`的嵌套`var`类型

当我们使用类似：

```aimd
{{var|students, subvars=[name, age]}}
```

或

```aimd
{{var|students, subvars=[name: str, age: int]}}
```

或

```aimd
{{var|students, subvars=[name: str = "张三", age: int = 18]}}
```

其每个`subvar`的构造本质都是一种具有严格形式的语法糖，其每个`subvar`的构建实际上都可以理解为一次对`var`函数的调用。因此每个`subvar`均可以使用上述的类型语法糖，从而实现对嵌套`var`的类型定义，其去语法糖（desugaring）后的等价结构为：

```aimd
{{var|students, subvars=[
    var(name: str = "张三"),
    var(age: int = 18)
]}}
```

在此基础上，我们可以为主`var`和每个`subvar`分别定义类型和参数信息，例如：

```aimd
{{var|students,
    title="学生信息",
    description="记录学生的姓名和年龄",
    subvars=[
        var(
             name: str = "张三",
             title="学生姓名",
             description="学生的全名",
             max_length=50
        ),
        var(
            age: int = 18,
            title="学生年龄",
            description="学生的年龄，单位为岁",
            ge=0
        )
    ]
}}
```

由此，`var`中调用`subvars`本质上`var`的调用是递归的，因此理论上可以实现任意层级的嵌套`var`类型定义。

### 支持的类型

在AIMD中所能够使用的语法类型，除了和Python原生支持的类型（如`str`、`int`、`float`、`bool`, `list`, `dict`, `list[str]`等）一致外，还支持`airalogy.types`中定义的自定义类型，例如`UserName`等，需注意的是和Python语法类似，类型不使用引号包裹。

### `**kwargs`参数说明

对于任意一个`var`类型字段，其`**kwargs`大致包含2类，一类是和类型无关的通用参数，例如`title`、`description`等；另一类是和具体类型相关的参数，例如对于`str`类型，可以使用`max_length`、`min_length`等参数进行限制。

#### 语法原理

因此为了简单理解该语法，可以将其理解为，对于任意`var`，其默认含有一套通用的参数`dict`，该`dict`的Python表示形式如下：

```py
common_kwargs = {
    "title": Optional[str],
    "description": Optional[str],
    ...
}
```

而对于每一种具体的类型，其均有一套自己专有的参数`dict`，例如对于`str`类型，其专有参数`dict`的Python表示形式如下：

```py
str_kwargs = {
    "max_length": Optional[int],
    "min_length": Optional[int],
    ...
}
```

而最终的`var`类型的参数`dict`，则是通过将通用参数`dict`和具体类型专有参数`dict`进行合并得到的，例如对于`str`类型的`var`，其最终的参数`dict`为：

```py
var_str_kwargs = {
    **common_kwargs,
    **str_kwargs,
}
```

由此，在AIMD语法糖中，对于`str`类型的`var`，其支持的参数即为`var_str_kwargs`中的所有参数。

```aimd
{{var|<var_id>: str, **var_str_kwargs}}
```

## 聚合与覆写原则

当 `protocol.aimd` 和 `model.py` 同时存在时，`data.var` 的字段集合仍然由 AIMD 决定。AIMD 中的类型语法糖会先生成一份基础 `VarModel`；`model.py` 中的同名字段会覆写 AIMD 生成的字段；AIMD 中存在而 `model.py` 没有定义的字段会保留 AIMD 生成的类型。`model.py` 不能额外定义 AIMD 中没有出现的 `VarModel` 字段。

这意味着以下写法都是允许的：

1. 字段只在 AIMD 中定义类型，`model.py` 不重复定义。
2. 字段在 AIMD 中只定义位置和 ID，不写类型，由 `model.py` 定义最终类型。

Airalogy 不要求 AIMD 和 `model.py` 拥有完全相同的字段集合，但要求 `model.py::VarModel` 的字段必须是 AIMD `var` 字段的子集。默认检查还会拒绝同一个字段的显式类型冲突：如果 AIMD 显式声明了 `age: int`，而 `model.py::VarModel` 将 `age` 声明为 `str`，则直接报错。

例如，下面的 Protocol 是有效的：

`protocol.aimd`:

```aimd
样本：{{var|sample_id: str}}
年龄：{{var|age}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    age: int
```

最终的 `data.var` 校验模型会包含 `sample_id: str` 和 `age: int`。其中 `sample_id` 来自 AIMD，`age` 由 `model.py` 覆写 AIMD 的默认字符串类型。

下面的 Protocol 则是无效的：

`protocol.aimd`:

```aimd
样本：{{var|sample_id: str}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    sample_id: str
    operator_id: str
```

`airalogy check protocol.aimd` 会报告该不兼容，因为 `operator_id` 不是 AIMD 中声明过的 `var`。如果确实需要记录该字段，应该先在 AIMD 中声明它；如果它只是导入来源、运行元信息或后端状态，通常应放入 `metadata` 或其他专门结构，而不是放入 `data.var`。

下面这种同名显式类型冲突也无效：

`protocol.aimd`:

```aimd
年龄：{{var|age: int}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    age: str
```

`airalogy check protocol.aimd` 会报告该冲突，因为 AIMD 将 `age` 显式声明为 `int`，但 `VarModel` 将其声明为 `str`。批量导入也会在导入 Record 前执行同样的兼容性检查，并使用聚合后的模型校验 `data.var`。

如果需要更丰富的 Pydantic 约束，应保持基础类型一致，并在 `model.py` 中增加约束：

```py
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    age: int = Field(ge=0, title="年龄")
```
