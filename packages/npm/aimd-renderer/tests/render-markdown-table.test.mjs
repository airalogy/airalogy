import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseAndExtract, renderToHtml } from '../dist/html.js'
import { renderToVue } from '../dist/vue.js'

const TABLE_WITH_INLINE_VAR = `
| Ingredient | Amount |
| --- | --- |
| Water | {{var|water_volume_ml: float, gt = 0}} mL |
`

const EXTRACTED_ID_SAMPLE = `
{{var_table|samples, subvars=[sample_id, concentration, volume]}}

{{step|sample_preparation}}
{{step|buffer_setup, 2}}
{{step|data_analysis}}
`

const STEP_REFERENCE_SAMPLE = `
{{step|sample_preparation}}
{{step|buffer_setup, 2}}

Referenced nested step: {{ref_step|buffer_setup}}
`

const REF_VAR_RECORD_SAMPLE = `
{{var|temperature: float}}

Recorded value: {{ref_var|temperature}}
Missing value: {{ref_var|operator}}
`

const CHOICE_MODE_SAMPLE = [
  '```quiz',
  'id: quiz_single_1',
  'type: choice',
  'mode: single',
  'stem: Pick one option.',
  'options:',
  '  - key: A',
  '    text: First',
  '  - key: B',
  '    text: Second',
  'answer: A',
  '```',
  '',
  '```quiz',
  'id: quiz_multiple_1',
  'type: choice',
  'mode: multiple',
  'stem: Pick more than one option.',
  'options:',
  '  - key: A',
  '    text: First',
  '  - key: B',
  '    text: Second',
  '  - key: C',
  '    text: Third',
  'answer: [A, C]',
  '```',
].join('\n')

const TRUE_FALSE_SAMPLE = [
  '```quiz',
  'id: quiz_true_false_1',
  'type: true_false',
  'stem: The sample stayed cold.',
  'answer: true',
  '```',
].join('\n')

const ASSIGNER_VISIBILITY_SAMPLE = [
  '{{var|water_volume_ml: float}}',
  '{{var|lemon_juice_ml: float}}',
  '{{var|server_total_ml: float}}',
  '{{var|client_total_ml: float}}',
  '',
  '```assigner',
  'def calculate_server_total_ml(dependent_fields):',
  '    return {"server_total_ml": dependent_fields["water_volume_ml"] + dependent_fields["lemon_juice_ml"]}',
  '```',
  '',
  '```assigner runtime=client',
  'assigner(',
  '  {',
  '    mode: "auto",',
  '    dependent_fields: ["water_volume_ml", "lemon_juice_ml"],',
  '    assigned_fields: ["client_total_ml"],',
  '  },',
  '  function calculate_client_total_ml({ water_volume_ml, lemon_juice_ml }) {',
  '    return {',
  '      client_total_ml: water_volume_ml + lemon_juice_ml,',
  '    };',
  '  }',
  ');',
  '```',
].join('\n')

function isVNodeLike(value) {
  return typeof value === 'object' && value !== null && 'type' in value
}

function flattenText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => flattenText(item)).join('')
  }

  if (!isVNodeLike(value)) {
    return ''
  }

  return flattenText(value.children)
}

function collectVNodesByType(value, aimdType, matches = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectVNodesByType(item, aimdType, matches))
    return matches
  }

  if (!isVNodeLike(value)) {
    return matches
  }

  if (value.props?.['data-aimd-type'] === aimdType) {
    matches.push(value)
  }

  collectVNodesByType(value.children, aimdType, matches)
  return matches
}

