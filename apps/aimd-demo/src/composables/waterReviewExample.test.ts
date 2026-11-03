// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AimdRecorder from '../../../../packages/npm/aimd-recorder/src/components/AimdRecorder.vue'
import { parseAndExtract, renderToHtml } from '@airalogy/aimd-renderer'
import { applyClientAssigners } from '../../../../packages/npm/aimd-recorder/src/client-assigner'
import fixtures from '../../../../examples/protocols/surface-water-quality-review/zh-CN/demo-records.json'
import { DEMO_EXAMPLES, getDemoExampleContent } from './sampleContent'

const example = DEMO_EXAMPLES.find(item => item.id === 'surface-water-quality-review')!
const content = getDemoExampleContent(example, 'zh-CN')
const fields = parseAndExtract(content)
const original = fixtures.records[0].data.var.reading_pairs[0]

function compute(pairs: unknown[]) {
  const values: Record<string, any> = { reading_pairs: pairs }
  applyClientAssigners(fields.client_assigner!, values, {
    fieldDefinitions: Object.fromEntries((fields.var_definitions ?? []).map(field => [field.id, { type: field.type, kwargs: field.kwargs }])),
  })
  return values
}

describe('surface-water review demonstration', () => {
  it('recalculates after actual Recorder table edits', async () => {
    let wrapper: ReturnType<typeof mount>
    wrapper = mount(AimdRecorder, { props: {
      content, locale: 'zh-CN', modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      'onUpdate:modelValue': value => { void wrapper?.setProps({ modelValue: value }) },
    } })
    try {
      await flushPromises()
      for (const [label, value] of [['配对编号', 'PAIR-UI'], ['自动站 DO', '3.2'], ['现场第 1 次', '6.8'], ['现场第 2 次', '6.6']]) {
        await wrapper.find(`input[aria-label="${label}: 1"]`).setValue(value)
        await flushPromises()
      }
      for (const label of ['仪器核查有效', '可比性确认']) {
        await wrapper.find(`select[aria-label="${label}: 1"]`).setValue('0')
        await flushPromises()
      }
      const updates = wrapper.emitted('update:modelValue') ?? []
      const latest = updates.at(-1)?.[0] as any
      expect(latest.var.comparison_results[0].status).toBe('比对差异需核查')
      expect(Number(latest.var.comparison_results[0].absolute_difference)).toBe(3.5)
    } finally {
      wrapper.unmount()
    }
  })
  it('applies a table edit to the current record even if the rendered row has been replaced', async () => {
    const wrapper = mount(AimdRecorder, { props: { content, locale: 'zh-CN', modelValue: structuredClone(fixtures.records[0].data) } })
    try {
      await flushPromises()
      const table = wrapper.findAllComponents({ name: 'AimdVarTableField' }).find(component => component.props('node').id === 'reading_pairs')!
      table.vm.$emit('cell-input', { tableName: 'reading_pairs', column: 'auto_do', rowIndex: 0, value: '3.2', row: { ...original } })
      await flushPromises()
      const latest = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as any
      expect(latest.var.reading_pairs[0].auto_do).toBe('3.2')
      expect(latest.var.comparison_results[0].status).toBe('比对差异需核查')
    } finally {
      wrapper.unmount()
    }
  })
  it('registers a complete, renderable protocol with titled steps and no fabricated defaults', async () => {
    expect(example.kind).toBe('protocol')
    expect(fields.step).toHaveLength(8)
    expect(fields.step_hierarchy?.every(step => Boolean(step.title))).toBe(true)
    expect(fields.var_table.map(table => table.id)).toEqual(['reading_pairs', 'comparison_results', 'samples'])
    expect(fields.client_assigner).toHaveLength(1)
    for (const ref of fields.ref_step) expect(fields.step).toContain(ref)
    for (const id of ['task_id', 'field_operator', 'auto_observed_at', 'field_observed_at']) {
      expect(fields.var_definitions?.find(field => field.id === id)?.default).toBeUndefined()
    }
    const { html } = await renderToHtml(content, { locale: 'zh-CN' })
    const element = document.createElement('div')
    element.innerHTML = html
    expect(element.querySelectorAll('[data-aimd-type="step"]')).toHaveLength(8)
    for (const token of ['{{var|', '{{step|', '{{check|', '{{ref_step|']) expect(element.textContent).not.toContain(token)
    expect(element.textContent).toContain('不作为正式监测判据')
    expect(Array.from(element.querySelectorAll('h2'), heading => heading.textContent)).toEqual([
      '一、填写监测读数', '二、查看比对结果', '三、补充追溯信息',
    ])
    expect(fields.step).toEqual([
      'register_task', 'record_readings', 'review_comparison', 'document_actions',
      'verify_equipment', 'pair_source_data', 'track_samples', 'human_review',
    ])
    const introduction = parseAndExtract(content.split('## 二、')[0])
    expect(introduction.var).toEqual(['task_id', 'site_name', 'task_reason', 'measurement_note'])
    expect(introduction.var_table.map(table => table.id)).toEqual(['reading_pairs'])
  })

  it.each([
    [0, 6.7, 2.99, 0, '演示规则内一致'],
    [1, 6.7, 2.99, 3.5, '比对差异需核查'],
    [2, 5, 72, null, '重复读数需复测'],
  ])('computes synthetic record %s without changing raw data', (index, mean, rpd, difference, status) => {
    const pairs = structuredClone(fixtures.records[index as number].data.var.reading_pairs)
    const before = structuredClone(pairs)
    const result = compute(pairs)
    expect(result.comparison_results[0]).toMatchObject({ field_mean: mean, repeat_rpd: rpd, absolute_difference: difference, status })
    expect(result.review_brief).toContain(status)
    expect(result.review_brief).toContain('DEMO-DO-001 v1')
    expect(pairs).toEqual(before)
  })

  it.each([
    [{ field_do_1: null }, '待补充原始读数'],
    [{ field_do_1: '' }, '待补充原始读数'],
    [{ field_do_1: -1 }, '输入不合法，请核对'],
    [{ field_do_1: Infinity }, '输入不合法，请核对'],
    [{ field_do_1: '6.8 mg/L' }, '输入不合法，请核对'],
    [{ field_do_1: true }, '输入不合法，请核对'],
    [{ field_do_1: '  ' }, '待补充原始读数'],
    [{ calibration_valid: null }, '待确认仪器核查'],
    [{ calibration_valid: '否' }, '仪器核查未通过'],
    [{ comparable: null }, '待确认可比性'],
    [{ comparable: '否' }, '不可直接比对'],
    [{ auto_do: 0, field_do_1: 0, field_do_2: 0 }, '零均值，需另行复核'],
    [{ auto_do: 3.1, field_do_1: 3.2, field_do_2: 3 }, '一致但低值待复核'],
  ])('does not confuse incomplete, invalid, unconfirmed, or low values with normality: %j', (patch, status) => {
    const result = compute([{ ...original, ...patch }]).comparison_results[0]
    expect(result.status).toBe(status)
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/)
  })

  it('uses unrounded values at both acceptance boundaries', () => {
    expect(compute([{ ...original, auto_do: 6.5, field_do_1: 6.3, field_do_2: 5.7 }]).comparison_results[0].status).toBe('演示规则内一致')
    expect(compute([{ ...original, auto_do: 6.50001, field_do_1: 6.3, field_do_2: 5.7 }]).comparison_results[0].status).toBe('比对差异需核查')
    expect(compute([{ ...original, auto_do: 6, field_do_1: 6.30001, field_do_2: 5.69999 }]).comparison_results[0].status).toBe('重复读数需复测')
  })

  it('accepts Recorder table text values without interpreting empty text as zero', () => {
    const values = compute([{ ...original, auto_do: '6.7', field_do_1: '6.8', field_do_2: '6.6' }])
    expect(values.comparison_results[0]).toMatchObject({ field_mean: 6.7, repeat_rpd: 2.99, status: '演示规则内一致' })
  })

  it('requires one pair per record and clears results when rows or readings are cleared', () => {
    expect(compute([original, { ...original }]).comparison_results[0].status).toBe('一条记录只允许一次配对，请拆分记录')
    const values = compute([{ ...original }])
    values.reading_pairs[0].field_do_1 = null
    applyClientAssigners(fields.client_assigner!, values)
    expect(values.comparison_results[0].field_mean).toBeNull()
    expect(values.comparison_results[0].status).toBe('待补充原始读数')
    values.reading_pairs = []
    applyClientAssigners(fields.client_assigner!, values)
    expect(values.comparison_results).toEqual([])
    expect(values.review_brief).toContain('配对记录：0 条')
  })
})
