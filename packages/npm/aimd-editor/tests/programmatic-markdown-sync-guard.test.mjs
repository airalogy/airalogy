import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const guardPath = resolve(__dirname, '../src/vue/programmaticMarkdownSyncGuard.ts')

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

test('programmatic markdown sync guard consumes tracked content and expires stale entries', async () => {
  const { createProgrammaticMarkdownSyncGuard } = loadTsModuleExports(guardPath)
  const guard = createProgrammaticMarkdownSyncGuard(20)

  guard.track('Exampleaa')
  assert.equal(guard.consume('Exampleaa'), true)
  assert.equal(guard.consume('Exampleaa'), false)

  guard.track('Exampleaaa')
  await new Promise(resolvePromise => setTimeout(resolvePromise, 30))
  assert.equal(guard.consume('Exampleaaa'), false)
})
