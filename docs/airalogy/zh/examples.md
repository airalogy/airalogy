# Protocol 示例

官方 Airalogy Protocol 示例位于 monorepo 的 [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols)。这些内容迁移自原独立仓库 `airalogy/protocols`，这样协议示例、解析器行为、引擎（Engine）包和文档可以一起演进。

可以在 [Airalogy Markdown Demo 案例页](https://airalogy.github.io/airalogy/aimd/demo/#/examples) 中预览和填写这些协议的 AIMD 部分。如果需要引擎（Engine）支持的解析、变量校验和赋值器（Assigner）执行，运行本地 Airalogy Protocol Demo：

```bash
pnpm dev:protocol-demo:full
```

包含 `assigner.py` 的协议需要 Airalogy 引擎（Airalogy Engine）来执行自动计算、文件处理和报告生成。

## 当前示例

| ID | 场景 | 运行时 | 说明 |
| --- | --- | --- | --- |
| `meeting-notes` | 会议记录 | 静态 | 适用于团队和项目的通用会议记录协议。 |
| `cuaac-kinetics` | 点击化学反应动力学 | 引擎 | CuAAC 动力学数据上传、参数计算、绘图和报告生成。 |
| `field-water-sample-observation` | 野外水样观测与环境扰动分析 | 静态 | 野外水样采集、当天气象场地记录、水化学与生化环境判读、季风和极端降雨扰动分析。 |
| `literature-review-assistant` | AI 辅助文献调研与证据综述 | 引擎 | 配置 OpenAI 兼容联网大模型，完成候选文献初筛、人工证据提取、质量评价和综述草稿生成。 |
| `stock-fundamental-analysis-assistant` | AI 辅助股票基本面分析 | 引擎 | 输入股票代码和公司名称，配置 OpenAI 兼容联网大模型，整理公开财报、业务分部、财务质量、估值比较、风险清单和研究报告草稿。 |
| `monitoring-site-flow-graph-3d-print` | 监测站点物理约束图与 3D 打印参数 | 引擎 | 基于站点经纬度和海拔生成物理约束有向图，并输出 3D 打印节点、边、缩放和结构参数。 |
| `fiber-endface-process` | 光纤端面微纳结构器件工艺路线 | 静态 | 光纤端面微纳结构器件的课题拆解、工艺路线设计、工艺窗口和表征计划记录。 |
| `fiber-endface-sensing-calibration` | 光纤端面传感标定分析 | 引擎 | 标定数据上传、灵敏度拟合、检测限估计、质控判定、绘图和报告生成。 |
| `drug-response-ic50` | 药物剂量-反应 IC50 分析 | 引擎 | 剂量-反应数据上传、IC50 估算、质控、曲线绘制和报告生成。 |
| `diary` | 日记 | 静态 | 轻量的结构化日记协议。 |

## 仓库结构

- `examples/protocols/index.json`：官方协议示例的机器可读清单。
- `examples/protocols/<example>/<locale>/protocol.aimd`：文档和 demo 应用加载的 AIMD 源码。
- `examples/protocols/<example>/<locale>/protocol.toml`：协议元数据。
- `examples/protocols/<example>/<locale>/assigner.py`：可选的引擎侧赋值器代码。
- `apps/protocol-demo`：加载这些协议包并调用 `@airalogy/airalogy-engine` 的本地 demo 服务。
- `spec/fixtures/protocols`：只用于回归和兼容性测试的协议夹具。
