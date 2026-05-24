import type { AimdFieldMeta } from './types'
import { normalizeAimdTypeName } from './type-utils'

const CODE_LANGUAGE_BY_TYPE: Record<string, string> = {
  codestr: 'plaintext',
  pystr: 'python',
  jsstr: 'javascript',
  tsstr: 'typescript',
  jsonstr: 'json',
  yamlstr: 'yaml',
  tomlstr: 'ini',
}

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  code: 'plaintext',
  plaintext: 'plaintext',
  py: 'python',
  python: 'python',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sh: 'shell',
  shell: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  xml: 'xml',
}

export const BUILT_IN_CODE_STR_TYPES = [
  'CodeStr',
  'PyStr',
  'JsStr',
  'TsStr',
  'JsonStr',
  'TomlStr',
  'YamlStr',
] as const

function normalizeKnownCodeLanguage(value: string | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const normalized = normalizeAimdTypeName(value)
  return CODE_LANGUAGE_BY_TYPE[normalized] ?? CODE_LANGUAGE_ALIASES[normalized] ?? null
}

function normalizeCustomCodeLanguage(value: string | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const normalized = normalizeAimdTypeName(value)
  if (normalized === 'text') {
    return 'plaintext'
  }

  return normalizeKnownCodeLanguage(value) ?? value.trim().toLowerCase()
}

export function resolveAimdCodeEditorLanguage(
  type: string | undefined,
  fieldMeta?: Pick<AimdFieldMeta, 'inputType' | 'codeLanguage'>,
): string | null {
  const explicitLanguage = normalizeCustomCodeLanguage(fieldMeta?.codeLanguage)
  if (explicitLanguage) {
    return explicitLanguage
  }

  const overrideLanguage = normalizeKnownCodeLanguage(fieldMeta?.inputType)
  if (overrideLanguage) {
    return overrideLanguage
  }

  return normalizeKnownCodeLanguage(type)
}

export function isAimdCodeEditorType(
  type: string | undefined,
  fieldMeta?: Pick<AimdFieldMeta, 'inputType' | 'codeLanguage'>,
): boolean {
  return resolveAimdCodeEditorLanguage(type, fieldMeta) !== null
}
