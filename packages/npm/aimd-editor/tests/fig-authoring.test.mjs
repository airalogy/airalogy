import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const helperPath = resolve(__dirname, '../src/authoring/fig.ts')

function validateFigDefinitions(figures) {
  const errors = []
  const seen = new Set()
  for (const [index, figure] of figures.entries()) {
    const id = figure.id?.trim() ?? ''
    const src = figure.src?.trim() ?? ''
    const label = id ? `fig "${id}"` : `fig block ${index + 1}`
    if (!id) errors.push(`${label}: missing required "id" field`)
    else if (seen.has(id)) errors.push(`fig "${id}": duplicate id`)
    else seen.add(id)
    if (!src) errors.push(`${label}: missing required "src" field`)
  }
  return errors
}

function loadAuthoringExports() {
  const source = readFileSync(helperPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })
  const module = { exports: {} }
  const localRequire = (id) => {
    if (id === '@airalogy/aimd-core/parser') return { validateFigDefinitions }
    throw new Error(`Unexpected import: ${id}`)
  }
  const fn = new Function('exports', 'module', 'require', outputText)
  fn(module.exports, module, localRequire)
  return module.exports
}

const {
  AIMD_FIG_ID_PATTERN,
  AimdFormalOutputError,
  collectAimdFigureIds,
  createAimdFigureId,
  normalizeAimdFigureIds,
  prepareAimdForFormalOutput,
  scanAimdFigureBlocks,
} = loadAuthoringExports()

test('createAimdFigureId derives legal readable ids and avoids conflicts', () => {
  const generated = [
    createAimdFigureId('images/lab-team.jpeg'),
    createAimdFigureId('images/lab-team.jpeg', ['lab_team']),
    createAimdFigureId('images/2026 result.png'),
    createAimdFigureId('images/团队合影.png'),
  ]
  assert.deepEqual(generated.slice(0, 3), ['lab_team', 'lab_team_2', 'fig_2026_result'])
  assert.match(generated[3], /^fig_[0-9a-f]{6}$/)
  for (const id of generated) assert.match(id, AIMD_FIG_ID_PATTERN)
})

test('normalizeAimdFigureIds writes ids into closed figures and remains stable', () => {
  const content = [
    'See {{ref_fig|lab_team}}.',
    '',
    '```fig',
    'id: lab_team',
    'src: images/existing.png',
    '```',
    '',
    '```fig',
    'src: images/lab-team.jpeg',
    'title: Lab team',
    '```',
    '',
    '```fig',
    'id:',
    'src: images/lab-team.jpeg',
    '```',
  ].join('\n')

  const result = normalizeAimdFigureIds(content)
  assert.equal(result.changed, true)
  assert.deepEqual(result.generated.map(item => item.id), ['lab_team_2', 'lab_team_3'])
  assert.match(result.content, /```fig\nid: lab_team_2\nsrc: images\/lab-team\.jpeg/)
  assert.match(result.content, /```fig\nid: lab_team_3\nsrc: images\/lab-team\.jpeg/)
  assert.match(result.content, /See \{\{ref_fig\|lab_team\}\}\./)
  assert.deepEqual(collectAimdFigureIds(result.content), ['lab_team', 'lab_team_2', 'lab_team_3'])

  const reopened = normalizeAimdFigureIds(result.content)
  assert.equal(reopened.changed, false)
  assert.equal(reopened.content, result.content)
})

test('normalization leaves unfinished figures and fenced examples unchanged', () => {
  const content = [
    '````aimd',
    '```fig',
    'src: images/example.png',
    '```',
    '````',
    '',
    '```fig',
    'src: images/draft.png',
  ].join('\n')

  assert.deepEqual(scanAimdFigureBlocks(content), [])
  const result = normalizeAimdFigureIds(content)
  assert.equal(result.changed, false)
  assert.equal(result.content, content)
})

test('normalization follows existing figure-body indentation', () => {
  const content = [
    '  ```fig',
    '    src: images/indented.png',
    '  ```',
  ].join('\n')

  const result = normalizeAimdFigureIds(content)
  assert.equal(result.changed, true)
  assert.match(result.content, /^  ```fig\n    id: indented\n    src:/)
})

test('prepareAimdForFormalOutput rejects duplicate ids and missing src', () => {
  const duplicate = [
    '```fig',
    'id: chart',
    'src: images/chart.png',
    '```',
    '',
    '```fig',
    'id: chart',
    'src: images/chart-copy.png',
    '```',
  ].join('\n')
  assert.throws(
    () => prepareAimdForFormalOutput(duplicate),
    error => error instanceof AimdFormalOutputError && /duplicate id/.test(error.message),
  )

  const missingSrc = ['```fig', 'id: chart', '```'].join('\n')
  assert.throws(
    () => prepareAimdForFormalOutput(missingSrc),
    error => error instanceof AimdFormalOutputError && /missing required "src"/.test(error.message),
  )
})
