# Defining a Workflow in AIMD

## Overview

A workflow coordinates multiple Airalogy Protocols above the level of a single `protocol.aimd`. Its core semantics are broader than “one Protocol output becomes another Protocol input”: it copies or transforms fields from one or more protocol runs / Records into fields on one or more downstream protocol runs / Records.

You can read a workflow as: source fields -> optional assigner transformation -> target fields. `nodes[]` defines the Protocol nodes in the graph, `assigners[]` defines reusable transformation functions, and `transitions[]` defines each invocation: which nodes it reads from, whether it runs an assigner, and which target fields it writes.

Workflow logic should live in an AIMD document, but it should normally be kept in a separate file such as `workflow.aimd` rather than being mixed into a normal protocol document. The fenced `workflow` block is a higher-level document type for protocol orchestration.

The parser only parses and validates the workflow declaration. It does not execute Python assigners, call APIs, mutate records, or decide branch outcomes. Runtime implementations should treat each workflow iteration as a new node run or Record; a completed Record should not be rewritten into an earlier state.

## Syntax

Use a fenced `workflow` block whose body is YAML:

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

## Assigner Source Examples

`entrypoint` uses the `file_path:function_name` format. Two assigners can live in separate `.py` files, or they can be two functions in the same `.py` file; the workflow names them with `assigners[].id`, and transitions reference them with `run`.

An assigner function should remain a plain Python function. This design does not require an `@assigner` decorator or an `AssignerResult` return class. Function parameters are explicitly bound by `transition.inputs`; the return value is a plain dict and is referenced later as `${transition_id.outputs.key}`.

### Option 1: One File per Assigner

`entrypoint: ./assigners/summarize_measurement.py:assign` means the runtime loads the `assign` function from `./assigners/summarize_measurement.py`. The workflow parser only validates the declaration; it does not execute this function.

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

`entrypoint: ./assigners/optimize_parameters.py:assign` points to the `assign` function in another file. It is referenced by `run: optimize_parameters` on the `retry_after_qc_failure` transition and generates field values for the next `prep` node run.

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

This style works well when assigners have longer logic, different dependencies, or separate tests.

### Option 2: Multiple Assigners in One File

You can also put both assigner functions in one Python file, as long as each `entrypoint` names a different function:

```yaml
assigners:
  - id: summarize_measurement
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:summarize_measurement
  - id: optimize_parameters
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:optimize_parameters
```

`./assigners/workflow_assigners.py` can look like this:

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

Both layouts have the same workflow semantics. `transition.run` references only `assigners[].id`; it does not care whether the functions live in the same file. `transition.inputs` decides where function arguments come from, and `transition.assign` decides which target fields receive function outputs.

## Fields

`version` must be `airalogy.workflow.v1`. Do not omit it; it is the explicit version boundary for the workflow schema.

`id` is the stable workflow id. It must start with a letter and contain only letters, digits, and underscores.

`nodes[]` declares protocol nodes in the graph. Each node requires `id` and either `protocol` for a local protocol path or `protocol_id` for a registry/project reference. Optional fields include `protocol_version`, `title`, and `description`.

`assigners[]` declares workflow-level assigners. A Python assigner requires `runtime: python` and `entrypoint`. `outputs` is only an optional function return contract, mainly for documentation, UI, and stronger future validation; it does not declare write targets and does not decide which outputs are consumed. Actual output consumption and target Protocol fields are declared by `transition.assign`. When `outputs` is omitted, the runtime can still expose actual returned dict keys as `${transition_id.outputs.key}` and validate that keys referenced by `transition.assign` exist. `permissions` is also optional. Ordinary users usually do not need to fill it in; engineering runtimes can infer and validate permissions from the assigner, project configuration, or sandbox policy.

`transitions[]` declares directed edges between nodes. Each transition requires `id`, `from`, and `to`. `id` is the namespace for this transition invocation, so assigner return values are referenced as `${transition_id.outputs.key}` rather than `${assigner_id.outputs.key}`. `from` and `to` may be written as a single string or as a string list in YAML; parser output normalizes both to arrays. Optional fields include `when`, `label`, `run`, `inputs`, `max_iterations`, and `assign`. A `run` value must reference an existing assigner id. `max_iterations` must be a positive integer.

