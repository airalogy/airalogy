# Basic Syntax for Airalogy Protocol

本文档主要针对一个Airalogy Protocol中的Airalogy Protocol Markdown (即一个Airalogy Markdown文件)和其相关的Airalogy Protocol Model的基本语法进行说明。

其相关文件通常位于一个Airalogy Protocol包（文件夹）根目录的如下文件中：

- Airalogy Protocol Markdown: `protocol.aimd`
- Airalogy Protocol Model: `model.py`

## Add data fields in Airalogy Markdown

在AIMD中我们可以添加不同类型的数据字段，当前主要包含以下3种类型：

- Variable
- Step
- Checkpoint

其分别在AIMD中通过`{{var}}`, `{{step}}`, `{{check}}` 3种模板进行定义。

为了更进一步说明各种类型的数据字段定义的语法，我们将分别对其进行说明：

### Variable

`{{var}}`通常用于标记在一个Airalogy Protocol中的需要记录的变量/科研数据。

#### AIMD语法

```aimd
{{var|<var_id>}}
```

其中`var`为模板名，`<var_id>`为该变量的ID。

例：

```aimd
<!-- File: protocol.aimd -->

实验记录者：{{var|recorder_name}}
第{{var|experiment_number}}次实验
```

#### `<var_id>`命名规则

- 不得以`_`开头。
- 多个`<var_id>`不得仅通过`_`的数量不同进行区分。如：`user_a`和`user__a`被视为重名。
- 在上述规则之上，遵循Python的变量命名规则。即：
  - 只能包含字母、数字和下划线。
  - 不能以数字开头。
  - 不得包含空格。
- `var`, `step`, `check`模板下的RFs不得有重名（或者是由于`_`的数量不同导致的RF名字的区分。如`user_a`和`user__a`被视为重名），即便它们分别属于不同的模板下。目的：便于AI输入时索引不容易混淆。

#### VarModel类型约束

当通过`{{var}}`定义了一个Variable时，其默认的数据类型约束为`str`。如果需要对其进行非`str`类型的约束，可以进一步在Model中对其进行类型约束。类型约束通过使用`pydantic`进行实现。

例：

```py
# File: model.py

from pydantic import BaseModel

class VarModel(BaseModel):
    recorder_name: str # 约束recorder_name的数据类型为字符串，且值必填
    experiment_number: int # 约束experiment_number的数据类型为整数，且值必填
```

#### VarModel初始自动赋予默认值

##### 简单赋值

对于一些Variable，我们希望其在记录时有一个初始化的默认值。这可以通过在`VarModel`中对其进行赋值来实现。

例：

```py
# File: model.py

from pydantic import BaseModel

class VarModel(BaseModel):
    recorder_name: str = "ZHANG San" # 约束recorder_name的数据类型为字符串，且默认值为"ZHANG San"
    experiment_number: int = 1 # 约束experiment_number的数据类型为整数，且默认值为1
```

##### 函数赋值

当然，在一些情况下，我们希望某Variable的默认值是一个函数的返回值。这可以通过在`VarModel`中对其进行函数赋值来实现。

例，如果我们希望一个`var`的默认值是当前的UTC时间：

```aimd
<!-- File: protocol.aimd -->

{{rv|current_time}}
```

则我们可以在`VarModel`中这样定义：

```py
# File: model.py

from datetime import datetime, timezone
from pydantic import BaseModel

class VarModel(BaseModel):
    current_time: datetime = datetime.now(timezone.utc) # 约束current_time的数据类型为datetime，且默认值为当前的UTC时间
```

#### VarModel额外信息注释

对于Variable，我们可以在Model中为其添加额外的信息注释，如`title`和`description`。

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = Field(
        title="实验记录者", # title为该var的标题，在前端渲染时会被用于显示该var的标题
        description="实验记录者是指记录实验过程的人员。" # description为该var的描述，在前端渲染时会被用于显示该var的描述
    )
```

当我们需要设置默认值时，可以使用`default`参数。

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = Field(
        default="ZHANG San", # 默认值为"ZHANG San"
        title="实验记录者",
        description="实验记录者是指记录实验过程的人员。" 
    )
```

当然，上述`default`, `title`, `description`均为可选项。

