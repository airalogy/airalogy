# Protocol Workflow

This example shows a `workflow.aimd` document that coordinates multiple protocol nodes. It covers workflow nodes, transitions, conditional routing, retry loops, workflow-level Python assigner declarations, transition inputs, target field assignment, and field references such as `${analysis.var.summary}` and `${analysis.check.pass_qc.checked}`.

The file is intentionally a workflow document rather than a normal `protocol.aimd`; each `nodes[].protocol` value points to a protocol that a workflow runtime would resolve before execution.
