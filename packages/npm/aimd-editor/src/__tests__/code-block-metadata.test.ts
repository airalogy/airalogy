import { afterEach, expect, it } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { DOMParser, DOMSerializer } from '@milkdown/kit/prose/model'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { codeBlockMetadataSchema } from '../vue/milkdown-code-block-metadata'

const editors: Editor[] = []
afterEach(async () => {
  for (const editor of editors.splice(0)) await editor.destroy()
  document.body.replaceChildren()
})

it.each([
  ['assigner runtime=client', 'runtime=client'],
  ['python title="original.py" linenos', 'title="original.py" linenos'],
  ['fig', ''],
  ['', ''],
])('preserves fence information %s through visual edits and DOM copies', async (info, meta) => {
  const original = `\`\`\`${info}\nvalue = 1\n\`\`\``
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.make().config(ctx => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, original)
  }).use(commonmark).use(codeBlockMetadataSchema).create()
  editors.push(editor)
  for (let i = 0; i < 3; i++) {
    expect(editor.action(getMarkdown()).trim()).toBe(original)
    editor.action(replaceAll(editor.action(getMarkdown())))
  }
  editor.action(ctx => {
    const view = ctx.get(editorViewCtx)
    const holder = document.createElement('div')
    holder.append(DOMSerializer.fromSchema(view.state.schema).serializeFragment(view.state.doc.content))
    const copied = DOMParser.fromSchema(view.state.schema).parse(holder)
    expect(copied.firstChild?.attrs.meta).toBe(meta)
    expect(copied.firstChild?.textContent).toBe('value = 1')
  })
})
