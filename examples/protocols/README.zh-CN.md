# Airalogy Protocol 示例

这个目录存放官方可运行的 Airalogy Protocol 示例，内容迁移自原独立仓库 `airalogy/protocols`。

可以在 [AIMD Demo 案例页](https://airalogy.github.io/airalogy/aimd/demo/#/examples) 中预览和填写这些协议的 AIMD 部分。包含 `assigner.py` 的示例需要 Airalogy 引擎（Airalogy Engine）运行时来执行自动计算、文件处理和报告生成。

## 示例清单

| ID | 场景 | 语言 | 引擎 | 说明 |
| --- | --- | --- | --- | --- |
| `meeting-notes` | 会议记录 | `en-US`, `zh-CN` | 否 | 适用于团队和项目的通用会议记录模板。 |
| `cuaac-kinetics` | 点击化学反应动力学 | `en-US`, `zh-CN` | 是 | CuAAC 动力学数据上传、参数计算、绘图和报告生成。 |
| `field-water-sample-observation` | 野外水样观测与环境扰动分析 | `zh-CN` | 否 | 野外水样采集、当天气象场地记录、水化学与生化环境判读、季风和极端降雨扰动分析。 |
| `literature-review-assistant` | AI 辅助文献调研与证据综述 | `zh-CN` | 是 | 配置 OpenAI 兼容联网大模型，完成候选文献初筛、人工证据提取、质量评价和综述草稿生成。 |
| `stock-fundamental-analysis-assistant` | AI 辅助股票基本面分析 | `zh-CN` | 是 | 输入股票代码和公司名称，配置 OpenAI 兼容联网大模型，整理公开财报、业务分部、财务质量、估值比较、风险清单和研究报告草稿。 |
| `monitoring-site-flow-graph-3d-print` | 监测站点物理约束图与 3D 打印参数 | `zh-CN` | 是 | 基于站点经纬度和海拔生成物理约束有向图，并输出 3D 打印节点、边、缩放和结构参数。 |
| `fiber-endface-process` | 光纤端面微纳结构器件工艺路线 | `zh-CN` | 否 | 光纤端面微纳结构器件的课题拆解、工艺路线设计、工艺窗口和表征计划记录。 |
| `fiber-endface-sensing-calibration` | 光纤端面传感标定分析 | `zh-CN` | 是 | 标定数据上传、灵敏度拟合、检测限估计、质控判定、绘图和报告生成。 |
| `drug-response-ic50` | 药物剂量-反应 IC50 分析 | `en-US`, `zh-CN` | 是 | 剂量-反应数据上传、IC50 估算、质控、曲线绘制和报告生成。 |
| `diary` | 日记 | `en-US`, `zh-CN` | 否 | 轻量的结构化日记协议。 |

机器可读清单位于 [index.json](./index.json)。

## 目录结构

- 每个协议语言版本都是一个完整协议目录，包含 `protocol.aimd` 和 `protocol.toml`。
- 可选的 `assigner.py` 与协议文件放在同一目录，便于整体打包或执行。
- 可选示例数据文件放在对应语言版本目录内。
- 只用于兼容性和回归测试的协议放在 [`spec/fixtures/protocols`](../../spec/fixtures/protocols)，不放入这个面向用户的示例目录。

## 必需结构

`examples/protocols` 是官方用户可见 Protocol 示例的唯一源头。PyPI 包中不再提交第二份副本；`packages/pypi/airalogy/src/airalogy/examples/protocols/data` 会在执行 `uv build` 时由这个目录自动生成，并被 git 忽略。

每个场景使用一个 kebab-case 目录，每个 Protocol 语言版本使用一个 locale 子目录：

```text
examples/protocols/<example-id>/<locale>/
├── protocol.aimd
├── protocol.toml
├── assigner.py          # 可选
└── sample-data.csv      # 可选
```

`<example-id>` 是用于 GitHub 路径和文档的公开示例 slug，例如 `meeting-notes`。`protocol.toml` 中的 Protocol id 是 API 和包查找使用的稳定运行时 id，例如 `meeting_notes_en`。

每个 locale 版本都必须在 `index.json` 中登记，并保持 `languages`、`protocol_dir`、`entry` 和 `toml` 一致。包含 `assigner.py` 时登记到 `assigner`；包含随包示例数据文件时登记到 `sample_data`。所有登记路径都必须位于对应 locale 目录内。

## 校验与打包

提交 Protocol 示例改动前，先运行聚焦校验：

```bash
UV_CACHE_DIR=.uv-cache uv --directory packages/pypi/airalogy run --with pytest python -m pytest tests/test_spec_fixtures.py
```

发布 `airalogy` 前，还要构建 Python 包：

```bash
UV_CACHE_DIR=.uv-cache uv build --out-dir .tmp/python-build/airalogy packages/pypi/airalogy
```

构建 backend 会校验示例 registry、检查所有引用文件、检查 Protocol metadata id、生成包内 data 副本，并在构建结束后从工作区删除生成目录。

仓库 pre-push hook 会在本次 push 包含 `examples/protocols`、`packages/pypi/airalogy` 或 `.changeset` 改动时自动运行这两项检查。

## 新增 Protocol 示例

- 每个场景使用一个 kebab-case 子目录。
- 语言版本使用 `en-US/`、`zh-CN/` 这类 locale 子目录。
- 每个 locale 子目录应保持为自包含的 Airalogy Protocol 包。
- 新增示例时同步登记到 `index.json`，方便文档和 demo 应用发现。
- 示例文件不要提交真实患者、受试者、凭据或业务数据。
