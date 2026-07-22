export type AimdRendererLocale = "en-US" | "zh-CN"

export const DEFAULT_AIMD_RENDERER_LOCALE: AimdRendererLocale = "en-US"

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K]
}

export interface AimdRendererMessages {
  scope: {
    var: string
    quiz: string
    step: string
    check: string
    table: string
    figure: string
    media: string
  }
  quiz: {
    types: {
      choice: string
      singleChoice: string
      multipleChoice: string
      trueFalse: string
      blank: string
      open: string
      scale: string
    }
    score: (score: string | number) => string
    answer: (value: string) => string
    rubric: (value: string) => string
  }
  step: {
    sequence: (step: string | number) => string
    reference: (step: string | number) => string
  }
  figure: {
    reference: (value: string | number) => string
    captionTitle: (sequence: number, title?: string) => string
  }
  media: {
    reference: (value: string | number, kind?: string) => string
    captionTitle: (sequence: number, title?: string, kind?: string) => string
    pin: string
    unpin: string
    pinSizeControls: string
    pinSizeSmall: string
    pinSizeMedium: string
    pinSizeLarge: string
    pinSizeSmallTitle: string
    pinSizeMediumTitle: string
    pinSizeLargeTitle: string
    showLegend: string
    hideLegend: string
    showLegendTitle: string
    hideLegendTitle: string
  }
  references: {
    title: string
  }
  assigner: {
    clientSummary: string
    serverSummary: string
  }
  recordView: {
    record: string
    field: string
    columns: string
    metadataColumns: string
    protocolColumns: string
    actions: string
    fieldId: string
    type: string
    description: string
    examples: string
    options: string
    fieldDetails: (label: string) => string
    selectAll: string
    yes: string
    no: string
    completed: string
    incomplete: string
    notRecorded: string
    missing: string
    emptyValue: string
    file: string
    noRecords: string
    compareAtLeastTwo: string
    showOnlyDifferences: string
    rows: (count: number) => string
    records: (count: number) => string
    selected: (count: number, limit: number) => string
    selectRecord: (label: string) => string
  }
}

export type AimdRendererMessagesInput = DeepPartial<AimdRendererMessages>

export interface AimdRendererI18nOptions {
  locale?: AimdRendererLocale | string
  messages?: AimdRendererMessagesInput
}

function detectRuntimeLocale(): string | undefined {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang)
      return htmlLang
  }

  if (typeof navigator !== "undefined") {
    if (navigator.language)
      return navigator.language
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0)
      return navigator.languages[0]
  }

  return undefined
}

