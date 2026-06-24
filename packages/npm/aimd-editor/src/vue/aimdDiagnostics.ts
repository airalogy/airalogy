import { parseMediaContent, parseVarDefinition, validateMediaDefinition, validateVarDefinition } from '@airalogy/aimd-core/parser'

export type AimdDiagnosticSeverity = 'warning' | 'error'

export interface AimdDiagnostic {
  message: string
  severity: AimdDiagnosticSeverity
  startOffset: number
  endOffset: number
}

const AIMD_VAR_TEMPLATE_PATTERN = /\{\{\s*(var_table|var)\s*\|([\s\S]*?)\}\}/g
const AIMD_MEDIA_BLOCK_PATTERN = /^[ \t]*(```|~~~)[ \t]*media(?:[^\n]*)?\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm

export function collectAimdDiagnostics(content: string): AimdDiagnostic[] {
  const diagnostics: AimdDiagnostic[] = []

  for (const match of content.matchAll(AIMD_VAR_TEMPLATE_PATTERN)) {
    const startOffset = match.index ?? 0
    const raw = match[0]
    const fieldContent = match[2] ?? ''

    try {
      const warnings = validateVarDefinition(parseVarDefinition(fieldContent))
      if (warnings.length > 0) {
        diagnostics.push({
          message: warnings.join('\n'),
          severity: 'warning',
          startOffset,
          endOffset: startOffset + raw.length,
        })
      }
    } catch {
      // Keep source editing permissive; syntax-level parser failures should not
      // block Monaco from rendering or reporting other diagnostics.
    }
  }

  for (const match of content.matchAll(AIMD_MEDIA_BLOCK_PATTERN)) {
    const startOffset = match.index ?? 0
    const raw = match[0]
    const blockContent = match[2] ?? ''

    try {
      const errors = validateMediaDefinition(parseMediaContent(blockContent))
      if (errors.length > 0) {
        diagnostics.push({
          message: errors.join('\n'),
          severity: 'error',
          startOffset,
          endOffset: startOffset + raw.length,
        })
      }
    } catch {
      // Keep source editing permissive; syntax-level parser failures should not
      // block Monaco from rendering or reporting other diagnostics.
    }
  }

  return diagnostics
}
