# Customization

Use the recorder customization APIs when a host needs to adapt built-in recorder behavior without reimplementing AIMD parsing or record-state management.

## Type Plugins

Use `typePlugins` when a host needs per-type behavior rather than whole-field replacement.

Type plugins can define:

- a custom initial value
- normalization logic
- display/parsing hooks
- a fully custom recorder widget for one AIMD type token

The built-in `AiralogyMarkdown` widget is implemented through this same path, so hosts can still override it with their own renderer if they need a different workflow.

For the architecture and an end-to-end example, see:

- [Type Plugins](/en/packages/type-plugins)

## Host Field Adapters

Use `fieldAdapters` when the host application needs to replace or wrap built-in recorder fields with its own components while still keeping AIMD parsing and record state in `AimdRecorder`.

```vue
<script setup lang="ts">
import { h } from "vue"
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
    :content="content"
    :model-value="record"
    :field-adapters="{
      step: ({ node, defaultVNode }) =>
        h('step-card', {
          'step-id': node.id,
          'step-number': node.step,
          title: node.title || node.id,
          level: String(node.level),
        }, () => [defaultVNode]),
    }"
  />
</template>
```

Each adapter receives the parsed AIMD node, current field value, full record snapshot, built-in localized messages, and the default recorder vnode. `wrapField` still runs after adapter resolution, so hosts can keep global wrappers for validation or assigner chrome.

## Message Overrides

Override `messages` when you only need to tune built-in labels:

```vue
<script setup lang="ts">
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
    locale="en-US"
    :messages="{
      step: {
        annotationPlaceholder: 'Step notes',
      },
      table: {
        addRow: 'Append row',
      },
    }"
  />
</template>
```

## Compatibility Note

`AimdProtocolRecorder` is still exported as a deprecated compatibility alias, but new usage should prefer `AimdRecorder`.
