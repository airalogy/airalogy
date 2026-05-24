export type AimdWorkbenchFieldType = 'var' | 'var_table' | 'step' | 'check' | 'quiz'
export type AimdWorkbenchFieldSourceKind = 'inline' | 'block'

export interface AimdWorkbenchFieldDescriptor {
  uid: string
  fieldType: AimdWorkbenchFieldType
  sourceKind: AimdWorkbenchFieldSourceKind
  id: string
  raw: string
  start: number
  end: number
  segmentStart: number
  segmentEnd: number
  valueType?: string
  subvarsText?: string
  quizType?: string
}

const INLINE_FIELD_PATTERN = /\{\{(var_table|var|step|check)\s*\|\s*([^}]+)\}\}/g
const QUIZ_BLOCK_PATTERN = /```quiz[^\n]*\n[\s\S]*?\n```/g

function trimYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function getLineStart(content: string, index: number): number {
  const previousBreak = content.lastIndexOf('\n', Math.max(0, index - 1))
  return previousBreak === -1 ? 0 : previousBreak + 1
}

function getLineEnd(content: string, index: number): number {
  const nextBreak = content.indexOf('\n', index)
  return nextBreak === -1 ? content.length : nextBreak + 1
}

function maybeExpandToStandaloneSegment(
  content: string,
  start: number,
  end: number,
  sourceKind: AimdWorkbenchFieldSourceKind,
): { segmentStart: number, segmentEnd: number } {
  if (sourceKind === 'block') {
    const segmentStart = getLineStart(content, start)
    let segmentEnd = getLineEnd(content, end)
    while (segmentEnd < content.length && content.slice(segmentEnd, segmentEnd + 1) === '\n') {
      segmentEnd += 1
    }
    return { segmentStart, segmentEnd }
  }

  const lineStart = getLineStart(content, start)
  const lineEnd = getLineEnd(content, end)
  const lineRaw = content.slice(lineStart, lineEnd).replace(/\r?\n$/, '')
  const fieldRaw = content.slice(start, end)
  if (lineRaw.trim() === fieldRaw.trim()) {
    let segmentEnd = lineEnd
    while (segmentEnd < content.length && content.slice(segmentEnd, segmentEnd + 1) === '\n') {
      segmentEnd += 1
    }
    return {
      segmentStart: lineStart,
      segmentEnd,
    }
  }

  return { segmentStart: start, segmentEnd: end }
}

function parseVarEditableParts(inner: string): {
  id: string
  valueType: string
  defaultPart: string
  suffixRaw: string
} {
  const kwargIndex = inner.search(/,\s*(?=\w+\s*=)/)
  const prefixRaw = kwargIndex >= 0 ? inner.slice(0, kwargIndex) : inner
  const suffixRaw = kwargIndex >= 0 ? inner.slice(kwargIndex) : ''
  const prefix = prefixRaw.trim()

  if (!prefix.includes(':')) {
    const eqIndex = prefix.indexOf('=')
    if (eqIndex >= 0) {
      return {
        id: prefix.slice(0, eqIndex).trim(),
        valueType: '',
        defaultPart: prefix.slice(eqIndex + 1).trim(),
        suffixRaw,
      }
    }

    return {
      id: prefix.trim(),
      valueType: '',
      defaultPart: '',
      suffixRaw,
    }
  }

  const colonIndex = prefix.indexOf(':')
  const id = prefix.slice(0, colonIndex).trim()
  const afterColon = prefix.slice(colonIndex + 1).trim()
  const eqIndex = afterColon.indexOf('=')

  if (eqIndex >= 0) {
    return {
      id,
      valueType: afterColon.slice(0, eqIndex).trim(),
      defaultPart: afterColon.slice(eqIndex + 1).trim(),
      suffixRaw,
    }
  }

  return {
    id,
    valueType: afterColon.trim(),
    defaultPart: '',
    suffixRaw,
  }
}

function buildVarInner(parts: {
  id: string
  valueType?: string
  defaultPart?: string
  suffixRaw?: string
}): string {
  let prefix = (parts.id || 'my_var').trim() || 'my_var'
  const valueType = (parts.valueType || '').trim()
  const defaultPart = (parts.defaultPart || '').trim()
  if (valueType) {
    prefix += `: ${valueType}`
  }
  if (defaultPart) {
    prefix += ` = ${defaultPart}`
  }

  return prefix + (parts.suffixRaw || '')
}

