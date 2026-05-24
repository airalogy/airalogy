# AimdRecorderEditor

Use `AimdRecorderEditor` when the user needs to keep editing AIMD protocol structure while continuing to fill recorder data on the same screen.

## Example

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

## Workspace Behavior

`AimdRecorderEditor` binds the source editor, recorder, and record state to the same `content` / `record` model.

By default it also:

- keeps `Recorder`, `Record Data`, and detached-data inspection near the main workflow instead of pushing them below long documents
- stretches both columns to the remaining viewport height
- uses internal scroll areas so the editor and recorder stay visually aligned

If the host prefers fixed-height behavior, set `:fit-viewport="false"` and continue sizing with `editorMinHeight` / `recorderMinHeight`.

If the host still wants the extra structure helper panel, pass `:show-field-structure="true"`.

## Recorder-Aware WYSIWYG Mode

The recorder side can switch into a recorder-aware WYSIWYG AIMD editor for non-technical users.

In this mode:

- `var`, `var_table`, `step`, `check`, and `quiz` render as their real recorder widgets instead of generic chips
- users can place the caret anywhere and keep writing headings, lists, and normal Markdown around those widgets
- rendered fields can be dragged to any caret-valid position
- a visible drop indicator helps place dragged fields more precisely
- each rendered field gets contextual hover/focus actions for edit, delete, and drag

When the host does not want recorder-side raw AIMD editing, set `:allow-raw-field-source-editing="false"` so the field dialog keeps only the structured field controls.

If the current protocol no longer contains previously recorded field ids, the editor can surface detached data in a dedicated view so users can migrate values into newly created fields.
