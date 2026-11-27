import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRenderer, renderToHtml, renderToHtmlSync, renderToVue } from '../dist/index.js'

const source = await readFile(new URL('./fixtures/meeting-notes.md', import.meta.url), 'utf8')
const format = { format: 'md' }

test('ordinary Markdown uses GFM and preserves AIMD examples across HTML and Vue', async () => {
  const result = await renderToHtml(source, format)
  assert.deepEqual(result, renderToHtmlSync(source, format))
  const { nodes, fields } = await renderToVue(source, format)
  const vueHtml = await renderToString(createSSRApp({ render: () => h('article', nodes) }))
  for (const html of [result.html, vueHtml]) {
    for (const wanted of ['<h2>', '<table>', 'type="checkbox"', '<blockquote>', '{{var|reading}}', 'language-workflow', 'nodes: []', '<details>', '<summary>']) {
      assert.ok(html.includes(wanted), wanted)
    }
    assert.doesNotMatch(html, /data-aimd-type/)
  }
  assert.deepEqual(result.fields.var, [])
  assert.deepEqual(fields, result.fields)
  assert.deepEqual(createRenderer(format).extractFields(source), fields)
  const aimd = await renderToHtml('{{var|reading}}')
  assert.deepEqual(aimd.fields.var, ['reading'])
})

test('Markdown sanitizes raw HTML and links and preserves ordinary soft breaks', async () => {
  const md = '<span onclick="invalid" data-aimd-type="var">visible</span>\n\n[removed](javascript:void) [relative](./notes.md)\nnext'
  const { html } = await renderToHtml(md, format)
  assert.match(html, /<span>visible<\/span>/)
  assert.match(html, /href="\.\/notes\.md"/)
  assert.doesNotMatch(html, /onclick|data-aimd-type|javascript:|<br/)
  assert.match((await renderToHtml(md, { ...format, breaks: true })).html, /<br/)
})
