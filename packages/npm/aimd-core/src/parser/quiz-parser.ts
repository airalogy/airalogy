import type {
  AimdQuizBlank,
  AimdQuizFollowupField,
  AimdQuizFollowupType,
  AimdQuizMode,
  AimdQuizNode,
  AimdQuizOption,
  AimdQuizScaleItem,
  AimdQuizType,
  AimdScaleDisplay,
} from "../types/nodes"
import type { AimdQuizField } from "../types/aimd"
import type {
  AimdBlankQuizGradingConfig,
  AimdChoiceQuizGradingConfig,
  AimdOpenQuizGradingConfig,
  AimdQuizBlankGradingRule,
  AimdQuizGradingConfig,
  AimdQuizNumericRule,
  AimdQuizRubricItem,
  AimdQuizScaleBand,
  AimdScaleQuizGradingConfig,
  AimdQuizTextNormalizeRule,
} from "../types/grading"
import { parseDocument } from "yaml"

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g
const QUIZ_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const TRUE_FALSE_OPTION_KEYS = ["true", "false"] as const
const DEFAULT_TRUE_FALSE_OPTIONS: AimdQuizOption[] = [
  { key: "true", text: "True" },
  { key: "false", text: "False" },
]
const TEXT_NORMALIZE_RULES = new Set<AimdQuizTextNormalizeRule>([
  "trim",
  "lowercase",
  "collapse_whitespace",
  "remove_spaces",
  "fullwidth_to_halfwidth",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseQuizYamlMapping(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n?/g, "\n")

  const document = parseDocument(normalized, {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)

  if (document.errors.length > 0) {
    const firstError = document.errors[0]
    throw new Error(`Invalid quiz YAML: ${firstError.message}`)
  }

  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error("quiz block must be a YAML mapping/object")
  }

  return value
}

function normalizeQuizType(value: unknown): AimdQuizType {
  if (typeof value !== "string") {
    throw new Error("quiz type is required (choice, true_false, blank, open, scale)")
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "choice" || normalized === "true_false" || normalized === "blank" || normalized === "open" || normalized === "scale") {
    return normalized
  }
  throw new Error("Invalid quiz type, expected one of: choice, true_false, blank, open, scale")
}

function normalizeQuizKey(key: unknown, sectionName: string): string {
  const normalized = typeof key === "string" ? key.trim() : String(key ?? "").trim()
  if (!normalized) {
    throw new Error(`Each ${sectionName} item must include non-empty fields: key`)
  }
  if (!QUIZ_KEY_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid key in ${sectionName}: ${normalized}. Keys must start with a letter and contain only letters, digits, and underscores`,
    )
  }
  return normalized
}

function normalizeChoiceMode(value: unknown): AimdQuizMode {
  if (typeof value !== "string") {
    throw new Error("choice quiz requires mode (single or multiple)")
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "single" || normalized === "multiple") {
    return normalized
  }
  throw new Error("Invalid choice mode, expected one of: single, multiple")
}

function normalizeScaleDisplay(value: unknown): AimdScaleDisplay {
  if (typeof value !== "string") {
    throw new Error("scale display must be one of: matrix, list")
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "matrix" || normalized === "list") {
    return normalized
  }
  throw new Error("scale display must be one of: matrix, list")
}

function normalizeFollowupType(value: unknown, fieldName: string): AimdQuizFollowupType {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName}.type must be one of: str, int, float, bool`)
  }

  const normalized = value.trim()
  if (normalized === "str" || normalized === "int" || normalized === "float" || normalized === "bool") {
    return normalized
  }

  throw new Error(`${fieldName}.type must be one of: str, int, float, bool`)
}

function followupValueMatchesType(value: unknown, fieldType: AimdQuizFollowupType): boolean {
  switch (fieldType) {
    case "str":
      return typeof value === "string"
    case "int":
      return typeof value === "number" && Number.isInteger(value)
    case "float":
      return typeof value === "number" && Number.isFinite(value)
    case "bool":
      return typeof value === "boolean"
    default:
      return false
  }
}

