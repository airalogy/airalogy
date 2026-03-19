# Airalogy Type Plugins

`airalogy.types` 现在提供显式的类型注册表，核心原因有两个：

- Airalogy 官方内置类型需要保持稳定、可文档化的公共契约。
- 第三方实验室或应用需要能够在不 fork Airalogy 的前提下增加新的 AIMD 类型。

这个设计是显式注册的。AIMD **不会**根据协议文本里的任意类型名去动态导入 Python 对象。只有已经注册的类型才会生效。

## 这意味着什么

类型系统不再被固定的官方内置列表锁死。

- 官方内置类型保持兼容。
- `generate_model()` 现在可以从第三方模块导入已注册的外部类型。
- 社区或私有实验室类型可以独立演进，未来如果设计成熟，也能用同一套描述符方式被官方吸收。

## Registry API

Airalogy 在 `airalogy.types.registry` 中提供了 `AiralogyTypeDescriptor` 和注册辅助函数。

```python
from airalogy.types.registry import (
    AiralogyTypeDescriptor,
    register_airalogy_type,
)

register_airalogy_type(
    AiralogyTypeDescriptor(
        type_name="MicroscopeCapture",
        import_from="my_lab_airalogy.types",
        storage_kind="structured",
        ui_kind="microscope-capture",
    )
)
```

注册完成后，AIMD 就可以直接写：

```aimd
{{var|capture: MicroscopeCapture}}
```

而 `generate_model()` 会自动生成：

```python
from my_lab_airalogy.types import MicroscopeCapture
```

这里的 `import_from` 不是固定写法，而是一个真实的 Python 模块路径字符串。

例如：

- `import_from="my_lab_airalogy.types"` 表示后续会生成 `from my_lab_airalogy.types import MicroscopeCapture`
- 如果你的类型定义在别的模块，就应该改成那个模块自己的 import 路径

它本质上回答的是：

> 这个 AIMD 类型名，最后应该从哪个 Python 模块里导入？

## 推荐代码结构

需要。否则读者会知道“可以注册”，但不知道“注册代码和类型本体应该放哪”。

推荐把“类型定义”和“插件注册入口”分开：

- Airalogy 官方内置类型：
  类型本体继续放在 `airalogy/src/airalogy/types/` 下面。
  注册 wiring 统一放在 `airalogy/src/airalogy/types/__init__.py`。
- 第三方包：
  类型本体放在你自己的业务模块里。
  插件入口单独放一个 `plugin.py` 或 `airalogy_plugin.py`，专门返回 descriptor 列表。

一个推荐的第三方包结构可以是：

```text
my_lab_airalogy/
  __init__.py
  types.py
  plugin.py
```

其中：

- `types.py`：放真正的 Pydantic model / `Annotated[...]` / 自定义类型实现
- `plugin.py`：放 `get_airalogy_types()` 之类的入口函数

例如：

```python
# my_lab_airalogy/types.py
from pydantic import BaseModel

class MicroscopeCapture(BaseModel):
    exposure_ms: int
    channel: str
```

```python
# my_lab_airalogy/plugin.py
from airalogy.types.registry import AiralogyTypeDescriptor

def get_airalogy_types():
    return [
        AiralogyTypeDescriptor(
            type_name="MicroscopeCapture",
            import_from="my_lab_airalogy.types",
            storage_kind="structured",
            ui_kind="microscope-capture",
        )
    ]
```

这里有两个关键点：

- `import_from` 应该指向真正导出类型符号的模块，而不是指向 registry 自身。
- `plugin.py` 只负责暴露 descriptor，不要把领域模型本体塞进注册文件里。

## Plugin Discovery

已安装的 Python 包也可以通过 `airalogy.types` 这个 entry point group 发布类型描述符。

示例 `pyproject.toml`：

```toml
[project.entry-points."airalogy.types"]
microscope = "my_lab_airalogy.plugin:get_airalogy_types"
```

目标对象可以返回：

- 单个 `AiralogyTypeDescriptor`
- 一个 descriptor 列表
- 一个接受 registry 并直接完成注册的 callable

Airalogy 会通过 `discover_airalogy_type_plugins()` 加载这些插件；查询 registry 时也会自动触发发现流程。

## 契约边界

一个 type descriptor 只回答一个核心问题：

> 当 AIMD 中出现类型 token `X` 时，Airalogy 应该把它视为哪个 Python 公共类型？

descriptor 当前携带的核心信息包括：

- `type_name`：公开的 AIMD / Python 类型名
- `import_from`：模型生成时使用的导入模块
- `storage_kind`：高层语义上的存储形态，如 scalar、structured、file-id
- `ui_kind`：面向前端 recorder/editor 的语义提示
- `schema_extra`：留给 richer tooling 的扩展元数据

## 与前端的关系

Airalogy registry 本身不直接定义前端 widget。它定义的是后端规范层的 canonical contract。`aimd` 仓库中的 recorder/editor 插件应该复用同样的公开类型名，这样后端 schema 和前端交互才能一致。

前端部分请参考 AIMD 文档：

- [`Type Plugins`](https://airalogy.github.io/aimd/zh/packages/type-plugins)
