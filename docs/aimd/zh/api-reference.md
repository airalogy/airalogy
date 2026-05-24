# API 参考

按包整理的 AIMD 公开 API 速查。更完整的使用示例请查看各包文档与[集成指南](/zh/integration)。

## @airalogy/aimd-core

核心 AIMD parser、类型定义、语法 grammar 与通用工具。

### 入口

| 入口 | 路径 |
|------|------|
| Root | `@airalogy/aimd-core` |
| Parser | `@airalogy/aimd-core/parser` |
| Syntax | `@airalogy/aimd-core/syntax` |
| Types | `@airalogy/aimd-core/types` |
| Utils | `@airalogy/aimd-core/utils` |

### Parser

```ts
import {
  remarkAimd,
  rehypeAimd,
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

**`remarkAimd`**：用于 Unified remark 流水线的插件，把 AIMD 行内模板与 fenced `quiz` / `fig` / `assigner` 块解析成带类型的 AST 节点。

**`rehypeAimd`**：HTML AST 阶段对应的 rehype 插件。

**`protectAimdInlineTemplates(content: string): ProtectedAimdInlineTemplates`**：保护 Markdown 表格中的 AIMD `{{...}}` 模板，避免 GFM 按 `|` 误切分。返回 `{ content, templates }`。

**`restoreAimdInlineTemplates(content: string, templates: AimdInlineTemplateMap): string`**：在解析后恢复被保护的模板。

**`validateClientAssignerFunctionSource(functionSource: string, id: string): void`**：校验前端 `client_assigner` 函数体；若包含不支持或不安全结构会直接抛错。

**`validateVarDefaultType(def: AimdVarDefinition): string[]`**：当 AIMD var 默认值与声明类型不匹配时返回 warning 文本。

### Syntax（TextMate / Shiki）

```ts
import { aimdLanguage, aimdInjection, aimdSyntaxTheme, AIMD_SCOPES } from "@airalogy/aimd-core"
```

- `aimdLanguage`：AIMD TextMate grammar（扩展自 Markdown）。
- `aimdInjection`：AIMD 行内模板注入 grammar。
- `aimdSyntaxTheme`：默认语法高亮主题 token。
- `AIMD_SCOPES`：AIMD scope 标识列表。

### 工具函数

```ts
import {
  findVarTable,
  getSubvarDef,
  getSubvarNames,
  hasSubvars,
  isVarTableField,
  mergeVarTableInfo,
  normalizeSubvars,
  toTemplateEnv,
} from "@airalogy/aimd-core"
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `findVarTable` | `(fields, name) => AimdVarTableField \| undefined` | 通过名字从提取结果里查找 var_table。 |
| `getSubvarDef` | `(table, colId) => AimdSubvar \| undefined` | 获取 var_table 的某一列定义。 |
| `getSubvarNames` | `(table) => string[]` | 列出 var_table 的列 ID。 |
| `hasSubvars` | `(table) => boolean` | 判断 var_table 是否定义了列。 |
| `isVarTableField` | `(field) => boolean` | var_table 的类型守卫。 |
| `normalizeSubvars` | `(subvars) => AimdSubvar[]` | 把 subvar 定义标准化为规范格式。 |
| `toTemplateEnv` | `(fields) => AimdTemplateEnv` | 由提取结果构造模板环境。 |

### Quiz 评分

```ts
import {
  gradeQuizAnswer,
  gradeScaleQuizLocally,
  gradeQuizRecordAnswers,
  isScaleQuizAnswerComplete,
  resolveQuizMaxScore,
  type AimdQuizGradingConfig,
  type AimdQuizGradeResult,
  type AimdQuizGradeReport,
} from "@airalogy/aimd-core"
```

