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
const quotedTemplateTextFixture = path.join(monorepoRoot, 'spec/fixtures/protocols/quoted-template-text/protocol/protocol.aimd')
const refsFixture = path.join(monorepoRoot, 'spec/fixtures/protocols/refs/protocol/protocol.aimd')
const mediaFixture = path.join(monorepoRoot, 'spec/fixtures/protocols/media/protocol/protocol.aimd')

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

test('quoted template text fixture keeps AIMD-looking strings literal', () => {
  const content = readFileSync(quotedTemplateTextFixture, 'utf8')
  const fields = parseAimd(content)

  assert.deepEqual(fields.step, ['verify_reading'])
  assert.deepEqual(fields.check, ['reading_stable'])
  assert.deepEqual(fields.ref_var, [])
})

test('refs fixture extracts citations and BibTeX references', () => {
  const content = readFileSync(refsFixture, 'utf8')
  const fields = parseAimd(content)

  assert.deepEqual(fields.step, ['review_references'])
  assert.deepEqual(fields.cite, ['yang2025airalogy', 'doe2024protocol'])
  assert.equal(fields.refs.length, 2)
  assert.equal(fields.refs[0].id, 'yang2025airalogy')
  assert.equal(fields.refs[0].title, 'Airalogy: Universal Research Automation')
  assert.equal(fields.refs[1].id, 'doe2024protocol')
  assert.equal(fields.refs[1].url, 'https://example.com/protocol')
})

test('media fixture extracts media blocks and media references', () => {
  const content = readFileSync(mediaFixture, 'utf8')
  const fields = parseAimd(content)

  assert.deepEqual(fields.step, ['review_media'])
  assert.deepEqual(fields.ref_media, ['lecture_video'])
  assert.equal(fields.media.length, 1)
  assert.deepEqual(fields.media[0], {
    id: 'lecture_video',
    kind: 'video',
    src: 'files/lecture.mp4',
    mime: 'video/mp4',
    poster: 'files/lecture-poster.jpg',
    title: 'Lecture Video',
    legend: 'A local video resource packaged with the AIMD protocol.',
  })
})
