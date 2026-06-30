# Protocol Workflow

This example shows a `workflow.aimd` document that coordinates multiple protocol nodes. It covers workflow nodes, transitions, conditional routing, retry loops, workflow-level Python assigner declarations, transition inputs, target field assignment, and field references such as `${analysis.var.summary}` and `${analysis.check.pass_qc.checked}`.

The file is intentionally a workflow document rather than a normal `protocol.aimd`; each `nodes[].protocol` value points to a protocol that a workflow runtime would resolve before execution.

## Run It

The `records.initial.json` file provides a minimal workflow state. In the Airalogy Protocol Demo, choose **Protocol Workflow**, open the **Engine** tab, and click **Run Workflow**. The demo server calls `@airalogy/airalogy-engine`, runs the Python workflow assigners in the sandbox, and returns updated Record drafts plus transition outputs.

From code, call the npm engine directly:

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
