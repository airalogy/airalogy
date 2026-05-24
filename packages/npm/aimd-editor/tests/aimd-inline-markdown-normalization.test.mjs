import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const helperPath = resolve(__dirname, '../src/vue/aimdInlineMarkdownNormalization.ts')
const editorContentPath = resolve(__dirname, '../src/vue/useEditorContent.ts')

function loadTsModuleExports(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })

  const module = { exports: {} }
  const exports = module.exports
  const fn = new Function('exports', 'module', outputText)
  fn(exports, module)
  return module.exports
}

test('normalizes markdown-escaped characters back out of AIMD inline templates', () => {
  const { normalizeAimdInlineTemplateMarkdownEscapes } = loadTsModuleExports(helperPath)

  assert.equal(
    normalizeAimdInlineTemplateMarkdownEscapes('Enter sample name: {{var|sample\\_name: str}}'),
    'Enter sample name: {{var|sample_name: str}}',
  )
})

test('normalizes markdown escapes when the AIMD template type itself is escaped', () => {
  const { normalizeAimdInlineTemplateMarkdownEscapes } = loadTsModuleExports(helperPath)

  assert.equal(
    normalizeAimdInlineTemplateMarkdownEscapes('过敏史：{{var\\_table|allergies, subvars=\\[allergen: str, reaction: str, severity: str, status: str, note: str]}}'),
    '过敏史：{{var_table|allergies, subvars=[allergen: str, reaction: str, severity: str, status: str, note: str]}}',
  )
})

test('only unescapes markdown escapes inside AIMD inline templates', () => {
  const { normalizeAimdInlineTemplateMarkdownEscapes } = loadTsModuleExports(helperPath)

  assert.equal(
    normalizeAimdInlineTemplateMarkdownEscapes('Outside \\_markdown_ and inside {{var|sample\\_name: str}}'),
    'Outside \\_markdown_ and inside {{var|sample_name: str}}',
  )
})

test('useEditorContent applies AIMD inline-template escape normalization during WYSIWYG markdown sync', () => {
  const source = readFileSync(editorContentPath, 'utf8')

  assert.match(source, /normalizeAimdInlineTemplateMarkdownEscapes/)
  assert.match(source, /const restored = normalizeAimdInlineTemplateMarkdownEscapes\(restoreAimdInlineTemplates\(markdown\)\)/)
})
