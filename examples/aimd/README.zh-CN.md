# AIMD 案例

这个目录用于管理面向不同场景的独立 AIMD 案例。案例用于展示 AIMD 在真实业务场景中的组织方式，也可以作为用户改造自己协议的起点。

包含 `protocol.toml`、可选 `assigner.py` 和可选示例数据的完整 Airalogy Protocol 示例位于 [`examples/protocols`](../protocols/)。

在线预览和填写入口：[Demo 案例页](https://airalogy.github.io/airalogy/aimd/demo/#/examples)。

## 案例清单

| ID | 场景 | 入口文件 | 说明 |
| --- | --- | --- | --- |
| `aimd-syntax-tour` | AIMD 语法导览 | [protocol.aimd](./aimd-syntax-tour/protocol.aimd) | 交互式语法导览，覆盖变量、表格、图、文献引用、步骤、检查点、题目、引用、Markdown 审阅标记和浏览器侧 client assigner。 |
| `clinical-information-record` | 临床信息记录 | [protocol.en-US.aimd](./clinical-information-record/protocol.en-US.aimd) / [protocol.zh-CN.aimd](./clinical-information-record/protocol.zh-CN.aimd) | 中英文双语案例，用于结构化记录临床就诊、评估、诊疗计划和审核信息。 |

机器可读清单位于 [index.json](./index.json)。

## 目录约定

- 每个案例使用一个 kebab-case 子目录，例如 `clinical-information-record/`。
- 单语言或语言中性的案例入口文件使用 `protocol.aimd` 命名；本地化入口文件使用 `protocol.<locale>.aimd` 命名。
- 每个案例至少提供一个 README，说明适用场景、覆盖字段和使用注意事项。
- 新增案例时，同步更新 `index.json`，方便宿主应用自动发现案例。
- 案例文件不要提交真实患者、受试者或业务数据。