function normalizeOptionFollowups(value: unknown, optionKey: string): AimdQuizFollowupField[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`options.${optionKey}.followups must be a non-empty list`)
  }

  const normalized: AimdQuizFollowupField[] = []
  const seenKeys = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error(`options.${optionKey}.followups must be a list of objects`)
    }

    const rawKey = typeof item.key === "string" ? item.key.trim() : ""
    if (!rawKey) {
      throw new Error(`Each options.${optionKey}.followups item must include a non-empty key`)
    }
    const key = normalizeQuizKey(rawKey, `options.${optionKey}.followups`)
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key in options.${optionKey}.followups: ${key}`)
    }
    seenKeys.add(key)

    const fieldType = normalizeFollowupType(item.type, `options.${optionKey}.followups.${key}`)
    const followup: AimdQuizFollowupField = {
      key,
      type: fieldType,
      required: true,
    }

    if (item.required !== undefined) {
      if (typeof item.required !== "boolean") {
        throw new Error(`options.${optionKey}.followups.${key}.required must be a boolean`)
      }
      followup.required = item.required
    }

    for (const field of ["title", "description", "unit"] as const) {
      const valueForField = item[field]
      if (valueForField === undefined || valueForField === null) {
        continue
      }
      if (typeof valueForField !== "string" || !valueForField.trim()) {
        throw new Error(`options.${optionKey}.followups.${key}.${field} must be a non-empty string`)
      }
      followup[field] = valueForField.trim()
    }

    if ("default" in item) {
      if (!followupValueMatchesType(item.default, fieldType)) {
        throw new Error(`options.${optionKey}.followups.${key}.default must match type ${fieldType}`)
      }
      followup.default = item.default as string | number | boolean
    }

    normalized.push(followup)
  }

  return normalized
}

function normalizeChoiceOptions(value: unknown): AimdQuizOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("options must be a non-empty list")
  }

  const normalized: AimdQuizOption[] = []
  const seenKeys = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error("options must be a list of objects")
    }

    const rawKey = typeof item.key === "string" ? item.key.trim() : ""
    const text = item.text === undefined || item.text === null
      ? ""
      : String(item.text).trim()
    if (!rawKey || !text) {
      throw new Error("Each options item must include non-empty fields: key, text")
    }
    const key = normalizeQuizKey(rawKey, "options")
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key in options: ${key}`)
    }
    seenKeys.add(key)

    const option: AimdQuizOption = { key, text }
    if (typeof item.explanation === "string" && item.explanation.trim()) {
      option.explanation = item.explanation.trim()
    }
    if (item.followups !== undefined) {
      option.followups = normalizeOptionFollowups(item.followups, key)
    }

    normalized.push(option)
  }

  return normalized
}

function normalizeTrueFalseOptionKey(value: unknown, fieldName: string): "true" | "false" {
  const normalized = typeof value === "boolean"
    ? String(value)
    : String(value ?? "").trim().toLowerCase()
  if (normalized === "true" || normalized === "false") {
    return normalized
  }
  throw new Error(`${fieldName} must be true or false`)
}

