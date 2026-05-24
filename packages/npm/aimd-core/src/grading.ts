import type { AimdQuizField } from "./types/aimd"
import type {
  AimdBlankQuizGradingConfig,
  AimdChoiceQuizGradingConfig,
  AimdOpenQuizGradingConfig,
  AimdQuizBlankGradeDetail,
  AimdQuizBlankGradingRule,
  AimdQuizGradeMethod,
  AimdQuizGradeReport,
  AimdQuizGradeResult,
  AimdQuizGradeSummary,
  AimdQuizGradingConfig,
  AimdQuizGradingOptions,
  AimdQuizRubricItem,
  AimdQuizRubricItemGradeDetail,
  AimdQuizScaleBandMatch,
  AimdScaleQuizGradingConfig,
  AimdQuizTextNormalizeRule,
} from "./types/grading"

const DEFAULT_BLANK_NORMALIZE: AimdQuizTextNormalizeRule[] = ["trim", "collapse_whitespace"]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000
}

function fullwidthToHalfwidth(value: string): string {
  let result = ""
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code === 0x3000) {
      result += " "
    }
    else if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCharCode(code - 0xfee0)
    }
    else {
      result += char
    }
  }
  return result
}

function normalizeText(value: string, rules: AimdQuizTextNormalizeRule[] = []): string {
  let normalized = value
  for (const rule of rules) {
    switch (rule) {
      case "trim":
        normalized = normalized.trim()
        break
      case "lowercase":
        normalized = normalized.toLowerCase()
        break
      case "collapse_whitespace":
        normalized = normalized.replace(/\s+/g, " ")
        break
      case "remove_spaces":
        normalized = normalized.replace(/\s+/g, "")
        break
      case "fullwidth_to_halfwidth":
        normalized = fullwidthToHalfwidth(normalized)
        break
      default:
        break
    }
  }
  return normalized
}

function normalizeBlankRule(blank: { key: string, answer: string }, rule?: AimdQuizBlankGradingRule): AimdQuizBlankGradingRule {
  const normalize = Array.isArray(rule?.normalize) && rule.normalize.length > 0
    ? rule.normalize
    : DEFAULT_BLANK_NORMALIZE

  const acceptedAnswers = Array.isArray(rule?.accepted_answers) && rule.accepted_answers.length > 0
    ? rule.accepted_answers
    : [blank.answer]

  return {
    key: blank.key,
    accepted_answers: acceptedAnswers,
    normalize,
    numeric: rule?.numeric,
  }
}

function parseNumberishValue(value: string, unit?: string): number | null {
  let normalized = fullwidthToHalfwidth(value).trim()
  if (!normalized) {
    return null
  }

  if (unit) {
    const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    normalized = normalized.replace(new RegExp(`\\s*${escapedUnit}\\s*$`, "i"), "")
  }

  normalized = normalized.replace(/,/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function inferStatus(earnedScore: number, maxScore: number): AimdQuizGradeResult["status"] {
  if (maxScore <= 0) {
    return "ungraded"
  }
  if (earnedScore >= maxScore) {
    return "correct"
  }
  if (earnedScore <= 0) {
    return "incorrect"
  }
  return "partial"
}

function normalizeProviderResult(
  quiz: AimdQuizField,
  maxScore: number,
  fallbackMethod: AimdQuizGradeMethod,
  fallbackProvider: string | undefined,
  result: AimdQuizGradeResult | null | undefined,
): AimdQuizGradeResult {
  if (!result) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "needs_review",
      method: fallbackMethod,
      provider: fallbackProvider,
      review_required: true,
      feedback: "A grading provider was requested but no result was returned.",
    }
  }

  if (typeof result !== "object" || Array.isArray(result)) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "needs_review",
      method: fallbackMethod,
      provider: fallbackProvider,
      review_required: true,
      feedback: "A grading provider must return a structured result object.",
    }
  }

  const normalizedMax = isFiniteNumber(result.max_score) ? result.max_score : maxScore
  const normalizedEarned = clamp(
    isFiniteNumber(result.earned_score) ? result.earned_score : 0,
    0,
    normalizedMax,
  )
  const normalizedStatus = result.status || inferStatus(normalizedEarned, normalizedMax)

  return {
    ...result,
    quiz_id: result.quiz_id || quiz.id,
    earned_score: roundScore(normalizedEarned),
    max_score: roundScore(normalizedMax),
    method: result.method || fallbackMethod,
    status: normalizedStatus,
    provider: result.provider || fallbackProvider,
    review_required: Boolean(result.review_required ?? normalizedStatus === "needs_review"),
  }
}

