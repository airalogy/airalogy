import { validateFigDefinitions } from '@airalogy/aimd-core/parser'

export const AIMD_FIG_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface AimdTextEdit {
  startOffset: number
  endOffset: number
  text: string
}

export interface AimdFigureSourceField {
  value: string
  lineStartOffset: number
  lineEndOffset: number
  indentation: string
}

export interface AimdFigureBlockInfo {
  startOffset: number
  endOffset: number
  bodyStartOffset: number
  bodyEndOffset: number
  indentation: string
  lineEnding: string
  id?: AimdFigureSourceField
  src?: AimdFigureSourceField
}

export interface GeneratedAimdFigureId {
  id: string
  src: string
  blockStartOffset: number
  edit: AimdTextEdit
}

export interface NormalizeAimdFigureIdsResult {
  content: string
  changed: boolean
  generated: GeneratedAimdFigureId[]
}

export type PrepareAimdFormalOutputResult = NormalizeAimdFigureIdsResult

export class AimdFormalOutputError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join('; '))
    this.name = 'AimdFormalOutputError'
    this.issues = issues
  }
}

interface SourceLine {
  startOffset: number
  endOffset: number
  textEndOffset: number
  text: string
  lineEnding: string
}

function splitSourceLines(content: string): SourceLine[] {
  const lines: SourceLine[] = []
  let startOffset = 0

  while (startOffset < content.length) {
    let textEndOffset = startOffset
    while (
      textEndOffset < content.length
      && content[textEndOffset] !== '\n'
      && content[textEndOffset] !== '\r'
    ) {
      textEndOffset += 1
    }

    let endOffset = textEndOffset
    let lineEnding = ''
    if (content[endOffset] === '\r' && content[endOffset + 1] === '\n') {
      endOffset += 2
      lineEnding = '\r\n'
    }
    else if (content[endOffset] === '\r' || content[endOffset] === '\n') {
      lineEnding = content[endOffset]
      endOffset += 1
    }

    lines.push({
      startOffset,
      endOffset,
      textEndOffset,
      text: content.slice(startOffset, textEndOffset),
      lineEnding,
    })
    startOffset = endOffset
  }

  return lines
}