test('renderToHtml renders inline var inside markdown table without escape syntax', async () => {
  const { html, fields } = await renderToHtml(TABLE_WITH_INLINE_VAR)

  assert.match(html, /data-aimd-id="water_volume_ml"/)
  assert.doesNotMatch(html, /data-aimd-name=/)
  assert.match(html, /aimd-field--var/)
  assert.match(html, /<td><span class="aimd-field aimd-field--var"/)
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('parseAndExtract finds inline vars inside markdown table', () => {
  const fields = parseAndExtract(TABLE_WITH_INLINE_VAR)

  assert.deepEqual(fields.var, ['water_volume_ml'])
  assert.equal(fields.var_definitions?.[0]?.id, 'water_volume_ml')
  assert.equal(fields.var_definitions?.[0]?.type, 'float')
  assert.equal(fields.var_definitions?.[0]?.kwargs?.gt, 0)
})

test('parseAndExtract exposes canonical ids for extracted field objects', () => {
  const fields = parseAndExtract(EXTRACTED_ID_SAMPLE)

  assert.equal(fields.var_table[0]?.id, 'samples')
  assert.equal(fields.var_table[0]?.subvars?.[0]?.id, 'sample_id')
  assert.equal(fields.step_hierarchy?.[0]?.id, 'sample_preparation')
  assert.equal(fields.step_hierarchy?.[1]?.id, 'buffer_setup')
  assert.equal(fields.step_hierarchy?.[1]?.step, '1.1')
  assert.equal(fields.step_hierarchy?.[2]?.prev_id, 'sample_preparation')
})

test('renderToHtml renders ref_step using localized step sequence', async () => {
  const { html } = await renderToHtml(STEP_REFERENCE_SAMPLE)

  assert.match(html, /data-aimd-step-sequence="1\.1"/)
  assert.match(html, /class="aimd-field aimd-field--step aimd-field--readonly"/)
  assert.match(html, /research-step__sequence">Step 1\.1</)
  assert.doesNotMatch(html, /research-step__sequence">Step 1\.1 :</)
  assert.match(html, /title="buffer_setup"/)
})

test('renderToVue renders ref_step using localized step sequence in edit mode', async () => {
  const { nodes } = await renderToVue(STEP_REFERENCE_SAMPLE, {
    context: {
      mode: 'edit',
    },
  })

  const refSteps = collectVNodesByType(nodes, 'ref_step')

  assert.equal(refSteps.length, 1)
  assert.equal(refSteps[0]?.props?.['data-aimd-ref'], 'buffer_setup')
  assert.equal(refSteps[0]?.props?.['data-aimd-step-sequence'], '1.1')
  assert.equal(refSteps[0]?.props?.title, 'buffer_setup')
  assert.match(flattenText(refSteps[0]), /Step 1\.1/)
  assert.doesNotMatch(flattenText(refSteps[0]), /buffer_setup/)
})

test('renderToVue renders ref_var using readonly record values in edit mode when available', async () => {
  const { nodes } = await renderToVue(REF_VAR_RECORD_SAMPLE, {
    context: {
      mode: 'edit',
      value: {
        var: {
          temperature: 4,
        },
        step: {},
        check: {},
        quiz: {},
      },
    },
  })

  const refVars = collectVNodesByType(nodes, 'ref_var')

  assert.equal(refVars.length, 2)
  assert.equal(refVars[0]?.props?.['data-aimd-ref'], 'temperature')
  assert.equal(refVars[0]?.props?.title, 'temperature')
  assert.match(flattenText(refVars[0]), /4/)
  assert.doesNotMatch(flattenText(refVars[0]), /temperature/)

  assert.equal(refVars[1]?.props?.['data-aimd-ref'], 'operator')
  assert.equal(refVars[1]?.props?.title, 'operator')
  assert.match(flattenText(refVars[1]), /varoperator/)
})

test('renderToHtml distinguishes single and multiple choice labels by locale', async () => {
  const { html: enHtml } = await renderToHtml(CHOICE_MODE_SAMPLE)
  const { html: zhHtml } = await renderToHtml(CHOICE_MODE_SAMPLE, { locale: 'zh-CN' })

  assert.match(enHtml, /\(Single choice\)/)
  assert.match(enHtml, /\(Multiple choice\)/)
  assert.doesNotMatch(enHtml, /\(choice\)/)

  assert.match(zhHtml, /\(单选\)/)
  assert.match(zhHtml, /\(多选\)/)
  assert.doesNotMatch(zhHtml, /\(选择\)/)
})

test('renderToHtml renders true/false quiz labels and default options', async () => {
  const { html, fields } = await renderToHtml(TRUE_FALSE_SAMPLE)

  assert.equal(fields.quiz[0]?.type, 'true_false')
  assert.equal(fields.quiz[0]?.answer, true)
  assert.match(html, /\(True\/false\)/)
  assert.match(html, /true\. True/)
  assert.match(html, /false\. False/)
})

test('renderToHtml hides assigner blocks by default while preserving client assigner metadata', async () => {
  const { html, fields } = await renderToHtml(ASSIGNER_VISIBILITY_SAMPLE)

  assert.doesNotMatch(html, /calculate_server_total_ml/)
  assert.doesNotMatch(html, /calculate_client_total_ml/)
  assert.equal(fields.client_assigner[0]?.id, 'calculate_client_total_ml')
})

test('renderToHtml can expand assigner blocks as language-specific code fences', async () => {
  const { html } = await renderToHtml(ASSIGNER_VISIBILITY_SAMPLE, {
    assignerVisibility: 'expanded',
  })

  assert.match(html, /aimd-assigner-preview--expanded/)
  assert.match(html, /language-python/)
  assert.match(html, /language-javascript/)
  assert.match(html, /Server assigner/)
  assert.match(html, /Client assigner/)
  assert.match(html, /calculate_server_total_ml/)
  assert.match(html, /calculate_client_total_ml/)
  assert.match(html, /style="color:/)
})

test('renderToHtml can collapse assigner blocks behind localized details summaries', async () => {
  const { html: enHtml } = await renderToHtml(ASSIGNER_VISIBILITY_SAMPLE, {
    assignerVisibility: 'collapsed',
  })
  const { html: zhHtml } = await renderToHtml(ASSIGNER_VISIBILITY_SAMPLE, {
    assignerVisibility: 'collapsed',
    locale: 'zh-CN',
  })

  assert.match(enHtml, /<details class="aimd-assigner-preview aimd-assigner-preview--collapsed aimd-assigner-preview--server"/)
  assert.match(enHtml, /Server assigner/)
  assert.match(enHtml, /Client assigner/)
  assert.match(enHtml, />PY<\/span>/)
  assert.match(enHtml, />JS<\/span>/)
  assert.match(enHtml, /language-python/)
  assert.match(enHtml, /language-javascript/)
  assert.match(enHtml, /aimd-assigner-code__line/)
  assert.match(enHtml, /style="color:/)

  assert.match(zhHtml, /服务端 assigner/)
  assert.match(zhHtml, /前端 assigner/)
  assert.match(zhHtml, />PY<\/span>/)
  assert.match(zhHtml, />JS<\/span>/)
})