function getProviderName(config: AimdQuizGradingConfig | undefined): string | undefined {
  if (!config || typeof config !== "object") {
    return undefined
  }

  if ("provider" in config && typeof config.provider === "string" && config.provider.trim()) {
    return config.provider
  }

  return undefined
}

function getChoiceOptionPoints(
  config: AimdChoiceQuizGradingConfig | undefined,
): Record<string, number> | undefined {
  if (!config?.option_points || typeof config.option_points !== "object") {
    return undefined
  }
  return config.option_points
}

function getChoiceScoringStrategy(
  config: AimdChoiceQuizGradingConfig | undefined,
): NonNullable<AimdChoiceQuizGradingConfig["strategy"]> {
  if (config?.strategy && config.strategy !== "auto") {
    return config.strategy
  }
  return getChoiceOptionPoints(config) ? "option_points" : "exact_match"
}

function optionTemplateHasFollowups(quiz: AimdQuizField): boolean {
  return (quiz.type === "choice" || quiz.type === "true_false")
    && Array.isArray(quiz.options)
    && quiz.options.some(option => Array.isArray(option.followups) && option.followups.length > 0)
}

function isOptionBasedQuiz(quiz: AimdQuizField): boolean {
  return quiz.type === "choice" || quiz.type === "true_false"
}

function getOptionSelectedAnswer(quiz: AimdQuizField, answer: unknown): unknown {
  if (
    optionTemplateHasFollowups(quiz)
    && typeof answer === "object"
    && answer !== null
    && !Array.isArray(answer)
  ) {
    return (answer as Record<string, unknown>).selected
  }

  return answer
}

function resolveChoiceOptionPointsMaxScore(
  quiz: AimdQuizField,
  config: AimdChoiceQuizGradingConfig | undefined,
): number | null {
  const optionPoints = getChoiceOptionPoints(config)
  if (!optionPoints || !isOptionBasedQuiz(quiz) || !Array.isArray(quiz.options) || quiz.options.length === 0) {
    return null
  }

  const scores = quiz.options.map(option => {
    const value = optionPoints[option.key]
    return isFiniteNumber(value) ? value : 0
  })

  if (quiz.type === "true_false" || quiz.mode === "single") {
    return roundScore(Math.max(0, ...scores))
  }

  const total = scores.reduce((sum, value) => sum + (value > 0 ? value : 0), 0)
  return roundScore(Math.max(0, total))
}

function normalizeTrueFalseAnswerKey(answer: unknown): "true" | "false" | null {
  if (typeof answer === "boolean") {
    return String(answer) as "true" | "false"
  }

  if (typeof answer === "string") {
    const normalized = answer.trim().toLowerCase()
    if (normalized === "true" || normalized === "false") {
      return normalized
    }
  }

  return null
}

function getScaleScoringStrategy(
  config: AimdScaleQuizGradingConfig | undefined,
): NonNullable<AimdScaleQuizGradingConfig["strategy"]> {
  if (config?.strategy && config.strategy !== "auto") {
    return config.strategy
  }
  return "sum"
}

function resolveScaleMaxScore(quiz: AimdQuizField): number | null {
  if (quiz.type !== "scale" || !Array.isArray(quiz.items) || quiz.items.length === 0 || !Array.isArray(quiz.options) || quiz.options.length === 0) {
    return null
  }

  const maxPerItem = Math.max(0, ...quiz.options.map(option => isFiniteNumber(option.points) ? option.points : 0))
  return roundScore(maxPerItem * quiz.items.length)
}

function asScaleAnswerMap(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const normalized: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      normalized[key] = item
    }
  }
  return normalized
}

