import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { protectAimdInlineTemplates } from '@airalogy/aimd-core'
import { findAimdInlineTemplates } from '@airalogy/aimd-core/parser'
import { aimdMilkdownPlugins } from '../vue/milkdown-aimd-plugin'
import { normalizeComparableAimdMarkdown } from '../vue/comparableAimdMarkdown'

const editors: Editor[] = []
afterEach(async () => {
  for (const editor of editors.splice(0)) await editor.destroy()
  document.body.replaceChildren()
})

async function createEditor(markdown: string) {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.make().config(ctx => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, protectAimdInlineTemplates(markdown).content)
  }).use(commonmark).use(aimdMilkdownPlugins).create()
  editors.push(editor)
  return editor
}

describe('quoted AIMD visual round trips', () => {
  it.each([
    String.raw`{{check|quoted_message_boundary, checked_message="这里的 AIMD 样式文本保持为普通文字：{{ref_var|stable_wait_s}}。"}}`,
    String.raw`{{step|verify, title="Confirm {{ref_var|reading}}", checked_message='Keep {{ref_var|reading}} and don\'t stop at }}.', check=True}}`,
    String.raw`{{var|note: str, title="Read \"{{ref_var|reading}}\"", default="Keep {{ref_var|first}} and {{ref_var|second_value}}"}}`,
  ])('keeps quoted templates inside a single field across visual round trips: %s', async field => {
    const markdown = `${field} Outside {{ref_var|stable_wait_s}}.`
    const editor = await createEditor(markdown)
    for (let iteration = 0; iteration < 3; iteration++) {
      const nodes: Array<{ fieldType: string; fieldContent: string }> = []
      editor.action(ctx => ctx.get(editorViewCtx).state.doc.descendants(node => {
        if (node.type.name === 'aimd_field') nodes.push(node.attrs as typeof nodes[number])
      }))
      expect(nodes).toHaveLength(2)
      expect(`{{${nodes[0].fieldType}|${nodes[0].fieldContent}}}`).toBe(field)
      expect(nodes[1]).toMatchObject({ fieldType: 'ref_var', fieldContent: 'stable_wait_s' })
      const saved = editor.action(getMarkdown()).trim()
      expect(saved).toBe(markdown)
      editor.action(replaceAll(protectAimdInlineTemplates(saved).content))
    }
  })

  it('preserves literal AIMD syntax in the shared quoted-template fixture', async () => {
    const original = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../spec/fixtures/protocols/quoted-template-text/protocol/protocol.aimd'), 'utf8')
    const editor = await createEditor(original)
    const types: string[] = []
    editor.action(ctx => ctx.get(editorViewCtx).state.doc.descendants(node => {
      if (node.type.name === 'aimd_field') types.push(node.attrs.fieldType)
    }))
    expect(types).toEqual(['step', 'check'])
    expect(findAimdInlineTemplates(editor.action(getMarkdown()))).toEqual(findAimdInlineTemplates(original))
  })

  it('normalizes escaped field syntax without rewriting quoted nested text', () => {
    const original = String.raw`{{check|reading, checked_message="Keep {{ref_var|first}} and {{ref_var|second\_value}}", title="Literal &#x20;"}}`
    expect(normalizeComparableAimdMarkdown(original)).toBe(original)
    const escaped = String.raw`{{var\_table|cups, subvars=[cup\_id: str], title="Keep {{ref_var|first}} and {{ref_var|second\_value}}"}}`
    expect(normalizeComparableAimdMarkdown(escaped)).toBe(escaped.replace('var\\_table', 'var_table').replace('cup\\_id', 'cup_id'))
    expect(normalizeComparableAimdMarkdown('`{{ref_media|video}}`')).toBe('`{{ref_media|video}}`')
  })

  it('keeps inline and fenced code examples as code', async () => {
    const field = '{{check|demo, checked_message="Keep {{ref_var|reading}}"}}'
    const original = `\`${field}\`\n\n\`\`\`aimd\n${field}\n\`\`\``
    const editor = await createEditor(original)
    const types: string[] = []
    editor.action(ctx => ctx.get(editorViewCtx).state.doc.descendants(node => { types.push(node.type.name) }))
    expect(types).not.toContain('aimd_field')
    expect(editor.action(getMarkdown()).trim()).toBe(original)
  })
})
