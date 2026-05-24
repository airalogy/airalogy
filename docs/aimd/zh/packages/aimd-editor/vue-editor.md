# Vue 编辑器

当你需要标准的 AIMD 编辑 UI，并且希望在一个组件里同时支持源码和所见即所得模式时，使用 `AimdEditor`。

## 基础用法

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

## 国际化

Vue 编辑器内建 `en-US` 和 `zh-CN` 两套 UI 文案。

如果不显式传入 `locale`，编辑器会按下面顺序自动推断：

1. `document.documentElement.lang`
2. `navigator.language`
3. `navigator.languages[0]`

凡是 `zh*` 都会归一化到 `zh-CN`，其他语言回退到 `en-US`。

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

也可以通过 `messages` 覆盖内建文案：

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"

const messages = {
  common: {
    insert: "添加",
  },
}
</script>

<template>
  <AimdEditor locale="zh-CN" :messages="messages" />
</template>
```

## 相关页面

- [内嵌编辑面](/zh/packages/aimd-editor/embedded)
- [类型插件](/zh/packages/type-plugins)
