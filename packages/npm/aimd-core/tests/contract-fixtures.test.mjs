import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  isAimdWorkflowReference,
  parseWorkflowContent,
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
const workflowFixture = path.join(monorepoRoot, 'spec/fixtures/workflows/parameter-optimization/workflow.aimd')

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

test('workflow fixture parses through AIMD core workflow parser', () => {
  const content = readFileSync(workflowFixture, 'utf8')
  const workflowYaml = content.match(/```workflow\n([\s\S]*?)\n```/)?.[1]
  assert.ok(workflowYaml)

  const workflow = parseWorkflowContent(workflowYaml)
  assert.equal(workflow.version, 'airalogy.workflow.v1')
  assert.equal(workflow.id, 'parameter_optimization')
  assert.deepEqual(workflow.nodes.map(node => node.id), ['prep', 'measurement', 'analysis', 'report'])
  const summarizeMeasurement = workflow.assigners.find(assigner => assigner.id === 'summarize_measurement')
  const optimizeParameters = workflow.assigners.find(assigner => assigner.id === 'optimize_parameters')
  assert.ok(summarizeMeasurement)
  assert.ok(optimizeParameters)
  assert.equal(summarizeMeasurement.runtime, 'python')
  assert.equal(summarizeMeasurement.entrypoint, './assigners/summarize_measurement.py:assign')
  assert.equal(workflow.transitions[1].run, 'summarize_measurement')
  assert.equal(workflow.transitions[1].id, 'summarize_measurement_for_analysis')
  assert.deepEqual(workflow.transitions[1].from, ['measurement'])
  assert.deepEqual(workflow.transitions[1].to, ['analysis'])
  assert.deepEqual(workflow.transitions[1].inputs, {
    raw_data: '${measurement.var.raw_data}',
  })
  assert.deepEqual(workflow.transitions[1].assign, {
    analysis: {
      'var.raw_data': '${measurement.var.raw_data}',
      'var.raw_data_summary': '${summarize_measurement_for_analysis.outputs.raw_data_summary}',
      'var.measurement_quality': '${summarize_measurement_for_analysis.outputs.measurement_quality}',
    },
  })
  assert.equal(optimizeParameters.runtime, 'python')
  assert.equal(optimizeParameters.entrypoint, './assigners/optimize_parameters.py:assign')
  assert.equal(optimizeParameters.permissions, undefined)
  assert.equal(workflow.transitions[3].id, 'retry_after_qc_failure')
  assert.deepEqual(workflow.transitions[3].from, ['analysis'])
  assert.deepEqual(workflow.transitions[3].to, ['prep'])
  assert.equal(workflow.transitions[3].run, 'optimize_parameters')
  assert.equal(workflow.transitions[3].max_iterations, 5)
  assert.equal(workflow.default_initial_node, 'prep')
  assert.equal(isAimdWorkflowReference('${analysis.var.summary}'), true)
  assert.equal(isAimdWorkflowReference('${analysis.check.pass_qc.checked}'), true)
  assert.equal(isAimdWorkflowReference('${retry_after_qc_failure.outputs.retry_reason}'), true)
  assert.equal(isAimdWorkflowReference('${analysis}'), false)
  assert.equal(isAimdWorkflowReference('analysis.var.summary'), false)
})

test('workflow parser keeps optional assigner permissions when declared', () => {
  const workflow = parseWorkflowContent(`
version: airalogy.workflow.v1
id: permissions_example
nodes:
  - id: prep
    protocol: ./protocols/prep/protocol.aimd
  - id: report
    protocol: ./protocols/report/protocol.aimd
assigners:
  - id: summarize
    runtime: python
    entrypoint: ./assigners/summarize.py:assign
    permissions:
      network:
        - api.example.com
      secrets:
        - EXAMPLE_API_KEY
transitions:
  - id: summarize_for_report
    from: prep
    to: report
    run: summarize
`)

  assert.deepEqual(workflow.assigners[0].permissions, {
    network: ['api.example.com'],
    secrets: ['EXAMPLE_API_KEY'],
  })
})

test('workflow parser normalizes many-to-many transition assignments', () => {
  const workflow = parseWorkflowContent(`
version: airalogy.workflow.v1
id: many_to_many_example
nodes:
  - id: analysis
    protocol: ./protocols/analysis/protocol.aimd
  - id: qc_review
    protocol: ./protocols/qc-review/protocol.aimd
  - id: report
    protocol: ./protocols/report/protocol.aimd
  - id: archive
    protocol: ./protocols/archive/protocol.aimd
assigners:
  - id: plan_report_and_archive
    runtime: python
    entrypoint: ./assigners/plan_report_and_archive.py:assign
transitions:
  - id: prepare_report_and_archive
    from:
      - analysis
      - qc_review
    to:
      - report
      - archive
    run: plan_report_and_archive
    inputs:
      analysis_summary: \${analysis.var.summary}
      qc_checked: \${qc_review.check.pass_qc.checked}
    assign:
      report:
        var.summary: \${prepare_report_and_archive.outputs.report_summary}
        check.ready_to_publish: \${qc_review.check.pass_qc}
      archive:
        var.qc_annotation: \${qc_review.check.pass_qc.annotation}
        var.archive_bundle: \${prepare_report_and_archive.outputs.archive_bundle}
`)

  assert.deepEqual(workflow.transitions[0].from, ['analysis', 'qc_review'])
  assert.deepEqual(workflow.transitions[0].to, ['report', 'archive'])
  assert.deepEqual(workflow.transitions[0].inputs, {
    analysis_summary: '${analysis.var.summary}',
    qc_checked: '${qc_review.check.pass_qc.checked}',
  })
  assert.deepEqual(workflow.transitions[0].assign, {
    report: {
      'var.summary': '${prepare_report_and_archive.outputs.report_summary}',
      'check.ready_to_publish': '${qc_review.check.pass_qc}',
    },
    archive: {
      'var.qc_annotation': '${qc_review.check.pass_qc.annotation}',
      'var.archive_bundle': '${prepare_report_and_archive.outputs.archive_bundle}',
    },
  })
})

test('workflow fixture is extracted from fenced workflow blocks', () => {
  const content = readFileSync(workflowFixture, 'utf8')
  const fields = parseAimd(content)

  assert.equal(fields.workflow.length, 1)
  assert.equal(fields.workflow[0].id, 'parameter_optimization')
  assert.equal(fields.workflow[0].transitions.length, 4)
  assert.deepEqual(fields.step, [])
  assert.deepEqual(fields.var, [])
})
