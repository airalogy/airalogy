import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdMarkdownField.vue'), 'utf8')

describe('AimdMarkdownField', () => {
  it('embeds the full AimdEditor so toolbar controls remain available', () => {
    expect(source).toMatch(/import \{ AimdEditor \} from '@airalogy\/aimd-editor\/vue'/)
    expect(source).toMatch(/<AimdEditor/)
    expect(source).toMatch(/mode="source"/)
    expect(source).toMatch(/:show-top-bar="true"/)
    expect(source).toMatch(/:show-toolbar="!disabled"/)
    expect(source).toMatch(/:show-md-toolbar="true"/)
    expect(source).toMatch(/:show-aimd-toolbar="true"/)
  })

  it('renders as an embedded block editor instead of using a trigger dialog', () => {
    expect(source).not.toMatch(/<Teleport to="body">/)
    expect(source).toMatch(/aimd-rec-inline--var-markdown/)
    expect(source).toMatch(/aimd-markdown-field__editor-shell/)
    expect(source).toMatch(/aimd-markdown-field__editor/)
  })

  it('keeps a local draft so parent v-model echoes do not reset the editor session', () => {
    expect(source).toMatch(/const draftValue = ref\(normalizeMarkdownModelValue\(props\.modelValue\)\)/)
    expect(source).toMatch(/watch\(\(\) => props\.modelValue, \(value\) => \{/)
    expect(source).toMatch(/if \(nextValue === draftValue\.value\)/)
    expect(source).toMatch(/emitDraftValue/)
  })
})
