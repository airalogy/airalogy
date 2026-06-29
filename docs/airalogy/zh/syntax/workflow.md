# 在 AIMD 中定义 Workflow

## 概述

Workflow 位于单个 `protocol.aimd` 之上，用来编排多个 Airalogy Protocol。它的核心语义不是“某个 Protocol 输出到另一个 Protocol 输入”这一种固定形式，而是把一个或多个 protocol run / Record 中的字段，复制或转换后写入一个或多个下游 protocol run / Record 的字段。

因此可以把 Workflow 理解为：来源字段 -> 可选 assigner 转换 -> 目标字段。`nodes[]` 定义图里的 Protocol 节点，`assigners[]` 定义可复用的转换函数，`transitions[]` 定义每一次从哪些节点读取、是否运行 assigner、以及写入哪些目标字段。

Workflow 逻辑应当写在 AIMD 文档中，但通常建议放在独立文件里，例如 `workflow.aimd`，而不是混在普通 protocol 文档中。fenced `workflow` 代码块是一个更高层的文档类型，专门表达 protocol 编排。

Parser 只负责解析和校验 workflow 声明，不执行 Python assigner，不调用 API，不修改 Record，也不判断分支结果。运行时实现应当区分技术性 retry 和 workflow loop / protocol rerun：技术性 retry 是同一次 transition 或 node run 的内部 attempt；workflow loop iteration 或 protocol rerun 才代表新的 node run 和新的 Record。

技术性 retry 不应创建新的 Record，也不应创建新的 Record version，例如 assigner 调 API 超时、沙箱进程失败、网络请求重试或数据库提交前失败；这类信息最多记录为同一次 run 的 attempt log。Workflow loop iteration / protocol rerun 应当创建新的 Record，而不是把旧 Record 写成新的 version。新的 Record 表示一次新的 Protocol 执行或 node run，应该拥有自己的输入、时间、操作者、上游来源和 iteration index；Record version 只用于同一条 Record 的修订历史，例如补录、纠错、草稿保存或 schema migration。

## 语法

使用 fenced `workflow` 代码块，块内内容为 YAML：

````aimd
# Parameter Optimization Workflow

```workflow
version: airalogy.workflow.v1
id: parameter_optimization
title: Parameter Optimization Workflow
description: Iterates sample preparation and analysis until QC passes.

nodes:
  - id: prep
    protocol: ./protocols/sample-prep/protocol.aimd
    title: Sample Preparation
  - id: measurement
    protocol: ./protocols/measurement/protocol.aimd
    title: Measurement
  - id: analysis
    protocol: ./protocols/analysis/protocol.aimd
    title: QC Analysis
  - id: report
    protocol: ./protocols/report/protocol.aimd
    title: Final Report

assigners:
  - id: summarize_measurement
    runtime: python
    entrypoint: ./assigners/summarize_measurement.py:assign
    description: Builds a compact summary from raw measurement output.

  - id: optimize_parameters
    runtime: python
    entrypoint: ./assigners/optimize_parameters.py:assign
    description: Calls a model-backed optimizer and returns retry parameters.

transitions:
  - id: pass_sample_to_measurement
    from:
      - prep
    to:
      - measurement
    assign:
      measurement:
        var.sample_id: ${prep.var.sample_id}

  - id: summarize_measurement_for_analysis
    from:
      - measurement
    to:
      - analysis
    run: summarize_measurement
    inputs:
      raw_data: ${measurement.var.raw_data}
    assign:
      analysis:
        var.raw_data: ${measurement.var.raw_data}
        var.raw_data_summary: ${summarize_measurement_for_analysis.outputs.raw_data_summary}
        var.measurement_quality: ${summarize_measurement_for_analysis.outputs.measurement_quality}

  - id: finish_when_qc_passes
    from:
      - analysis
    to:
      - report
    when: ${analysis.check.pass_qc.checked} == true

  - id: retry_after_qc_failure
    from:
      - analysis
    to:
      - prep
    when: ${analysis.check.pass_qc.checked} == false
    run: optimize_parameters
    inputs:
      summary: ${analysis.var.summary}
      failed_metrics: ${analysis.var.failed_metrics}
    max_iterations: 5
    assign:
      prep:
        var.target_temperature_c: ${retry_after_qc_failure.outputs.recommended_temperature_c}
        var.target_concentration_m: ${retry_after_qc_failure.outputs.recommended_concentration_m}
        var.retry_note: ${retry_after_qc_failure.outputs.retry_reason}

logic: |
  Iterate preparation and measurement until QC passes or the retry limit is reached.

default_initial_node: prep
```
````