function normalizeTrueFalseOptions(value: unknown): AimdQuizOption[] {
  if (value === undefined) {
    return DEFAULT_TRUE_FALSE_OPTIONS.map(option => ({ ...option }))
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("true_false options must contain exactly two items: true and false")
  }

  const normalized: AimdQuizOption[] = []
  const seenKeys = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error("true_false options must be a list of objects")
    }

    const key = normalizeTrueFalseOptionKey(item.key, "true_false option key")
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key in true_false options: ${key}`)
    }
    seenKeys.add(key)

    const text = item.text === undefined || item.text === null
      ? ""
      : String(item.text).trim()
    if (!text) {
      throw new Error(`true_false options.${key}.text must be a non-empty string`)
    }

    const option: AimdQuizOption = { key, text }
    if (typeof item.explanation === "string" && item.explanation.trim()) {
      option.explanation = item.explanation.trim()
    }
    if (item.followups !== undefined) {
      option.followups = normalizeOptionFollowups(item.followups, key)
    }
    normalized.push(option)
  }

  for (const key of TRUE_FALSE_OPTION_KEYS) {
    if (!seenKeys.has(key)) {
      throw new Error("true_false options must include both true and false")
    }
  }

  return normalized
}

type NormalizedQuizKeyedItem<
  RequiredField extends string,
  OptionalField extends string = never,
> = {
  key: string
} & Record<RequiredField, string> & Partial<Record<OptionalField, string>>

function normalizeQuizKeyedItems<
  RequiredField extends string,
  OptionalField extends string = never,
>(
  value: unknown,
  sectionName: string,
  requiredFields: readonly ["key", ...RequiredField[]],
  optionalFields: readonly OptionalField[] = [],
): Array<NormalizedQuizKeyedItem<RequiredField, OptionalField>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${sectionName} must be a non-empty list`)
  }

  const normalizedItems: Array<NormalizedQuizKeyedItem<RequiredField, OptionalField>> = []
  const seenKeys = new Set<string>()

  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error(`${sectionName} must be a list of objects`)
    }

    const normalizedItem: Record<string, string> = {}
    for (const field of requiredFields) {
      const rawField = item[field]
      const normalizedField = rawField === undefined || rawField === null
        ? ""
        : String(rawField).trim()
      if (!normalizedField) {
        throw new Error(`Each ${sectionName} item must include non-empty fields: ${requiredFields.join(", ")}`)
      }
      normalizedItem[field] = normalizedField
    }

    for (const field of optionalFields) {
      const rawField = item[field]
      if (rawField === undefined || rawField === null) {
        continue
      }
      const normalizedField = String(rawField).trim()
      if (normalizedField) {
        normalizedItem[field] = normalizedField
      }
    }

    const itemKey = normalizedItem.key
    normalizeQuizKey(itemKey, sectionName)
    if (seenKeys.has(itemKey)) {
      throw new Error(`Duplicate key in ${sectionName}: ${itemKey}`)
    }
    seenKeys.add(itemKey)
    normalizedItems.push(normalizedItem as NormalizedQuizKeyedItem<RequiredField, OptionalField>)
  }

  return normalizedItems
}

function normalizeStringList(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty list of strings`)
  }

  const normalized: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${fieldName} must contain only non-empty strings`)
    }
    normalized.push(item.trim())
  }
  return normalized
}

function normalizeTextNormalizeRules(value: unknown, fieldName: string): AimdQuizTextNormalizeRule[] {
  const rules = normalizeStringList(value, fieldName)
  const normalized: AimdQuizTextNormalizeRule[] = []
  for (const rule of rules) {
    if (!TEXT_NORMALIZE_RULES.has(rule as AimdQuizTextNormalizeRule)) {
      throw new Error(`Invalid ${fieldName} item: ${rule}`)
    }
    normalized.push(rule as AimdQuizTextNormalizeRule)
  }
  return normalized
}

