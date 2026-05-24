import type { Editor } from '@milkdown/kit/core'
import {
  createAimdEditorMessages,
  DEFAULT_AIMD_EDITOR_LOCALE,
  type AimdEditorLocale,
  type AimdEditorMessages,
  type AimdEditorMessagesInput,
} from './locales'

export interface AimdFieldTypeDefinition {
  type: string
  icon: string
  svgIcon: string
  color: string
}

export interface AimdFieldType extends AimdFieldTypeDefinition {
  label: string
  desc: string
}

export interface AimdVarTypePresetOption {
  key: string
  value: string
  label: string
  desc: string
}

export interface MdToolbarItemDefinition {
  action: string
  style?: string
  svgIcon?: string
}

export interface MdToolbarItem extends MdToolbarItemDefinition {
  title?: string
}

export interface AimdEditorProps {
  /** Initial / bound markdown content (v-model) */
  modelValue?: string
  /** Built-in UI locale */
  locale?: AimdEditorLocale | string
  /** Optional overrides for built-in UI copy */
  messages?: AimdEditorMessagesInput
  /** Initial editor mode */
  mode?: 'source' | 'wysiwyg'
  /** Theme name for Monaco */
  theme?: string
  /** Whether to show the top toolbar (mode switch + theme toggle) */
  showTopBar?: boolean
  /** Whether to show the formatting toolbar */
  showToolbar?: boolean
  /** Whether to show the AIMD toolbar section */
  showAimdToolbar?: boolean
  /** Whether to show the Markdown toolbar section */
  showMdToolbar?: boolean
  /** Whether to enable the Milkdown block handle (plus button on left) */
  enableBlockHandle?: boolean
  /** Whether to enable the slash menu (type / to insert) */
  enableSlashMenu?: boolean
  /** Whether inactive source / WYSIWYG panes stay mounted in the DOM */
  keepInactiveEditorsMounted?: boolean
  /** Minimum height of the editor area in px */
  minHeight?: number
  /** Whether the editor is read-only */
  readonly?: boolean
  /** Monaco editor options override */
  monacoOptions?: Record<string, any>
  /** Additional var type presets shown in the insertion dialog */
  varTypePlugins?: AimdVarTypePresetOption[]
}

export interface AimdEditorEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', mode: 'source' | 'wysiwyg'): void
  (e: 'ready', editor: { monaco?: any; milkdown?: Editor }): void
}