function looksLikeVarTable(inner: string): boolean {
  if (/subvars\s*=\s*\[/.test(inner)) {
    return true
  }

  return /^[A-Za-z_][\w-]*\s*\([^)]*\)\s*$/.test(inner.trim())
}

function normalizeSubvarToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('var(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(4, -1).trim()
    const separatorIndex = inner.search(/[:=,\s]/)
    return (separatorIndex === -1 ? inner : inner.slice(0, separatorIndex)).trim()
  }

  const colonIndex = trimmed.indexOf(':')
  if (colonIndex >= 0) {
    return trimmed.slice(0, colonIndex).trim()
  }

  return trimmed
}

function parseVarTableDescriptor(inner: string) {
  const trimmed = inner.trim()
  const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\s*\(([^)]*)\)\s*$/)
  if (parenMatch) {
    const subvarsText = parenMatch[2]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .join(', ')

    return {
      id: parenMatch[1],
      subvarsText: subvarsText || 'col1, col2',
    }
  }

  const id = trimmed.split(',')[0]?.trim() || 'my_table'
  const subvarsMatch = trimmed.match(/subvars\s*=\s*\[([\s\S]*?)\]/)
  const subvarsText = subvarsMatch?.[1]
    ?.split(',')
    .map(part => normalizeSubvarToken(part))
    .filter(Boolean)
    .join(', ')

  return {
    id,
    subvarsText: subvarsText || 'col1, col2',
  }
}

function parseStepDescriptor(inner: string) {
  const trimmed = inner.trim()
  const parts = trimmed.split(/,\s*/)
  return {
    id: parts[0]?.trim() || 'my_step',
  }
}

function parseCheckDescriptor(inner: string) {
  const trimmed = inner.trim()
  const parts = trimmed.split(/,\s*/)
  return {
    id: parts[0]?.trim() || 'my_check',
  }
}

function parseQuizDescriptor(raw: string) {
  const idMatch = raw.match(/^\s*id:\s*(.+)\s*$/m)
  const typeMatch = raw.match(/^\s*type:\s*(.+)\s*$/m)

  return {
    id: trimYamlScalar(idMatch?.[1] || 'quiz_choice_1'),
    quizType: trimYamlScalar(typeMatch?.[1] || 'choice'),
  }
}

function replaceInlineInner(raw: string, nextInner: string): string {
  return raw.replace(/^(\{\{(?:var_table|var|step|check)\s*\|\s*)([\s\S]*?)(\}\})$/, `$1${nextInner}$3`)
}

function replaceFirstIdentifier(rawInner: string, nextId: string): string {
  return rawInner.replace(/^(\s*)([A-Za-z_][\w-]*)/, `$1${nextId}`)
}

function updateInlineFieldId(raw: string, fieldType: Extract<AimdWorkbenchFieldType, 'var' | 'var_table' | 'step' | 'check'>, nextId: string): string {
  const innerMatch = raw.match(/^\{\{(?:var_table|var|step|check)\s*\|\s*([\s\S]*?)\}\}$/)
  if (!innerMatch) {
    return raw
  }

  const inner = innerMatch[1]

  if (fieldType === 'var') {
    const parsed = parseVarEditableParts(inner)
    return replaceInlineInner(raw, buildVarInner({
      ...parsed,
      id: nextId,
    }))
  }

  return replaceInlineInner(raw, replaceFirstIdentifier(inner, nextId))
}

function updateInlineVarValueType(raw: string, nextValueType: string): string {
  const innerMatch = raw.match(/^\{\{var\s*\|\s*([\s\S]*?)\}\}$/)
  if (!innerMatch) {
    return raw
  }

  const parsed = parseVarEditableParts(innerMatch[1])
  return replaceInlineInner(raw, buildVarInner({
    ...parsed,
    valueType: nextValueType,
  }))
}

