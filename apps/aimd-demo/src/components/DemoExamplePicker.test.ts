import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './DemoExamplePicker.vue'), 'utf8')

const pageSources = {
  core: readFileSync(resolve(__dirname, '../pages/CoreDemo.vue'), 'utf8'),
  editor: readFileSync(resolve(__dirname, '../pages/EditorDemo.vue'), 'utf8'),
  renderer: readFileSync(resolve(__dirname, '../pages/RendererDemo.vue'), 'utf8'),
  recorder: readFileSync(resolve(__dirname, '../pages/RecorderDemo.vue'), 'utf8'),
  examples: readFileSync(resolve(__dirname, '../pages/ExamplesDemo.vue'), 'utf8'),
}

describe('DemoExamplePicker', () => {
  it('centralizes compact example selection in the shared picker', () => {
    expect(source).toContain("variant?: 'compact' | 'list'")
    expect(source).toContain('titleLabel?: string')
    expect(source).toContain('changeLabel?: string')
    expect(source).toContain('resetLabel?: string')
    expect(source).toContain("variant: 'compact'")
    expect(source).toContain('demo-example-picker__current')
    expect(source).toContain('demo-example-picker__list-panel--popover')
    expect(source).toMatch(/\.demo-example-picker__list-panel--popover\s*\{[^}]*z-index:\s*100;/s)
    expect(source).toContain('props.titleLabel ?? messages.value.examples.title')
    expect(source).toContain('props.resetLabel ?? messages.value.examples.resetCurrent')
  })

  it('uses the compact picker by default on package tabs and list mode in the examples popover', () => {
    expect(pageSources.core).not.toContain('variant="list"')
    expect(pageSources.editor).not.toContain('variant="list"')
    expect(pageSources.renderer).not.toContain('variant="list"')
    expect(pageSources.recorder).not.toContain('variant="list"')
    expect(pageSources.examples).toContain('variant="list"')
  })
})