export function isScaleQuizAnswerComplete(quiz: AimdQuizField, answer: unknown): boolean {
  if (quiz.type !== "scale" || !Array.isArray(quiz.items) || quiz.items.length === 0) {
    return false
  }

  const answerMap = asScaleAnswerMap(answer)
  if (!answerMap) {
    return false
  }

  return quiz.items.every(item => typeof answerMap[item.key] === "string" && answerMap[item.key].trim().length > 0)
}

function resolveScaleBand(
  score: number,
  config: AimdScaleQuizGradingConfig | undefined,
): AimdQuizScaleBandMatch | undefined {
  const band = config?.bands?.find(candidate => score >= candidate.min && score <= candidate.max)
  return band ? { ...band } : undefined
}

export function gradeScaleQuizLocally(
  quiz: AimdQuizField,
  answer: unknown,
): AimdQuizGradeResult {
  const maxScore = resolveQuizMaxScore(quiz)

  if (quiz.type !== "scale") {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "Local scale grading expects a scale quiz definition.",
    }
  }

  if (!Array.isArray(quiz.items) || quiz.items.length === 0) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
      feedback: "This scale does not define any items.",
    }
  }

  if (!Array.isArray(quiz.options) || quiz.options.length === 0) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
      feedback: "This scale does not define any answer options.",
    }
  }

  const answerMap = asScaleAnswerMap(answer)
  if (!answerMap) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "Scale grading expects a dict keyed by item key.",
    }
  }

  const optionPoints = new Map(
    quiz.options.map(option => [option.key, isFiniteNumber(option.points) ? option.points : 0]),
  )

  const missingItems = quiz.items.filter(item => !answerMap[item.key]?.trim())
  if (missingItems.length > 0) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "scale_sum",
      feedback: `This scale is incomplete (${quiz.items.length - missingItems.length} / ${quiz.items.length} item(s) answered).`,
    }
  }

  for (const item of quiz.items) {
    const selectedKey = answerMap[item.key]
    if (!optionPoints.has(selectedKey)) {
      return {
        quiz_id: quiz.id,
        earned_score: 0,
        max_score: maxScore,
        status: "error",
        method: "invalid_answer",
        feedback: `Scale answer for ${quiz.id}.${item.key} must be one option key.`,
      }
    }
  }

  const config = quiz.grading as AimdScaleQuizGradingConfig | undefined
  const strategy = getScaleScoringStrategy(config)
  if (strategy !== "sum") {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: `Unsupported scale grading strategy: ${strategy}.`,
    }
  }

  const earnedScore = roundScore(quiz.items.reduce((sum, item) => sum + (optionPoints.get(answerMap[item.key]) ?? 0), 0))
  const band = resolveScaleBand(earnedScore, config)
  return {
    quiz_id: quiz.id,
    earned_score: earnedScore,
    max_score: maxScore,
    status: "scored",
    method: "scale_sum",
    band,
  }
}

async function requestProviderGrade(
  quiz: AimdQuizField,
  answer: unknown,
  config: AimdQuizGradingConfig | undefined,
  maxScore: number,
  fallbackMethod: AimdQuizGradeMethod,
  options: AimdQuizGradingOptions,
): Promise<AimdQuizGradeResult> {
  if (!options.provider) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "needs_review",
      method: fallbackMethod,
      provider: getProviderName(config),
      review_required: true,
      feedback: "This quiz requires an external grading provider.",
    }
  }

  const providerResult = await options.provider({
    quiz,
    answer,
    config,
    max_score: maxScore,
  })

  return normalizeProviderResult(
    quiz,
    maxScore,
    fallbackMethod,
    getProviderName(config),
    providerResult,
  )
}

export function resolveQuizMaxScore(quiz: AimdQuizField): number {
  if (isFiniteNumber(quiz.score) && quiz.score >= 0) {
    return roundScore(quiz.score)
  }

  if (isOptionBasedQuiz(quiz)) {
    const inferredChoiceScore = resolveChoiceOptionPointsMaxScore(
      quiz,
      quiz.grading as AimdChoiceQuizGradingConfig | undefined,
    )
    if (inferredChoiceScore !== null) {
      return inferredChoiceScore
    }
  }

  if (quiz.type === "scale") {
    const inferredScaleScore = resolveScaleMaxScore(quiz)
    if (inferredScaleScore !== null) {
      return inferredScaleScore
    }
  }

  if (quiz.type === "blank" && Array.isArray(quiz.blanks) && quiz.blanks.length > 0) {
    return quiz.blanks.length
  }

  if (quiz.type === "open") {
    const rubricItems = (quiz.grading as AimdOpenQuizGradingConfig | undefined)?.rubric_items
    if (Array.isArray(rubricItems) && rubricItems.length > 0) {
      return roundScore(rubricItems.reduce((total, item) => total + (isFiniteNumber(item.points) ? item.points : 0), 0))
    }
  }

  return 1
}