| API | 说明 |
|-----|------|
| `gradeQuizAnswer(quiz, answer, options?)` | 对单道题评分。支持 choice 和 `true_false` 精确匹配、可确定性量表本地求和/分组、填空题规范化/数值容差，以及开放题 rubric/provider 流程。 |
| `gradeScaleQuizLocally(quiz, answer)` | 对可确定性 `scale` 量表在前端本地求和评分，并可根据 `bands` 解析分组/分类。 |
| `gradeQuizRecordAnswers(fields.quiz, record.quiz, options?)` | 对整份 quiz 作答批量评分，返回 `{ quiz, summary }`，其中 `summary` 包含总分与复核数量。 |
| `isScaleQuizAnswerComplete(quiz, answer)` | 检查 `scale` 量表是否每个 item 都已选中合法选项，适合在决定是否显示本地得分前先判断。 |
| `resolveQuizMaxScore(quiz)` | 解析题目的最大分值；若未显式写 `score`，会按题型给出合理默认值。 |
| `AimdQuizGradingConfig` | `quiz.grading` 的类型，支持 `partial_credit`、`sum`、`normalized_match`、`keyword_rubric`、`llm_rubric` 等策略，以及量表 `bands` 元数据。 |
| `AimdQuizGradeResult` | 单题评分结果。包含 `earned_score`、`max_score`、`status`、`feedback`、`review_required` 等字段。 |

### Schema 工具

```ts
import {
  schemaToInputType,
  formatter,
  parser,
  validator,
  formatRawValue,
  convertToScientificString,
  isWipValue,
} from "@airalogy/aimd-core"
```

| 函数 | 说明 |
|------|------|
| `schemaToInputType(type)` | 把 AIMD var 类型（如 `str`、`int`、`float`、`bool`、`date`、`file`）映射成 HTML input 类型。 |
| `formatter(type, value)` | 按 AIMD 类型格式化展示值。 |
| `parser(type, raw)` | 将原始字符串解析为带类型的值。 |
| `validator(type, value)` | 按 AIMD 类型校验值，返回校验结果。 |
| `formatRawValue(value)` | 将原始值格式化为字符串。 |
| `isWipValue(value)` | 判断一个值是否为 work-in-progress 占位。 |

### 领域常量

```ts
import {
  scopeKeyRecord,
  scopeNameRecord,
  scopeColorRecord,
  getRecordDataKey,
  getSchemaKey,
} from "@airalogy/aimd-core"
```

### 关键类型

```ts
// remark-aimd 的提取结果
interface ExtractedAimdFields {
  var: string[]
  var_table: AimdVarTableField[]
  client_assigner: AimdClientAssignerField[]
  quiz: AimdQuizField[]
  step: string[]
  check: string[]
  ref_step: string[]
  ref_var: string[]
  ref_fig?: string[]
  cite?: string[]
  fig?: AimdFigField[]
  step_hierarchy?: AimdStepField[]
}

// 解析后的变量定义
interface AimdVarDefinition {
  id: string
  type?: string
  default?: string | number | boolean | null
  defaultRaw?: string
  required?: boolean
  subvars?: Record<string, AimdVarDefinition>
  kwargs?: Record<string, string | number | boolean>
  warnings?: string[]
}

// renderer 复用的 processor 选项
interface ProcessorOptions {
  mode?: "preview" | "edit" | "report"
  gfm?: boolean
  math?: boolean
  sanitize?: boolean
  breaks?: boolean
  quizPreview?: QuizPreviewOptions
}

// 题目预览控制
interface QuizPreviewOptions {
  showAnswers?: boolean
  showRubric?: boolean
}

// AIMD AST 节点联合类型
type AimdNode =
  | AimdVarNode
  | AimdVarTableNode
  | AimdQuizNode
  | AimdStepNode
  | AimdCheckNode
  | AimdRefNode
  | AimdCiteNode
  | AimdFigNode
```

---

## @airalogy/aimd-editor

Monaco 语言集成与 Vue WYSIWYG 编辑器。

### 入口

| 入口 | 路径 |
|------|------|
| Root | `@airalogy/aimd-editor`（同时导出 monaco + vue） |
| Monaco | `@airalogy/aimd-editor/monaco` |
| Vue | `@airalogy/aimd-editor/vue` |

### Monaco 集成

```ts
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"
```

| 导出 | 类型 | 说明 |
|------|------|------|
| `language` | `IMonarchLanguage` | AIMD 的 Monarch tokenizer 规则。 |
| `conf` | `LanguageConfiguration` | 语言配置（括号、注释、自动闭合等）。 |
| `completionItemProvider` | `CompletionItemProvider` | AIMD 字段语法自动补全。 |

### Monaco Theme

```ts
import { aimdTheme, aimdTokenColors, createAimdExtendedTheme } from "@airalogy/aimd-editor/monaco"
```

