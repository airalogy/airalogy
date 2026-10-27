# Vue Editor

Use `AimdEditor` when you want the standard AIMD authoring UI with source and WYSIWYG modes in one component.

## Basic Usage

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdEditor } from "@airalogy/aimd-editor"

const content = ref("")
</script>

<template>
  <AimdEditor v-model="content" />
</template>
```

## Input Fields Without Manual IDs

The toolbar groups Text, Integer, Decimal, Single choice, Multiple choice, and Yes/no shortcuts using icons and short labels with full insertion tooltips. More inputs contains dates, times, date/time, text lists, attachments, and custom types; controls wrap on narrow screens. Selecting a shortcut opens the corresponding preset. Hosts can pass `initialPreset` to `AimdInputFieldDialog`; standalone `AimdEditorToolbar` integrations handle its `insert-input` event.

Decimal maps to `float` without requiring users to understand floating-point terminology. Single choice generates `Literal[...]`; multiple choice generates `list[Literal[...]]`, storing one value and an array respectively. Yes/no generates `bool | None` to keep unanswered distinct from No. These are data fields; use Quiz for questions with correct answers and scores.

The Attachment preset offers formats such as PDF, PNG, and CSV and writes the corresponding `FileIdPDF`, `FileIdPNG`, or `FileIdCSV` type. Formats come directly from the built-in type registry rather than a separate editor-maintained list.

Use `mode="wysiwyg" field-display="compact"` for visual definition editing. The Input action offers human-readable control types and dropdown choices without asking users to write Python type syntax. The optional name becomes `title`; the advanced ID is generated automatically, remains in the serialized AIMD, and can be changed to another legal, unique ID. Reordering fields never renumbers existing IDs. Invalid or duplicate IDs block insertion or updates. Custom types and defaults remain available in advanced settings.

Click a visual input placeholder to edit its properties. Renaming updates direct `ref_var` nodes in the visual document. It does not migrate external Records, assigner code, or external integrations; hosts must handle those dependencies explicitly. Editing a title alone preserves the ID, default and unrelated metadata.

`fieldDisplay` accepts `compact` or `detailed` and defaults to `detailed`. `mode` still defaults to `source` for existing integrations. For real Record values inside the editable document, use [AimdRecorderWysiwygSurface](/en/packages/aimd-recorder/recorder#visual-form-authoring), not the definition-only placeholders in `AimdEditor`.

The reusable `@airalogy/aimd-editor/authoring` entry exports `collectAimdFieldIds(markdown)`, `createAimdFieldId(existingIds, prefix?)`, and `updateAimdInputField(original, values)`. `AimdInputFieldDialog` from the Vue entry also accepts `reservedIds` to avoid reusing IDs of detached Record data.

Inserting and editing inputs use the same viewport-centered native modal dialog. It focuses the name input and supports Escape or Cancel to close. Explicit automatic margins preserve centering independently of host global styles. Narrow viewports retain side spacing, and taller content such as expanded advanced settings scrolls inside the dialog. The Recorder visual authoring surface reuses this dialog.

## Multiline Tables

Visual editing preserves multiline `var_table` declarations and nested `var(...)` column definitions when switching modes or saving. The Recorder visual surface renders the declared column titles and typed inputs, not the definition text. Legacy drafts containing encoded indentation such as `&#x20;` at the start of a definition line are repaired when loaded into the visual editor and written back on the next content edit. Literal text inside quoted values and ordinary Markdown is not decoded by this repair.

## Step Names

Use the Step toolbar action to enter an optional name; insertion generates a unique persistent ID. Click a step placeholder or its Edit action to reopen settings. Advanced settings contain the ID, level, expected duration and timer display; existing IDs stay read-only so renaming a title cannot detach records or references. Instructions remain editable Markdown below the step. A missing title does not promote the following inline text into a title.

```aimd
{{step|dilute_and_mix, title="Dilute and mix", check=True, duration="2m"}}

Add water to the mark and mix.
```

`AimdStepFieldDialog` is exported from `@airalogy/aimd-editor/vue`; `updateAimdStepField` is exported from `@airalogy/aimd-editor/authoring`. Both the definition editor and Recorder visual surface reuse these authoring tools. Title edits update AIMD, not Record data.

## Checkpoint Names and Advanced Types

Quoted field parameters are literal text. For example, `{{check|reading, checked_message="Keep {{ref_var|wait_s}} literal"}}` is one checkpoint, not a checkpoint followed by a nested reference. Visual editing, mode switching, saving, and reopening preserve the complete definition. A `{{ref_var|wait_s}}` outside the parameter string remains a normal document reference.

Insert a checkpoint with an optional name, for example `{{check|safety_ready, title="Protective equipment"}}`. Its following Markdown is the check instructions, not an inferred title. The shared `AimdStepFieldDialog` accepts `fieldType="check"` and offers title, ID and checked message. Existing IDs stay read-only; `updateAimdCheckField` changes metadata without renaming Record keys.

The **Advanced / custom** input choice opens a type picker backed by the generated Python registry, plus `varTypePlugins` supplied by the host. The type expression remains editable, including unknown custom types, `list[...]` and nullable expressions. Choosing a registered type retains `| None` when present. This picker only declares the type: custom Python definitions and specialized Recorder widgets must still be provided by the host.

## Localization

The Vue editor includes built-in `en-US` and `zh-CN` UI messages.

If `locale` is omitted, the editor resolves locale from runtime hints in this order:

1. `document.documentElement.lang`
2. `navigator.language`
3. `navigator.languages[0]`

Any `zh*` locale resolves to `zh-CN`. Other locales fall back to `en-US`.

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

Use `messages` to override built-in copy:

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"

const messages = {
  common: {
    insert: "Add",
  },
}
</script>

<template>
  <AimdEditor locale="en-US" :messages="messages" />
</template>
```

## Related

`AimdEditor` edits template source, not Record persistence. Use Recorder for typed values and let the host own storage, record IDs, versions, and export. See [Save templates and records](../../demo#save-templates-and-records) for the complete demo workflow; saving a template does not include entered values.

- [Embedded Surfaces](/en/packages/aimd-editor/embedded)
- [Type Plugins](/en/packages/type-plugins)