// SVG icon helpers – all 16×16, stroke-based, currentColor
const _si = (d: string, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`

const DEFAULT_EDITOR_MESSAGES = createAimdEditorMessages(DEFAULT_AIMD_EDITOR_LOCALE)

export const AIMD_FIELD_TYPE_DEFINITIONS: AimdFieldTypeDefinition[] = [
  { type: 'var', icon: 'x', svgIcon: _si('<path d="M7 4l10 16M17 4L7 20"/>'), color: '#2563eb' },
  { type: 'var_table', icon: '\u229e', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'), color: '#059669' },
  { type: 'quiz', icon: '?', svgIcon: _si('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2 3.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>'), color: '#7c3aed' },
  { type: 'step', icon: '\u25b6', svgIcon: _si('<polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/>'), color: '#d97706' },
  { type: 'check', icon: '\u2713', svgIcon: _si('<polyline points="4 12 9 17 20 6"/>'), color: '#dc2626' },
  { type: 'ref_step', icon: '\u2197', svgIcon: _si('<path d="M7 17L17 7M17 7H8M17 7v9"/>'), color: '#0891b2' },
  { type: 'ref_var', icon: '\u2197', svgIcon: _si('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>'), color: '#0891b2' },
  { type: 'ref_fig', icon: '\u2197', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/>'), color: '#0891b2' },
  { type: 'cite', icon: '\ud83d\udcd6', svgIcon: _si('<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'), color: '#6d28d9' },
]

export const MD_TOOLBAR_ITEM_DEFINITIONS: MdToolbarItemDefinition[] = [
  { action: 'h1', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><text x="16.5" y="14" font-size="10" fill="currentColor" stroke="none" font-weight="600">1</text>') },
  { action: 'h2', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><path d="M16.5 8.5a2.5 2.5 0 015 0c0 2-5 4-5 6.5h5" stroke-width="1.8"/>') },
  { action: 'h3', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><path d="M16.5 8a2 2 0 014 0 2 2 0 01-2.5 2 2 2 0 012.5 2 2 2 0 01-4 0" stroke-width="1.8"/>') },
  { action: 'bold', svgIcon: _si('<path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>') },
  { action: 'italic', svgIcon: _si('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>') },
  { action: 'strikethrough', svgIcon: _si('<path d="M16 4c-.5-1.5-2.2-3-5-3-3 0-5 2-5 4.5 0 2 1.5 3.5 5 4.5"/><path d="M3 12h18"/><path d="M8 20c.5 1.5 2.2 3 5 3 3 0 5-2 5-4.5 0-2-1.5-3.5-5-4.5"/>') },
  { action: 'sep1' },
  { action: 'ul', svgIcon: _si('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>') },
  { action: 'ol', svgIcon: _si('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="7.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text>') },
  { action: 'blockquote', svgIcon: _si('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>') },
  { action: 'code', svgIcon: _si('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') },
  { action: 'codeblock', svgIcon: _si('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><rect x="1" y="1" width="22" height="22" rx="3" stroke-dasharray="4 2" stroke-width="1"/>') },
  { action: 'sep2' },
  { action: 'link', svgIcon: _si('<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>') },
  { action: 'image', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/>') },
  { action: 'table', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>') },
  { action: 'hr', svgIcon: _si('<line x1="2" y1="12" x2="22" y2="12" stroke-width="2.5"/>') },
  { action: 'math', svgIcon: _si('<path d="M18 4H6l6 8-6 8h12" stroke-width="2"/>') },
]

export function createAimdFieldTypes(
  messages: Pick<AimdEditorMessages, 'fieldTypes'> = DEFAULT_EDITOR_MESSAGES,
): AimdFieldType[] {
  return AIMD_FIELD_TYPE_DEFINITIONS.map((fieldType) => {
    const localized = messages.fieldTypes[fieldType.type as keyof typeof messages.fieldTypes]
    return {
      ...fieldType,
      label: localized?.label || fieldType.type,
      desc: localized?.desc || '',
    }
  })
}

function isMdToolbarSeparator(item: MdToolbarItemDefinition): boolean {
  return item.action.startsWith('sep')
}

export function createMdToolbarItems(
  messages: Pick<AimdEditorMessages, 'mdToolbar'> = DEFAULT_EDITOR_MESSAGES,
): MdToolbarItem[] {
  return MD_TOOLBAR_ITEM_DEFINITIONS.map((item) => {
    if (isMdToolbarSeparator(item)) return item
    const title = messages.mdToolbar[item.action as keyof typeof messages.mdToolbar]
    return {
      ...item,
      title: title || item.action,
    }
  })
}

export function createAimdVarTypePresets(
  messages: Pick<AimdEditorMessages, 'varTypePresets'> = DEFAULT_EDITOR_MESSAGES,
  customPresets: AimdVarTypePresetOption[] = [],
): AimdVarTypePresetOption[] {
  const defaults: AimdVarTypePresetOption[] = [
    { key: 'str', value: 'str', ...messages.varTypePresets.str },
    { key: 'int', value: 'int', ...messages.varTypePresets.int },
    { key: 'float', value: 'float', ...messages.varTypePresets.float },
    { key: 'bool', value: 'bool', ...messages.varTypePresets.bool },
    { key: 'date', value: 'date', ...messages.varTypePresets.date },
    { key: 'datetime', value: 'datetime', ...messages.varTypePresets.datetime },
    { key: 'time', value: 'time', ...messages.varTypePresets.time },
    { key: 'codeStr', value: 'CodeStr', ...messages.varTypePresets.codeStr },
    { key: 'pyStr', value: 'PyStr', ...messages.varTypePresets.pyStr },
    { key: 'jsStr', value: 'JsStr', ...messages.varTypePresets.jsStr },
    { key: 'tsStr', value: 'TsStr', ...messages.varTypePresets.tsStr },
    { key: 'jsonStr', value: 'JsonStr', ...messages.varTypePresets.jsonStr },
    { key: 'tomlStr', value: 'TomlStr', ...messages.varTypePresets.tomlStr },
    { key: 'yamlStr', value: 'YamlStr', ...messages.varTypePresets.yamlStr },
    { key: 'dnaSequence', value: 'DNASequence', ...messages.varTypePresets.dnaSequence },
    { key: 'currentTime', value: 'CurrentTime', ...messages.varTypePresets.currentTime },
    { key: 'userName', value: 'UserName', ...messages.varTypePresets.userName },
    { key: 'airalogyMarkdown', value: 'AiralogyMarkdown', ...messages.varTypePresets.airalogyMarkdown },
  ]

  const indexByValue = new Map<string, number>()
  const merged = defaults.map((preset, index) => {
    indexByValue.set(normalizeVarTypePresetValue(preset.value), index)
    return preset
  })

  for (const preset of customPresets) {
    const normalized = normalizeVarTypePresetValue(preset.value)
    const existingIndex = indexByValue.get(normalized)
    if (typeof existingIndex === 'number') {
      merged[existingIndex] = preset
      continue
    }

    indexByValue.set(normalized, merged.length)
    merged.push(preset)
  }

  return merged
}

function normalizeVarTypePresetValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '')
}

// Backwards-compatible English defaults. Prefer the factory helpers above.
/**
 * @deprecated Use `AIMD_FIELD_TYPE_DEFINITIONS` with `createAimdFieldTypes(messages)` instead.
 */
export const AIMD_FIELD_TYPES: AimdFieldType[] = createAimdFieldTypes(DEFAULT_EDITOR_MESSAGES)
/**
 * @deprecated Use `MD_TOOLBAR_ITEM_DEFINITIONS` with `createMdToolbarItems(messages)` instead.
 */
export const MD_TOOLBAR_ITEMS: MdToolbarItem[] = createMdToolbarItems(DEFAULT_EDITOR_MESSAGES)

function toYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (!trimmed)
    return '""'

  if (
    /[:#\[\]\{\},&*!?|><=@`]/.test(trimmed)
    || /^\s|\s$/.test(value)
    || /["']/.test(trimmed)
  ) {
    return JSON.stringify(trimmed)
  }

  return trimmed
}

