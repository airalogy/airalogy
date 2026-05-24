# Embedded Surfaces

Use the embedded entries when a host package needs lower-level AIMD editor building blocks instead of the full `AimdEditor`.

## WYSIWYG Surface

`AimdWysiwygEditor` is available from `@airalogy/aimd-editor/wysiwyg` and also from `@airalogy/aimd-editor/embedded`.

It supports:

- controlled `content`
- `readonly` and `active` host control
- custom Milkdown plugin chains through `milkdownPlugins`

That makes it suitable for host packages such as `@airalogy/aimd-recorder`, where AIMD fields may need host-specific node views.

## Focused Field Insertion

`AimdFieldDialog` supports `allowedTypes`, so a host can constrain the AIMD insertion UI to a focused subset of field kinds instead of showing the full AIMD field list.

This is useful for recorder-side editing workflows that only want `var`, `var_table`, `step`, `check`, and `quiz`.

## UI Metadata Helpers

If you build your own AIMD toolbar or insertion UI, use the typed helpers from the root entry:

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  createAimdVarTypePresets,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("zh-CN")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
const varTypePresets = createAimdVarTypePresets()
```

`createAimdVarTypePresets(...)` generates the preset-card data used by the `var` insertion panel. Pass host-specific preset data into `AimdEditor` through `varTypePlugins`.

## Related

- [Vue Editor](/en/packages/aimd-editor/vue-editor)
- [Type Plugins](/en/packages/type-plugins)
