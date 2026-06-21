import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const editorPath = resolve(__dirname, '../src/vue/AimdEditor.vue')
const typesPath = resolve(__dirname, '../src/vue/types.ts')

test('AimdEditor lets hosts override the image toolbar action', () => {
  const editorSource = readFileSync(editorPath, 'utf8')
  const typesSource = readFileSync(typesPath, 'utf8')

  assert.match(typesSource, /imageToolbarAction\?: AimdEditorImageToolbarAction/)
  assert.match(typesSource, /interface AimdEditorImageRequest/)
  assert.match(editorSource, /imageToolbarAction: 'markdown'/)
  assert.match(editorSource, /props\.imageToolbarAction === 'custom'/)
  assert.match(editorSource, /buttonRect: getToolbarButtonRect/)
  assert.match(editorSource, /emit\('request-image', \{ buttonRect:/)
  assert.match(editorSource, /@md-action="handleMdToolbarAction"/)
})