function isUnansweredQuizAnswer(quiz: AimdQuizField, answer: unknown): boolean {
  if (answer === undefined || answer === null) {
    return true
  }

  if (quiz.type === "choice") {
    const selectedAnswer = getOptionSelectedAnswer(quiz, answer)
    if (quiz.mode === "single") {
      return typeof selectedAnswer === "string" && selectedAnswer.trim().length === 0
    }
    if (quiz.mode === "multiple") {
      return Array.isArray(selectedAnswer)
        && selectedAnswer.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length === 0
    }
    return false
  }

  if (quiz.type === "true_false") {
    const selectedAnswer = getOptionSelectedAnswer(quiz, answer)
    if (selectedAnswer === undefined || selectedAnswer === null) {
      return true
    }
    return typeof selectedAnswer === "string" && selectedAnswer.trim().length === 0
  }

  if (quiz.type === "blank") {
    if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
      return false
    }
    return Object.values(answer).every(value => typeof value !== "string" || value.trim().length === 0)
  }

  if (quiz.type === "scale") {
    const answerMap = asScaleAnswerMap(answer)
    if (!answerMap) {
      return false
    }
    return Object.values(answerMap).every(value => value.trim().length === 0)
  }

  if (quiz.type === "open") {
    return typeof answer === "string" && answer.trim().length === 0
  }

  return false
}

function gradeChoiceQuiz(
  quiz: AimdQuizField,
  answer: unknown,
  maxScore: number,
): AimdQuizGradeResult {
  const config = quiz.grading as AimdChoiceQuizGradingConfig | undefined
  const strategy = getChoiceScoringStrategy(config)
  const optionPoints = getChoiceOptionPoints(config)
  const selectedAnswer = getOptionSelectedAnswer(quiz, answer)

  if (quiz.mode === "single") {
    if (typeof selectedAnswer !== "string") {
      return {
        quiz_id: quiz.id,
        earned_score: 0,
        max_score: maxScore,
        status: "error",
        method: "invalid_answer",
        feedback: "Choice(single) grading expects a string option key.",
      }
    }

    if (strategy === "option_points") {
      const rawScore = optionPoints?.[selectedAnswer] ?? 0
      const earnedScore = roundScore(clamp(isFiniteNumber(rawScore) ? rawScore : 0, 0, maxScore))
      return {
        quiz_id: quiz.id,
        earned_score: earnedScore,
        max_score: maxScore,
        status: inferStatus(earnedScore, maxScore),
        method: "option_points",
      }
    }

    const officialAnswer = quiz.answer
    if (officialAnswer === undefined) {
      return {
        quiz_id: quiz.id,
        earned_score: 0,
        max_score: maxScore,
        status: "ungraded",
        method: "manual",
        feedback: "This choice quiz does not define an answer key.",
      }
    }

    const correct = typeof officialAnswer === "string" && selectedAnswer === officialAnswer
    return {
      quiz_id: quiz.id,
      earned_score: correct ? maxScore : 0,
      max_score: maxScore,
      status: correct ? "correct" : "incorrect",
      method: "exact_match",
    }
  }

  if (!Array.isArray(selectedAnswer)) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "Choice(multiple) grading expects a list of option keys.",
    }
  }

  const selected = new Set(selectedAnswer.filter((item): item is string => typeof item === "string"))

  if (strategy === "option_points") {
    const rawScore = [...selected].reduce((sum, key) => {
      const value = optionPoints?.[key] ?? 0
      return sum + (isFiniteNumber(value) ? value : 0)
    }, 0)
    const earnedScore = roundScore(clamp(rawScore, 0, maxScore))
    return {
      quiz_id: quiz.id,
      earned_score: earnedScore,
      max_score: maxScore,
      status: inferStatus(earnedScore, maxScore),
      method: "option_points",
      feedback: rawScore !== earnedScore
        ? `Selected option scores totaled ${roundScore(rawScore)} before score limits were applied.`
        : undefined,
    }
  }

  const officialAnswer = quiz.answer
  if (officialAnswer === undefined) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
      feedback: "This choice quiz does not define an answer key.",
    }
  }

  const expected = new Set(Array.isArray(officialAnswer) ? officialAnswer.filter((item): item is string => typeof item === "string") : [])

  if (strategy === "partial_credit") {
    const correctSelections = [...selected].filter(item => expected.has(item)).length
    const wrongSelections = [...selected].filter(item => !expected.has(item)).length
    const denominator = expected.size || 1
    const rawFraction = (correctSelections - wrongSelections) / denominator
    const earnedScore = roundScore(clamp(rawFraction, 0, 1) * maxScore)
    return {
      quiz_id: quiz.id,
      earned_score: earnedScore,
      max_score: maxScore,
      status: inferStatus(earnedScore, maxScore),
      method: "partial_credit",
      feedback: earnedScore > 0 && earnedScore < maxScore
        ? `Matched ${correctSelections} correct option(s) with ${wrongSelections} wrong selection(s).`
        : undefined,
    }
  }

  const exactMatch = selected.size === expected.size && [...expected].every(item => selected.has(item))
  return {
    quiz_id: quiz.id,
    earned_score: exactMatch ? maxScore : 0,
    max_score: maxScore,
    status: exactMatch ? "correct" : "incorrect",
    method: "exact_match",
  }
}

