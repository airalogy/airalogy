import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const helperPath = resolve(__dirname, '../src/vue/comparableAimdMarkdown.ts')
const wysiwygPath = resolve(__dirname, '../src/vue/AimdWysiwygEditor.vue')

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
  const runtimeRequire = (id) => {
    if (id === '@airalogy/aimd-core') {
      return {
        restoreAimdInlineTemplates: (markdown) => (
          markdown.replace(
            /AIMDINLINETEMPLATE7b7b7661727c73616d706c655f6e616d653a207374727d7dTOKEN/g,
            '{{var|sample_name: str}}',
          )
        ),
      }
    }
    if (id === './aimdInlineMarkdownNormalization') {
      return {
        normalizeAimdInlineTemplateMarkdownEscapes: markdown => markdown.replace(/sample\\_name/g, 'sample_name'),
      }
    }

    return require(id)
  }

  const fn = new Function('exports', 'module', 'require', outputText)
  fn(exports, module, runtimeRequire)
  return module.exports
}

test('normalizes protected and escaped AIMD markdown into the same comparable content', () => {
  const { normalizeComparableAimdMarkdown } = loadTsModuleExports(helperPath)

  const restoredMarkdown = 'Enter sample name: {{var|sample_name: str}}'
  const protectedMarkdown = 'Enter sample name: AIMDINLINETEMPLATE7b7b7661727c73616d706c655f6e616d653a207374727d7dTOKEN'
  const escapedMarkdown = 'Enter sample name: {{var|sample\\_name: str}}'

  assert.equal(normalizeComparableAimdMarkdown(protectedMarkdown), restoredMarkdown)
  assert.equal(normalizeComparableAimdMarkdown(escapedMarkdown), restoredMarkdown)
})

test('AimdWysiwygEditor compares and tracks canonical AIMD markdown during controlled sync', () => {
  const source = readFileSync(wysiwygPath, 'utf8')

  assert.match(source, /import\s+\{\s*normalizeComparableAimdMarkdown\s*\}\s+from\s+'\.\/comparableAimdMarkdown'/)
  assert.match(source, /let lastKnownMarkdown = normalizeComparableAimdMarkdown\(props\.content\)/)
  assert.match(source, /const comparableMarkdown = normalizeComparableAimdMarkdown\(markdown\)/)
  assert.match(source, /programmaticMarkdownSyncGuard\.consume\(comparableMarkdown\)/)
  assert.match(source, /const comparableContent = normalizeComparableAimdMarkdown\(content\)/)
  assert.match(source, /programmaticMarkdownSyncGuard\.track\(comparableContent\)/)
  assert.match(source, /normalizeComparableAimdMarkdown\(props\.content\) === lastKnownMarkdown/)
})
