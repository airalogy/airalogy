# Vue 编辑器

## 无需手填 ID 的输入框

工具栏将常用字段独立分组，以图标和短标签显示“文本、整数、小数、单选、多选、是／否”；悬停会显示完整的插入名称。日期、时间、日期时间、文本列表、附件和自定义类型放在“更多输入框”，窄屏下自动换行。选择快捷入口后，配置对话框直接选中对应类型。`AimdInputFieldDialog` 的 `initialPreset` 可由宿主传入；独立使用 `AimdEditorToolbar` 时处理 `insert-input` 事件即可。

“小数”对应 `float`，不要求普通用户理解“浮点数”。“单选”生成 `Literal[...]`，“多选”生成 `list[Literal[...]]`；填写时分别保存单个值和数组。“是／否”快捷入口生成 `bool | None`，保留“未填写”，不将未回答误当成“否”。这些字段用于记录数据；带正确答案和评分的题目仍使用“题目”入口。

“附件”提供文件格式选择，例如 PDF、PNG、CSV，并写入对应的 `FileIdPDF`、`FileIdPNG`、`FileIdCSV` 类型。格式列表直接来自内置类型注册表，不需要在编辑器里重复维护。

设置 `mode="wysiwyg" field-display="compact"` 可进行简洁的可视化定义编辑。“输入框”操作以普通文字提供控件类型和下拉选项，不要求用户编写 Python 类型语法。名称选填并保存为 `title`；高级设置中的 ID 自动生成，真实写入 AIMD，并允许改成其他合法、唯一的 ID。移动字段不会重新编号，非法或重复 ID 会阻止插入或更新。自定义类型和默认值仍可在高级设置中配置。

点击可视化输入框占位块可修改属性。改名会同步更新可视化文档中的直接 `ref_var` 节点，但不会迁移外部 Records、assigner 代码或外部系统的依赖；宿主需要显式处理这些关联。仅修改名称会保留原 ID、默认值及其他元数据。

`fieldDisplay` 支持 `compact`、`detailed`，默认仍为 `detailed`；`mode` 默认仍为 `source`，兼容既有集成。需要在可编辑文档中填写真实 Record 值时，使用 [AimdRecorderWysiwygSurface](/zh/packages/aimd-recorder/recorder#可视化表单编辑)，而不是 `AimdEditor` 中仅编辑定义的占位块。

`@airalogy/aimd-editor/authoring` 导出可复用的 `collectAimdFieldIds(markdown)`、`createAimdFieldId(existingIds, prefix?)` 和 `updateAimdInputField(original, values)`。Vue 入口的 `AimdInputFieldDialog` 还支持 `reservedIds`，用于避免新字段复用已脱离文档的 Record 数据 ID。

插入和编辑输入框共用视口居中的原生模态对话框，自动聚焦名称输入框，支持 Esc 或“取消”关闭。组件显式保留居中所需的自动边距，不依赖宿主的全局样式；窄屏下保留两侧边距，高级设置展开后内容过高时在对话框内部滚动。Recorder 的可视化编辑界面复用同一个对话框。

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

## 多行数据表

可视化编辑在切换模式和保存时保留多行 `var_table` 及嵌套的 `var(...)` 列定义。Recorder 可视化界面显示声明的列标题和对应类型的输入控件，而不是定义文本。旧草稿中定义行首的 `&#x20;` 等缩进编码会在载入可视化编辑器时恢复，并在下一次内容编辑时写回；该修复不会解码引号内的字面文本或普通 Markdown 内容。

## 步骤名称

点击工具栏“步骤”填写可选的名称，插入时自动生成稳定且唯一的 ID。点击步骤占位块或旁边的“编辑”可重新打开设置。高级设置提供 ID、层级、预计时长及计时显示；已有步骤 ID 保持只读，避免修改名称时断开记录和引用。操作正文在步骤下方直接编辑，未设置标题时不会把同行文字自动当作标题。

```aimd
{{step|dilute_and_mix, title="定容与混匀", check=True, duration="2m"}}

加水至刻度并混匀。
```

`@airalogy/aimd-editor/vue` 导出 `AimdStepFieldDialog`，`@airalogy/aimd-editor/authoring` 导出 `updateAimdStepField`。定义编辑器和 Recorder 可视化界面复用同一套编辑能力。修改名称更新 AIMD，不修改 Record 数据。

## 检查点名称与高级类型

字段参数的引号内是字面文本。例如 `{{check|reading, checked_message="保留字面文本 {{ref_var|wait_s}}"}}` 是一个完整检查点，不是检查点加一个嵌套引用。可视化编辑、模式切换、保存后重新打开均保留完整定义；参数字符串之外的 `{{ref_var|wait_s}}` 仍是普通正文引用。

插入检查点时名称选填，例如 `{{check|safety_ready, title="防护用品检查"}}`。后续 Markdown 是检查正文，不会自动推断为标题。共用的 `AimdStepFieldDialog` 接受 `fieldType="check"`，提供标题、ID 和勾选后提示；已有 ID 保持只读，`updateAimdCheckField` 编辑元数据而不改 Record 键。

输入框的“高级 / 自定义”提供来自 Python 生成注册表的内置类型列表，以及宿主传入的 `varTypePlugins`。下方的类型表达式仍可编辑，包括未知自定义类型、`list[...]` 和可空类型。选择已有类型时保留原有 `| None`。这里仅声明类型，自定义 Python 类型定义和专用 Recorder 控件仍需由宿主提供。

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

`AimdEditor` 负责编辑模板源文件，不负责 Record 持久化。填写值由 Recorder 管理，存储、记录 ID、版本和导出由宿主负责。完整 Demo 流程见[保存模板与记录](../../demo#保存模板与记录)；保存模板不会包含填写值。

- [内嵌编辑面](/zh/packages/aimd-editor/embedded)
- [类型插件](/zh/packages/type-plugins)
