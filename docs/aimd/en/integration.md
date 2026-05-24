# Cross-Package Integration

This guide shows how to combine `@airalogy/aimd-editor`, `@airalogy/aimd-renderer`, and `@airalogy/aimd-recorder` in a single Vue 3 application to build a full AIMD authoring and recording workflow.

## Install

```bash
pnpm add @airalogy/aimd-core @airalogy/aimd-editor @airalogy/aimd-renderer @airalogy/aimd-recorder
pnpm add vue monaco-editor @vueuse/core naive-ui
```

## Basic Setup with Vue 3

The typical integration has three stages: **edit**, **preview**, and **record**. Each stage maps to one of the AIMD packages.

```vue
<script setup lang="ts">
import { ref, watch } from "vue"
import { AimdEditor } from "@airalogy/aimd-editor"
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# My Protocol

Sample Name: {{var|sample_name: str}}
Temperature: {{var|temperature: float = 25.0}}

{{step|preparation}}
Prepare the workspace.

{{step|measurement}}
Record the measurement.

{{check|safety_check}}
`)

const previewHtml = ref("")
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const activeTab = ref<"edit" | "preview" | "record">("edit")

watch(content, async (value) => {
  const { html } = await renderToHtml(value)
  previewHtml.value = html
}, { immediate: true })
</script>

<template>
  <div class="aimd-app">
    <nav>
      <button @click="activeTab = 'edit'">Edit</button>
      <button @click="activeTab = 'preview'">Preview</button>
      <button @click="activeTab = 'record'">Record</button>
    </nav>

    <!-- Editor: author AIMD content -->
    <AimdEditor
      v-if="activeTab === 'edit'"
      v-model="content"
    />

    <!-- Preview: rendered HTML output -->
    <div
      v-if="activeTab === 'preview'"
      v-html="previewHtml"
    />

    <!-- Recorder: structured data input -->
    <AimdRecorder
      v-if="activeTab === 'record'"
      v-model="record"
      :content="content"
      locale="en-US"
    />
  </div>
</template>
```

## Recorder Editor

If the host needs simultaneous protocol authoring and recorder entry in one surface, use `AimdRecorderEditor` instead of wiring `AimdEditor` and `AimdRecorder` separately:

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"

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

When the user removes or renames fields while editing the protocol, the editor keeps `Recorder`, `Record Data`, and detached record values together in one right-side tab workspace instead of pushing those panels below the main editor. That keeps the secondary tools visible even when the AIMD document is long, and by default the editor also stretches both columns to the remaining viewport height below its current page position so the editor and recorder stay aligned. The same balanced-scroll layout continues to apply when the recorder side is switched into visual editing. If the host still wants the separate structure-helper panel, pass `:show-field-structure="true"`. If the host wants a truly caret-based WYSIWYG flow, users can switch on visual edit mode in the recorder panel; the right side then becomes a recorder-aware WYSIWYG surface where `var`, `var_table`, `step`, `check`, and `quiz` fields render as live recorder widgets, can be dragged to any caret-valid location, and expose the built-in field-edit dialog directly from the rendered node. Set `:allow-raw-field-source-editing="false"` when that dialog should stay in structured mode only. Turn the toggle off again to return to recorder entry with the current record state intact. If the host prefers fixed-height behavior, set `:fit-viewport="false"`.

## Field Extraction

Use `parseAndExtract` from the renderer to get structured metadata about all AIMD fields in the content. This is useful for building side panels, validation summaries, or progress tracking.

```ts
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

// fields.var       — list of variable IDs
// fields.step      — list of step IDs
// fields.check     — list of checkpoint IDs
// fields.quiz      — list of quiz definitions
// fields.var_table — list of table definitions with column metadata
// fields.fig       — list of figure definitions
```

## Quiz Auto Grading

If the host wants score, status, and feedback to appear directly in the recorder, first extract `fields.quiz` with `parseAndExtract()`, then build a grade report with the grading helpers exported from `@airalogy/aimd-core`.

```ts
import { gradeQuizRecordAnswers } from "@airalogy/aimd-core"
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