function normalizeNumericRule(value: unknown, fieldName: string): AimdQuizNumericRule {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be an object`)
  }

  const target = value.target
  if (typeof target !== "number" || Number.isNaN(target)) {
    throw new Error(`${fieldName}.target must be a number`)
  }

  const numericRule: AimdQuizNumericRule = { target }
  if (value.tolerance !== undefined) {
    if (typeof value.tolerance !== "number" || Number.isNaN(value.tolerance) || value.tolerance < 0) {
      throw new Error(`${fieldName}.tolerance must be a non-negative number`)
    }
    numericRule.tolerance = value.tolerance
  }
  if (value.unit !== undefined) {
    if (typeof value.unit !== "string" || !value.unit.trim()) {
      throw new Error(`${fieldName}.unit must be a non-empty string`)
    }
    numericRule.unit = value.unit.trim()
  }

  return numericRule
}

function normalizeBlankGradingRules(value: unknown, blankKeys: string[]): AimdQuizBlankGradingRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("grading.blanks must be a non-empty list")
  }

  const normalized: AimdQuizBlankGradingRule[] = []
  const seenKeys = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error("grading.blanks must be a list of objects")
    }
    const key = typeof item.key === "string" ? item.key.trim() : ""
    if (!key) {
      throw new Error("Each grading.blanks item must include a non-empty key")
    }
    if (!blankKeys.includes(key)) {
      throw new Error(`grading.blanks contains unknown blank key: ${key}`)
    }
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key in grading.blanks: ${key}`)
    }
    seenKeys.add(key)

    const rule: AimdQuizBlankGradingRule = { key }
    if (item.accepted_answers !== undefined) {
      rule.accepted_answers = normalizeStringList(item.accepted_answers, `grading.blanks.${key}.accepted_answers`)
    }
    if (item.normalize !== undefined) {
      rule.normalize = normalizeTextNormalizeRules(item.normalize, `grading.blanks.${key}.normalize`)
    }
    if (item.numeric !== undefined) {
      rule.numeric = normalizeNumericRule(item.numeric, `grading.blanks.${key}.numeric`)
    }
    normalized.push(rule)
  }
  return normalized
}

function normalizeRubricItems(value: unknown): AimdQuizRubricItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("grading.rubric_items must be a non-empty list")
  }

  const normalized: AimdQuizRubricItem[] = []
  const seenIds = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error("grading.rubric_items must be a list of objects")
    }
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const desc = typeof item.desc === "string" ? item.desc.trim() : ""
    const points = item.points

    if (!id) {
      throw new Error("Each grading.rubric_items item must include a non-empty id")
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate id in grading.rubric_items: ${id}`)
    }
    seenIds.add(id)
    if (!desc) {
      throw new Error(`grading.rubric_items.${id}.desc must be a non-empty string`)
    }
    if (typeof points !== "number" || Number.isNaN(points) || points < 0) {
      throw new Error(`grading.rubric_items.${id}.points must be a non-negative number`)
    }

    const rubricItem: AimdQuizRubricItem = { id, desc, points }
    if (item.keywords !== undefined) {
      rubricItem.keywords = normalizeStringList(item.keywords, `grading.rubric_items.${id}.keywords`)
    }
    normalized.push(rubricItem)
  }

  return normalized
}

function normalizeProviderName(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  return value.trim()
}

function normalizePrompt(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeChoiceOptionPoints(
  value: unknown,
  optionKeys: string[],
): Record<string, number> {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    throw new Error("grading.option_points must be a non-empty mapping from option key to score")
  }

  const normalized: Record<string, number> = {}
  for (const [key, scoreValue] of Object.entries(value)) {
    if (!optionKeys.includes(key)) {
      throw new Error(`grading.option_points contains unknown option key: ${key}`)
    }
    if (typeof scoreValue !== "number" || Number.isNaN(scoreValue) || !Number.isFinite(scoreValue)) {
      throw new Error(`grading.option_points.${key} must be a finite number`)
    }
    normalized[key] = scoreValue
  }

  return normalized
}

function normalizeScaleOptions(value: unknown): AimdQuizOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("options must be a non-empty list")
  }

  const normalized: AimdQuizOption[] = []
  const seenKeys = new Set<string>()
  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error("options must be a list of objects")
    }

    const rawKey = typeof item.key === "string" ? item.key.trim() : String(item.key ?? "").trim()
    const text = typeof item.text === "string" ? item.text.trim() : ""
    if (!rawKey || !text) {
      throw new Error("Each options item must include non-empty fields: key, text, points")
    }
    const key = normalizeQuizKey(rawKey, "options")
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key in options: ${key}`)
    }
    seenKeys.add(key)

    if (typeof item.points !== "number" || Number.isNaN(item.points) || !Number.isFinite(item.points)) {
      throw new Error(`options.${key}.points must be a finite number`)
    }

    const option: AimdQuizOption = {
      key,
      text,
      points: item.points,
    }
    if (typeof item.explanation === "string" && item.explanation.trim()) {
      option.explanation = item.explanation.trim()
    }
    normalized.push(option)
  }

  return normalized
}

