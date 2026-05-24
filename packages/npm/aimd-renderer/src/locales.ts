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
  assigner: {
    clientSummary: string
    serverSummary: string
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
  assigner: {
    clientSummary: "Client assigner",
    serverSummary: "Server assigner",
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
  assigner: {
    clientSummary: "前端 assigner",
    serverSummary: "服务端 assigner",
  },
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