function updateQuizFieldId(raw: string, nextId: string): string {
  if (/^\s*id:\s*.+$/m.test(raw)) {
    return raw.replace(/^\s*id:\s*.+$/m, `id: ${nextId}`)
  }

  return raw.replace(/^```quiz[^\n]*\n/, match => `${match}id: ${nextId}\n`)
}

function buildWorkbenchSyntax(
  type: AimdWorkbenchFieldType,
  fields: Record<string, string>,
): string {
  switch (type) {
    case 'var': {
      let inner = (fields.name || '').trim() || 'my_var'
      const valueType = (fields.type || '').trim()
      if (valueType) {
        inner += `: ${valueType}`
      }
      return `{{var|${inner}}}`
    }
    case 'var_table': {
      const name = (fields.name || '').trim() || 'my_table'
      const subvars = (fields.subvars || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)

      return `{{var_table|${name}, subvars=[${(subvars.length > 0 ? subvars : ['col1', 'col2']).join(', ')}]}}`
    }
    case 'step':
      return `{{step|${(fields.name || '').trim() || 'my_step'}}}`
    case 'check':
      return `{{check|${(fields.name || '').trim() || 'my_check'}}}`
    case 'quiz': {
      const quizType = (fields.quizType || '').trim() || 'choice'
      const id = (fields.id || '').trim() || `quiz_${quizType}_1`
      const stem = fields.stem || 'Fill the question stem'
      if (quizType === 'open') {
        return [
          '```quiz',
          `id: ${id}`,
          'type: open',
          'stem: |',
          `  ${stem}`,
          '```',
        ].join('\n')
      }

      if (quizType === 'scale') {
        return [
          '```quiz',
          `id: ${id}`,
          'type: scale',
          'title: Scale title',
          'stem: |',
          `  ${stem}`,
          'display: matrix',
          'items:',
          '  - key: item_1',
          '    stem: First item',
          '  - key: item_2',
          '    stem: Second item',
          'options:',
          '  - key: never',
          '    text: Never',
          '    points: 0',
          '  - key: sometimes',
          '    text: Sometimes',
          '    points: 1',
          '  - key: often',
          '    text: Often',
          '    points: 2',
          'grading:',
          '  strategy: sum',
          '```',
        ].join('\n')
      }

      return [
        '```quiz',
        `id: ${id}`,
        `type: ${quizType}`,
        'stem: |',
        `  ${stem}`,
        quizType === 'blank' ? 'blanks:\n  - key: blank_1\n    answer: answer' : 'mode: single\noptions:\n  - key: A\n    text: Option A\n  - key: B\n    text: Option B',
        '```',
      ].join('\n')
    }
  }
}

function buildFieldSyntax(
  fieldType: AimdWorkbenchFieldType,
  options?: {
    id?: string
    valueType?: string
    subvarsText?: string
    quizType?: string
  },
): string {
  const id = options?.id?.trim()

  switch (fieldType) {
    case 'var':
      return buildWorkbenchSyntax('var', {
        name: id || 'my_var',
        type: options?.valueType?.trim() || 'str',
      })
    case 'var_table':
      return buildWorkbenchSyntax('var_table', {
        name: id || 'my_table',
        subvars: options?.subvarsText?.trim() || 'col1, col2',
      })
    case 'step':
      return buildWorkbenchSyntax('step', {
        name: id || 'my_step',
      })
    case 'check':
      return buildWorkbenchSyntax('check', {
        name: id || 'my_check',
      })
    case 'quiz': {
      const quizType = options?.quizType?.trim() || 'choice'
      return buildWorkbenchSyntax('quiz', {
        id: id || `quiz_${quizType}_1`,
        quizType,
      })
    }
  }
}

function replaceContentRange(content: string, start: number, end: number, replacement: string): string {
  return content.slice(0, start) + replacement + content.slice(end)
}

function formatInlineInsertion(content: string, offset: number, syntax: string): string {
  const prevChar = offset > 0 ? content[offset - 1] : ''
  const nextChar = offset < content.length ? content[offset] : ''
  const needsLeadingSpace = !!prevChar && !/\s/.test(prevChar)
  const needsTrailingSpace = !!nextChar && !/\s/.test(nextChar)

  return `${needsLeadingSpace ? ' ' : ''}${syntax}${needsTrailingSpace ? ' ' : ''}`
}

function formatBlockInsertion(content: string, offset: number, syntax: string): string {
  const before = content.slice(0, offset)
  const after = content.slice(offset)
  const leadingBreaks = before.match(/\n*$/)?.[0].length ?? 0
  const trailingBreaks = after.match(/^\n*/)?.[0].length ?? 0
  const prefix = before.length === 0 ? '' : leadingBreaks >= 2 ? '' : '\n'.repeat(2 - leadingBreaks)
  const suffix = after.length === 0 ? '' : trailingBreaks >= 2 ? '' : '\n'.repeat(2 - trailingBreaks)
  return `${prefix}${syntax}${suffix}`
}

