import assert from 'node:assert/strict'
import { test } from 'node:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
  validateVarDefinition,
  validateVarDefaultType,
  validateVarKwargs,
} from '../dist/parser.js'

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return {
    tree,
    fields: file.data.aimdFields,
  }
}

function findAllAimdNodes(node) {
  const results = []
  if (!node || typeof node !== 'object') return results
  if (node.type === 'aimd') results.push(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...findAllAimdNodes(child))
    }
  }
  return results
}

function findAimdNode(node) {
  return findAllAimdNodes(node)[0] ?? null
}

// ── parseVarDefinition: simple id ────────────────────────────────────────────

test('var: simple id without type', () => {
  const { tree } = parseAimd('{{var|water}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'var')
  assert.equal(node?.definition?.id, 'water')
  assert.equal(node?.definition?.type, undefined)
  assert.equal(node?.definition?.default, undefined)
})

// ── parseVarDefinition: typed ────────────────────────────────────────────────

test('var: typed without default', () => {
  const { tree } = parseAimd('{{var|temperature: float}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.id, 'temperature')
  assert.equal(node?.definition?.type, 'float')
  assert.equal(node?.definition?.default, undefined)
})

test('var: int type', () => {
  const { tree } = parseAimd('{{var|count: int}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.type, 'int')
})

test('var: str type', () => {
  const { tree } = parseAimd('{{var|name: str}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.type, 'str')
})

test('var: bool type', () => {
  const { tree } = parseAimd('{{var|flag: bool}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.type, 'bool')
})

// ── parseVarDefinition: defaults ─────────────────────────────────────────────

test('var: float default', () => {
  const { tree } = parseAimd('{{var|temperature: float = 25.0}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, 25)
  assert.equal(node?.definition?.defaultRaw, '25.0')
})

test('var: int default', () => {
  const { tree } = parseAimd('{{var|count: int = 10}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, 10)
})

test('var: negative int default', () => {
  const { tree } = parseAimd('{{var|offset: int = -5}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, -5)
})

test('var: negative float default', () => {
  const { tree } = parseAimd('{{var|temp: float = -3.5}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, -3.5)
})

test('var: bool default True', () => {
  const { tree } = parseAimd('{{var|flag: bool = True}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, true)
})

test('var: bool default false', () => {
  const { tree } = parseAimd('{{var|flag: bool = false}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, false)
})

test('var: null default', () => {
  const { tree } = parseAimd('{{var|val: int = null}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, null)
})

test('var: None default (Python-style)', () => {
  const { tree } = parseAimd('{{var|val: int = None}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, null)
})

test('var: string default with double quotes', () => {
  const { tree } = parseAimd('{{var|name: str = "hello"}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, 'hello')
})

test('var: string default with single quotes', () => {
  const { tree } = parseAimd("{{var|name: str = 'world'}}")
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, 'world')
})

test('var: unquoted string default', () => {
  const { tree } = parseAimd('{{var|unit: str = mL}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.default, 'mL')
})

test('var: preserves Pydantic-style numeric kwargs', () => {
  const { tree, fields } = parseAimd('{{var|age: int = 18, title = "Age", ge = 0, lt = 150, multiple_of = 1}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.kwargs?.title, 'Age')
  assert.equal(node?.definition?.kwargs?.ge, 0)
  assert.equal(node?.definition?.kwargs?.lt, 150)
  assert.equal(node?.definition?.kwargs?.multiple_of, 1)
  assert.deepEqual(fields.var, ['age'])
  assert.equal(fields.var_definitions?.[0]?.id, 'age')
  assert.equal(fields.var_definitions?.[0]?.type, 'int')
  assert.equal(fields.var_definitions?.[0]?.default, 18)
  assert.equal(fields.var_definitions?.[0]?.title, 'Age')
  assert.equal(fields.var_definitions?.[0]?.kwargs?.ge, 0)
  assert.equal(fields.var_definitions?.[0]?.kwargs?.lt, 150)
  assert.equal(fields.var_definitions?.[0]?.kwargs?.multiple_of, 1)
})

// ── parseVarDefinition: subvars ──────────────────────────────────────────────

test('var_table: with simple subvars', () => {
  const { tree, fields } = parseAimd('{{var_table|samples, subvars=[sample_id, concentration, volume]}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'var_table')
  assert.equal(node?.id, 'samples')
  assert.deepEqual(node?.columns, ['sample_id', 'concentration', 'volume'])
})

test('var_table: subvars with types', () => {
  const { tree } = parseAimd('{{var_table|data, subvars=[name: str, count: int]}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'var_table')
  assert.equal(node?.definition?.subvars?.name?.type, 'str')
  assert.equal(node?.definition?.subvars?.count?.type, 'int')
})

test('var_table: subvars with defaults', () => {
  const { tree } = parseAimd('{{var_table|data, subvars=[count: int = 0, name: str = ""]}}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.subvars?.count?.default, 0)
  assert.equal(node?.definition?.subvars?.name?.default, '')
})

test('var_table: multiline nested var() subvars keep full child definitions', () => {
  const { tree, fields } = parseAimd(`{{var|inhibition_results,
    title="时空抑制率计算结果表",
    description="各能量等级下的细胞抑制率",
    subvars=[
        var(energy_level: float = 0.0, title="能量等级 (TeV)", description="测试能量浓度"),
        var(treatment_qr_mean: float = 0.0, title="处理组QR均值", description="该能量等级处理组的量子共振平均值"),
        var(inhibition_rate: float = 0.0, title="抑制率 (%)", description="计算得到的抑制百分比"),
        var(dimension_correction: float = 1.0, title="维度校正系数", description="跨维度误差校正"),
        var(confidence_level: str = "高", title="置信度", description="结果可信度评估"),
        var(notes: str = "", title="备注", description="异常现象记录")
    ]
}}`)

  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'var_table')
  assert.deepEqual(node?.columns, [
    'energy_level',
    'treatment_qr_mean',
    'inhibition_rate',
    'dimension_correction',
    'confidence_level',
    'notes',
  ])
  assert.equal(node?.definition?.kwargs?.title, '时空抑制率计算结果表')
  assert.equal(node?.definition?.kwargs?.description, '各能量等级下的细胞抑制率')
  assert.equal(node?.definition?.subvars?.energy_level?.type, 'float')
  assert.equal(node?.definition?.subvars?.energy_level?.default, 0)
  assert.equal(node?.definition?.subvars?.energy_level?.kwargs?.title, '能量等级 (TeV)')
  assert.equal(node?.definition?.subvars?.energy_level?.kwargs?.description, '测试能量浓度')
  assert.equal(node?.definition?.subvars?.confidence_level?.default, '高')
  assert.equal(node?.definition?.subvars?.notes?.default, '')
  assert.equal(node?.definition?.subvars?.energy_level?.kwargs?.float, undefined)
  assert.equal(fields.var_table[0]?.subvars[0]?.id, 'energy_level')
  assert.equal(fields.var_table[0]?.subvars[0]?.title, '能量等级 (TeV)')
  assert.equal(fields.var_table[0]?.subvars[0]?.description, '测试能量浓度')
})

test('var auto-detection: subvars= triggers var_table', () => {
  const { tree } = parseAimd('{{var|data, subvars=[a, b]}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'var_table')
})

// ── step parsing ─────────────────────────────────────────────────────────────

test('step: simple id defaults to level 1', () => {
  const { tree } = parseAimd('{{step|prepare_sample}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'step')
  assert.equal(node?.id, 'prepare_sample')
  assert.equal(node?.level, 1)
  assert.equal(node?.check, false)
})

test('step: with level', () => {
  const { tree } = parseAimd('{{step|substep_a, 2}}')
  const node = findAimdNode(tree)
  assert.equal(node?.level, 2)
})

test('step: with check', () => {
  const { tree } = parseAimd('{{step|verify, 1, check=True}}')
  const node = findAimdNode(tree)
  assert.equal(node?.check, true)
})

test('step: with checked_message', () => {
  const { tree } = parseAimd("{{step|verify, check=True, checked_message='Done!'}}")
  const node = findAimdNode(tree)
  assert.equal(node?.check, true)
  assert.equal(node?.checked_message, 'Done!')
})

test('step: preserves title, subtitle, result, and props for host renderers', () => {
  const { tree } = parseAimd("{{step|verify, 2, title='Verify Output', subtitle='Cross-check values', result=True}}")
  const node = findAimdNode(tree)
  assert.equal(node?.title, 'Verify Output')
  assert.equal(node?.subtitle, 'Cross-check values')
  assert.equal(node?.result, true)
  assert.equal(node?.props?.title, 'Verify Output')
  assert.equal(node?.props?.subtitle, 'Cross-check values')
  assert.equal(node?.props?.result, true)
})

test('step: parses duration strings into estimated_duration_ms', () => {
  const { tree } = parseAimd("{{step|incubate, duration='1h30m', check=True}}")
  const node = findAimdNode(tree)
  assert.equal(node?.estimated_duration_ms, 5_400_000)
  assert.equal(node?.props?.duration, '1h30m')
})

test('step: parses timer mode metadata', () => {
  const { tree } = parseAimd("{{step|wash, duration='30s', timer='countdown'}}")
  const node = findAimdNode(tree)
  assert.equal(node?.timer_mode, 'countdown')
  assert.equal(node?.props?.timer, 'countdown')
})

test('step: parses day-scale duration strings into estimated_duration_ms', () => {
  const { tree } = parseAimd("{{step|grow, duration='2d4h'}}")
  const node = findAimdNode(tree)
  assert.equal(node?.estimated_duration_ms, 187_200_000)
})

test('step: level clamped to max 3', () => {
  const { tree } = parseAimd('{{step|deep, 5}}')
  const node = findAimdNode(tree)
  assert.equal(node?.level, 3)
})

test('step: level clamped to min 1', () => {
  const { tree } = parseAimd('{{step|shallow, 0}}')
  const node = findAimdNode(tree)
  assert.equal(node?.level, 1)
})

// ── step hierarchy ───────────────────────────────────────────────────────────

test('step hierarchy: siblings get sequential numbering', () => {
  const { fields } = parseAimd(`
{{step|step_a}}
{{step|step_b}}
{{step|step_c}}
`)
  const hierarchy = fields.step_hierarchy
  assert.equal(hierarchy.length, 3)
  assert.equal(hierarchy[0].step, '1')
  assert.equal(hierarchy[1].step, '2')
  assert.equal(hierarchy[2].step, '3')
})

test('step hierarchy: preserves estimated duration metadata', () => {
  const { fields } = parseAimd(`
{{step|step_a, duration='45s'}}
{{step|step_b, duration='2m 15s', timer='both'}}
`)
  const hierarchy = fields.step_hierarchy
  assert.equal(hierarchy?.[0]?.estimated_duration_ms, 45_000)
  assert.equal(hierarchy?.[1]?.estimated_duration_ms, 135_000)
  assert.equal(hierarchy?.[1]?.timer_mode, 'both')
})

test('step hierarchy: nested steps get hierarchical numbering', () => {
  const { fields } = parseAimd(`
{{step|main_step}}
{{step|sub_a, 2}}
{{step|sub_b, 2}}
`)
  const hierarchy = fields.step_hierarchy
  assert.equal(hierarchy[0].step, '1')
  assert.equal(hierarchy[1].step, '1.1')
  assert.equal(hierarchy[2].step, '1.2')
})

test('step hierarchy: sibling links are set correctly', () => {
  const { fields } = parseAimd(`
{{step|step_a}}
{{step|step_b}}
{{step|step_c}}
`)
  const hierarchy = fields.step_hierarchy
  assert.equal(hierarchy[0].prev_id, undefined)
  assert.equal(hierarchy[0].next_id, 'step_b')
  assert.equal(hierarchy[1].prev_id, 'step_a')
  assert.equal(hierarchy[1].next_id, 'step_c')
  assert.equal(hierarchy[2].prev_id, 'step_b')
  assert.equal(hierarchy[2].next_id, undefined)
})

test('step hierarchy: parent-child relationship', () => {
  const { fields } = parseAimd(`
{{step|parent}}
{{step|child, 2}}
`)
  const hierarchy = fields.step_hierarchy
  assert.equal(hierarchy[0].has_children, true)
  assert.equal(hierarchy[1].parent_id, 'parent')
})

// ── check parsing ────────────────────────────────────────────────────────────

test('check: simple checkpoint', () => {
  const { tree } = parseAimd('{{check|checkpoint_1}}')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'check')
  assert.equal(node?.id, 'checkpoint_1')
})

test('check: with checked_message', () => {
  const { tree } = parseAimd("{{check|verify_step, checked_message='Complete!'}}")
  const node = findAimdNode(tree)
  assert.equal(node?.id, 'verify_step')
  assert.equal(node?.checked_message, 'Complete!')
})

// ── fig parsing ──────────────────────────────────────────────────────────────

test('fig: basic fig block', () => {
  const { fields } = parseAimd(`
\`\`\`fig
id: fig1
src: /images/chart.png
\`\`\`
`)
  assert.equal(fields.fig.length, 1)
  assert.equal(fields.fig[0].id, 'fig1')
  assert.equal(fields.fig[0].src, '/images/chart.png')
})

test('fig: with title and legend', () => {
  const { fields } = parseAimd(`
\`\`\`fig
id: fig2
src: /images/chart.png
title: My Chart
legend: This chart shows data.
\`\`\`
`)
  assert.equal(fields.fig[0].title, 'My Chart')
  assert.equal(fields.fig[0].legend, 'This chart shows data.')
})

// ── ref parsing ──────────────────────────────────────────────────────────────

test('ref_var: reference to variable', () => {
  const { tree, fields } = parseAimd('See {{ref_var|temperature}} for details.')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'ref_var')
  assert.equal(node?.refTarget, 'temperature')
  assert.ok(fields.ref_var.includes('temperature'))
})

test('ref_step: reference to step', () => {
  const { tree, fields } = parseAimd('Go back to {{ref_step|step_1}}.')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'ref_step')
  assert.equal(node?.refTarget, 'step_1')
})

test('ref_fig: reference to figure', () => {
  const { tree, fields } = parseAimd('See {{ref_fig|fig1}} for the chart.')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'ref_fig')
  assert.equal(node?.refTarget, 'fig1')
})

// ── cite parsing ─────────────────────────────────────────────────────────────

test('cite: single citation', () => {
  const { tree, fields } = parseAimd('As noted in {{cite|smith2024}}.')
  const node = findAimdNode(tree)
  assert.equal(node?.fieldType, 'cite')
  assert.deepEqual(node?.refs, ['smith2024'])
})

test('cite: multiple citations', () => {
  const { tree, fields } = parseAimd('See {{cite|smith2024, jones2023}}.')
  const node = findAimdNode(tree)
  assert.deepEqual(node?.refs, ['smith2024', 'jones2023'])
  assert.ok(fields.cite.includes('smith2024'))
  assert.ok(fields.cite.includes('jones2023'))
})

// ── multiple fields in one document ──────────────────────────────────────────

test('multiple var fields are collected', () => {
  const { fields } = parseAimd(`
Temperature: {{var|temperature: float = 25.0}}

Volume: {{var|volume: float = 10.0}}

Name: {{var|sample_name: str}}
`)
  assert.deepEqual(fields.var, ['temperature', 'volume', 'sample_name'])
})

test('duplicate var ids are deduplicated', () => {
  const { fields } = parseAimd(`
First mention: {{var|x: float}}

Second mention: {{var|x: float}}
`)
  assert.deepEqual(fields.var, ['x'])
})

// ── whitespace handling ──────────────────────────────────────────────────────

test('inline template with extra whitespace', () => {
  const { tree } = parseAimd('{{var|  temperature : float  = 25.0  }}')
  const node = findAimdNode(tree)
  assert.equal(node?.definition?.id, 'temperature')
  assert.equal(node?.definition?.type, 'float')
  assert.equal(node?.definition?.default, 25)
})

test('step with extra whitespace around pipe', () => {
  const { tree } = parseAimd('{{step  |  prepare_sample  }}')
  const node = findAimdNode(tree)
  assert.equal(node?.id, 'prepare_sample')
})

// ── validateVarDefaultType ───────────────────────────────────────────────────

test('validateVarDefaultType: int with valid integer default', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'int', default: 10 })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: int with float default warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'int', default: 3.5 })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('not an integer'))
})

test('validateVarDefaultType: int with string "abc" warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'int', default: 'abc' })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('not a valid integer'))
})

test('validateVarDefaultType: float with valid number default', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'float', default: 3.14 })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: float with non-numeric string warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'float', default: 'abc' })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('not a valid number'))
})

test('validateVarDefaultType: bool with true is valid', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'bool', default: true })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: bool with 0 is valid', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'bool', default: 0 })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: bool with string warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'bool', default: 'yes' })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('not a valid boolean'))
})