function toStemLines(value: string, fallback: string): string[] {
  const stem = (value || fallback).replace(/\r\n?/g, '\n')
  const lines = stem.split('\n')
  if (lines.length === 0)
    return [fallback]
  return lines
}

function getDefaultOptionText(key: string, messages?: Pick<AimdEditorMessages, 'defaults'>): string {
  return messages?.defaults.optionText(key) || DEFAULT_EDITOR_MESSAGES.defaults.optionText(key)
}

function parseQuizOptions(
  input: string,
  messages?: Pick<AimdEditorMessages, 'defaults'>,
): Array<{ key: string, text: string }> {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [
      { key: 'A', text: getDefaultOptionText('A', messages) },
      { key: 'B', text: getDefaultOptionText('B', messages) },
    ]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || String.fromCharCode(65 + index)
      const text = part.slice(sepIndex + 1).trim() || getDefaultOptionText(key, messages)
      return { key, text }
    }

    const key = String.fromCharCode(65 + index)
    return { key, text: part }
  })
}

function parseBlankItems(input: string): Array<{ key: string, answer: string }> {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [{ key: 'b1', answer: '' }]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || `b${index + 1}`
      const answer = part.slice(sepIndex + 1).trim() || ''
      return { key, answer }
    }
    return { key: `b${index + 1}`, answer: part }
  })
}

function parseOptionalScore(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed)
    return null
  const score = Number(trimmed)
  if (Number.isNaN(score) || score < 0)
    return null
  return String(score)
}

export function getDefaultAimdFields(
  type: string,
  messages?: Pick<AimdEditorMessages, 'defaults'>,
  existingQuizIds?: Set<string>,
): Record<string, string> {
  switch (type) {
    case 'var': return { name: '', type: 'str', default: '', title: '' }
    case 'var_table': return { name: '', subvars: '' }
    case 'quiz': {
      const quizType = 'choice'
      const base = `quiz_${quizType}`
      let suffix = 1
      while (existingQuizIds?.has(`${base}_${suffix}`)) {
        suffix += 1
      }
      const id = `${base}_${suffix}`
      return {
        id,
        quizType,
        mode: 'single',
        stem: messages?.defaults.questionStem || DEFAULT_EDITOR_MESSAGES.defaults.questionStem,
        options: `A:${getDefaultOptionText('A', messages)}, B:${getDefaultOptionText('B', messages)}`,
        answer: 'A',
        blanks: 'b1:',
        rubric: '',
        score: '',
      }
    }
    case 'step': return { name: '', level: '1' }
    case 'check': return { name: '' }
    case 'ref_step': return { name: '' }
    case 'ref_var': return { name: '' }
    case 'ref_fig': return { name: '' }
    case 'cite': return { refs: '' }
    default: return { name: '' }
  }
}