| 导出 | 说明 |
|------|------|
| `aimdTheme` | 独立 Monaco 主题定义。 |
| `aimdTokenColors` | AIMD scope 的 token 颜色映射。 |
| `createAimdExtendedTheme(base)` | 基于 `"vs"` 或 `"vs-dark"` 构造 AIMD 主题。 |

### Vue 编辑器组件

```ts
import { AimdEditor } from "@airalogy/aimd-editor"
```

**`AimdEditor`**：Vue 3 组件，支持源码模式（Monaco）与 WYSIWYG（Milkdown）模式。

Props：

| Prop | 类型 | 说明 |
|------|------|------|
| `modelValue` | `string` | AIMD 内容（`v-model`）。 |
| `locale` | `AimdEditorLocale` | `"en-US"` 或 `"zh-CN"`。 |
| `messages` | `AimdEditorMessagesInput` | 局部消息覆盖。 |

**`AimdFieldDialog`**：用于插入 AIMD 字段语法的弹窗组件。

### UI 元数据辅助函数

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  getDefaultAimdFields,
  buildAimdSyntax,
  getQuickAimdSyntax,
} from "@airalogy/aimd-editor"
```

| 函数 | 说明 |
|------|------|
| `createAimdEditorMessages(locale)` | 构造完整本地化消息集。 |
| `createAimdFieldTypes(messages)` | 为工具栏 UI 构造字段类型定义。 |
| `createMdToolbarItems(messages)` | 构造 Markdown 工具栏项定义。 |
| `getDefaultAimdFields()` | 获取默认字段定义。 |
| `buildAimdSyntax(fieldType, options)` | 根据结构化输入拼装 AIMD 语法字符串。 |
| `getQuickAimdSyntax(fieldType)` | 获取某个字段类型的最简语法片段。 |

### Milkdown 插件

```ts
import {
  aimdMilkdownPlugins,
  aimdRemarkPlugin,
  aimdFieldNode,
  aimdFieldView,
  aimdFieldInputRule,
} from "@airalogy/aimd-editor"
```

用于自定义 Milkdown 接入的底层导出。

### 本地化

```ts
import {
  createAimdEditorMessages,
  resolveAimdEditorLocale,
  DEFAULT_AIMD_EDITOR_LOCALE,
} from "@airalogy/aimd-editor"
```

| 类型 | 可选值 |
|------|--------|
| `AimdEditorLocale` | `"en-US" \| "zh-CN"` |

---

## @airalogy/aimd-renderer

用于渲染 AIMD 内容的 HTML / Vue 引擎。

### 入口

| 入口 | 路径 |
|------|------|
| Root | `@airalogy/aimd-renderer` |
| HTML | `@airalogy/aimd-renderer/html` |
| Vue | `@airalogy/aimd-renderer/vue` |
| Styles | `@airalogy/aimd-renderer/styles`（KaTeX CSS） |

### 渲染函数

```ts
import {
  renderToHtml,
  renderToHtmlSync,
  renderToVue,
  parseAndExtract,
  createCustomElementAimdRenderer,
  createRenderer,
  createHtmlProcessor,
  defaultRenderer,
} from "@airalogy/aimd-renderer"
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `renderToHtml` | `(content: string, options?: AimdRendererOptions) => Promise<{ html: string }>` | 异步 HTML 渲染，浏览器环境会自动加载公式样式。 |
| `renderToHtmlSync` | `(content: string, options?) => { html: string }` | 同步 HTML 渲染（不会自动加载公式样式）。 |
| `renderToVue` | `(content: string, options?) => Promise<RenderResult>` | 渲染为 Vue VNodes，返回 `{ nodes, fields }`。 |
| `parseAndExtract` | `(content: string) => ExtractedAimdFields` | 只解析并提取字段元数据，不做渲染。 |
| `createRenderer` | `(options?) => Processor` | 创建可复用的 unified processor。 |
| `createHtmlProcessor` | `(options?) => Processor` | 创建专用于 HTML 输出的 processor。 |

### Renderer 选项

```ts
interface AimdRendererOptions extends ProcessorOptions {
  assignerVisibility?: "hidden" | "collapsed" | "expanded"
  aimdElementRenderers?: Partial<Record<AimdFieldType, AimdHtmlNodeRenderer>>
  groupStepBodies?: boolean
  locale?: AimdRendererLocale
  messages?: AimdRendererMessagesInput
}
```

