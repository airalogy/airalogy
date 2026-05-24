import { describe, expect, it } from 'vitest'

import { isAimdCodeEditorType, resolveAimdCodeEditorLanguage } from '../code-types'

describe('code-types', () => {
  it('maps built-in Airalogy CodeStr types to Monaco languages', () => {
    expect(resolveAimdCodeEditorLanguage('PyStr')).toBe('python')
    expect(resolveAimdCodeEditorLanguage('JsStr')).toBe('javascript')
    expect(resolveAimdCodeEditorLanguage('TsStr')).toBe('typescript')
    expect(resolveAimdCodeEditorLanguage('JsonStr')).toBe('json')
    expect(resolveAimdCodeEditorLanguage('YamlStr')).toBe('yaml')
    expect(resolveAimdCodeEditorLanguage('TomlStr')).toBe('ini')
    expect(resolveAimdCodeEditorLanguage('CodeStr')).toBe('plaintext')
  })

  it('accepts field-meta overrides for generic code editors', () => {
    expect(resolveAimdCodeEditorLanguage('str', { codeLanguage: 'python' })).toBe('python')
    expect(resolveAimdCodeEditorLanguage('str', { inputType: 'yaml' })).toBe('yaml')
    expect(resolveAimdCodeEditorLanguage('str', { inputType: 'code', codeLanguage: 'sql' })).toBe('sql')
  })

  it('distinguishes code-like and non-code fields', () => {
    expect(isAimdCodeEditorType('PyStr')).toBe(true)
    expect(isAimdCodeEditorType('CodeStr')).toBe(true)
    expect(isAimdCodeEditorType('str', { inputType: 'code' })).toBe(true)
    expect(isAimdCodeEditorType('str', { codeLanguage: 'python' })).toBe(true)
    expect(isAimdCodeEditorType('str')).toBe(false)
    expect(isAimdCodeEditorType('markdown', { inputType: 'text' })).toBe(false)
  })
})
