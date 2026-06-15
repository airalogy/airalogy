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

  it('keeps long examples inside bounded scroll regions', () => {
    expect(source).toContain(':fill-parent="true"')
    expect(source).toContain(':fit-viewport="false"')
    expect(source).toMatch(/\.demo-page \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow: hidden;/)
    expect(source).toMatch(/\.examples-workbench \{[\s\S]*flex: 1 1 0;[\s\S]*overflow: hidden;/)
    expect(source).toMatch(/\.examples-panel \{[\s\S]*flex: 1 1 0;[\s\S]*overflow: auto;/)
  })

  it('keeps example selection compact by default', () => {
    expect(source).toMatch(/const isExamplePickerOpen = ref\(false\)/)
    expect(source).toMatch(/class="examples-current"/)
    expect(source).toMatch(/v-if="isExamplePickerOpen" class="examples-picker-popover"/)
    expect(source).toMatch(/isExamplePickerOpen\.value = false/)
    expect(source).toMatch(/\.examples-page-head \{[\s\S]*display: flex;/)
    expect(source).toMatch(/\.examples-control-area \{[\s\S]*min-height: 48px;/)
    expect(source).toMatch(/\.examples-picker-popover \{[\s\S]*position: absolute;[\s\S]*max-height: min\(54vh, 430px\);/)
    expect(source).toMatch(/\.examples-toolbar \{[\s\S]*gap: 8px;/)
  })
})
