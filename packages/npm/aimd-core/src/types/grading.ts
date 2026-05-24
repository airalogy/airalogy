import type { AimdQuizField } from "./aimd"

export type AimdQuizTextNormalizeRule =
  | "trim"
  | "lowercase"
  | "collapse_whitespace"
  | "remove_spaces"
  | "fullwidth_to_halfwidth"

export interface AimdQuizNumericRule {
  target: number
  tolerance?: number
  unit?: string
}

export interface AimdQuizBlankGradingRule {
  key: string
  accepted_answers?: string[]
  normalize?: AimdQuizTextNormalizeRule[]
  numeric?: AimdQuizNumericRule
}

export interface AimdQuizRubricItem {
  id: string
  points: number
  desc: string
  keywords?: string[]
}

export interface AimdQuizScaleBand {
  min: number
  max: number
  label: string
  interpretation?: string
}

export interface AimdChoiceQuizGradingConfig {
  strategy?: "auto" | "exact_match" | "partial_credit" | "option_points"
  option_points?: Record<string, number>
}

export interface AimdScaleQuizGradingConfig {
  strategy?: "auto" | "sum"
  bands?: AimdQuizScaleBand[]
}

export interface AimdBlankQuizGradingConfig {
  strategy?: "auto" | "normalized_match" | "llm"
  provider?: string
  blanks?: AimdQuizBlankGradingRule[]
  prompt?: string
}

export interface AimdOpenQuizGradingConfig {
  strategy?: "manual" | "keyword_rubric" | "llm_rubric" | "llm"
  provider?: string
  rubric_items?: AimdQuizRubricItem[]
  require_review_below?: number
  prompt?: string
}

export type AimdQuizGradingConfig =
  | AimdChoiceQuizGradingConfig
  | AimdScaleQuizGradingConfig
  | AimdBlankQuizGradingConfig
  | AimdOpenQuizGradingConfig

export type AimdQuizGradeStatus =
  | "correct"
  | "incorrect"
  | "partial"
  | "scored"
  | "needs_review"
  | "error"
  | "ungraded"

export type AimdQuizGradeMethod =
  | "exact_match"
  | "partial_credit"
  | "option_points"
  | "scale_sum"
  | "normalized_match"
  | "numeric_tolerance"
  | "keyword_rubric"
  | "llm"
  | "manual"
  | "invalid_answer"

export interface AimdQuizScaleBandMatch extends AimdQuizScaleBand {}

export interface AimdQuizBlankGradeDetail {
  key: string
  earned_score: number
  max_score: number
  status: Extract<AimdQuizGradeStatus, "correct" | "incorrect" | "partial">
  method: AimdQuizGradeMethod
  matched_value?: string
  feedback?: string
}

export interface AimdQuizRubricItemGradeDetail {
  id: string
  earned_score: number
  max_score: number
  matched?: boolean
  evidence?: string
  feedback?: string
}

export interface AimdQuizGradeResult {
  quiz_id: string
  earned_score: number
  max_score: number
  status: AimdQuizGradeStatus
  method: AimdQuizGradeMethod
  band?: AimdQuizScaleBandMatch
  feedback?: string
  confidence?: number
  provider?: string
  review_required?: boolean
  blank_results?: AimdQuizBlankGradeDetail[]
  rubric_results?: AimdQuizRubricItemGradeDetail[]
  metadata?: Record<string, unknown>
}

export interface AimdQuizGradeSummary {
  total_earned_score: number
  total_max_score: number
  review_required_count: number
}

export interface AimdQuizGradeReport {
  quiz: Record<string, AimdQuizGradeResult>
  summary: AimdQuizGradeSummary
}

export interface AimdQuizProviderRequest {
  quiz: AimdQuizField
  answer: unknown
  config?: AimdQuizGradingConfig
  max_score: number
}

export type AimdQuizGradingProvider = (
  request: AimdQuizProviderRequest,
) => Promise<AimdQuizGradeResult | null | undefined> | AimdQuizGradeResult | null | undefined

export interface AimdQuizGradingOptions {
  provider?: AimdQuizGradingProvider
}
