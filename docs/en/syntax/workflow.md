# Defining a Workflow in an Airalogy Protocol

## Overview

On the Airalogy platform, we allow multiple Airalogy Protocols to work together, so Airalogy provides a way to define Workflows. This design makes each Protocol a standalone building block, and a Workflow is the tool to assemble them. A Workflow can link multiple Protocols to form a systematic research workflow that achieves a specific research goal. Because users can freely combine public Protocols on the Airalogy platform, they can build their own workflows to meet unique research needs. Since a Workflow combines Protocols on the Airalogy platform, it can also be called an Airalogy Protocol Workflow, but in this document we often shorten it to Workflow.

### Local

To build a Workflow locally, place multiple Airalogy Protocols in the same folder, and create a new Airalogy Protocol in that folder that contains the Workflow definition. The file structure of this Airalogy Protocol is the same as a normal Airalogy Protocol.

## Definition Syntax

In short, a Workflow lets you combine multiple Protocols in a Project into a systematic research workflow to achieve a specific research goal. The Workflow definition syntax is:

You can use a `workflow` code block/template to define a Workflow. By analogy, it is like the `{{workflow}}` template version of `{{var}}`, but to make it easier for users to define, we implement it as a code block. This block can be defined in the Airalogy Markdown file of the Protocol. The syntax is:

````aimd
```workflow
<workflow_info>
```
````

The content inside the `workflow` code block is written in YAML. It is highlighted like a YAML code block, so users can rely on syntax highlighting. Below we show the Workflow definition syntax in a `yaml` block, which is the content of `<workflow_info>`:

```yaml
id: example_workflow # Workflow ID. This ID affects the data storage structure of the Workflow.
title: Example Workflow # Workflow title, shown in the Airalogy UI to help users understand it.
protocols:
  - protocol_index: 0 # The Protocol with index 0. protocol_index must start at 0 and increase, with no repeats or gaps.
    protocol_id: protocol_a # Protocol ID. This Protocol must be in the same Project and must exist.
    protocol_version: 0.0.1 # Optional. To specify a Protocol version, add the protocol_version field; if omitted, the latest version is used.
    protocol_name: Protocol A # Protocol name, used to hint its content.
  - protocol_index: 1 # The Protocol with index 1.
    protocol_id: protocol_b
    protocol_name: Protocol B
  # And so on, you can define multiple Protocols.
edges:
  - 0 -> 1 # Each element is a directed edge. This edge means after Protocol 0 completes, the next Protocol can be Protocol 1.
  # And so on, you can define multiple directed edges.
  # Edges can be one-way or bidirectional, represented by `->` and `<->` (for simplicity and consistency, `<-` is not supported).
logic: | # Defines the Workflow logic, written in Markdown.
  1. Protocol 1 must be executed before Protocol 2.
  2. Protocol 2 must be executed before Protocol 3.
  ...
default_initial_protocol_index: 0 # Default initial Protocol. Leave empty if none.
default_research_purpose: # Default research purpose. Leave empty if none.
default_research_strategy: # Default research strategy. Leave empty if none.
```

### Real Example

We use a workflow for a carbon nanotube dispersion study to show a complete definition:

````aimd
```workflow
id: cnt_dispersion
title: Workflow for a carbon nanotube dispersion study
protocols:
  - protocol_index: 0
    protocol_id: cnt_powder
    protocol_name: Preparation of dispersion solution from carbon nanotube powder
  - protocol_index: 1
    protocol_id: cnt_ultrasound
    protocol_name: Ultrasonic dispersion of carbon nanotube solution
  - protocol_index: 2
    protocol_id: cnt_dilution
    protocol_name: Preparation of low-concentration carbon nanotube dispersion solution from high-concentration solution
  - protocol_index: 3
    protocol_id: cnt_characterization
    protocol_name: Characterization of carbon nanotube dispersion
edges:
  - 0 -> 1
  - 1 <-> 3
  - 3 -> 2
  - 2 -> 1
logic: |
  1. The entire dispersion process must occur within a solution system, and the preparation of the dispersion from solid powder can only be the first step of the experiment: Protocol 0 must be the starting point of the Workflow.
  2. Every dispersion system must go through the stages of preparation, ultrasonication, and characterization: a Protocol Path must include at least one instance of (Protocol 0 -> Protocol 1 -> Protocol 3), and this sequence is irreversible.
  3. Based on the characterization results, it is determined whether: 1. The sample needs to be re-sonicated (Protocol 3 -> Protocol 1), or 2. The dispersion solution needs to be further diluted before sonication (Protocol 3 -> Protocol 2 -> Protocol 1). After repeating either of these two paths, characterization (Protocol 3) must be performed again to confirm the subsequent results. These two paths can be iteratively followed based on the outcomes of Protocol 3.
  4. The characterization process (Protocol 3), as the only quality control step in the experiment, can appear in the middle of the steps but must always be the final step in a Protocol Path.
  5. When the characterization results (Protocol 3) meet the research goal, the Workflow can be terminated.
```
````

## Applying a Workflow

After a user defines a Workflow in a Protocol, the Airalogy platform automatically parses the `workflow` block in the record view and draws a Workflow Graph. Users can view the graph to understand the topology. The UI also renders the `logic` Markdown text to help users understand the logical relationships.

When a Protocol containing a Workflow is loaded, the Airalogy platform looks up all `protocol_id`s in the Project and resolves the referenced Protocols. If a Protocol cannot be found, the platform warns that the Workflow references missing Protocols and asks the user to create them before using the Workflow.

## Data Structure

See [Workflow Data Structure](../data-structure/workflow.md).
