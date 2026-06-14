# AIMD 案例

`examples/aimd/` 目录用于收纳面向不同业务场景的独立 AIMD 案例。案例用于展示 AIMD 在真实流程中的组织方式，也可以由用户复制后改造成自己的 protocol。

完整 Airalogy Protocol 示例位于 `examples/protocols/`。这些示例包含 `protocol.toml`，并可能包含 `assigner.py` 和示例数据，用于需要引擎（Engine）支持的流程。

可以在 [Demo 案例页](/demo/#/examples) 中直接切换、编辑和填写这些案例。

## 当前案例

| ID | 场景 | 说明 |
| --- | --- | --- |
| `aimd-syntax-tour` | AIMD 语法导览 | 交互式语法导览，覆盖变量、表格、步骤、检查点、题目、引用、Markdown 审阅标记和浏览器侧 client assigner。 |
| `clinical-information-record` | 临床信息记录 | 中英文双语案例，用于结构化记录临床就诊、评估、诊疗计划和审核信息。 |

## Protocol 示例

| ID | 场景 | 说明 |
| --- | --- | --- |
| `meeting-notes` | 会议记录 | 适用于团队和项目的通用会议记录协议。 |
| `cuaac-kinetics` | 点击化学反应动力学 | CuAAC 动力学数据上传、自动计算、绘图和报告生成。 |
| `field-water-sample-observation` | 野外水样观测与环境扰动分析 | 野外水样采集、当天气象场地记录、水化学与生化环境判读、季风和极端降雨扰动分析。 |
| `literature-review-assistant` | AI 辅助文献调研与证据综述 | 配置 OpenAI 兼容联网大模型，完成候选文献初筛、人工证据提取、质量评价和综述草稿生成。 |
| `stock-fundamental-analysis-assistant` | AI 辅助股票基本面分析 | 输入股票代码和公司名称，配置 OpenAI 兼容联网大模型，整理公开财报、业务分部、财务质量、估值比较、风险清单和研究报告草稿。 |
| `monitoring-site-flow-graph-3d-print` | 监测站点物理约束图与 3D 打印参数 | 基于站点经纬度和海拔生成物理约束有向图，并输出 3D 打印节点、边、缩放和结构参数。 |
| `fiber-endface-process` | 光纤端面微纳结构器件工艺路线 | 光纤端面微纳结构器件的课题拆解、工艺路线设计、工艺窗口和表征计划记录。 |
| `fiber-endface-sensing-calibration` | 光纤端面传感标定分析 | 标定数据上传、灵敏度拟合、检测限估计、质控判定、绘图和报告生成。 |
| `drug-response-ic50` | 药物剂量-反应 IC50 分析 | 剂量-反应数据上传、IC50 估算、质控、曲线绘制和报告生成。 |
| `diary` | 日记 | 轻量的结构化日记协议。 |

AIMD 案例源码位于 GitHub 仓库的 [`examples/aimd`](https://github.com/airalogy/airalogy/tree/main/examples/aimd) 目录，机器可读清单位于 [`examples/aimd/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/aimd/index.json)。完整 Protocol 示例位于 [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols)，机器可读清单位于 [`examples/protocols/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/protocols/index.json)。

## 新增案例

新增案例时建议遵循以下约定：

- 每个案例一个 kebab-case 子目录。
- 入口文件命名为 `protocol.<locale>.aimd`。
- README 说明适用场景、覆盖字段和使用注意事项。
- 独立 AIMD 案例同步登记到 `examples/aimd/index.json`。
- 完整 Protocol 示例同步登记到 `examples/protocols/index.json`。
