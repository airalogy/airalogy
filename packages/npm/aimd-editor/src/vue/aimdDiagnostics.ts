import { parseMediaContent, parseVarDefinition, validateMediaDefinition, validateVarDefinition } from '@airalogy/aimd-core/parser'
import {
  normalizeAimdFigureIds,
  scanAimdFigureBlocks,
  type AimdTextEdit,
} from '../authoring'

export type AimdDiagnosticSeverity = 'warning' | 'error'

export interface AimdDiagnostic {
  code?: string
  message: string
  severity: AimdDiagnosticSeverity
  startOffset: number
  endOffset: number
  quickFix?: {
    title: string
    edit: AimdTextEdit
  }
}

export interface AimdDiagnosticMessages {
  figureMissingId: string
  figureMissingSrc: string
  figureDuplicateId: (id: string) => string
  generateFigureId: string
}

const AIMD_VAR_TEMPLATE_PATTERN = /\{\{\s*(var_table|var)\s*\|([\s\S]*?)\}\}/g
const AIMD_MEDIA_BLOCK_PATTERN = /^[ \t]*(```|~~~)[ \t]*media(?:[^\n]*)?\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm

const DEFAULT_DIAGNOSTIC_MESSAGES: AimdDiagnosticMessages = {
  figureMissingId: 'This figure is missing the required ID. Generate or enter a unique ID.',
  figureMissingSrc: 'This figure is missing the required src field.',
  figureDuplicateId: id => `Figure ID "${id}" is already used in this document.`,
  generateFigureId: 'Generate figure ID',
}

export function collectAimdDiagnostics(
  content: string,
  messages: AimdDiagnosticMessages = DEFAULT_DIAGNOSTIC_MESSAGES,
): AimdDiagnostic[] {
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

  const figures = scanAimdFigureBlocks(content)
  const generatedByBlock = new Map(
    normalizeAimdFigureIds(content).generated.map(item => [item.blockStartOffset, item]),
  )
  const seenFigureIds = new Set<string>()

  for (const figure of figures) {
    const id = figure.id?.value ?? ''
    const src = figure.src?.value ?? ''

    if (!id) {
      const generated = generatedByBlock.get(figure.startOffset)
      diagnostics.push({
        code: 'fig-missing-id',
        message: messages.figureMissingId,
        severity: 'error',
        startOffset: figure.startOffset,
        endOffset: figure.endOffset,
        ...(generated
          ? {
              quickFix: {
                title: messages.generateFigureId,
                edit: generated.edit,
              },
            }
          : {}),
      })
    }

    if (!src) {
      diagnostics.push({
        code: 'fig-missing-src',
        message: messages.figureMissingSrc,
        severity: 'error',
        startOffset: figure.startOffset,
        endOffset: figure.endOffset,
      })
    }

    if (id) {
      if (seenFigureIds.has(id)) {
        diagnostics.push({
          code: 'fig-duplicate-id',
          message: messages.figureDuplicateId(id),
          severity: 'error',
          startOffset: figure.startOffset,
          endOffset: figure.endOffset,
        })
      }
      seenFigureIds.add(id)
    }
  }

  return diagnostics
}
