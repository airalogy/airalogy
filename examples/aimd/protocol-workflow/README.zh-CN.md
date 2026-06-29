# Protocol Workflow

这个案例展示一个 `workflow.aimd` 文档，用于编排多个 protocol 节点。它覆盖 workflow 节点、transition、条件分支、重试循环、workflow 级 Python assigner 声明、transition inputs、目标字段赋值，以及 `${analysis.var.summary}` 和 `${analysis.check.pass_qc.checked}` 这类字段引用。

该文件有意作为 workflow 文档存在，而不是普通 `protocol.aimd`；`nodes[].protocol` 指向的 protocol 会由 workflow runtime 在执行前解析。
