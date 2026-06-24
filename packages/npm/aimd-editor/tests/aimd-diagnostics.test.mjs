import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const nodeRequire = createRequire(import.meta.url)
const helperPath = resolve(__dirname, '../src/vue/aimdDiagnostics.ts')
const sourceEditorPath = resolve(__dirname, '../src/vue/AimdSourceEditor.vue')

function loadTsModuleExports(path, requireOverrides = {}) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })

  const module = { exports: {} }
  const exports = module.exports
  const localRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(requireOverrides, id)) {
      return requireOverrides[id]
    }
    return nodeRequire(id)
  }
  const fn = new Function('exports', 'module', 'require', outputText)
  fn(exports, module, localRequire)
  return module.exports
}

test('collectAimdDiagnostics reports var semantic warnings with source offsets', () => {
  const { collectAimdDiagnostics } = loadTsModuleExports(helperPath, {
    '@airalogy/aimd-core/parser': {
      parseVarDefinition(content) {
        const id = content.split(/[,:]/)[0].trim()
        const type = content.match(/:\s*([A-Za-z_]\w*)/)?.[1]
        const kwargs = {}
        for (const key of ['gt', 'ge', 'lt', 'le', 'multiple_of']) {
          if (new RegExp(`\\b${key}\\s*=`).test(content)) {
            kwargs[key] = 0
          }
        }
        return { id, type, kwargs }
      },
      validateVarDefinition(def) {
        if (def.type === 'str' && def.kwargs.gt !== undefined) {
          return [`"${def.id}": numeric constraints (gt) only apply to int/integer/float/number variables, not str`]
        }
        return []
      },
      parseMediaContent(content) {
        const id = content.match(/\bid:\s*([^\n]+)/)?.[1]?.trim()
        const kind = content.match(/\bkind:\s*([^\n]+)/)?.[1]?.trim() || 'file'
        const src = content.match(/\bsrc:\s*([^\n]+)/)?.[1]?.trim()
        if (!id || !src) throw new Error('invalid media')
        return { id, kind, src }
      },
      validateMediaDefinition(media) {
        return media.kind === 'image'
          ? [`media "${media.id}": unsupported kind "image". Supported media kinds are video, audio, and file; static images must use a fig block.`]
          : []
      },
    },
  })

  const content = [
    'Name: {{var|name: str, gt = 0}}',
    'Height: {{var|height_cm: float, gt = 0}}',
  ].join('\n')
  const diagnostics = collectAimdDiagnostics(content)

  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].severity, 'warning')
  assert.equal(diagnostics[0].startOffset, content.indexOf('{{var|name'))
  assert.equal(diagnostics[0].endOffset, content.indexOf('{{var|name') + '{{var|name: str, gt = 0}}'.length)
  assert.match(diagnostics[0].message, /numeric constraints \(gt\)/)
})

test('collectAimdDiagnostics reports unsupported media kind errors with source offsets', () => {
  const { collectAimdDiagnostics } = loadTsModuleExports(helperPath, {
    '@airalogy/aimd-core/parser': {
      parseVarDefinition() {
        return { id: 'unused' }
      },
      validateVarDefinition() {
        return []
      },
      parseMediaContent(content) {
        const id = content.match(/\bid:\s*([^\n]+)/)?.[1]?.trim()
        const kind = content.match(/\bkind:\s*([^\n]+)/)?.[1]?.trim() || 'file'
        const src = content.match(/\bsrc:\s*([^\n]+)/)?.[1]?.trim()
        if (!id || !src) throw new Error('invalid media')
        return { id, kind, src }
      },
      validateMediaDefinition(media) {
        return media.kind === 'image'
          ? [`media "${media.id}": unsupported kind "image". Supported media kinds are video, audio, and file; static images must use a fig block.`]
          : []
      },
    },
  })

  const mediaBlock = [
    '```media',
    'id: workflow_image',
    'kind: image',
    'src: files/workflow.png',
    '```',
  ].join('\n')
  const content = `Intro\n\n${mediaBlock}\n\nEnd`
  const diagnostics = collectAimdDiagnostics(content)

  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].severity, 'error')
  assert.equal(diagnostics[0].startOffset, content.indexOf(mediaBlock))
  assert.equal(diagnostics[0].endOffset, content.indexOf(mediaBlock) + mediaBlock.length)
  assert.match(diagnostics[0].message, /static images must use a fig block/)
})

test('AimdSourceEditor publishes AIMD diagnostics as Monaco markers', () => {
  const source = readFileSync(sourceEditorPath, 'utf8')

  assert.match(source, /collectAimdDiagnostics/)
  assert.match(source, /setModelMarkers\(model, AIMD_DIAGNOSTIC_OWNER, markers\)/)
  assert.match(source, /setModelMarkers\(model, AIMD_DIAGNOSTIC_OWNER, \[\]\)/)
})