`createCustomElementAimdRenderer(tagName, mapProperties?, options?)` 可用于构造 HTML 节点 renderer，把 AIMD 元素映射成宿主自定义元素，同时保留默认 AIMD 元数据。

### Vue Renderer 工具

```ts
import {
  renderToVNodes,
  hastToVue,
  createComponentRenderer,
  createAssetRenderer,
  createCodeBlockRenderer,
  createEmbeddedRenderer,
  createMermaidRenderer,
  createStepCardRenderer,
} from "@airalogy/aimd-renderer"
```

| 函数 | 说明 |
|------|------|
| `renderToVNodes(hast, options)` | 将 HAST 树转换为带 AIMD 组件渲染逻辑的 Vue VNodes。 |
| `hastToVue(node)` | 将单个 HAST 节点转换为 Vue VNode。 |
| `createComponentRenderer(renderers)` | 根据字段类型处理器映射构造组件 renderer。 |
| `createAssetRenderer(resolver)` | 构造资源（图片 / 文件）renderer。 |
| `createCodeBlockRenderer(highlighter)` | 构造带语法高亮的代码块 renderer（基于 Shiki）。 |
| `createMermaidRenderer()` | 构造 Mermaid 图表 renderer。 |
| `createStepCardRenderer(options?)` | 构造可复用的 Vue step-card renderer。 |

### Unified Token Renderer

```ts
import { createUnifiedTokenRenderer } from "@airalogy/aimd-renderer"

type UnifiedTokenRendererOptions = {
  locale?: AimdRendererLocale
  messages?: AimdRendererMessagesInput
  highlighter?: ShikiHighlighter
  assetResolver?: AssetResolver
}
```

### 事件注入 Key

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

这些是 Vue `InjectionKey`，用于跨组件协调事件通道。

### 辅助函数

```ts
import { getFinalIndent, parseFieldTag } from "@airalogy/aimd-renderer"
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `getFinalIndent` | `(item: { parent?, sequence, level }) => string` | 计算嵌套步骤的显示缩进字符串，例如 `"1.2.3"`。 |
| `parseFieldTag` | `(template: string) => { type, name }[]` | 将 AIMD 模板 tag 字符串解析为 type / name 对。 |

### 本地化

```ts
import {
  createAimdRendererMessages,
  resolveAimdRendererLocale,
  getAimdRendererQuizTypeLabel,
  DEFAULT_AIMD_RENDERER_LOCALE,
} from "@airalogy/aimd-renderer"
```

| 类型 | 可选值 |
|------|--------|
| `AimdRendererLocale` | `"en-US" \| "zh-CN"` |

---

## @airalogy/aimd-recorder

用于结构化录入与记录的 Vue 组件。

### 入口

| 入口 | 路径 |
|------|------|
| Root | `@airalogy/aimd-recorder` |
| Components | `@airalogy/aimd-recorder/components` |
| Composables | `@airalogy/aimd-recorder/composables` |
| Styles | `@airalogy/aimd-recorder/styles`（recorder CSS） |

### 组件

```ts
import {
  AimdRecorder,
  AimdRecorderEditor,
  AimdQuizRecorder,
  AimdDnaSequenceField,
} from "@airalogy/aimd-recorder"
```

| 组件 | 说明 |
|------|------|
| `AimdRecorder` | 完整协议 recorder：在 AIMD 内容中内联渲染输入控件，也可以通过 `quizGrades` 显示题目得分、状态和反馈，并通过 `choiceOptionExplanationMode` / `submitted` 控制选择题讲解何时显示，还可以通过 `scaleGradeDisplayMode` 控制可确定性量表的本地评分何时显示。 |
| `AimdRecorderEditor` | 组合式 protocol 编辑 + recorder 录入界面。用 `v-model:content` 绑定源码、用 `v-model` 绑定 record，适合一边调整 AIMD 结构一边继续填数据，并内建 recorder field 结构编辑与 recorder 内可视化编辑能力。 |
| `AimdQuizRecorder` | 可独立复用的题目作答组件，支持 choice / true_false / blank / open / scale，也支持通过 `grade` 展示评分结果，并可按选中、提交后或评分后显示选择题选项讲解，还能控制量表本地评分的显示时机。 |
| `AimdDnaSequenceField` | 专用 DNA 序列输入控件，包含 SeqViz 视图、注释编辑与 GenBank 导入导出。 |

### 记录数据

```ts
import {
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
  type AimdStepOrCheckRecordItem,
} from "@airalogy/aimd-recorder"
```

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}

interface AimdStepOrCheckRecordItem {
  checked: boolean
  annotation: string
}

function createEmptyProtocolRecordData(): AimdProtocolRecordData
```

