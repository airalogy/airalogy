# Protocol Workflow

这个案例展示一个 `workflow.aimd` 文档，用于编排多个 protocol 节点。它覆盖 workflow 节点、transition、条件分支、重试循环、workflow 级 Python assigner 声明、transition inputs、目标字段赋值，以及 `${analysis.var.summary}` 和 `${analysis.check.pass_qc.checked}` 这类字段引用。

该文件有意作为 workflow 文档存在，而不是普通 `protocol.aimd`；`nodes[].protocol` 指向的 protocol 会由 workflow runtime 在执行前解析。

## 运行方式

`records.initial.json` 提供了一个最小 workflow 状态。在 Airalogy Protocol Demo 中选择 **Protocol Workflow**，打开 **Engine** 面板，然后点击 **Run Workflow**。demo server 会调用 `@airalogy/airalogy-engine`，在 sandbox 中运行 Python workflow assigner，并返回更新后的 Record 草稿和 transition outputs。

也可以直接从代码调用 npm engine：

```typescript
import { readFileSync } from "node:fs";
import { runWorkflow } from "@airalogy/airalogy-engine";

const records = JSON.parse(readFileSync("examples/aimd/protocol-workflow/records.initial.json", "utf8"));
const result = await runWorkflow("examples/aimd/protocol-workflow", records, {
  assignerRuntime: "local",
});

console.log(result.data?.records);
console.log(result.data?.transition_outputs);
```