const report = await gradeQuizRecordAnswers(
  fields.quiz,
  record.value.quiz,
  {
    provider: async ({ quiz, answer, config, max_score }) => {
      // Recommended: call your own backend grading endpoint here.
      // The backend can map config.provider to the real model + secret.
      const response = await fetch("/api/grade-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz, answer, config, max_score }),
      })
      return await response.json()
    },
  },
)

const quizGrades = report.quiz
```

Here, `config.provider` is only the configuration name written in AIMD, such as `teacher_default`. The recommended pattern is to let your backend use that name to choose the real model, secret, and grading flow, rather than binding the browser directly to an external model service.

Also note: the backend response consumed by `gradeQuizAnswer()` / `gradeQuizRecordAnswers()` must be a structured grade result object. Do not return raw free-form model text directly. At minimum, return something like:

```json
{
  "earned_score": 4,
  "max_score": 5,
  "status": "partial",
  "method": "llm",
  "feedback": "Mostly correct, but one key point is missing."
}
```

If the provider returns unstructured text instead, the current implementation marks that quiz as `needs_review` rather than trying to extract a reliable score from free text.

Then pass the result map into `AimdRecorder`:

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :quiz-grades="quizGrades"
  choice-option-explanation-mode="selected"
/>
```

Notes:

- `choice` and most `blank` items can be graded locally
- deterministic `scale` items can also be graded locally, and `scaleGradeDisplayMode` controls whether that result is hidden, shown on completion, or shown only after submission
- `open` items are usually better with rubric logic or a backend provider
- for practice, you can recompute `quizGrades` on each answer change to provide immediate feedback
- for homework, if explanations should appear only after submission, pass `:submitted="isSubmitted"` and set `choiceOptionExplanationMode="submitted"`
- for assessment-style scales, pass `:submitted="isSubmitted"` and set `scaleGradeDisplayMode="submitted"` so users do not see a provisional classification before submit
- for exams, you can omit `quizGrades` until submission or teacher review is complete
- unanswered quizzes with status `ungraded` do not render a grading panel by default
- if a choice option includes `explanation`, `choiceOptionExplanationMode` controls whether the option explanation is shown
- `submitted` is owned by the host app; the recorder does not infer submission state automatically
- do not expose real model keys in the browser for high-stakes grading

## Configuration Options

### Editor Options

The `AimdEditor` component accepts several props:

```vue
<AimdEditor
  v-model="content"
  locale="en-US"
  :messages="customEditorMessages"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `""` | AIMD content (use with `v-model`) |
| `locale` | `"en-US" \| "zh-CN"` | auto-detected | UI language |
| `messages` | `AimdEditorMessagesInput` | built-in | Override specific UI labels |

Use the factory helpers to build toolbar metadata for custom UIs:

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("en-US")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
```

### Renderer Options

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  locale: "en-US",
  assignerVisibility: "hidden",   // "hidden" | "collapsed" | "expanded"
  mode: "preview",                // "preview" | "edit" | "report"
  math: true,                     // enable KaTeX math rendering
  gfm: true,                      // enable GFM tables, strikethrough, etc.
  groupStepBodies: true,          // fold trailing block content into step containers
  quizPreview: {
    showAnswers: false,            // reveal quiz answers in preview
    showRubric: false,             // reveal open-question rubrics
  },
})
```

Use `aimdElementRenderers` together with `createCustomElementAimdRenderer()` when the host preview surface needs to map AIMD nodes into custom elements.

For Vue vnode output instead of HTML strings:

```ts
import { renderToVue } from "@airalogy/aimd-renderer"