const EN_US_MESSAGES: AimdRendererMessages = {
  scope: {
    var: "var",
    quiz: "quiz",
    step: "step",
    check: "check",
    table: "table",
    figure: "figure",
    media: "media",
  },
  quiz: {
    types: {
      choice: "choice",
      singleChoice: "Single choice",
      multipleChoice: "Multiple choice",
      trueFalse: "True/false",
      blank: "blank",
      open: "open",
      scale: "scale",
    },
    score: score => `${score} pt`,
    answer: value => `Answer: ${value}`,
    rubric: value => `Rubric: ${value}`,
  },
  step: {
    sequence: step => `Step ${step} :`,
    reference: step => `Step ${step}`,
  },
  figure: {
    reference: value => `figure ${value}`,
    captionTitle: (sequence, title) => title ? `figure ${sequence}: ${title}` : `figure ${sequence}`,
  },
  media: {
    reference: (value, kind) => `${getEnglishMediaKindLabel(kind)} ${value}`,
    captionTitle: (sequence, title, kind) => title ? `${getEnglishMediaKindLabel(kind)} ${sequence}: ${title}` : `${getEnglishMediaKindLabel(kind)} ${sequence}`,
    pin: "Pin",
    unpin: "Unpin",
    pinSizeControls: "Pinned media size",
    pinSizeSmall: "S",
    pinSizeMedium: "M",
    pinSizeLarge: "L",
    pinSizeSmallTitle: "Small pinned size",
    pinSizeMediumTitle: "Medium pinned size",
    pinSizeLargeTitle: "Large pinned size",
    showLegend: "Details",
    hideLegend: "Hide",
    showLegendTitle: "Show media description",
    hideLegendTitle: "Hide media description",
  },
  references: {
    title: "References",
  },
  assigner: {
    clientSummary: "Client assigner",
    serverSummary: "Server assigner",
  },
  recordView: {
    record: "Record",
    field: "Field",
    columns: "Columns",
    metadataColumns: "Record information",
    protocolColumns: "Protocol fields",
    actions: "Actions",
    fieldId: "Field",
    type: "Type",
    description: "Description",
    examples: "Examples",
    options: "Options",
    fieldDetails: label => `Show details for ${label}`,
    selectAll: "Select records on this page",
    yes: "Yes",
    no: "No",
    completed: "Completed",
    incomplete: "Incomplete",
    notRecorded: "Not recorded",
    missing: "Missing value",
    emptyValue: "—",
    file: "File",
    noRecords: "No records",
    compareAtLeastTwo: "Select at least two records to compare.",
    showOnlyDifferences: "Only show differences",
    rows: count => `${count} ${count === 1 ? "row" : "rows"}`,
    records: count => `${count} ${count === 1 ? "record" : "records"}`,
    selected: (count, limit) => limit > 0 ? `${count}/${limit} selected` : `${count} selected`,
    selectRecord: label => `Select ${label}`,
  },
}

const ZH_CN_MESSAGES: AimdRendererMessages = {
  scope: {
    var: "变量",
    quiz: "题目",
    step: "步骤",
    check: "检查点",
    table: "表格",
    figure: "图",
    media: "媒体",
  },
  quiz: {
    types: {
      choice: "选择",
      singleChoice: "单选",
      multipleChoice: "多选",
      trueFalse: "判断",
      blank: "填空",
      open: "开放",
      scale: "量表",
    },
    score: score => `${score} 分`,
    answer: value => `答案：${value}`,
    rubric: value => `评分标准：${value}`,
  },
  step: {
    sequence: step => `步骤 ${step}：`,
    reference: step => `步骤${step}`,
  },
  figure: {
    reference: value => `图 ${value}`,
    captionTitle: (sequence, title) => title ? `图 ${sequence}：${title}` : `图 ${sequence}`,
  },
  media: {
    reference: (value, kind) => `${getChineseMediaKindLabel(kind)} ${value}`,
    captionTitle: (sequence, title, kind) => title ? `${getChineseMediaKindLabel(kind)} ${sequence}：${title}` : `${getChineseMediaKindLabel(kind)} ${sequence}`,
    pin: "固定",
    unpin: "取消",
    pinSizeControls: "固定媒体尺寸",
    pinSizeSmall: "小",
    pinSizeMedium: "中",
    pinSizeLarge: "大",
    pinSizeSmallTitle: "小尺寸固定",
    pinSizeMediumTitle: "中尺寸固定",
    pinSizeLargeTitle: "大尺寸固定",
    showLegend: "说明",
    hideLegend: "收起",
    showLegendTitle: "展开媒体说明",
    hideLegendTitle: "收起媒体说明",
  },
  references: {
    title: "参考文献",
  },
  assigner: {
    clientSummary: "前端 assigner",
    serverSummary: "服务端 assigner",
  },
  recordView: {
    record: "记录",
    field: "字段",
    columns: "选择列",
    metadataColumns: "记录信息",
    protocolColumns: "协议字段",
    actions: "操作",
    fieldId: "字段",
    type: "类型",
    description: "说明",
    examples: "示例",
    options: "可选值",
    fieldDetails: label => `查看${label}的字段详情`,
    selectAll: "选择当前页记录",
    yes: "是",
    no: "否",
    completed: "已完成",
    incomplete: "未完成",
    notRecorded: "未记录",
    missing: "缺少数据",
    emptyValue: "—",
    file: "文件",
    noRecords: "暂无记录",
    compareAtLeastTwo: "请至少选择两条记录进行对比。",
    showOnlyDifferences: "仅显示差异",
    rows: count => `${count} 行`,
    records: count => `${count} 条记录`,
    selected: (count, limit) => limit > 0 ? `已选 ${count}/${limit} 条` : `已选 ${count} 条`,
    selectRecord: label => `选择${label}`,
  },
}

