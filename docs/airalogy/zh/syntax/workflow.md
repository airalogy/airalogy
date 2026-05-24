# 在Airalogy Protocol中定义Workflow

## 概述

在Airalogy平台中，我们允许多个Airalogy Protocols之间协同，因此Airalogy专门提供了Workflow的定义方式。该设计使得Airalogy平台中的每个Protocol都可以被看作是一个独立的积木，而Workflow则是将这些积木组合在一起的工具。一个Workflow可以将多个Protocols关联起来，形成具有系统性的科研工作流，以实现某种特定的科研目标。由于用户可以自由的将Airalogy平台中各种公开的Protocols进行组合，这使得用户能够自由的基于已有的Protocols构建自己的科研工作流，以满足自己的独特的科研需求。Workflow由于是把Airalogy平台中的Protocols组合在一起，因此也可以被称为Airalogy Protocol Workflow，当然我们在文档中经常用Workflow来简称。

### 本地

如果是要在本地建立一个Workflow，则需要将在一个文件夹中，将多个Airalogy Protocol放于其下，并在同文件下建立一个含有Workflow的新的Airalogy Protocol。该Airalogy Protocol的文件结构和普通的Airalogy Protocol一样。

## 定义语法

简单来说，通过一个Workflow，我们可以把一个项目（Project）中的多个Protocol组合在一起，形成一个具有系统性的科研工作流，以实现某种特定的科研目标。Workflow的定义语法如下：

我们可以使用`workflow`代码块/模板来定义一个Workflow。其功能如果要做类比的话可以比做是`{{var}}`模板版本的`{{workflow}}`，但为了让用户更便捷的定义其内容，我们因此将其设计为代码块形式。该代码块可以在该Airalogy Protocol的Airalogy Markdown文件中定义。其语法如下：

````aimd
```workflow
<workflow_info>
```
````

`workflow`代码块中的内容基于YAML语法编写，其高亮显示效果等同于YAML代码块，为了便于用户能够根据语法高亮来轻松理解语法，下文中在`yaml`代码块中展示了Workflow的定义语法，即`<workflow_info>`的内容：

```yaml
id: example_workflow # Workflow的ID。该ID关系到该Workflow的数据储存结构
title: Example Workflow # Workflow的标题。用于在Airalogy界面中展示，以帮助用户理解该Workflow的内容
protocols:
  - protocol_index: 0 # 该Workflow中的第0个Protocol。protocol_index需要从0开始递增，不得重复和跳跃
    protocol_id: protocol_a # 该Protocol的ID。该Protocol需要为同一个Project中的Protocol，且必须存在于该Project中
    protocol_version: 0.0.1 # 可选。如需指定Protocol版本，请新增protocol_version字段；不填写则默认使用最新版本
    protocol_name: Protocol A # 该Protocol的名称，用于提示用户该Protocol的内容
  - protocol_index: 1 # 该Workflow中的第1个Protocol的ID
    protocol_id: protocol_b
    protocol_name: Protocol B
  # 以此类推，可以定义多个Protocol
edges:
  - 0 -> 1 # 该列表中的每个元素代表一个有向边。该有向边表示Protocol 0完成后，下一个可以执行的Protocol是Protocol 1
  # 以此类推，可以定义多个有向边
  # 有向边支持单向有向，或者双向有向。分别使用自左向右箭头`->`和双向箭头`<->`来表示（注意为了形式的简单和统一，`<-`是不被支持的）
logic: | # 该字段用于定义Workflow的逻辑。使用Markdown语法编写
  1. Protocol 0 must be executed before Protocol 1.
  2. Protocol 1 must be executed before Protocol 2.
  ...
default_initial_protocol_index: 0 # 该字段用于定义Workflow的默认初始Protocol。如果没有默认初始Protocol，可以留空
default_research_purpose: # 该字段用于定义Workflow的默认研究目的。如果没有默认研究目的，可以留空
default_research_strategy: # 该字段用于定义Workflow的默认研究策略。如果没有默认研究策略，可以留空
```

### 真实例子

我们以一个关于碳纳米管分散研究的Workflow为例，展示一个完整的Workflow定义：

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

## 应用Workflow

当用户在一个Protocol中定义了一个Workflow后，在Airalogy的记录界面中，Airalogy平台会自动解析上述`workflow`代码块，并自动的绘制出Workflow Graph。用户可以通过该Graph来了解Workflow的拓扑结构。另外，界面也将把Workflow中的`logic`的Markdown文本渲染出来，以帮助用户理解Workflow的逻辑关系。

当用户加载一个含有Workflow的Protocol后，Airalogy平台会自动根据该Workflow中所有`protocol_id`s来在该Protocol所在的Project中索引到对应的Protocol。当索引不到对应的Protocol时，Airalogy平台会提示用户该Workflow中的Protocol缺失，并要求用户先创建这些Protocol后才能使用该Workflow。

## 数据结构

请参考[Workflow数据结构](../data-structure/workflow.md)。
