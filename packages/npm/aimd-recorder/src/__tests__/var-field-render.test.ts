import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdVarField.vue'), 'utf8')

describe('AimdVarField render behavior', () => {
  it('shares compact layout syncing between textareas and single-line inputs', () => {
    expect(source).toMatch(/function syncCompactControlLayout\(control: HTMLInputElement \| HTMLTextAreaElement\)/)
    expect(source).toMatch(/if \(typeof HTMLTextAreaElement !== "undefined" && control instanceof HTMLTextAreaElement\) \{\s*syncAutoWrapTextareaHeight\(control\)\s*\}/)
  })

  it('resizes single-line inputs while the user types', () => {
    expect(source).toMatch(/onInput: \(event: Event\) => \{\s*const el = event\.target as HTMLInputElement\s*syncCompactControlLayout\(el\)\s*syncNumberValidity\(el\)\s*onVarChange\(el\.value\)\s*\}/)
  })

  it('applies Pydantic-style numeric constraints from AIMD kwargs', () => {
    expect(source).toMatch(/getNumericInputAttributes\(type, node\.definition\?\.kwargs\)/)
    expect(source).toMatch(/getNumericConstraintViolation\(displayValue, type, node\.definition\?\.kwargs\)/)
    expect(source).toMatch(/control\.setCustomValidity\(violation \?\? ""\)/)
  })

  it('renders code-like vars with the dedicated code editor field', () => {
    expect(source).toMatch(/const AimdCodeField = defineAsyncComponent\(\(\) => import\("\.\/AimdCodeField\.vue"\)\)/)
    expect(source).toMatch(/if \(inputKind === "code"\)/)
    expect(source).toMatch(/language: codeLanguage/)
    expect(source).toMatch(/"aimd-rec-inline--var-stacked--code"/)
  })
})