function normalizeMediaKindLabelKey(kind: string | undefined): "video" | "audio" | "file" {
  const normalized = (kind || "").trim().toLowerCase()
  if (normalized === "video" || normalized === "audio") {
    return normalized
  }
  return "file"
}

function getEnglishMediaKindLabel(kind: string | undefined): string {
  switch (normalizeMediaKindLabelKey(kind)) {
    case "video":
      return "Video"
    case "audio":
      return "Audio"
    case "file":
    default:
      return "Attachment"
  }
}

function getChineseMediaKindLabel(kind: string | undefined): string {
  switch (normalizeMediaKindLabelKey(kind)) {
    case "video":
      return "视频"
    case "audio":
      return "音频"
    case "file":
    default:
      return "附件"
  }
}

const BASE_MESSAGES: Record<AimdRendererLocale, AimdRendererMessages> = {
  "en-US": EN_US_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override)
    return base

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key]
    if (overrideValue === undefined)
      continue

    const baseValue = base[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key as string] = deepMerge(baseValue, overrideValue as any)
      continue
    }

    result[key as string] = overrideValue as T[keyof T]
  }

  return result as T
}

export function resolveAimdRendererLocale(locale?: string): AimdRendererLocale {
  const runtimeLocale = locale || detectRuntimeLocale()

  if (runtimeLocale?.toLowerCase().startsWith("zh")) {
    return "zh-CN"
  }

  return DEFAULT_AIMD_RENDERER_LOCALE
}

export function createAimdRendererMessages(
  locale: string | undefined,
  overrides?: AimdRendererMessagesInput,
): AimdRendererMessages {
  const resolvedLocale = resolveAimdRendererLocale(locale)
  const merged = deepMerge(BASE_MESSAGES[resolvedLocale], overrides)
  const choiceOverride = overrides?.quiz?.types?.choice
  const hasSingleChoiceOverride = overrides?.quiz?.types?.singleChoice !== undefined
  const hasMultipleChoiceOverride = overrides?.quiz?.types?.multipleChoice !== undefined

  if (typeof choiceOverride === "string") {
    if (!hasSingleChoiceOverride) {
      merged.quiz.types.singleChoice = choiceOverride
    }
    if (!hasMultipleChoiceOverride) {
      merged.quiz.types.multipleChoice = choiceOverride
    }
  }

  return merged
}

export function getAimdRendererScopeLabel(
  scope: string,
  messages: Pick<AimdRendererMessages, "scope">,
): string {
  switch (scope) {
    case "var":
      return messages.scope.var
    case "quiz":
      return messages.scope.quiz
    case "step":
      return messages.scope.step
    case "check":
      return messages.scope.check
    case "var_table":
      return messages.scope.table
    case "figure":
      return messages.scope.figure
    default:
      return scope
  }
}

export function getAimdRendererQuizTypeLabel(
  quizType: string | undefined,
  quizMode: string | undefined,
  messages: Pick<AimdRendererMessages, "quiz">,
): string {
  switch (quizType) {
    case "choice":
      if (quizMode === "single") {
        return messages.quiz.types.singleChoice
      }
      if (quizMode === "multiple") {
        return messages.quiz.types.multipleChoice
      }
      return messages.quiz.types.choice
    case "blank":
      return messages.quiz.types.blank
    case "true_false":
      return messages.quiz.types.trueFalse
    case "open":
      return messages.quiz.types.open
    case "scale":
      return messages.quiz.types.scale
    default:
      return quizType || messages.quiz.types.open
  }
}
