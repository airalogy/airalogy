# @airalogy/aimd-recorder

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

Reusable recording UI for AIMD (Airalogy Markdown), including inline protocol recorder, the combined `AimdRecorderEditor`, quiz answer components, and styles.

Built-in variable input types include `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence`.
`AiralogyMarkdown` now uses a full-width embedded AIMD/Markdown editor in recorder mode, opens in `Source` mode by default, keeps the full top toolbar, and still supports switching to `WYSIWYG` instead of a plain textarea.
In recorder/edit mode, `ref_var` references display current var values as readonly inline content when available.
Frontend-only `assigner runtime=client` blocks are executed locally for pure var computations.
For simultaneous protocol restructuring and data entry, `AimdRecorderEditor` keeps the AIMD source editor and recorder bound to the same `content` + `record` state and can surface detached values after field IDs disappear from the current protocol.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. `@airalogy/aimd-*` docs describe how the frontend parser, renderer, and recorder implement those rules.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Quick Start

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

Sample: {{var|sample_name: str}}
Operator: {{var|operator: UserName}}
Record Time: {{var|current_time: CurrentTime}}
Temperature: {{var|temperature: float = 25.0}}
Notes: {{var|notes: AiralogyMarkdown}}
Plasmid: {{var|plasmid: DNASequence}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    locale="en-US"
    current-user-name="Alice"
  />
</template>
```

`AiralogyMarkdown` fields render a full-width embedded AIMD/Markdown editor with the full top toolbar, default to `Source` mode, and still support switching to `WYSIWYG`. Even when the field is authored mid-sentence, recorder lifts it into its own block row instead of keeping it as a tiny inline control.

Numeric `var` inputs honor Pydantic-style constraints such as `gt`, `ge`, `lt`, `le`, and `multiple_of`; these constraints apply to `int`, `integer`, `float`, and `number` var types.
Client assigners also use these constraints for dependency readiness, so an assigner will not run while a dependent numeric field violates its declared bounds.

`DNASequence` fields render a dedicated DNA editor with:

- a default `Interactive` mode focused on the sequence viewer
- a separate `Raw structure` mode for sequence text and structured cleanup
- an optional top-level sequence name field for plasmid or construct naming
- shared toolbar actions for importing FASTA / GenBank sequence files and exporting the current value as a GenBank `.gbk` file
- interactive onboarding for pasting DNA text
- sequence input using IUPAC DNA letters
- topology toggle (`linear` / `circular`)
- GenBank-aligned feature rows with multi-segment locations
- partial start / partial end flags per segment
- qualifier rows such as `gene`, `product`, `label`, and `note`

Use `locale` to switch built-in recorder labels (`en-US` / `zh-CN`).
`AimdProtocolRecorder` is still available as a deprecated compatibility alias, but new code should use `AimdRecorder`.

## Recorder Editor

Use `AimdRecorderEditor` when users need to edit the AIMD protocol structure and fill recorder values in the same screen.

```vue
  <script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

Sample: {{var|sample_name: str}}
Temperature: {{var|temperature: float}}
`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderEditor
    v-model="record"
    v-model:content="content"
    locale="en-US"
    :show-record-data="true"
    :allow-raw-field-source-editing="false"
  />
</template>
```

This editor keeps recorder state alive while the AIMD source changes, and it groups `Recorder`, `Record Data`, and detached-data views into one right-side tab workspace so those auxiliary panels do not get pushed below a long AIMD document. By default, it also measures the remaining viewport space below the editor and stretches both columns to fill that space as much as possible, with internal scrolling on each side so the columns stay visually aligned; that balanced scroll behavior also applies when the recorder side is switched into visual editing. If the host still wants the separate `Field Structure` helper panel, pass `:show-field-structure="true"`. Users can:

- switch field kinds
- rename field ids
- change inline `var` value types
- add or delete fields
- drag field source fragments into a different order

If a field is renamed or removed, detached values are shown in their own tab so users can copy them into newly created fields instead of losing track of the previous data.

For non-technical users, the editor also has a recorder-aware WYSIWYG mode. Turn it on in the recorder panel header and the right side switches into a caret-based AIMD editor where `var`, `var_table`, `step`, `check`, and `quiz` fields are rendered as real recorder widgets instead of inline chips. Users can keep writing headings, lists, and normal Markdown around those widgets, drag the rendered field nodes to any caret-valid position, and follow the visible drop indicator that appears while dragging for more precise placement. The contextual hover/focus toolbar attached to each rendered field also keeps edit, delete, and drag actions on the widget itself. If the host does not want raw AIMD editing inside the recorder-side dialog, set `:allow-raw-field-source-editing="false"` and the dialog keeps only the structured controls. Turn visual edit mode back off to return to normal recorder entry; the current record state stays intact.

If the host prefers the previous fixed-height behavior, disable viewport fitting explicitly:

```vue
<AimdRecorderEditor
  :fit-viewport="false"
  :editor-min-height="640"
  :recorder-min-height="640"
/>
```

`record` shape:

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

Client assigner example:

````aimd
Water: {{var|water_volume_ml: float}}
Lemon: {{var|lemon_juice_ml: float}}
Total: {{var|total_liquid_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_volume_ml", "lemon_juice_ml"],
    assigned_fields: ["total_liquid_ml"],
  },
  function calculate_total_liquid_ml({ water_volume_ml, lemon_juice_ml }) {
    return {
      total_liquid_ml: Math.round((water_volume_ml + lemon_juice_ml) * 100) / 100,
    };
  }
);
```
````

For `mode: "manual"`, the component exposes explicit trigger methods through the Vue ref:

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## Host Field Adapters

```ts
import { h } from "vue"

const fieldAdapters = {
  step: ({ node, defaultVNode }) =>
    h("step-card", {
      "step-id": node.id,
      "step-number": node.step,
      title: node.title || node.id,
      level: String(node.level),
    }, () => [defaultVNode]),
}
```

Pass `fieldAdapters` to `AimdRecorder` when the host app needs to replace or wrap built-in recorder field UIs while still using AIMD parsing and record-state management.

If the host app needs per-type behavior instead, use `typePlugins`. A type plugin can define the initial value, normalization, display/parsing hooks, and even a dedicated widget for one specific AIMD type token.

The built-in `AiralogyMarkdown` editor uses this same extension path, so a host plugin can still replace it if needed.

See:

- `docs/aimd/en/packages/type-plugins.md`

### Quiz Recorder Only

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdQuizRecorder } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const answer = ref("")
const quiz = {
  id: "quiz_single_1",
  type: "choice",
  mode: "single",
  stem: "Pick one option",
  options: [
    { key: "A", text: "Option A" },
    { key: "B", text: "Option B" },
  ],
}
</script>

<template>
  <AimdQuizRecorder v-model="answer" :quiz="quiz" locale="en-US" />
</template>
```

If a choice option defines `followups`, the recorder renders those inputs after the option is selected. For those quizzes, `v-model` uses `{ selected, followups }`; choice quizzes without followups keep the legacy string or string-array answer format.

`AimdQuizRecorder` also supports `scale` quizzes. For deterministic scales, you can either pass an external `grade` result or let the recorder reveal a local score/classification via `scaleGradeDisplayMode="completed"` or `scaleGradeDisplayMode="submitted"`.

## Documentation

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-recorder>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-recorder>
- Source docs: `docs/aimd/en/packages/aimd-recorder.md`, `docs/aimd/zh/packages/aimd-recorder.md`

## Citation

If `@airalogy/aimd-recorder` is useful in your work, please cite the Airalogy paper:

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