## Assigner 源码示例

`entrypoint` 的格式是 `文件路径:函数名`。两个 assigner 可以分别写在两个 `.py` 文件里，也可以写在同一个 `.py` 文件的两个函数里；workflow 通过 `assigners[].id` 命名，通过 transition 的 `run` 引用。

Assigner 函数本身建议保持为普通 Python 函数。当前设计不要求 `@assigner` 装饰器，也不要求返回 `AssignerResult` 类；函数参数由 `transition.inputs` 显式绑定，返回值是普通 dict，后续通过 `${transition_id.outputs.key}` 引用。

### 写法一：每个 assigner 一个文件

`entrypoint: ./assigners/summarize_measurement.py:assign` 表示 runtime 会加载 `./assigners/summarize_measurement.py` 文件里的 `assign` 函数。Workflow parser 只校验声明，不会执行这个函数。

```python
def assign(raw_data):
    """Summarize raw measurement data before the analysis node runs."""
    if raw_data is None:
        return {
            "raw_data_summary": "No raw measurement data was provided.",
            "measurement_quality": "missing",
        }

    if isinstance(raw_data, dict):
        point_count = len(raw_data.get("points", []))
        instrument = raw_data.get("instrument", "unknown instrument")
        return {
            "raw_data_summary": f"{point_count} points captured by {instrument}.",
            "measurement_quality": "review",
        }

    return {
        "raw_data_summary": str(raw_data),
        "measurement_quality": "review",
    }
```

`entrypoint: ./assigners/optimize_parameters.py:assign` 指向另一个文件里的 `assign` 函数。它在 `retry_after_qc_failure` 这条 transition 里通过 `run: optimize_parameters` 被引用，用于生成下一轮 `prep` 的字段值。

```python
def assign(summary, failed_metrics):
    """Recommend retry parameters after QC fails."""
    failed_metrics = failed_metrics or []
    retry_reason = "QC failed"

    if failed_metrics:
        retry_reason = "QC failed for: " + ", ".join(map(str, failed_metrics))

    return {
        "recommended_temperature_c": 24.0,
        "recommended_concentration_m": 0.05,
        "retry_reason": retry_reason,
        "optimizer_note": f"Input summary: {summary or 'not provided'}",
    }
```

这种写法适合 assigner 逻辑较长、依赖不同，或者希望单独测试每个 assigner 的情况。

### 写法二：多个 assigner 放在同一个文件

也可以把两个 assigner 函数放在同一个 Python 文件里，只要 `entrypoint` 的函数名不同即可：

```yaml
assigners:
  - id: summarize_measurement
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:summarize_measurement
  - id: optimize_parameters
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:optimize_parameters
```

`./assigners/workflow_assigners.py` 可以这样写：

```python
def summarize_measurement(raw_data):
    """Summarize raw measurement data before the analysis node runs."""
    if raw_data is None:
        return {
            "raw_data_summary": "No raw measurement data was provided.",
            "measurement_quality": "missing",
        }

    if isinstance(raw_data, dict):
        point_count = len(raw_data.get("points", []))
        instrument = raw_data.get("instrument", "unknown instrument")
        return {
            "raw_data_summary": f"{point_count} points captured by {instrument}.",
            "measurement_quality": "review",
        }

    return {
        "raw_data_summary": str(raw_data),
        "measurement_quality": "review",
    }


def optimize_parameters(summary, failed_metrics):
    """Recommend retry parameters after QC fails."""
    failed_metrics = failed_metrics or []
    retry_reason = "QC failed"

    if failed_metrics:
        retry_reason = "QC failed for: " + ", ".join(map(str, failed_metrics))

    return {
        "recommended_temperature_c": 24.0,
        "recommended_concentration_m": 0.05,
        "retry_reason": retry_reason,
        "optimizer_note": f"Input summary: {summary or 'not provided'}",
    }
```

这两种写法在 workflow 语义上等价。`transition.run` 只引用 `assigners[].id`，不关心函数是否在同一个文件；`transition.inputs` 决定函数参数从哪里来，`transition.assign` 决定函数返回值写到哪些目标字段。

## 字段

`version` 必须是 `airalogy.workflow.v1`。这个字段不要省略；它是 workflow schema 的显式版本边界。

`id` 是稳定的 workflow id。它必须以字母开头，并且只能包含字母、数字和下划线。

`nodes[]` 声明 workflow 图中的 protocol 节点。每个节点都需要 `id`，并且必须提供 `protocol` 或 `protocol_id` 之一：`protocol` 用于本地 protocol 路径，`protocol_id` 用于 registry 或 project 中的 protocol 引用。可选字段包括 `protocol_version`、`title` 和 `description`。

