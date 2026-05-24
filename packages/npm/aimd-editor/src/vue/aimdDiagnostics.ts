import { parseVarDefinition, validateVarDefinition } from '@airalogy/aimd-core/parser'

export type AimdDiagnosticSeverity = 'warning' | 'error'

export interface AimdDiagnostic {
  message: string
  severity: AimdDiagnosticSeverity
  startOffset: number
  endOffset: number
}

const AIMD_VAR_TEMPLATE_PATTERN = /\{\{\s*(var_table|var)\s*\|([\s\S]*?)\}\}/g

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

  return diagnostics
}