function getFenceOpening(line: string): { indentation: string, marker: string, language: string } | null {
  const match = line.match(/^([ \t]{0,3})(`{3,}|~{3,})[ \t]*([^ \t]*)[^\r\n]*$/)
  if (!match) return null
  return {
    indentation: match[1],
    marker: match[2],
    language: match[3].trim().toLowerCase(),
  }
}

function isMatchingFenceClose(line: string, openingMarker: string): boolean {
  const match = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/)
  return Boolean(
    match
    && match[1][0] === openingMarker[0]
    && match[1].length >= openingMarker.length,
  )
}

function stripYamlComment(value: string): string {
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (quote) {
      if (char === '\\' && quote === '"') {
        escaped = true
      }
      else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '#' && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index)
    }
  }

  return value
}

function parseScalarValue(rawValue: string): string {
  const value = stripYamlComment(rawValue).trim()
  if (!value) return ''

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'string' ? parsed : value
    }
    catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

function parseFigureField(line: SourceLine): { key: 'id' | 'src', field: AimdFigureSourceField } | null {
  const match = line.text.match(/^([ \t]*)(id|src)[ \t]*:[ \t]*(.*)$/i)
  if (!match) return null
  return {
    key: match[2].toLowerCase() as 'id' | 'src',
    field: {
      value: parseScalarValue(match[3]),
      lineStartOffset: line.startOffset,
      lineEndOffset: line.textEndOffset,
      indentation: match[1],
    },
  }
}

export function scanAimdFigureBlocks(content: string): AimdFigureBlockInfo[] {
  const lines = splitSourceLines(content)
  const blocks: AimdFigureBlockInfo[] = []

  for (let index = 0; index < lines.length;) {
    const opening = getFenceOpening(lines[index].text)
    if (!opening) {
      index += 1
      continue
    }

    let closingIndex = index + 1
    while (
      closingIndex < lines.length
      && !isMatchingFenceClose(lines[closingIndex].text, opening.marker)
    ) {
      closingIndex += 1
    }

    if (closingIndex >= lines.length) {
      break
    }

    if (opening.language === 'fig') {
      let id: AimdFigureSourceField | undefined
      let src: AimdFigureSourceField | undefined
      for (let bodyIndex = index + 1; bodyIndex < closingIndex; bodyIndex += 1) {
        const parsedField = parseFigureField(lines[bodyIndex])
        if (parsedField?.key === 'id') id = parsedField.field
        if (parsedField?.key === 'src') src = parsedField.field
      }

      blocks.push({
        startOffset: lines[index].startOffset,
        endOffset: lines[closingIndex].textEndOffset,
        bodyStartOffset: lines[index].endOffset,
        bodyEndOffset: lines[closingIndex].startOffset,
        indentation: opening.indentation,
        lineEnding: lines[index].lineEnding,
        id,
        src,
      })
    }

    index = closingIndex + 1
  }

  return blocks
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6)
}

function getFigureSourceStem(src: string): string {
  let candidate = src.trim()
  try {
    const url = new URL(candidate)
    candidate = url.pathname
  }
  catch {
    candidate = candidate.split(/[?#]/, 1)[0]
  }

  const lastSegment = candidate.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? ''
  let decodedSegment = lastSegment
  try {
    decodedSegment = decodeURIComponent(lastSegment)
  }
  catch {}

  const lastDot = decodedSegment.lastIndexOf('.')
  return lastDot > 0 ? decodedSegment.slice(0, lastDot) : decodedSegment
}

export function createAimdFigureId(src: string, usedIds: Iterable<string> = []): string {
  let base = getFigureSourceStem(src)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()

  if (!base) {
    base = `fig_${stableHash(src || 'figure')}`
  }
  else if (/^[0-9]/.test(base)) {
    base = `fig_${base}`
  }

  const used = new Set(usedIds)
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}_${suffix}`
    suffix += 1
  }
  return id
}

export function collectAimdFigureIds(content: string): string[] {
  return scanAimdFigureBlocks(content)
    .map(block => block.id?.value ?? '')
    .filter(Boolean)
}

function detectPreferredLineEnding(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

function createFigureIdEdit(
  content: string,
  block: AimdFigureBlockInfo,
  id: string,
): AimdTextEdit {
  if (block.id) {
    return {
      startOffset: block.id.lineStartOffset,
      endOffset: block.id.lineEndOffset,
      text: `${block.id.indentation}id: ${id}`,
    }
  }

  const lineEnding = block.lineEnding || detectPreferredLineEnding(content)
  return {
    startOffset: block.bodyStartOffset,
    endOffset: block.bodyStartOffset,
    text: `${block.src?.indentation ?? block.indentation}id: ${id}${lineEnding}`,
  }
}

function applyTextEdits(content: string, edits: AimdTextEdit[]): string {
  return [...edits]
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce(
      (result, edit) => `${result.slice(0, edit.startOffset)}${edit.text}${result.slice(edit.endOffset)}`,
      content,
    )
}

export function normalizeAimdFigureIds(content: string): NormalizeAimdFigureIdsResult {
  const blocks = scanAimdFigureBlocks(content)
  const usedIds = new Set(
    blocks.map(block => block.id?.value ?? '').filter(Boolean),
  )
  const generated: GeneratedAimdFigureId[] = []

  for (const block of blocks) {
    const src = block.src?.value ?? ''
    if (block.id?.value || !src) continue

    const id = createAimdFigureId(src, usedIds)
    usedIds.add(id)
    generated.push({
      id,
      src,
      blockStartOffset: block.startOffset,
      edit: createFigureIdEdit(content, block, id),
    })
  }

  const normalizedContent = applyTextEdits(content, generated.map(item => item.edit))
  return {
    content: normalizedContent,
    changed: generated.length > 0,
    generated,
  }
}

export function prepareAimdForFormalOutput(content: string): PrepareAimdFormalOutputResult {
  const normalized = normalizeAimdFigureIds(content)
  const figures = scanAimdFigureBlocks(normalized.content).map(block => ({
    id: block.id?.value,
    src: block.src?.value,
  }))
  const issues = validateFigDefinitions(figures)
  if (issues.length > 0) {
    throw new AimdFormalOutputError(issues)
  }
  return normalized
}