`assigners[]` 声明 workflow 级 assigner。Python assigner 需要 `runtime: python` 和 `entrypoint`。`outputs` 只是可选的函数返回契约，主要用于文档、UI 和未来更强的校验；它不声明写入目标，也不决定哪些输出会被消费。实际消费哪些返回值、写入哪些 Protocol 字段，由 `transition.assign` 显式声明。不写 `outputs` 时，runtime 仍然可以根据实际返回 dict 暴露 `${transition_id.outputs.key}`，并用 `transition.assign` 中出现的引用检查对应 key 是否存在。`permissions` 也是可选声明；普通用户通常不需要填写，工程化 runtime 可以根据 assigner、项目配置或 sandbox 策略推断与校验权限。

`transitions[]` 声明节点之间的有向边。每个 transition 都需要 `id`、`from` 和 `to`。`id` 是这一次 transition 调用的命名空间，因此 assigner 返回值使用 `${transition_id.outputs.key}` 引用，而不是 `${assigner_id.outputs.key}`。`from` 和 `to` 可以在 YAML 里写成单个字符串或字符串列表，parser 输出统一归一化为数组。可选字段包括 `when`、`label`、`run`、`inputs`、`max_iterations` 和 `assign`。`run` 必须引用已存在的 assigner id。`max_iterations` 必须是正整数。

输出引用使用 transition id，而不是 assigner id，是因为 assigner id 表示“函数定义”，transition id 表示“这一次函数调用”。同一个 assigner 可以被多个 transition 复用，每次调用的输入、来源节点、目标节点和返回值都可能不同。如果输出挂在 assigner id 上，`${build_analysis_inputs.outputs.raw_data_summary}` 就无法区分是哪一次调用的结果；写成 `${prepare_analysis_inputs.outputs.raw_data_summary}` 则明确表示 `prepare_analysis_inputs` 这条 transition 调用产生的输出。

`inputs` 只属于 transition，不属于 assigner。它的 key 是 Python 函数参数名，value 可以是常量，也可以是字段引用，例如 `${measurement.var.raw_data}` 或 `${analysis.check.pass_qc.annotation}`。这样同一个 assigner 可以在不同 transition 中读取不同来源。

`assign` 声明写入目标字段。推荐使用按目标 node 分组的形式：第一层 key 是目标 node id，第二层 key 是目标字段路径，例如 `var.sample_id`、`check.pass_qc`、`step.review_result.annotation`。当 `to` 只有一个目标 node 时，parser 也接受省略第一层目标 node 的简写，并会归一化为分组形式；当 `to` 有多个目标 node 时，必须显式按目标 node 分组。

`logic` 是面向人的 Markdown 文本，用于解释 workflow 策略。

`default_initial_node` 可选，用于声明默认起始节点，并且必须引用已存在的 node id。

## 字段引用

字段引用使用 `${node_id.field_path}`。`field_path` 至少包含两段：字段类别和字段 id；如果该字段值本身是结构化对象，可以继续写子字段。

```yaml
${measurement.var.raw_data}
${analysis.check.pass_qc}
${analysis.check.pass_qc.checked}
${analysis.check.pass_qc.annotation}
${prep.step.prepare_sample}
${prep.step.prepare_sample.annotation}
```

`step` 和 `check` 本身也可以作为字段值来传递。比如 `${analysis.check.pass_qc}` 可以表示整个检查结果对象，而 `${analysis.check.pass_qc.checked}` 和 `${analysis.check.pass_qc.annotation}` 则分别表示其中的 `checked` 与 `annotation` 子字段。Parser 只校验引用表达式的结构形态；具体字段是否存在、字段类型是否匹配、子字段是否可写，由 protocol schema / Record schema 和 runtime 校验。

右侧 value 不加 `${...}` 时就是普通常量字符串，即使它看起来像字段路径，也不会被当成引用：

```yaml
assign:
  prep:
    var.retry_note: retry_after_qc_failure.outputs.retry_reason
```

上面会把字面量字符串 `"retry_after_qc_failure.outputs.retry_reason"` 写入 `prep.var.retry_note`。如果想读取 transition 输出，应该显式写成：

```yaml
assign:
  prep:
    var.retry_note: ${retry_after_qc_failure.outputs.retry_reason}
```

这个规则让普通字符串和动态引用保持清楚边界。例如 `api.openai.com`、`data.raw.csv`、`analysis.var.summary` 都可以作为普通字符串保存，不会被 runtime 误判为引用。

## 数据传递示例

### 一对一

一个上游 Protocol 写入一个下游 Protocol：