function normalizeScaleBands(value: unknown): AimdQuizScaleBand[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("grading.bands must be a non-empty list")
  }

  const normalized: AimdQuizScaleBand[] = []
  for (const [index, item] of value.entries()) {
    if (!isPlainObject(item)) {
      throw new Error("grading.bands must be a list of objects")
    }
    const min = item.min
    const max = item.max
    const label = typeof item.label === "string" ? item.label.trim() : ""
    if (typeof min !== "number" || Number.isNaN(min) || !Number.isFinite(min)) {
      throw new Error(`grading.bands[${index}].min must be a finite number`)
    }
    if (typeof max !== "number" || Number.isNaN(max) || !Number.isFinite(max)) {
      throw new Error(`grading.bands[${index}].max must be a finite number`)
    }
    if (max < min) {
      throw new Error(`grading.bands[${index}].max must be greater than or equal to min`)
    }
    if (!label) {
      throw new Error(`grading.bands[${index}].label must be a non-empty string`)
    }

    const band: AimdQuizScaleBand = {
      min,
      max,
      label,
    }
    if (typeof item.interpretation === "string" && item.interpretation.trim()) {
      band.interpretation = item.interpretation.trim()
    }
    normalized.push(band)
  }

  return normalized
}

function normalizeGradingConfig(
  value: unknown,
  quizType: AimdQuizType,
  context: { blankKeys?: string[], optionKeys?: string[] } = {},
): AimdQuizGradingConfig {
  if (!isPlainObject(value)) {
    throw new Error("grading must be a YAML mapping/object")
  }

  const strategyValue = value.strategy
  const strategy = typeof strategyValue === "string" && strategyValue.trim()
    ? strategyValue.trim()
    : undefined

  if (quizType === "choice" || quizType === "true_false") {
    if (strategy !== undefined && strategy !== "auto" && strategy !== "exact_match" && strategy !== "partial_credit" && strategy !== "option_points") {
      throw new Error("choice/true_false grading.strategy must be one of: auto, exact_match, partial_credit, option_points")
    }
    if (quizType === "true_false" && strategy === "partial_credit") {
      throw new Error("true_false grading.strategy cannot be partial_credit")
    }
    const config: AimdChoiceQuizGradingConfig = {}
    if (strategy !== undefined) {
      config.strategy = strategy as AimdChoiceQuizGradingConfig["strategy"]
    }
    if (value.option_points !== undefined) {
      if (strategy !== undefined && strategy !== "auto" && strategy !== "option_points") {
        throw new Error("grading.option_points can only be used with choice grading strategy auto or option_points")
      }
      config.option_points = normalizeChoiceOptionPoints(value.option_points, context.optionKeys || [])
    }
    if (strategy === "option_points" && !config.option_points) {
      throw new Error("grading.option_points is required when choice grading.strategy is option_points")
    }
    return config
  }

  if (quizType === "scale") {
    if (strategy !== undefined && strategy !== "auto" && strategy !== "sum") {
      throw new Error("scale grading.strategy must be one of: auto, sum")
    }
    const config: AimdScaleQuizGradingConfig = {}
    if (strategy !== undefined) {
      config.strategy = strategy as AimdScaleQuizGradingConfig["strategy"]
    }
    if (value.bands !== undefined) {
      config.bands = normalizeScaleBands(value.bands)
    }
    return config
  }

  if (quizType === "blank") {
    if (strategy !== undefined && strategy !== "auto" && strategy !== "normalized_match" && strategy !== "llm") {
      throw new Error("blank grading.strategy must be one of: auto, normalized_match, llm")
    }
    const config: AimdBlankQuizGradingConfig = {}
    if (strategy !== undefined) {
      config.strategy = strategy as AimdBlankQuizGradingConfig["strategy"]
    }
    if (value.provider !== undefined) {
      config.provider = normalizeProviderName(value.provider, "grading.provider")
    }
    if (value.prompt !== undefined) {
      config.prompt = normalizePrompt(value.prompt, "grading.prompt")
    }
    if (value.blanks !== undefined) {
      config.blanks = normalizeBlankGradingRules(value.blanks, context.blankKeys || [])
    }
    return config
  }

  if (strategy !== undefined && strategy !== "manual" && strategy !== "keyword_rubric" && strategy !== "llm_rubric" && strategy !== "llm") {
    throw new Error("open grading.strategy must be one of: manual, keyword_rubric, llm_rubric, llm")
  }
  const config: AimdOpenQuizGradingConfig = {}
  if (strategy !== undefined) {
    config.strategy = strategy as AimdOpenQuizGradingConfig["strategy"]
  }
  if (value.provider !== undefined) {
    config.provider = normalizeProviderName(value.provider, "grading.provider")
  }
  if (value.prompt !== undefined) {
    config.prompt = normalizePrompt(value.prompt, "grading.prompt")
  }
  if (value.rubric_items !== undefined) {
    config.rubric_items = normalizeRubricItems(value.rubric_items)
  }
  if (value.require_review_below !== undefined) {
    const threshold = value.require_review_below
    if (typeof threshold !== "number" || Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
      throw new Error("grading.require_review_below must be a number between 0 and 1")
    }
    config.require_review_below = threshold
  }
  return config
}