当`title`不设置时，前端渲染时会使用RV的ID（`var_id`）的首字母大写作为title。

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = Field(
        default="ZHANG San",
        # 在此案例中，我们不设置title。则前端渲染时会使用该var的ID的首字母大写作为title，即"Recorder Name"
        description="实验记录者是指记录实验过程的人员。"
    )
```

当`description`不设置时，前端渲染时会不显示description。

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = Field(
        title="实验记录者",
        # 在此案例中，我们不设置description。则前端渲染时不会显示description
    )
```

在某些情况下，如果为了帮助国际化，则description也可以写成多语的形式，可以使用`\n`进行换行。

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = Field(
        title="实验记录者",
        # 示例一个多语的description
        description="实验记录者是指记录实验过程的人员。\nThe recorder of the experiment."
    )
```

#### VarModel数值约束

对于数值型的RV，我们可以通过`Field`的相关参数进行约束：

- `gt`: 大于
- `ge`: 大于等于
- `lt`: 小于
- `le`: 小于等于
- `multiple_of`: 是某个数的倍数

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    a_positive_int: int = Field(
        gt=0, # a_positive_int必须为大于0的整数
        title="一个正整数",
        description="这是一个正整数。"
    )
    a_non_negative_int: int = Field(
        ge=0, # a_non_negative_int必须为大于等于0的整数
        title="一个非负整数",
        description="这是一个非负整数。"
    )
    a_negative_int: int = Field(
        lt=0, # a_negative_int必须为小于0的整数
        title="一个负整数",
        description="这是一个负整数。"
    )
    a_non_positive_int: int = Field(
        le=0, # a_non_positive_int必须为小于等于0的整数
        title="一个非正整数",
        description="这是一个非正整数。"
    )
    a_even_int: int = Field(
        multiple_of=2, # a_even_int必须为2的倍数，即偶数
        title="一个偶数",
        description="这是一个偶数。"
    )
    a_positive_float: float = Field(
        gt=0, # a_positive_float必须为大于0的浮点数
        title="一个正浮点数",
        description="这是一个正浮点数。"
    )
```

#### VarModel字符串长度约束

对于字符串型的RV，我们可以通过`Field`的相关参数进行约束：

- `min_length`: 最小长度
- `max_length`: 最大长度
- `pattern`: 正则表达式

例：

```py
# File: model.py

from pydantic import BaseModel, Field

class VarModel(BaseModel):
    a_str_with_min_length: str = Field(
        min_length=3, # a_str_with_min_length的长度至少为3
        title="一个长度至少为3的字符串",
        description="这是一个长度至少为3的字符串。"
    )
    a_str_with_max_length: str = Field(
        max_length=5, # a_str_with_max_length的长度至多为5
        title="一个长度至多为5的字符串",
        description="这是一个长度至多为5的字符串。"
    )
    a_str_with_pattern: str = Field(
        pattern=r"(?i)^NMM-[0-9A-Z]{4}", # a_str_with_pattern必须符合正则表达式`(?i)^NMM-[0-9A-Z]{4}`
        title="NMM ID",
        description="The unique ID for a Natural Medicinal Material."
```

#### VarModel枚举约束

可以使用`Literal`来约束一个Variable的值为一个枚举值。

例，枚举的值是字符串：

```py
# File: model.py
from typing import Literal

class VarModel(BaseModel):
    a_str_enum_var: Literal["a", "b", "c"] = "a" # 设定a_str_enum_var的的值只能为"a", "b", "c"中的一个；且默认值为"a"。当然，也可以不设置默认值。
```

#### 列表形式的Variable

```py
# File: model.py

class VarModel(BaseModel):
    a_list_of_int: list[int] = [1, 2, 3] # 约束a_list_of_int的数据类型为整数列表，且默认值为[1, 2, 3]
    a_list_of_str: list[str] = ["a", "b", "c"] # 约束a_list_of_str的数据类型为字符串列表，且默认值为["a", "b", "c"]
```

### Step

可以使用`{{step}}`模板用于标记在一个Airalogy Protocol中的步骤。

Step和CheckPoint均具有固定的数据结构，因而无需在Model中对其进行额外的定义。

#### AIMD语法

```aimd
{{step|<step_id>, <step_level>}}
```

- `<step_level>`为Step的层级，为整数`1`, `2`, `3`。之所以约束最多为3层，是为了保证Step的层级不会过深，以保证前端的易读性。
- 如果用户没有主动定义`<step_level>`，则默认为`1`。