```yaml
transitions:
  - id: pass_sample_to_measurement
    from:
      - prep
    to:
      - measurement
    assign:
      measurement:
        var.sample_id: ${prep.var.sample_id}
        var.sample_label: ${prep.var.sample_label}
```

### 一对多

一个上游 Protocol 同时写入多个下游 Protocol：

```yaml
transitions:
  - id: distribute_analysis_results
    from:
      - analysis
    to:
      - report
      - archive
    assign:
      report:
        var.summary: ${analysis.var.summary}
        check.pass_qc: ${analysis.check.pass_qc}
      archive:
        var.summary: ${analysis.var.summary}
        var.qc_annotation: ${analysis.check.pass_qc.annotation}
```

### 多对一

多个上游 Protocol 汇总后写入一个下游 Protocol：

```yaml
assigners:
  - id: build_analysis_inputs
    runtime: python
    entrypoint: ./assigners/build_analysis_inputs.py:assign

transitions:
  - id: prepare_analysis_inputs
    from:
      - measurement
      - literature_review
    to:
      - analysis
    run: build_analysis_inputs
    inputs:
      raw_data: ${measurement.var.raw_data}
      background_summary: ${literature_review.var.summary}
    assign:
      analysis:
        var.raw_data_summary: ${prepare_analysis_inputs.outputs.raw_data_summary}
        var.background_summary: ${prepare_analysis_inputs.outputs.background_summary}
```

这里 `raw_data` 和 `background_summary` 是 `build_analysis_inputs.py:assign` 的函数参数名；它们分别来自哪一个 Protocol，由 `transition.inputs` 显式声明。

### 多对多

多个上游 Protocol 经过一个 assigner 后，同时写入多个下游 Protocol：

```yaml
assigners:
  - id: plan_report_and_archive
    runtime: python
    entrypoint: ./assigners/plan_report_and_archive.py:assign

transitions:
  - id: prepare_report_and_archive
    from:
      - analysis
      - qc_review
    to:
      - report
      - archive
    run: plan_report_and_archive
    inputs:
      analysis_summary: ${analysis.var.summary}
      qc_checked: ${qc_review.check.pass_qc.checked}
      qc_annotation: ${qc_review.check.pass_qc.annotation}
    assign:
      report:
        var.summary: ${prepare_report_and_archive.outputs.report_summary}
        check.ready_to_publish: ${qc_review.check.pass_qc}
      archive:
        var.qc_annotation: ${qc_review.check.pass_qc.annotation}
        var.archive_bundle: ${prepare_report_and_archive.outputs.archive_bundle}
```

这个例子展示了完整情况：`from` 可以有多个来源，`to` 可以有多个目标，`inputs` 显式绑定 assigner 参数来源，`assign` 显式绑定每个目标 node 的目标字段。

## 数据传递原则

Workflow 级数据传递应当尽量保持声明式。YAML 负责声明图、来源字段、目标字段和 assigner 调用；Python assigner 只负责把输入值转换成输出值，不负责决定“这些值来自哪个 Protocol”或“写入哪个下游字段”。这样可以避免 YAML 写一套绑定、Python 再隐含写一套绑定，从而减少漂移。

传递的值应当是规范 JSON 可序列化值或引用表达式。File、Image、Sequence、Markdown 等结构化值应通过 typed JSON value 或字段引用表达；具体如何展示和执行由 renderer 与 runtime 决定。

## 校验

npm AIMD core parser 和 Python parser 都会校验 workflow block。它们会拒绝不支持的版本、重复的 node、assigner 或 transition id、缺失的 protocol 引用、指向未知节点的 transition、指向未知 assigner 的 `run`、缺少 entrypoint 的 Python assigner、出现但格式非法的权限列表、格式非法的目标字段路径，以及非正整数的重试次数。

Parser 不会执行 assigner，也不会静态推断 Python 返回 dict 的全部 key。更强的运行时校验应当在执行 assigner 后检查 `${transition_id.outputs.key}` 是否存在，并检查目标字段是否存在、可写、类型兼容。

`airalogy_engine.AiralogyWorkflowEngine` 支持执行 workflow transition assignment：它会解析 `workflow.aimd`，按 `transition.inputs` 读取上游 Record 字段，运行 workflow 级 Python assigner，把返回值暴露为 `${transition_id.outputs.key}`，并按 `transition.assign` 生成目标 Record draft。它不负责数据库持久化，也不把技术性 retry 写成 Record 或 Record version；平台层应当决定何时保存新的 Record。

## 数据结构

请参考 [Workflow 数据结构](../data-structure/workflow.md)。
