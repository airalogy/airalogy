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
  const runtimeRequire = (id) => {
    if (id === 'vue') {
      return require('vue')
    }
    if (id === '@airalogy/aimd-core') {
      return {
        protectAimdInlineTemplates: (markdown) => ({ content: markdown }),
        restoreAimdInlineTemplates: markdown => markdown,
      }
    }
    if (id === '@airalogy/aimd-renderer') {
      return {
        parseAndExtract: () => ({ var: [], step: [], check: [], quiz: [], var_table: [] }),
      }
    }
    if (id === '@milkdown/kit/utils') {
      return {
        replaceAll: () => () => {},
        getMarkdown: () => () => '',
        insert: () => () => {},
        callCommand: () => () => {},
      }
    }
    if (id === '@milkdown/kit/preset/gfm') {
      return {
        insertTableCommand: { key: 'insertTable' },
      }
    }
    if (id === './aimdInlineMarkdownNormalization') {
      return {
        normalizeAimdInlineTemplateMarkdownEscapes: markdown => markdown,
      }
    }

    return require(id)
  }

  const fn = new Function('exports', 'module', 'require', outputText)
  fn(exports, module, runtimeRequire)
  return module.exports
}

test('useEditorContent does not re-emit modelValue when syncFromProp updates internal content', async () => {
  const vue = require('vue')
  const { useEditorContent } = loadTsModuleExports(editorContentPath)
  const emitted = []

  const state = useEditorContent({
    initialContent: '',
    initialMode: 'wysiwyg',
    resolvedMessages: { value: {} },
    emitModelValue: value => emitted.push(value),
    emitMode: () => {},
  })

  state.syncFromProp('Examplea')
  await vue.nextTick()

  assert.deepEqual(emitted, [])

  state.commitUserContent('Exampleaa')
  await vue.nextTick()

  assert.deepEqual(emitted, ['Exampleaa'])
})