test('validateVarDefaultType: str with string is valid', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'str', default: 'hello' })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: str with number warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'str', default: 42 })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('not a string'))
})

test('validateVarDefaultType: date with ISO string is valid', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'date', default: '2024-01-15' })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: date with non-ISO string warns', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'date', default: 'Jan 15' })
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('ISO date'))
})

test('validateVarDefaultType: no type → no warnings', () => {
  const warnings = validateVarDefaultType({ id: 'x', default: 42 })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: no default → no warnings', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'int' })
  assert.equal(warnings.length, 0)
})

test('validateVarDefaultType: null default → no warnings', () => {
  const warnings = validateVarDefaultType({ id: 'x', type: 'int', default: null })
  assert.equal(warnings.length, 0)
})

// ── validateVarKwargs ───────────────────────────────────────────────────────

test('validateVarKwargs: numeric constraints are valid on numeric vars', () => {
  const warnings = validateVarKwargs({ id: 'height_cm', type: 'float', kwargs: { gt: 0, le: 300 } })
  assert.deepEqual(warnings, [])
})

test('validateVarKwargs: numeric constraints warn on non-numeric vars', () => {
  const warnings = validateVarKwargs({ id: 'name', type: 'str', kwargs: { ge: 0 } })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /numeric constraints \(ge\) only apply to int\/integer\/float\/number variables, not str/)
})