export function scanWorkbenchFields(content: string): AimdWorkbenchFieldDescriptor[] {
  const fields: AimdWorkbenchFieldDescriptor[] = []

  for (const match of content.matchAll(INLINE_FIELD_PATTERN)) {
    const raw = match[0]
    const outerType = match[1]
    const inner = match[2]
    const start = match.index ?? 0
    const end = start + raw.length
    const segment = maybeExpandToStandaloneSegment(content, start, end, 'inline')

    if (outerType === 'var' && !looksLikeVarTable(inner)) {
      const parsed = parseVarEditableParts(inner)
      fields.push({
        uid: `inline:${start}:${end}`,
        fieldType: 'var',
        sourceKind: 'inline',
        id: parsed.id || 'my_var',
        valueType: parsed.valueType || 'str',
        raw,
        start,
        end,
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
      })
      continue
    }

    if (outerType === 'var' || outerType === 'var_table') {
      const parsed = parseVarTableDescriptor(inner)
      fields.push({
        uid: `inline:${start}:${end}`,
        fieldType: 'var_table',
        sourceKind: 'inline',
        id: parsed.id,
        subvarsText: parsed.subvarsText,
        raw,
        start,
        end,
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
      })
      continue
    }

    if (outerType === 'step') {
      const parsed = parseStepDescriptor(inner)
      fields.push({
        uid: `inline:${start}:${end}`,
        fieldType: 'step',
        sourceKind: 'inline',
        id: parsed.id,
        raw,
        start,
        end,
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
      })
      continue
    }

    const parsed = parseCheckDescriptor(inner)
    fields.push({
      uid: `inline:${start}:${end}`,
      fieldType: 'check',
      sourceKind: 'inline',
      id: parsed.id,
      raw,
      start,
      end,
      segmentStart: segment.segmentStart,
      segmentEnd: segment.segmentEnd,
    })
  }

  for (const match of content.matchAll(QUIZ_BLOCK_PATTERN)) {
    const raw = match[0]
    const start = match.index ?? 0
    const end = start + raw.length
    const segment = maybeExpandToStandaloneSegment(content, start, end, 'block')
    const parsed = parseQuizDescriptor(raw)

    fields.push({
      uid: `block:${start}:${end}`,
      fieldType: 'quiz',
      sourceKind: 'block',
      id: parsed.id,
      quizType: parsed.quizType,
      raw,
      start,
      end,
      segmentStart: segment.segmentStart,
      segmentEnd: segment.segmentEnd,
    })
  }

  return fields.sort((left, right) => left.start - right.start)
}

export function generateNextWorkbenchFieldId(
  fields: AimdWorkbenchFieldDescriptor[],
  fieldType: AimdWorkbenchFieldType,
  quizType?: string,
): string {
  const existingIds = new Set(fields.map(field => field.id))
  const base = fieldType === 'var'
    ? 'new_var'
    : fieldType === 'var_table'
      ? 'new_table'
      : fieldType === 'step'
        ? 'new_step'
        : fieldType === 'check'
          ? 'new_check'
          : `quiz_${quizType || 'choice'}`

  if (!existingIds.has(base)) {
    return base
  }

  let suffix = 2
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix += 1
  }

  return `${base}_${suffix}`
}

export function appendWorkbenchField(
  content: string,
  fieldType: AimdWorkbenchFieldType,
  options?: {
    id?: string
    valueType?: string
    subvarsText?: string
    quizType?: string
  },
): string {
  const syntax = buildFieldSyntax(fieldType, options)
  const trimmed = content.replace(/\s+$/, '')
  if (!trimmed) {
    return syntax
  }

  return `${trimmed}\n\n${syntax}`
}

