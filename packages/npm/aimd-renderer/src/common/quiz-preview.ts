import type { QuizPreviewOptions } from "@airalogy/aimd-core/types"

export interface ResolvedQuizPreviewOptions {
  showAnswers: boolean
  showRubric: boolean
}

/**
 * Resolve quiz preview visibility options from mode and user overrides.
 * Default behavior: reveal answers/rubric in "report" mode, hide otherwise.
 */
export function resolveQuizPreviewOptions(
  mode: string,
  quizPreview?: QuizPreviewOptions,
): ResolvedQuizPreviewOptions {
  const normalizedMode = mode === "timeline" ? "preview" : mode
  const defaultReveal = normalizedMode === "report"
  return {
    showAnswers: quizPreview?.showAnswers ?? defaultReveal,
    showRubric: quizPreview?.showRubric ?? defaultReveal,
  }
}
