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

## 新增 Protocol 示例

- 每个场景使用一个 kebab-case 子目录。
- 语言版本使用 `en-US/`、`zh-CN/` 这类 locale 子目录。
- 每个 locale 子目录应保持为自包含的 Airalogy Protocol 包。
- 新增示例时同步登记到 `index.json`，方便文档和 demo 应用发现。
- 示例文件不要提交真实患者、受试者、凭据或业务数据。