export function insertWorkbenchField(
  content: string,
  fields: AimdWorkbenchFieldDescriptor[],
  insertionIndex: number,
  fieldType: AimdWorkbenchFieldType,
  options?: {
    id?: string
    valueType?: string
    subvarsText?: string
    quizType?: string
  },
): string {
  if (fields.length === 0) {
    return appendWorkbenchField(content, fieldType, options)
  }

  const syntax = buildFieldSyntax(fieldType, options)
  const normalizedInsertionIndex = Math.max(0, Math.min(insertionIndex, fields.length))
  const insertionOffset = normalizedInsertionIndex >= fields.length
    ? fields[fields.length - 1].segmentEnd
    : fields[normalizedInsertionIndex].segmentStart
  const sourceKind: AimdWorkbenchFieldSourceKind = fieldType === 'quiz' ? 'block' : 'inline'
  const fragment = sourceKind === 'block'
    ? formatBlockInsertion(content, insertionOffset, syntax)
    : formatInlineInsertion(content, insertionOffset, syntax)

  return replaceContentRange(content, insertionOffset, insertionOffset, fragment)
}

export function deleteWorkbenchField(
  content: string,
  field: AimdWorkbenchFieldDescriptor,
): string {
  return replaceContentRange(content, field.segmentStart, field.segmentEnd, '')
}

export function updateWorkbenchFieldId(
  content: string,
  field: AimdWorkbenchFieldDescriptor,
  nextId: string,
): string {
  const normalizedId = nextId.trim()
  if (!normalizedId || normalizedId === field.id) {
    return content
  }

  const nextRaw = field.fieldType === 'quiz'
    ? updateQuizFieldId(field.raw, normalizedId)
    : updateInlineFieldId(field.raw, field.fieldType, normalizedId)

  return replaceContentRange(content, field.start, field.end, nextRaw)
}

export function updateWorkbenchFieldKind(
  content: string,
  field: AimdWorkbenchFieldDescriptor,
  nextType: AimdWorkbenchFieldType,
): string {
  if (nextType === field.fieldType) {
    return content
  }

  const nextRaw = buildFieldSyntax(nextType, {
    id: field.id,
    valueType: field.valueType,
    subvarsText: field.subvarsText,
    quizType: field.quizType,
  })

  return replaceContentRange(content, field.start, field.end, nextRaw)
}

export function updateWorkbenchVarValueType(
  content: string,
  field: AimdWorkbenchFieldDescriptor,
  nextValueType: string,
): string {
  if (field.fieldType !== 'var') {
    return content
  }

  const normalizedValueType = nextValueType.trim()
  if (normalizedValueType === (field.valueType || '').trim()) {
    return content
  }

  const nextRaw = updateInlineVarValueType(field.raw, normalizedValueType)
  return replaceContentRange(content, field.start, field.end, nextRaw)
}

export function updateWorkbenchFieldRaw(
  content: string,
  field: AimdWorkbenchFieldDescriptor,
  nextRaw: string,
): string {
  const normalizedRaw = (field.sourceKind === 'block' ? nextRaw.trimEnd() : nextRaw.trim()).replace(/\r\n?/g, '\n')
  if (!normalizedRaw || normalizedRaw === field.raw) {
    return content
  }

  return replaceContentRange(content, field.start, field.end, normalizedRaw)
}

export function moveWorkbenchField(
  content: string,
  fields: AimdWorkbenchFieldDescriptor[],
  movedUid: string,
  insertionIndex: number,
): string {
  const movedField = fields.find(field => field.uid === movedUid)
  if (!movedField) {
    return content
  }

  const remainingFields = fields.filter(field => field.uid !== movedUid)
  const normalizedInsertionIndex = Math.max(0, Math.min(insertionIndex, remainingFields.length))
  const fragment = content.slice(movedField.segmentStart, movedField.segmentEnd)
  const withoutFragment = replaceContentRange(content, movedField.segmentStart, movedField.segmentEnd, '')
  const movedLength = movedField.segmentEnd - movedField.segmentStart

  const adjustedRemainingFields = remainingFields.map(field => ({
    ...field,
    segmentStart: field.segmentStart > movedField.segmentStart ? field.segmentStart - movedLength : field.segmentStart,
    segmentEnd: field.segmentEnd > movedField.segmentStart ? field.segmentEnd - movedLength : field.segmentEnd,
  }))

  const insertionOffset = normalizedInsertionIndex >= adjustedRemainingFields.length
    ? (
        adjustedRemainingFields.length === 0
          ? withoutFragment.length
          : adjustedRemainingFields[adjustedRemainingFields.length - 1].segmentEnd
      )
    : adjustedRemainingFields[normalizedInsertionIndex].segmentStart

  return replaceContentRange(withoutFragment, insertionOffset, insertionOffset, fragment)
}
