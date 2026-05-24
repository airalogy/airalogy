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

- [Embedded Surfaces](/en/packages/aimd-editor/embedded)
- [Type Plugins](/en/packages/type-plugins)
