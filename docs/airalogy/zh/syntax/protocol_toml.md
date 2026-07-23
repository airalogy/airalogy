# Airalogy Protocol's `protocol.toml`

`protocol.toml`在Airalogy Protocol中，被用于定义Airalogy Protocol的元信息（采用易于编写的[TOML](https://toml.io/cn/)格式。类似于Python的[`pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)）。用户在自定义一个Airalogy Protocol时，大部分情况下可以不手动编写`protocol.toml`（Airalogy Platform在用户将Airalogy Protocol上传到Unit时会自动生成`protocol.toml`）。但是，用户也可以手动编写`protocol.toml`，以便于更好的定义Airalogy Protocol的元信息。

## 文件结构

`protocol.toml`可以被定义于一个Airalogy Protocol的根目录下。其文件结构如下：

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
└── protocol.toml
```

## 定义Protocol元信息

`protocol.toml`的定义语法如下：

```toml
[airalogy_protocol]
id = "alice_s_protocol"
version = "0.0.1"
kind = "experiment"
name = "Alice's Protocol"
description = "An example protocol for demonstration purposes."
authors = [
    {name = "Alice", email = "alice@airalogy.com", airalogy_user_id = "airalogy.id.user.alice"}
]
maintainers = [
    {name = "Alice", email = "alice@airalogy.com", airalogy_user_id = "airalogy.id.user.alice"}
]
disciplines = ["drug discovery", "biology"]
keywords = ["cck-8", "cell viability", "drug screening", "proliferation assay"]
license = "CC-BY-4.0"
```

- `id`：Protocol的ID。当Airalogy Protocol上传到Airalogy Platform中的一个Protocol Repository时，该ID既是Protocol Repository的ID。为此，该ID只需要在Protocol Repository所在的Project下唯一即可。
- `version`：Protocol的版本。该字段用于定义Protocol的版本号。其格式一定要遵循`x.y.z`的格式，其中`x`、`y`、`z`是数字。如果用户没有手动定义`protocol.toml`，则该字段的值为Airalogy Platform自动生成的Protocol版本号，默认为`0.0.1`。
- `kind`（可选）：Protocol 的产品模式，缺省为 `experiment`。需要定义可版本化的实验室资源 Schema 时使用 `resource_definition`。
- `name`：Protocol的名称。如果用户没有手动定义`protocol.toml`，则该字段的值为Airalogy Platform自动生成的Protocol名称（通常是Airalogy Markdown中的一级标题。如果是自动产生的`name`前端会将其展示给用户，如果用户不满意还可以手动修改）。
- `description`（可选）：可以写一小段关于该Protocol的简短描述。
- `authors`（可选）：Protocol的作者。该字段用于定义Protocol的作者信息。其格式为一个列表，列表中的每个元素是一个作者信息，包括作者的：姓名、邮箱（可选）、Airalogy User ID（可选）。
- `maintainers`（可选）：Protocol的维护者。该字段用于定义Protocol的维护者信息。其格式为一个列表，列表中的每个元素是一个维护者信息，包括维护者的：姓名、邮箱（可选）、Airalogy User ID（可选）。
- `disciplines`（可选）：Protocol的学科领域。该字段用于定义Protocol的学科领域。其格式为一个列表，列表中的每个元素是一个学科领域的名称。其中列表中的第一个元素被视为该Protocol的主要学科领域。
- `keywords`（可选）：Protocol的关键词。该字段用于定义Protocol的关键词。其格式为一个列表，列表中的每个元素是一个关键词。
- `license`（可选）：Protocol的许可证。由于一个Airalogy Protocol以和代码包一样的形式管理，因此用户可以在`protocol.toml`中定义Protocol的许可证，以帮助用户更好的理解该Protocol的使用限制。该字段的值为一个字符串，表示许可证的名称。如果用户没有手动定义，则默认为空字符串（表示不使用许可证）。

注意：在`protocol.toml`中，我们并没有包含类似`lab_id`、`project_id`这是因为这些IDs其性质上本质是依赖于Airalogy Platform，从ID性质上来看，这些IDs的逻辑层级应该是超于Protocol的，为此我们并没有在`protocol.toml`中定义这些IDs。

`resource_definition` 的限制、ResourceRef 字段、兼容性报告与 migration manifest 见[资源、库存与 Protocol 版本](./resources)。

## 资源定义

`kind = "resource_definition"` 表示宿主管理资源类型的可版本化 Schema。它可以使用 Markdown、`var`、`var_table`、文件、`EntityRef` 与确定性校验，但不能包含实验步骤、quiz、workflow、collector 或 assigner 运行时；archive 打包时会校验这一限制。

## Schema 兼容性与迁移

Python 宿主调用 `airalogy.schema_compatibility.compare_json_schemas()`，npm 宿主调用 `compareAimdJsonSchemas()`。两端都会返回 `compatible`、`conditional`、`breaking` 或 `unknown`、字段级差异，以及建议的 SemVer 增量。

跨版本包可以包含 `airalogy.migration.v1` manifest，使用确定性的 `rename`、`copy`、`remove` 与 `set_default` 操作。自定义 `transform.entrypoint` 必须声明 SHA-256 `code_hash`。parser 不会执行自定义代码；宿主必须校验哈希，在无网络、无密钥的沙箱中运行，并将规则/代码哈希与迁移结果一起持久化。

## 参考

`protocol.toml`的设计参考了[`pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)的设计。