Output references use the transition id rather than the assigner id because the assigner id names a function definition, while the transition id names one function invocation. The same assigner can be reused by multiple transitions, and each invocation can have different inputs, source nodes, target nodes, and returned values. If outputs were attached to the assigner id, `${build_analysis_inputs.outputs.raw_data_summary}` would not identify which invocation produced the value; `${prepare_analysis_inputs.outputs.raw_data_summary}` clearly refers to the output produced by the `prepare_analysis_inputs` transition invocation.

`inputs` belongs to a transition, not to an assigner. Its keys are Python function parameter names, and its values can be constants or field references such as `${measurement.var.raw_data}` or `${analysis.check.pass_qc.annotation}`. This lets the same assigner be reused across different transitions with different sources.

`assign` declares writes into target fields. Prefer the grouped form: the first-level key is the target node id, and the second-level key is the target field path, such as `var.sample_id`, `check.pass_qc`, or `step.review_result.annotation`. When `to` contains exactly one target node, the parser also accepts a shorthand that omits the target node key and normalizes it to the grouped form. When `to` contains multiple target nodes, assignments must be grouped by target node.

`logic` is human-readable Markdown text explaining the workflow policy.

`default_initial_node` optionally names the default start node and must reference an existing node id.

## Field References

Field references use `${node_id.field_path}`. `field_path` must contain at least two segments: field family and field id; when the field value is itself structured, more subfield segments may follow.

```yaml
${measurement.var.raw_data}
${analysis.check.pass_qc}
${analysis.check.pass_qc.checked}
${analysis.check.pass_qc.annotation}
${prep.step.prepare_sample}
${prep.step.prepare_sample.annotation}
```

`step` and `check` can themselves be field values. For example, `${analysis.check.pass_qc}` can represent the whole check result object, while `${analysis.check.pass_qc.checked}` and `${analysis.check.pass_qc.annotation}` select the `checked` and `annotation` subfields. The parser only validates the structural shape of the reference expression; actual field existence, field type compatibility, and subfield writeability belong to the protocol schema / Record schema and the workflow runtime.

When the right-hand value does not use `${...}`, it is a plain constant string, even if it looks like a field path:

```yaml
assign:
  prep:
    var.retry_note: retry_after_qc_failure.outputs.retry_reason
```

The example above writes the literal string `"retry_after_qc_failure.outputs.retry_reason"` into `prep.var.retry_note`. To read a transition output, write the reference explicitly:

```yaml
assign:
  prep:
    var.retry_note: ${retry_after_qc_failure.outputs.retry_reason}
```

This keeps plain strings and dynamic references clearly separated. For example, `api.openai.com`, `data.raw.csv`, and `analysis.var.summary` can remain ordinary strings without being misread by the runtime as references.

## Data Passing Examples

### One to One

One upstream Protocol writes into one downstream Protocol:

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

### One to Many

One upstream Protocol writes into multiple downstream Protocols:

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

### Many to One

Multiple upstream Protocols are combined into one downstream Protocol:

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

Here `raw_data` and `background_summary` are the function parameter names for `build_analysis_inputs.py:assign`; their source Protocols are declared explicitly by `transition.inputs`.

### Many to Many

Multiple upstream Protocols run through one assigner and write into multiple downstream Protocols:

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

This example shows the complete case: `from` can have multiple sources, `to` can have multiple targets, `inputs` explicitly binds assigner arguments, and `assign` explicitly binds every target node field.

## Data Passing Principles

Workflow-level data passing should stay declarative. YAML declares the graph, source fields, target fields, and assigner invocation; Python assigners only transform input values into output values. They should not decide “which Protocol did this value come from” or “which downstream field should receive this value.” This avoids duplicating bindings in both YAML and Python and reduces drift.

Values should be canonical JSON-serializable values or reference expressions. Structured values such as files, images, sequences, and Markdown should be represented as typed JSON values or field references; renderers and runtimes decide how to display and execute them.

## Validation

Both the npm AIMD core parser and the Python parser validate workflow blocks. They reject unsupported versions, duplicate node, assigner, or transition ids, missing protocol references, transitions pointing to unknown nodes, `run` references pointing to unknown assigners, Python assigners without an entrypoint, permission lists that are present but malformed, malformed target field paths, and non-positive retry limits.

The parser does not execute assigners and does not statically infer every key returned by a Python dict. Stronger runtime validation should check after assigner execution that `${transition_id.outputs.key}` exists, and that target fields exist, are writable, and have compatible types.

## Data Structure

See [Workflow Data Structure](../data-structure/workflow.md).