#### `<step_id>`命名规则

- 符合`<var_id>`命名规则。`<step_id>`不与`<var_id>`重名。

例：

```aimd
<!-- File: protocol.aimd -->

{{step|step_level_1_step_1, 1}} A
{{step|step_level_1_step_1_step_level_2_step_1, 2}} A.a
{{step|step_level_1_step_1_step_level_2_step_2, 2}} A.b
{{step|step_level_1_step_1_step_level_2_step_2_step_level_3_step_1, 3}} A.b.1
{{step|step_level_1_step_1_step_level_2_step_2_step_level_3_step_2, 3}} A.b.2
{{step|step_level_1_step_2}} B
```

上述案例在前端渲染时，会自动根据每个`{{step}}`的`<step_level>`的层级关系进行嵌套渲染。大致样式如下：

```text
Step 1: A
    Step 1.1: A.a
    Step 1.2: A.b
        Step 1.2.1: A.b.1
        Step 1.2.2: A.b.2
Step 2: B
```

注意在`{{step|step_level_1_step_2}}`中，我们没有显式定义`<step_level>`，则默认为`1`。

对于每个Step，前端也都会自动渲染出一个空的输入框，供用户进行对应Step的注释（未示出）。

#### 过程检查

在一个具有很多Step的Airalogy Protocol中，用户可能需要对一些Step进行检查/标记，以提示该Step是否已经完成。这可以通过在Step模板中使用参数`check=True`来实现。

```aimd
{{step|<step_id>, <step_level>, check=True}}
```

例：

```aimd
<!-- File: protocol.aimd -->

{{step|step_1}}
{{step|step_1_1, 2}}
{{step|step_2, check=True}}
{{step|step_3}}
```

在上述案例中，`step_2`的Step会在前端渲染时自动渲染一个额外的checkbox，供用户进行打勾。而`step_1`, `step_1_1`, `step_3`的Step则不会渲染额外的checkbox。

##### 检查后提示

对于某些Step，用户可能需要在检查后，对其进行一些提示（该提示会以横幅的形式展现，因此不会干扰到后续的科研记录（即使在语音输入条件下））。这可以通过在Step模板中使用参数`checked_message`来实现。

```aimd
{{step|<step_id>, <step_level>, check=True, checked_message="<message>"}}
```

例：

```aimd
<!-- File: protocol.aimd -->

{{step|step_1}}
{{step|step_1_1, 2}}
{{step|step_2, 1, check=True, checked_message="该步骤的下一个步骤非常重要，请仔细、仔细、再仔细。"}}
{{step|step_3}}
```

注意，`checked_message`参数只有在显式定义`check=True`时才会生效。该设计的目的是让Airalogy Protocol的设计者在设计时，使用更加明确的方式来定义Step的检查点。

因此，下面的案例是无效的：

```aimd
<!-- File: protocol.aimd -->

{{step|step_1, 1}}
{{step|step_1_1, 2}}
{{step|step_2, 1, checked_message="该步骤的下一个步骤非常重要，请仔细、仔细、再仔细。"}}
{{step|step_3, 1}}
```

### Checkpoint

Checkpoint通常用于标记在一个Airalogy Protocol中的重要检查点。在前端渲染时，Checkpoint通常会被渲染为一个check mark的按钮，允许用户打勾。

#### AIMD语法

```aimd
{{check|<checkpoint_id>}}
```

用户可以替换`<checkpoint_id>`为任意Checkpoint的名字。

#### `<checkpoint_id>`命名规则

遵循`<var_id>`的命名规则。

例：

```aimd
<!-- File: protocol.aimd -->

{{check|prepare_pcr_reaction_on_ice}} 是否在冰上进行PCR反应体系的制备。
```

其前端渲染效果类似Markdown中的checkbox。

- [ ] 是否在冰上进行PCR反应体系的制备。

#### 检查后提示

同Step，对于某些Checkpoint，用户可能需要在检查后，对其进行一些提示。这可以通过在Checkpoint模板中使用参数`checked_message`来实现。

```aimd
{{check|<checkpoint_id>, checked_message="<message>"}}
```

例：

```aimd
<!-- File: protocol.aimd -->

{{check|prepare_pcr_reaction_on_ice, checked_message="请注意不要把PCR管挂壁冷凝水滴入PCR反应体系中。"}}
```
