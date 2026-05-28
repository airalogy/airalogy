# Protocol 示例

官方 Airalogy Protocol 示例位于 monorepo 的 [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols)。这些内容迁移自原独立仓库 `airalogy/protocols`，这样协议示例、解析器行为、engine 包和文档可以一起演进。

可以在 [Airalogy Markdown Demo 案例页](https://airalogy.github.io/airalogy/aimd/demo/#/examples) 中预览和填写这些协议的 AIMD 部分。如果需要 engine 支持的解析、变量校验和 assigner 执行，运行本地 Airalogy Protocol Demo：

```bash
pnpm dev:protocol-demo:full
```

包含 `assigner.py` 的协议需要 Airalogy Engine 来执行自动计算、文件处理和报告生成。

## 当前示例

| ID | 场景 | 运行时 | 说明 |
| --- | --- | --- | --- |
| `meeting-notes` | 会议记录 | 静态 | 适用于团队和项目的通用会议记录协议。 |
| `cuaac-kinetics` | 点击化学反应动力学 | Engine | CuAAC 动力学数据上传、参数计算、绘图和报告生成。 |
| `drug-response-ic50` | 药物剂量-反应 IC50 分析 | Engine | 剂量-反应数据上传、IC50 估算、质控、曲线绘制和报告生成。 |
| `diary` | 日记 | 静态 | 轻量的结构化日记协议。 |

## 仓库结构

- `examples/protocols/index.json`：官方协议示例的机器可读清单。
- `examples/protocols/<example>/<locale>/protocol.aimd`：文档和 demo 应用加载的 AIMD 源码。
- `examples/protocols/<example>/<locale>/protocol.toml`：协议元数据。
- `examples/protocols/<example>/<locale>/assigner.py`：可选的 engine 侧 assigner 代码。
- `apps/protocol-demo`：加载这些协议包并调用 `@airalogy/airalogy-engine` 的本地 demo 服务。
- `spec/fixtures/protocols`：只用于回归和兼容性测试的协议夹具。
