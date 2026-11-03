import { codeBlockAttr, codeBlockSchema } from '@milkdown/kit/preset/commonmark'

// Code-fence metadata is executable AIMD configuration, not disposable presentation text.
export const codeBlockMetadataSchema = codeBlockSchema.extendSchema(previous => ctx => {
  const schema = previous(ctx)
  return {
    ...schema,
    attrs: {
      ...schema.attrs,
      meta: { default: '', validate: 'string' },
    },
    parseDOM: [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs: element => ({
        language: (element as HTMLElement).getAttribute('data-language') ?? '',
        meta: (element as HTMLElement).getAttribute('data-code-meta') ?? '',
      }),
    }],
    toDOM: node => {
      const attrs = ctx.get(codeBlockAttr.key)(node)
      return ['pre', {
        ...attrs.pre,
        'data-language': node.attrs.language,
        'data-code-meta': node.attrs.meta,
      }, ['code', attrs.code, 0]]
    },
    parseMarkdown: {
      ...schema.parseMarkdown,
      runner: (state, node, type) => {
        state.openNode(type, { language: node.lang ?? '', meta: node.meta ?? '' })
        if (node.value) state.addText(String(node.value))
        state.closeNode()
      },
    },
    toMarkdown: {
      ...schema.toMarkdown,
      runner: (state, node) => {
        state.addNode('code', undefined, node.textContent, {
          lang: node.attrs.language,
          meta: node.attrs.meta || undefined,
        })
      },
    },
  }
})
