import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
} from '../dist/parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(__dirname, '../../../..')
const basicFixture = path.join(monorepoRoot, 'spec/fixtures/basic-protocol')
const criticMarkupFixture = path.join(monorepoRoot, 'spec/fixtures/protocols/critic-markup/protocol/protocol.aimd')

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return file.data.aimdFields
}

test('basic protocol fixture fields match AIMD core parser', () => {
  const content = readFileSync(path.join(basicFixture, 'protocol.aimd'), 'utf8')
  const expected = JSON.parse(
    readFileSync(path.join(basicFixture, 'expected-fields.json'), 'utf8'),
  )
  const fields = parseAimd(content)

  assert.deepEqual(fields.var, expected.var)
  assert.deepEqual(fields.step, expected.step)
  assert.deepEqual(fields.check, expected.check)
})

test('critic markup fixture remains plain markdown for AIMD core parser', () => {
  const content = readFileSync(criticMarkupFixture, 'utf8')
  const fields = parseAimd(content)

  assert.deepEqual(fields.step, ['review_protocol_text'])
  assert.deepEqual(fields.var, ['review_summary'])
})