export function buildAimdSyntax(
  type: string,
  fields: Record<string, string>,
  messages?: Pick<AimdEditorMessages, 'defaults'>,
): string {
  switch (type) {
    case 'var': {
      let inner = (fields.name || '').trim() || 'my_var'
      const varType = (fields.type || '').trim()
      const title = (fields.title || '').trim()
      if (varType) inner += ': ' + varType
      if (fields.default) inner += ' = ' + fields.default
      if (title) inner += ', title = "' + title + '"'
      return `{{var|${inner}}}`
    }
    case 'var_table': {
      const name = fields.name || 'my_table'
      const subvars = fields.subvars ? fields.subvars.split(',').map(s => s.trim()).filter(Boolean) : ['col1', 'col2']
      return `{{var_table|${name}, subvars=[${subvars.join(', ')}]}}`
    }
    case 'step': {
      const name = fields.name || 'my_step'
      const level = fields.level && fields.level !== '1' ? ', ' + fields.level : ''
      return `{{step|${name}${level}}}`
    }
    case 'quiz': {
      const quizType = (fields.quizType || 'choice').trim()
      const id = (fields.id || `quiz_${quizType}_1`).trim()
      const score = parseOptionalScore(fields.score || '')
      const lines: string[] = [
        '```quiz',
        `id: ${toYamlScalar(id)}`,
        `type: ${toYamlScalar(quizType)}`,
      ]

      if (score !== null) {
        lines.push(`score: ${score}`)
      }

      lines.push('stem: |')
      for (const stemLine of toStemLines(fields.stem, messages?.defaults.fillQuestionStem || DEFAULT_EDITOR_MESSAGES.defaults.fillQuestionStem)) {
        lines.push(`  ${stemLine}`)
      }

      if (quizType === 'choice') {
        const mode = fields.mode === 'multiple' ? 'multiple' : 'single'
        const options = parseQuizOptions(fields.options || '', messages)
        lines.push(`mode: ${mode}`)
        lines.push('options:')
        for (const option of options) {
          lines.push(`  - key: ${toYamlScalar(option.key)}`)
          lines.push(`    text: ${toYamlScalar(option.text)}`)
        }

        const answerRaw = (fields.answer || '').trim()
        if (answerRaw) {
          if (mode === 'multiple') {
            const answers = answerRaw.split(',').map(v => v.trim()).filter(Boolean)
            if (answers.length > 0) {
              lines.push('answer:')
              for (const answer of answers) {
                lines.push(`  - ${toYamlScalar(answer)}`)
              }
            }
          }
          else {
            lines.push(`answer: ${toYamlScalar(answerRaw)}`)
          }
        }
      }
      else if (quizType === 'blank') {
        const blanks = parseBlankItems(fields.blanks || '')
        lines.push('blanks:')
        for (const blank of blanks) {
          lines.push(`  - key: ${toYamlScalar(blank.key)}`)
          lines.push(`    answer: ${toYamlScalar(blank.answer)}`)
        }
      }
      else {
        const rubric = (fields.rubric || '').trim()
        if (rubric) {
          lines.push(`rubric: ${toYamlScalar(rubric)}`)
        }
      }

      lines.push('```')
      return lines.join('\n')
    }
    case 'check':
      return `{{check|${fields.name || 'my_check'}}}`
    case 'ref_step':
      return `{{ref_step|${fields.name || 'step_id'}}}`
    case 'ref_var':
      return `{{ref_var|${fields.name || 'var_id'}}}`
    case 'ref_fig':
      return `{{ref_fig|${fields.name || 'fig_id'}}}`
    case 'cite':
      return `{{cite|${fields.refs || 'ref1'}}}`
    default:
      return `{{${type}|${fields.name || 'id'}}}`
  }
}

export function getQuickAimdSyntax(
  type: string,
  messages?: Pick<AimdEditorMessages, 'defaults'>,
): string {
  const defaults: Record<string, string> = {
    var: '{{var|var_id: str}}',
    var_table: '{{var_table|table_id, subvars=[col1, col2, col3]}}',
    quiz: [
      '```quiz',
      'id: quiz_choice_1',
      'type: choice',
      'mode: single',
      'stem: |',
      `  ${messages?.defaults.questionStem || DEFAULT_EDITOR_MESSAGES.defaults.questionStem}`,
      'options:',
      '  - key: A',
      `    text: ${getDefaultOptionText('A', messages)}`,
      '  - key: B',
      `    text: ${getDefaultOptionText('B', messages)}`,
      'answer: A',
      '```',
    ].join('\n'),
    step: '{{step|step_id}}',
    check: '{{check|check_id}}',
    ref_step: '{{ref_step|step_id}}',
    ref_var: '{{ref_var|var_id}}',
    ref_fig: '{{ref_fig|fig_id}}',
    cite: '{{cite|ref1}}',
  }
  return defaults[type] || `{{${type}|id}}`
}