test('validateVarKwargs: numeric constraints warn on untyped vars', () => {
  const warnings = validateVarKwargs({ id: 'name', kwargs: { gt: 0 } })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /not untyped/)
})

test('validateVarKwargs: numeric constraint values must be numbers', () => {
  const warnings = validateVarKwargs({ id: 'height_cm', type: 'float', kwargs: { gt: '0' } })
  assert.deepEqual(warnings, ['"height_cm": numeric constraint "gt" must be a number'])
})

test('validateVarKwargs: multiple_of must be positive', () => {
  const warnings = validateVarKwargs({ id: 'step', type: 'int', kwargs: { multiple_of: 0 } })
  assert.deepEqual(warnings, ['"step": numeric constraint "multiple_of" must be greater than 0'])
})

test('validateVarKwargs: checks nested subvars', () => {
  const warnings = validateVarKwargs({
    id: 'rows',
    subvars: {
      label: { id: 'label', type: 'str', kwargs: { lt: 10 } },
    },
  })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /^"label":/)
})

test('validateVarDefinition: combines default and kwargs warnings', () => {
  const warnings = validateVarDefinition({
    id: 'score',
    type: 'str',
    default: 12,
    kwargs: { gt: 0 },
  })
  assert.equal(warnings.length, 2)
  assert.match(warnings[0], /default 12 is not a string/)
  assert.match(warnings[1], /numeric constraints \(gt\)/)
})
