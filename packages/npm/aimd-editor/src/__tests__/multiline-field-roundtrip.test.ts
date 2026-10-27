import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { protectAimdInlineTemplates } from '@airalogy/aimd-core'
import { parseAndExtract } from '@airalogy/aimd-renderer'
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
  }).use(commonmark).use(gfm).use(aimdMilkdownPlugins).create()
  editors.push(editor)
  return editor
}

const table = `{{var_table|cups, subvars=[
    var(cup_id: str, title="杯号"),
    var(group: Literal["L", "W", "D"], title="组别"),
    var(count: int, title="数量", ge=0, le=10)
]}}`

describe('visual AIMD field round trips', () => {
  it('preserves multiline table columns across repeated serialization and reload', async () => {
    const editor = await createEditor(table)
    for (let iteration = 0; iteration < 3; iteration++) {
      const markdown = editor.action(getMarkdown())
      expect(markdown.trim()).toBe(table)
      expect(markdown).not.toContain('&#x20;')
      expect(parseAndExtract(markdown).var_table).toEqual(parseAndExtract(table).var_table)
      editor.action(replaceAll(protectAimdInlineTemplates(markdown).content))
    }
  })

  it('repairs old escaped indentation without decoding quoted literal values or ordinary prose', async () => {
    const oldDraft = `Outside &#x20;\n\n${table.replace(/\n    /g, '\n&#x20;   ')}`
    const editor = await createEditor(oldDraft)
    const markdown = editor.action(getMarkdown())
    expect(markdown).toContain(table)
    expect(parseAndExtract(markdown).var_table?.[0]?.subvars.map(field => field.id)).toEqual(['cup_id', 'group', 'count'])

    const literal = String.raw`{{var|note: str, title="Read \"carefully\"", default="C:\\lab\\a_b &#x20;"}}`
    expect(normalizeComparableAimdMarkdown(literal)).toBe(literal)
    const literalEditor = await createEditor(literal)
    expect(normalizeComparableAimdMarkdown(literalEditor.action(getMarkdown())).trim()).toBe(literal)
    expect(normalizeComparableAimdMarkdown('Outside &#x20; and \\_text')).toBe('Outside &#x20; and \\_text')
  })

  it.each(['ai-glasses-vinegar-titration', 'ai-glasses-leaf-disk-photosynthesis'])('keeps every table definition in %s', async name => {
    const original = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), `../../../../../examples/protocols/${name}/zh-CN/protocol.aimd`), 'utf8')
    const editor = await createEditor(original)
    const roundTripped = normalizeComparableAimdMarkdown(editor.action(getMarkdown()))
    expect(roundTripped).not.toContain('&#x20;')
    expect(parseAndExtract(roundTripped).var_table).toEqual(parseAndExtract(original).var_table)
  })
})