function gradeTrueFalseQuiz(
  quiz: AimdQuizField,
  answer: unknown,
  maxScore: number,
): AimdQuizGradeResult {
  const config = quiz.grading as AimdChoiceQuizGradingConfig | undefined
  const strategy = getChoiceScoringStrategy(config)
  const optionPoints = getChoiceOptionPoints(config)
  const selectedKey = normalizeTrueFalseAnswerKey(getOptionSelectedAnswer(quiz, answer))

  if (!selectedKey) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "True/false grading expects a boolean answer or a structured answer with selected.",
    }
  }

  if (strategy === "option_points") {
    const rawScore = optionPoints?.[selectedKey] ?? 0
    const earnedScore = roundScore(clamp(isFiniteNumber(rawScore) ? rawScore : 0, 0, maxScore))
    return {
      quiz_id: quiz.id,
      earned_score: earnedScore,
      max_score: maxScore,
      status: inferStatus(earnedScore, maxScore),
      method: "option_points",
    }
  }

  const officialKey = normalizeTrueFalseAnswerKey(quiz.answer)
  if (!officialKey) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
      feedback: "This true/false quiz does not define an answer key.",
    }
  }

  const correct = selectedKey === officialKey
  return {
    quiz_id: quiz.id,
    earned_score: correct ? maxScore : 0,
    max_score: maxScore,
    status: correct ? "correct" : "incorrect",
    method: "exact_match",
  }
}

function matchBlankValue(
  value: string,
  rule: AimdQuizBlankGradingRule,
): { matched: boolean, method: AimdQuizGradeMethod, matchedValue?: string } {
  const normalizedRules = Array.isArray(rule.normalize) ? rule.normalize : DEFAULT_BLANK_NORMALIZE

  if (rule.numeric) {
    const parsedValue = parseNumberishValue(value, rule.numeric.unit)
    const tolerance = isFiniteNumber(rule.numeric.tolerance) ? Math.abs(rule.numeric.tolerance) : 0
    if (parsedValue !== null && Math.abs(parsedValue - rule.numeric.target) <= tolerance) {
      return {
        matched: true,
        method: "numeric_tolerance",
        matchedValue: String(rule.numeric.target),
      }
    }
  }

  const normalizedValue = normalizeText(value, normalizedRules)
  for (const candidate of rule.accepted_answers || []) {
    if (normalizedValue === normalizeText(candidate, normalizedRules)) {
      return {
        matched: true,
        method: "normalized_match",
        matchedValue: candidate,
      }
    }
  }

  return {
    matched: false,
    method: "normalized_match",
  }
}

