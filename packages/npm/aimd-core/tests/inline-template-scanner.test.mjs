import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findAimdInlineTemplates } from '../dist/parser.js'

test('shared scanner returns whole fields and exact offsets around quoted nested templates', () => {
  const raw = String.raw`{{check|quoted_message_boundary, checked_message="这里：{{ref_var|wait_s}}，\"quoted\" 和 }}。"}}`
  const source = `Before ${raw} After {{ref_var|wait_s}}.`
  const matches = findAimdInlineTemplates(source)
  assert.equal(matches.length, 2)
  assert.deepEqual(matches[0], {
    type: 'check', content: raw.slice(8, -2), raw, start: 7, end: 7 + raw.length,
  })
  assert.equal(matches[1].raw, '{{ref_var|wait_s}}')
  for (const match of matches) assert.equal(source.slice(match.start, match.end), match.raw)
})

test('single quotes and escaped apostrophes do not end templates early', () => {
  const source = String.raw`{{step|verify, checked_message='Don\'t parse {{var|example}} or }} here.', check=True}}`
  assert.equal(findAimdInlineTemplates(source)[0].raw, source)
  assert.equal(findAimdInlineTemplates(source).length, 1)
})

test('Markdown-escaped type recovery is explicitly opt-in for editor drafts', () => {
  for (const [escaped, type] of [['var\\_table', 'var_table'], ['ref\\_var', 'ref_var'], ['ref\\_media', 'ref_media']]) {
    const raw = `{{${escaped}|example}}`
    assert.deepEqual(findAimdInlineTemplates(raw), [])
    assert.deepEqual(findAimdInlineTemplates(raw, { allowMarkdownEscapedTypes: true }), [
      { type, content: 'example', raw, start: 0, end: raw.length },
    ])
  }
})
