import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './ExamplesDemo.vue'), 'utf8')

describe('ExamplesDemo', () => {
  it('styles v-html Markdown headings in the render preview', () => {
    expect(source).toMatch(/class="examples-render-preview" v-html="htmlOutput"/)
    expect(source).toMatch(/\.examples-render-preview :deep\(h1\)/)
    expect(source).toMatch(/\.examples-render-preview :deep\(h2\)/)
    expect(source).toMatch(/\.examples-render-preview :deep\(p\)/)
    expect(source).toMatch(/\.examples-render-preview :deep\(ul\)/)
  })
})
