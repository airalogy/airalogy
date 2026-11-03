import { flushPromises, mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import AimdRecorder from '../components/AimdRecorder.vue'

it('writes table cell changes to the current record before running client assigners', async () => {
  const content = `{{var|readings: list[Reading], subvars=[var(value: float)]}}
{{var|total: float | None}}
\`\`\`assigner runtime=client
assigner({ mode: "auto", dependent_fields: ["readings"], assigned_fields: ["total"] },
  function total_reading({ readings }) { return { total: Number(readings[0].value) }; });
\`\`\``
  const wrapper = mount(AimdRecorder, { props: {
    content, modelValue: { var: { readings: [{ value: 1 }] }, step: {}, check: {}, quiz: {} },
  } })
  try {
    await flushPromises()
    const table = wrapper.findComponent({ name: 'AimdVarTableField' })
    const staleRow = { value: '1' }
    table.vm.$emit('cell-input', { tableName: 'readings', column: 'value', rowIndex: 0, value: '7', row: staleRow })
    await flushPromises()
    const updates = wrapper.emitted('update:modelValue') ?? []
    const record = updates[updates.length - 1]?.[0] as { var: { readings: unknown[]; total: number } }
    expect(record.var.readings).toEqual([{ value: '7' }])
    expect(record.var.total).toBe(7)
    expect(staleRow.value).toBe('1')
  } finally {
    wrapper.unmount()
  }
})