function normalizeChoiceAnswer(
  value: unknown,
  mode: AimdQuizMode,
  optionKeys: string[],
  fieldName: "answer" | "default",
): string | string[] {
  if (mode === "single") {
    if (typeof value !== "string" || !optionKeys.includes(value)) {
      throw new Error(`single choice ${fieldName} must be one option key`)
    }
    return value
  }

  if (!Array.isArray(value)) {
    throw new Error(`multiple choice ${fieldName} must be a list of option keys`)
  }

  const normalized: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !optionKeys.includes(item)) {
      throw new Error(`multiple choice ${fieldName} must contain only option keys`)
    }
    normalized.push(item)
  }
  return normalized
}

function normalizeTrueFalseAnswer(
  value: unknown,
  fieldName: "answer" | "default",
): boolean {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") {
      return true
    }
    if (normalized === "false") {
      return false
    }
  }

  throw new Error(`true_false ${fieldName} must be true or false`)
}

function validateBlankPlaceholders(stem: string, blankKeys: string[]): void {
  const placeholderKeys = [...stem.matchAll(BLANK_PLACEHOLDER_PATTERN)].map(match => match[1])
  if (placeholderKeys.length === 0) {
    throw new Error("blank stem must include placeholders like [[b1]]")
  }

  const duplicates: string[] = []
  const seen = new Set<string>()
  for (const key of placeholderKeys) {
    if (seen.has(key) && !duplicates.includes(key)) {
      duplicates.push(key)
    }
    seen.add(key)
  }
  if (duplicates.length > 0) {
    throw new Error(`blank stem contains duplicate placeholders: ${duplicates.join(", ")}`)
  }

  const unknown = placeholderKeys.filter(key => !blankKeys.includes(key))
  if (unknown.length > 0) {
    throw new Error(`blank stem contains undefined placeholders: ${Array.from(new Set(unknown)).join(", ")}`)
  }

  const missing = blankKeys.filter(key => !seen.has(key))
  if (missing.length > 0) {
    throw new Error(`blank stem is missing placeholders for blank keys: ${missing.join(", ")}`)
  }
}

