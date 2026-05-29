# Type Plugins

The `aimd` packages now expose a type-plugin layer on top of AIMD's existing freeform type syntax.

This matters because AIMD already accepts arbitrary type tokens in source text, but recorder/editor UX used to be mostly hard-coded to a fixed set of built-in types. Type plugins turn that into an explicit extension mechanism.

## Design Split

- `airalogy` defines the canonical backend contract for a type token.
- `aimd` defines how frontend tools discover, suggest, initialize, normalize, and render that type.

The same public type name should be reused on both sides.

## Recorder Integration

`AimdRecorder` now accepts `typePlugins`.

Each plugin can define:

- `inputKind`
- `getInitialValue`
- `normalizeValue`
- `getDisplayValue`
- `parseInputValue`
- `renderField`

This lets a host app add a full custom widget for a single type without replacing the whole recorder.

The built-in `AiralogyMarkdown` recorder field now uses this exact mechanism: the official plugin renders a full-width embedded AIMD/Markdown field with `Preview` and `Source` modes, renders Mermaid code blocks in preview, and recorder lifts inline occurrences into block layout before rendering. Host apps can still override it if they need a different editor surface.

```vue
<script setup lang="ts">
import { h } from "vue"
import { AimdRecorder, type AimdTypePlugin } from "@airalogy/aimd-recorder"

const microscopeCapturePlugin: AimdTypePlugin = {
  type: "MicroscopeCapture",
  inputKind: "text",
  getInitialValue: () => ({ exposure_ms: 0, channel: "brightfield" }),
  renderField: ({ value, emitChange }) =>
    h("microscope-capture-field", {
      modelValue: value,
      "onUpdate:modelValue": emitChange,
    }),
}
</script>

<template>
  <AimdRecorder
    :content="content"
    :model-value="record"
    :type-plugins="[microscopeCapturePlugin]"
  />
</template>
```

## Editor Integration

`AimdEditor` and the editor's AIMD field insertion dialog `AimdFieldDialog` now accept `varTypePlugins`.

Here, `AIMD Field` is used as an umbrella term for insertable AIMD units such as `var`, `var_table`, `quiz`, `step`, `check`, and `ref_*`.

These do not change AIMD syntax rules. They extend the insertion dialog so custom types are discoverable to authors.

```vue
<script setup lang="ts">
import { AimdEditor, type AimdVarTypePresetOption } from "@airalogy/aimd-editor"

const varTypePlugins: AimdVarTypePresetOption[] = [
  {
    key: "microscopeCapture",
    value: "MicroscopeCapture",
    label: "MicroscopeCapture",
    desc: "Structured microscope capture payload with a custom recorder widget",
  },
]
</script>

<template>
  <AimdEditor v-model="content" :var-type-plugins="varTypePlugins" />
</template>
```

## Why This Architecture

This keeps the system extensible without making it opaque.

- Protocol authors can keep writing plain AIMD.
- Host apps can add type-specific UX incrementally.
- Official Airalogy types are just first-party plugins with stronger documentation and compatibility guarantees.
- Good third-party designs can later be adopted by Airalogy without redesigning the whole extension path.

## Related Docs

- [`airalogy` type plugins](https://airalogy.github.io/airalogy/airalogy/en/apis/type-plugins)
- [`@airalogy/aimd-recorder`](/en/packages/aimd-recorder/)
- [`@airalogy/aimd-editor`](/en/packages/aimd-editor/)