const { nodes, fields } = await renderToVue(content, {
  locale: "en-US",
})
```

### Recorder Options

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  locale="en-US"
  current-user-name="Alice"
  choice-option-explanation-mode="selected"
  :field-meta="fieldMetaMap"
  :field-state="fieldStateMap"
  :messages="customRecorderMessages"
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `modelValue` | `AimdProtocolRecordData` | Record data (use with `v-model`) |
| `content` | `string` | AIMD source content |
| `locale` | `"en-US" \| "zh-CN"` | UI language |
| `currentUserName` | `string` | Auto-fills `UserName` var fields |
| `quizGrades` | `Record<string, AimdQuizGradeResult>` | Quiz grade map; when provided, the recorder renders score, status, and feedback below each quiz |
| `submitted` | `boolean` | Marks whether the current attempt has been submitted; combine with `choiceOptionExplanationMode="submitted"` to reveal option explanations after submit |
| `choiceOptionExplanationMode` | `"hidden" \| "selected" \| "submitted" \| "graded"` | Controls when `explanation` text on choice options is shown: hidden, immediately after selection, after submission, or only after the quiz has a grade result |
| `scaleGradeDisplayMode` | `"hidden" \| "completed" \| "submitted" \| "graded"` | Controls when recorder-side local grading for deterministic `scale` quizzes is shown; use `submitted` for assessment flows where the learner should not see a provisional score before submit |
| `fieldMeta` | `Record<string, AimdFieldMeta>` | Per-field metadata overrides |
| `fieldState` | `Record<string, AimdFieldState>` | Per-field runtime state |
| `fieldAdapters` | `AimdRecorderFieldAdapters` | Replace or wrap built-in recorder field UIs with host components |
| `messages` | `AimdRecorderMessagesInput` | Override specific recorder labels |

The record data shape:

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}
```

## Event Handling Across Packages

### Field Events from Recorder

The recorder emits events when users interact with fields. Listen for changes using `v-model` or watch the record data:

```vue
<script setup lang="ts">
import { watch } from "vue"

watch(record, (newRecord) => {
  console.log("Variables:", newRecord.var)
  console.log("Steps:", newRecord.step)
  console.log("Checks:", newRecord.check)
  console.log("Quizzes:", newRecord.quiz)
}, { deep: true })
</script>
```

### Vue Injection Keys

The renderer provides Vue injection keys for event coordination between nested components:

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

These are `InjectionKey` symbols used with Vue's `provide` / `inject` to pass event channels down the component tree.

### Client Assigners

Client-side assigners run JavaScript functions that compute derived field values. They are defined in the AIMD content and executed by the recorder.

```aimd
Water: {{var|water_ml: float}}
Lemon: {{var|lemon_ml: float}}
Total: {{var|total_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_ml", "lemon_ml"],
    assigned_fields: ["total_ml"],
  },
  function calculate_total({ water_ml, lemon_ml }) {
    return { total_ml: water_ml + lemon_ml };
  }
);
```

For `mode: "manual"` assigners, trigger execution explicitly:

```ts
const recorderRef = ref<InstanceType<typeof AimdRecorder>>()

recorderRef.value?.runClientAssigner("calculate_total")
recorderRef.value?.runManualClientAssigners()
```

## Shared Localization

All three packages support `en-US` and `zh-CN`. Pass the same locale to each component for a consistent UI:

```vue
<AimdEditor locale="zh-CN" />

<AimdRecorder locale="zh-CN" />
```

```ts
const { html } = await renderToHtml(content, { locale: "zh-CN" })
```

Each package provides its own message factory for fine-grained label customization:

```ts
import { createAimdEditorMessages } from "@airalogy/aimd-editor"
import { createAimdRendererMessages } from "@airalogy/aimd-renderer"
import { createAimdRecorderMessages } from "@airalogy/aimd-recorder"
```

## Math and Styles

The renderer loads KaTeX math styles automatically when using the async `renderToHtml` or `renderToVue` APIs in browser environments. For server-side rendering or manual control, import styles explicitly:

```ts
import "@airalogy/aimd-renderer/styles"
```

The recorder has its own stylesheet:

```ts
import "@airalogy/aimd-recorder/styles"
```

## Full Working Example

See the `apps/aimd-demo/` directory in the monorepo for a complete integration that wires all four packages together with routing, live preview, and recording. Run it locally:

```bash
pnpm dev:demo
```
