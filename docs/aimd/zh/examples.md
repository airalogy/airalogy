# AIMD 案例

`examples/` 目录用于收纳面向不同业务场景的 AIMD 案例。案例用于展示 AIMD 在真实流程中的组织方式，也可以由用户复制后改造成自己的 protocol。

可以在 [Demo 案例页](/demo/#/examples) 中直接切换、编辑和填写这些案例。

## 当前案例

| ID | 场景 | 说明 |
| --- | --- | --- |
| `clinical-information-record` | 临床信息记录 | 中英文双语案例，用于结构化记录临床就诊、评估、诊疗计划和审核信息。 |

案例源码位于 GitHub 仓库的 [`examples/`](https://github.com/airalogy/airalogy/tree/main/examples/aimd) 目录，机器可读清单位于 [`examples/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/aimd/index.json)。

## 新增案例

新增案例时建议遵循以下约定：

- 每个案例一个 kebab-case 子目录。
- 入口文件命名为 `protocol.<locale>.aimd`。
- README 说明适用场景、覆盖字段和使用注意事项。
- 同步登记到 `examples/index.json`。