function gradeBlankQuizDeterministic(
  quiz: AimdQuizField,
  answer: unknown,
  maxScore: number,
): AimdQuizGradeResult {
  if (!Array.isArray(quiz.blanks) || quiz.blanks.length === 0) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
      feedback: "This blank quiz does not define blank answers.",
    }
  }

  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "Blank grading expects a dict keyed by blank key.",
    }
  }

  const config = quiz.grading as AimdBlankQuizGradingConfig | undefined
  const ruleMap = new Map((config?.blanks || []).map(rule => [rule.key, rule]))
  const scorePerBlank = maxScore / quiz.blanks.length
  const blankResults: AimdQuizBlankGradeDetail[] = []

  let earnedScore = 0
  for (const blank of quiz.blanks) {
    const rawValue = (answer as Record<string, unknown>)[blank.key]
    const value = typeof rawValue === "string" ? rawValue : ""
    const normalizedRule = normalizeBlankRule(blank, ruleMap.get(blank.key))
    const matched = matchBlankValue(value, normalizedRule)
    const blankScore = matched.matched ? scorePerBlank : 0
    earnedScore += blankScore
    blankResults.push({
      key: blank.key,
      earned_score: roundScore(blankScore),
      max_score: roundScore(scorePerBlank),
      status: matched.matched ? "correct" : "incorrect",
      method: matched.method,
      matched_value: matched.matched ? matched.matchedValue : undefined,
      feedback: matched.matched ? undefined : "Answer did not match the accepted responses.",
    })
  }

  const normalizedEarned = roundScore(earnedScore)
  const correctCount = blankResults.filter(item => item.status === "correct").length
  return {
    quiz_id: quiz.id,
    earned_score: normalizedEarned,
    max_score: maxScore,
    status: inferStatus(normalizedEarned, maxScore),
    method: blankResults.some(item => item.method === "numeric_tolerance") ? "numeric_tolerance" : "normalized_match",
    blank_results: blankResults,
    feedback: correctCount === quiz.blanks.length
      ? undefined
      : `${correctCount} / ${quiz.blanks.length} blank(s) matched.`,
  }
}

function findKeywordEvidence(answer: string, keywords: string[]): string | undefined {
  const lowered = normalizeText(answer, ["fullwidth_to_halfwidth", "lowercase", "collapse_whitespace"])
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword, ["fullwidth_to_halfwidth", "lowercase", "collapse_whitespace"])
    if (!normalizedKeyword) {
      continue
    }
    const index = lowered.indexOf(normalizedKeyword)
    if (index >= 0) {
      return answer.slice(index, Math.min(answer.length, index + keyword.length + 24)).trim()
    }
  }
  return undefined
}

function gradeOpenQuizKeywordRubric(
  quiz: AimdQuizField,
  answer: unknown,
  maxScore: number,
): AimdQuizGradeResult {
  if (typeof answer !== "string") {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "error",
      method: "invalid_answer",
      feedback: "Open-question grading expects a string answer.",
    }
  }

  const config = quiz.grading as AimdOpenQuizGradingConfig | undefined
  const rubricItems = config?.rubric_items
  if (!Array.isArray(rubricItems) || rubricItems.length === 0) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "needs_review",
      method: "manual",
      review_required: true,
      feedback: "Keyword rubric grading requires grading.rubric_items.",
    }
  }

  const rubricResults: AimdQuizRubricItemGradeDetail[] = []
  let earnedScore = 0
  let matchedCount = 0

  for (const item of rubricItems) {
    const keywords = Array.isArray(item.keywords)
      ? item.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : []
    const matched = keywords.length > 0 && Boolean(findKeywordEvidence(answer, keywords))
    if (matched) {
      earnedScore += item.points
      matchedCount += 1
    }
    rubricResults.push({
      id: item.id,
      earned_score: matched ? item.points : 0,
      max_score: item.points,
      matched,
      evidence: matched ? findKeywordEvidence(answer, keywords) : undefined,
      feedback: matched ? undefined : item.desc,
    })
  }

  const normalizedEarned = roundScore(clamp(earnedScore, 0, maxScore))
  const confidence = rubricItems.length > 0 ? matchedCount / rubricItems.length : undefined
  const reviewRequired = isFiniteNumber(config?.require_review_below)
    ? (confidence ?? 0) < config.require_review_below
    : false
  const missingItems = rubricItems.filter(item => !rubricResults.find(result => result.id === item.id)?.matched)

  return {
    quiz_id: quiz.id,
    earned_score: normalizedEarned,
    max_score: maxScore,
    status: inferStatus(normalizedEarned, maxScore),
    method: "keyword_rubric",
    rubric_results: rubricResults,
    confidence,
    review_required: reviewRequired,
    feedback: missingItems.length > 0
      ? `Missing rubric items: ${missingItems.map(item => item.id).join(", ")}.`
      : undefined,
  }
}