### 扩展类型

```ts
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderFieldAdapter,
  AimdRecorderFieldAdapterContext,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldType,
  FieldEventPayload,
  TableEventPayload,
} from "@airalogy/aimd-recorder"
```

| 类型 | 说明 |
|------|------|
| `AimdFieldMeta` | 每字段元数据：`inputType`、`required`、`pattern`、`enumOptions`、`disabled`、`placeholder`、`assigner`。 |
| `AimdFieldState` | 每字段运行时状态：`loading`、`error`、`validationError`、`disabled`。 |
| `AimdRecorderFieldType` | 内建 recorder 字段类型：`"var"`、`"var_table"`、`"step"`、`"check"`、`"quiz"`。 |
| `AimdRecorderFieldAdapterContext` | 宿主 adapter 上下文，包含解析后的 AIMD 节点、当前值、本地化消息、record 快照，以及 recorder 默认 vnode。 |
| `AimdRecorderFieldAdapter` | 用于替换或包裹 recorder 字段 vnode 的函数类型。 |
| `AimdRecorderFieldAdapters` | 按字段类型组织的 adapter 映射。 |
| `FieldEventPayload` | 字段事件载荷：`{ section, fieldKey, value? }`。 |
| `TableEventPayload` | 表格事件载荷：`{ tableName, rowIndex?, columns }`。 |

### DNA 序列类型

```ts
import type {
  AimdDnaSequenceValue,
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceSegment,
  AimdDnaSequenceQualifier,
} from "@airalogy/aimd-recorder"
```

### Composables：Record State

```ts
import {
  cloneRecordData,
  normalizeIncomingRecord,
  applyIncomingRecord,
  normalizeStepFields,
  normalizeCheckFields,
  normalizeQuizFields,
  normalizeVarTableFields,
  getQuizDefaultValue,
  ensureDefaultsFromFields,
  createEmptyVarTableRow,
  normalizeVarTableRows,
} from "@airalogy/aimd-recorder"
```

| 函数 | 说明 |
|------|------|
| `cloneRecordData(record)` | 深拷贝 record 数据对象。 |
| `normalizeIncomingRecord(record, fields)` | 根据提取字段结果标准化一个 record。 |
| `applyIncomingRecord(target, incoming, fields)` | 将传入 record 合并到目标 record。 |
| `ensureDefaultsFromFields(record, fields)` | 根据字段定义补齐缺失默认值。 |

### Composables：Var Helpers

```ts
import {
  normalizeVarTypeName,
  getVarInputKind,
  parseVarInputValue,
  getVarInputDisplayValue,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
} from "@airalogy/aimd-recorder"
```

| 函数 | 说明 |
|------|------|
| `normalizeVarTypeName(type)` | 将 AIMD var 类型名归一化为 recorder 使用的规范名字。 |
| `getVarInputKind(type)` | 将 AIMD var 类型映射为 recorder 输入控件类别。 |
| `parseVarInputValue(type, raw)` | 将用户输入解析成 recorder 存储值。 |
| `getVarInputDisplayValue(value, kind)` | 将 recorder 值格式化为可展示输入值。 |
| `unwrapStructuredValue(value)` | 取出结构化值中的原始标量部分。 |
| `toBooleanValue(value)` | 将未知值转换为布尔值。 |
| `toDateValue(value)` | 将未知值标准化为日期字符串。 |
| `formatDateTimeWithTimezone(date)` | 输出带时区偏移的日期时间字符串。 |

### 本地化

```ts
import {
  createAimdRecorderMessages,
  resolveAimdRecorderLocale,
  DEFAULT_AIMD_RECORDER_LOCALE,
} from "@airalogy/aimd-recorder"
```

| 类型 | 可选值 |
|------|--------|
| `AimdRecorderLocale` | `"en-US" \| "zh-CN"` |