/**
 * Parse one `quiz` code block payload into AIMD node/field data.
 */
export function parseQuizContent(content: string): { node: AimdQuizNode, field: AimdQuizField } {
  const data = parseQuizYamlMapping(content)

  const idValue = data.id
  if (typeof idValue !== "string" || !idValue.trim()) {
    throw new Error("quiz id is required")
  }
  const id = idValue.trim()

  const quizType = normalizeQuizType(data.type)

  const stemValue = data.stem
  if (typeof stemValue !== "string" || !stemValue.trim()) {
    throw new Error("quiz stem is required")
  }
  const stem = stemValue.trim()

  const scoreValue = data.score
  let score: number | undefined
  if (scoreValue !== undefined) {
    if (typeof scoreValue !== "number" || Number.isNaN(scoreValue) || scoreValue < 0) {
      throw new Error("quiz score must be a non-negative number")
    }
    score = scoreValue
  }

  const titleValue = data.title
  if (titleValue !== undefined && (typeof titleValue !== "string" || !titleValue.trim())) {
    throw new Error("quiz title must be a non-empty string")
  }
  const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : undefined

  const descriptionValue = data.description
  if (descriptionValue !== undefined && (typeof descriptionValue !== "string" || !descriptionValue.trim())) {
    throw new Error("quiz description must be a non-empty string")
  }
  const description = typeof descriptionValue === "string" && descriptionValue.trim()
    ? descriptionValue.trim()
    : undefined

  const field: AimdQuizField = {
    id,
    type: quizType,
    stem,
  }
  const node: AimdQuizNode = {
    type: "aimd",
    fieldType: "quiz",
    id,
    scope: "quiz",
    raw: content,
    quizType,
    stem,
  }

  if (score !== undefined) {
    field.score = score
    node.score = score
  }
  if (title) {
    field.title = title
    node.title = title
  }
  if (description) {
    field.description = description
    node.description = description
  }

  if (quizType === "choice") {
    const mode = normalizeChoiceMode(data.mode)
    const options = normalizeChoiceOptions(data.options)
    const optionKeys = options.map(option => option.key)

    const answerValue = data.answer
    if (answerValue !== undefined) {
      const normalizedAnswer = normalizeChoiceAnswer(answerValue, mode, optionKeys, "answer")
      field.answer = normalizedAnswer
      node.answer = normalizedAnswer
    }

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      const normalizedDefault = normalizeChoiceAnswer(defaultValue, mode, optionKeys, "default")
      field.default = normalizedDefault
      node.default = normalizedDefault
    }

    field.mode = mode
    field.options = options
    node.mode = mode
    node.options = options
    if (data.grading !== undefined) {
      const grading = normalizeGradingConfig(data.grading, quizType, { optionKeys })
      field.grading = grading
      node.grading = grading
    }

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "mode",
      "options",
      "answer",
      "default",
      "grading",
      "title",
      "description",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  if (quizType === "true_false") {
    const options = normalizeTrueFalseOptions(data.options)
    const optionKeys = options.map(option => option.key)

    const answerValue = data.answer
    if (answerValue !== undefined) {
      const normalizedAnswer = normalizeTrueFalseAnswer(answerValue, "answer")
      field.answer = normalizedAnswer
      node.answer = normalizedAnswer
    }

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      const normalizedDefault = normalizeTrueFalseAnswer(defaultValue, "default")
      field.default = normalizedDefault
      node.default = normalizedDefault
    }

    field.mode = "single"
    field.options = options
    node.mode = "single"
    node.options = options
    if (data.grading !== undefined) {
      const grading = normalizeGradingConfig(data.grading, quizType, { optionKeys })
      field.grading = grading
      node.grading = grading
    }

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "options",
      "answer",
      "default",
      "grading",
      "title",
      "description",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  if (quizType === "scale") {
    const items: AimdQuizScaleItem[] = normalizeQuizKeyedItems(
      data.items,
      "items",
      ["key", "stem"] as const,
      ["description"] as const,
    )
    const itemKeys = items.map(item => item.key)
    const options = normalizeScaleOptions(data.options)
    const optionKeys = options.map(option => option.key)

    const displayValue = data.display
    const display = displayValue === undefined ? "matrix" : normalizeScaleDisplay(displayValue)

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      if (!isPlainObject(defaultValue)) {
        throw new Error("scale default must be a dict keyed by item key")
      }
      const parsedDefault: Record<string, string> = {}
      for (const [itemKey, value] of Object.entries(defaultValue)) {
        if (!itemKeys.includes(itemKey)) {
          throw new Error(`scale default contains unknown item key: ${itemKey}`)
        }
        if (typeof value !== "string" || !optionKeys.includes(value)) {
          throw new Error(`scale default value for ${itemKey} must be one option key`)
        }
        parsedDefault[itemKey] = value
      }
      field.default = parsedDefault
      node.default = parsedDefault
    }

    field.display = display
    field.items = items
    field.options = options
    node.display = display
    node.items = items
    node.options = options
    if (data.grading !== undefined) {
      const grading = normalizeGradingConfig(data.grading, quizType, { optionKeys })
      field.grading = grading
      node.grading = grading
    }

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "display",
      "items",
      "options",
      "default",
      "grading",
      "title",
      "description",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  if (quizType === "blank") {
    const blanks: AimdQuizBlank[] = normalizeQuizKeyedItems(
      data.blanks,
      "blanks",
      ["key", "answer"] as const,
    )
    const blankKeys = blanks.map(blank => blank.key)
    validateBlankPlaceholders(stem, blankKeys)

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      let normalizedDefault: Record<string, string> | undefined
      if (typeof defaultValue === "string" && blankKeys.length === 1) {
        normalizedDefault = { [blankKeys[0]]: defaultValue }
      }
      else if (isPlainObject(defaultValue)) {
        const parsedDefault: Record<string, string> = {}
        for (const [key, value] of Object.entries(defaultValue)) {
          if (!blankKeys.includes(key)) {
            throw new Error("blank default contains unknown blank keys")
          }
          if (typeof value !== "string") {
            throw new Error("blank default values must be strings")
          }
          parsedDefault[key] = value
        }
        normalizedDefault = parsedDefault
      }
      else {
        throw new Error("blank default must be a dict keyed by blank key")
      }

      field.default = normalizedDefault
      node.default = normalizedDefault
    }

    field.blanks = blanks
    node.blanks = blanks
    if (data.grading !== undefined) {
      const grading = normalizeGradingConfig(data.grading, quizType, { blankKeys })
      field.grading = grading
      node.grading = grading
    }

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "blanks",
      "default",
      "grading",
      "title",
      "description",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  const rubricValue = data.rubric
  if (rubricValue !== undefined) {
    if (typeof rubricValue !== "string") {
      throw new Error("open rubric must be a string")
    }
    field.rubric = rubricValue
    node.rubric = rubricValue
  }

  const defaultValue = data.default
  if (defaultValue !== undefined) {
    if (typeof defaultValue !== "string") {
      throw new Error("open default must be a string")
    }
    field.default = defaultValue
    node.default = defaultValue
  }
  if (data.grading !== undefined) {
    const grading = normalizeGradingConfig(data.grading, quizType)
    field.grading = grading
    node.grading = grading
  }

  const reservedKeys = new Set([
    "id",
    "type",
    "stem",
    "score",
    "rubric",
    "default",
    "grading",
    "title",
    "description",
  ])
  const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
  if (extraEntries.length > 0) {
    const extra = Object.fromEntries(extraEntries)
    field.extra = extra
    node.extra = extra
  }

  return { node, field }
}