export async function gradeQuizAnswer(
  quiz: AimdQuizField,
  answer: unknown,
  options: AimdQuizGradingOptions = {},
): Promise<AimdQuizGradeResult> {
  const maxScore = resolveQuizMaxScore(quiz)

  if (isUnansweredQuizAnswer(quiz, answer)) {
    return {
      quiz_id: quiz.id,
      earned_score: 0,
      max_score: maxScore,
      status: "ungraded",
      method: "manual",
    }
  }

  if (quiz.type === "choice") {
    return gradeChoiceQuiz(quiz, answer, maxScore)
  }

  if (quiz.type === "true_false") {
    return gradeTrueFalseQuiz(quiz, answer, maxScore)
  }

  if (quiz.type === "scale") {
    return gradeScaleQuizLocally(quiz, answer)
  }

  if (quiz.type === "blank") {
    const config = quiz.grading as AimdBlankQuizGradingConfig | undefined
    if (config?.strategy === "llm") {
      return requestProviderGrade(quiz, answer, config, maxScore, "llm", options)
    }
    return gradeBlankQuizDeterministic(quiz, answer, maxScore)
  }

  const config = quiz.grading as AimdOpenQuizGradingConfig | undefined
  const strategy = config?.strategy ?? "manual"

  if (strategy === "keyword_rubric") {
    return gradeOpenQuizKeywordRubric(quiz, answer, maxScore)
  }

  if (strategy === "llm" || strategy === "llm_rubric") {
    return requestProviderGrade(quiz, answer, config, maxScore, "llm", options)
  }

  return {
    quiz_id: quiz.id,
    earned_score: 0,
    max_score: maxScore,
    status: "needs_review",
    method: "manual",
    review_required: true,
    feedback: "This open question requires manual or provider-based grading.",
  }
}

export async function gradeQuizRecordAnswers(
  quizFields: AimdQuizField[],
  quizAnswers: Record<string, unknown>,
  options: AimdQuizGradingOptions = {},
): Promise<AimdQuizGradeReport> {
  const byId: Record<string, AimdQuizGradeResult> = {}
  let totalEarnedScore = 0
  let totalMaxScore = 0
  let reviewRequiredCount = 0

  for (const quiz of quizFields) {
    const result = await gradeQuizAnswer(quiz, quizAnswers[quiz.id], options)
    byId[quiz.id] = result
    totalEarnedScore += result.earned_score
    totalMaxScore += result.max_score
    if (result.review_required) {
      reviewRequiredCount += 1
    }
  }

  return {
    quiz: byId,
    summary: {
      total_earned_score: roundScore(totalEarnedScore),
      total_max_score: roundScore(totalMaxScore),
      review_required_count: reviewRequiredCount,
    },
  }
}

export type {
  AimdBlankQuizGradingConfig,
  AimdChoiceQuizGradingConfig,
  AimdOpenQuizGradingConfig,
  AimdQuizBlankGradeDetail,
  AimdQuizBlankGradingRule,
  AimdQuizGradeMethod,
  AimdQuizGradeReport,
  AimdQuizGradeResult,
  AimdQuizGradeSummary,
  AimdQuizGradingConfig,
  AimdQuizGradingOptions,
  AimdQuizRubricItem,
  AimdQuizRubricItemGradeDetail,
  AimdQuizScaleBandMatch,
  AimdScaleQuizGradingConfig,
  AimdQuizTextNormalizeRule,
}
