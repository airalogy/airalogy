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

## 覆写原则

由于可以在AIMD和`model.py`中同时定义AF的类型和参数信息，因此当两者均存在时，Airalogy会遵循以下覆写原则：

1. `model.py`中的定义优先级高于AIMD中的定义。
2. 当`model.py`中未定义某个AF时，使用AIMD中的定义。
3. 当`model.py`中定义了某个AF时，其定义将完全覆写AIMD中的定义，包括类型和所有参数信息。

### 原理

简单来说，为了实现基于任意一个Airalogy Protocol渲染出正确的Airalogy Protocol Recording Interface中每个AFs的对应的Field Input Boxes，本质上，我们是要根据该Airalogy Protocol构建出Airalogy Field Json Schema。为此，当同时存在AIMD和`model.py`时，Airalogy会先根据AIMD构建出初始的Json Schema，然后再根据`model.py`中的定义对该Json Schema进行覆写，最终得到正确的Json Schema。

例如，假设如下案例：

`protocol.aimd`:

```aimd
姓名：{{var|name: str = "未知", title = "学生姓名", description = "学生的全名", max_length = 50}}
年龄：{{var|age:: str}}
学院: {{var|school: str}}
```

`model.py`:

```py
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="年龄", description="学生的年龄，单位为岁", ge=0)
```

则通过`protocol.aimd`构建出的初始Json Schema为：

```json
{
    "title": "VarModel",
    "type": "object",
    "properties": {
        "name": {
            "title": "学生姓名",
            "type": "string",
            "description": "学生的全名",
            "maxLength": 50,
            "default": "未知"
        },
        "age": {
            "title": "age",
            "type": "string"
        },
        "school": {
            "title": "school",
            "type": "string"
        }
    }
}
```

而根据`model.py`中的定义获得的Json Schema为：

```json
{
    "title": "VarModel",
    "type": "object",
    "properties": {
        "name": {
            "title": "name",
            "type": "string"
        },
        "age": {
            "title": "年龄",
            "type": "integer",
            "description": "学生的年龄，单位为岁",
            "minimum": 0,
            "default": 18
        }
    }
}
```

注意，在`model.py`中重复定义了`name`和`age`两个AFs，因此这2个AFs会覆写掉AIMD中对应的定义，最终得到的Json Schema为：

```json
{
    "title": "VarModel",
    "type": "object",
    "properties": {
        "name": {
            "title": "name",
            "type": "string"
        },
        "age": {
            "title": "年龄",
            "type": "integer",
            "description": "学生的年龄，单位为岁",
            "minimum": 0,
            "default": 18
        },
        "school": {
            "title": "school",
            "type": "string"
        }
    }
}
```

注意到在上述最终的Json Schema中，`name`的并没有`description`和`maxLength`等信息，因为这些信息均被`model.py`中的定义所覆写掉了。

或者也可以理解为，上述的实现原理是，Airalogy会先根据AIMD构建出初始的Pydantic Model类，然后再根据`model.py`中的定义对该Pydantic Model类进行覆写，最终得到正确的Pydantic Model类，从而实现正确的Json Schema生成。

例如，上述案例中，根据AIMD构建出的初始Pydantic Model类为：

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str = Field(
        default="未知", title="学生姓名", description="学生的全名", max_length=50
    )
    age: str
    school: str
```

而根据`model.py`中的定义获得的Pydantic Model类为：

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="年龄", description="学生的年龄，单位为岁", ge=0)
```

则最终得到的Pydantic Model类为：

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="年龄", description="学生的年龄，单位为岁", ge=0)
    school: str
```

然后我们通过调用`VarModel.model_json_schema()`即可得到上述最终的Json Schema。

#### 未来功能

当然，出于语意一致性和原子性原则，我们并不推荐用户在`model.py`和`protocol.aimd`中重复定义同一个AF。在未来的版本中，我们计划增加对该行为的警告提示，以帮助用户避免这种潜在的错误使用。
