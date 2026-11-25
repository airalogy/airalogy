import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AimdRecorder from '../components/AimdRecorder.vue'

describe('standalone field panel', () => {
  const content = [
    'Example: `{{var|ignored}}`',
    '{{step|start, title="Prepare"}} {{var|sample: str, title="Label", placeholder="S-01"}}',
    '{{var|photo: FileIdJPG | None = None, title="Label photo"}}',
    '{{check|inspect, title="Inspect label"}} {{check|legacy}}',
  ].join('\n\n')
  it.each([false, true])('shows protocol definitions separately from values (readonly=%s)', async readonly => {
    const panel = mount(AimdRecorder, { props: {
      content: '{{var|count: int = 0, title="Count"}}', layout: 'field-panel', readonly, locale: 'zh-CN',
      modelValue: { var: { count: 17 } }, validationSchema: { research_variable: {
        properties: { count: { $ref: '#/$defs/count' } },
        $defs: { count: { type: 'integer', examples: [0, 8], minimum: 0, maximum: 20, description: 'Units counted' } },
      } },
    } })
    await flushPromises()
    const definition = panel.get('[data-panel-key="var:count"] dl')
    const entries = Object.fromEntries(definition.findAll('dt').map(dt => [dt.text(), dt.element.nextElementSibling?.textContent]))
    expect(entries).toMatchObject({ '字段 ID': 'count', '类型': 'int', '示例数据': '0\n8', '默认值': '0', '说明': 'Units counted' })
    expect(entries['其他定义与约束']).toContain('minimum = 0')
    expect(entries['其他定义与约束']).toContain('maximum = 20')
    expect(definition.text()).not.toContain('17')
    panel.unmount()
  })

  it('finishes a pointer activation before an adjacent required-field error changes the layout', async () => {
    const panel = mount(AimdRecorder, { props: {
      content: '{{var|location: str}} {{var|photo: FileIdJPG | None = None}}',
      layout: 'field-panel', validationTriggers: ['blur'],
    } })
    try {
      await flushPromises()
      const target = panel.get('[data-panel-field="var:photo"] .aimd-panel-upload button')
      const location = panel.get('[data-rec-focus-key="var:location"]')
      await target.trigger('pointerdown', { button: 0 })
      await location.trigger('blur')
      await flushPromises()
      expect(panel.find('[role=alert]').exists()).toBe(false)
      window.dispatchEvent(new MouseEvent('click'))
      await vi.waitFor(() => expect(panel.find('[role=alert]').exists()).toBe(true))
    } finally {
      panel.unmount()
    }
  })

  it('uses unique titled fields, keeps authored hints, and navigates by stable keys', async () => {
    const panel = mount(AimdRecorder, { props: { content, layout: 'field-panel', locale: 'en-US' } })
    await flushPromises()
    expect(panel.findAll('[data-panel-field]').map(f => f.attributes('data-panel-field'))).toEqual(['var:sample', 'var:photo'])
    expect(panel.get('[data-rec-focus-key="var:sample"]').attributes('placeholder')).toBe('S-01')
    expect(panel.get('[data-panel-field="var:photo"]').text()).toContain('Optional')
    expect(panel.findAll('[data-panel-group=step] [data-panel-key], [data-panel-group=check] [data-panel-key]').map(b => b.attributes('aria-label'))).toEqual(['Prepare', 'Inspect label', 'legacy'])
    expect(panel.get('[data-panel-key="var:sample"] .aimd-panel-label code').text()).toBe('sample')
    await panel.setProps({ fieldDisplay: 'compact' })
    await flushPromises()
    expect(panel.get('.aimd-fields-list').attributes('data-field-display')).toBe('compact')
    expect(panel.find('[data-panel-key="var:sample"] .aimd-panel-label code').exists()).toBe(false)
    await panel.get('[data-navigate-field="step:start"]').trigger('click')
    expect(panel.emitted('navigate-field')).toEqual([['step:start']])
    await panel.setProps({ panelVariables: ['extra', 'photo', 'photo'], fieldMeta: { 'var:extra': {title:'Additional field'} } })
    await flushPromises()
    expect(panel.findAll('[data-panel-field]').map(f => f.attributes('aria-label'))).toEqual(['Additional field', 'Label photo'])
  })

  it('keeps the same grouped rows when reading and preserves missing, zero and unchecked values', async () => {
    const panel = mount(AimdRecorder, { props: {
      content: '{{var|n: int = 7}} {{var|zero: int}} {{check|verified}}',
      layout: 'field-panel', readonly: true, locale: 'zh-CN',
      modelValue: { var: {zero: 0}, check: { verified: { checked: false, annotation: '核对备注' } } },
    } })
    await flushPromises()
    expect(panel.get('[data-panel-group="var"] > summary').text()).toBe('变量')
    expect(panel.get('[data-panel-group="check"] > summary').text()).toBe('检查点')
    expect(panel.get('[data-panel-key="var:n"] .aimd-panel-value').text()).toContain('未记录')
    expect(panel.get('[data-panel-key="var:zero"] .aimd-panel-value').text()).toBe('0')
    expect(panel.get('[data-panel-key="check:verified"]').text()).toContain('未勾选')
    expect(panel.get('[data-panel-key="check:verified"]').text()).toContain('核对备注')
    expect(panel.find('input, textarea, select, [contenteditable=true]').exists()).toBe(false)
    expect(panel.emitted('update:modelValue')).toBeUndefined()
    await panel.setProps({ modelValue: { var: {n: 22}, check: {} } })
    await flushPromises()
    expect(panel.get('[data-panel-key="var:n"] .aimd-panel-value').text()).toBe('22')
    expect(panel.get('[data-panel-key="check:verified"] .aimd-record-check__status').text()).toBe('未记录')
    panel.unmount()
  })

  it('keeps the displayed value when switching between reading and editing', async () => {
    const panel = mount(AimdRecorder, { props: {
      content: '{{var|count: int}}', layout: 'field-panel', readonly: true, modelValue: {var: {count: 0}},
    } })
    await flushPromises()
    await panel.setProps({readonly: false})
    await flushPromises()
    expect((panel.get('input').element as HTMLInputElement).value).toBe('0')
    await panel.setProps({readonly: true, modelValue: {var: {count: 12}}})
    await flushPromises()
    expect(panel.get('.aimd-panel-value').text()).toBe('12')
    expect(panel.find('input').exists()).toBe(false)
    panel.unmount()
  })

  it('displays saved table cells only once and keeps legacy question answers', async () => {
    const panel = mount(AimdRecorder, { props: {
      content: '{{var_table|readings, subvars=[count: int]}}',
      layout: 'field-panel', readonly: true,
      modelValue: {var: {readings: [{count: 0}]}, quiz: {review: 'Reviewed'}},
    } })
    await flushPromises()
    expect(panel.get('[data-panel-key="var_table:readings"] td').text()).toBe('0')
    expect(panel.find('[data-panel-key="var:readings"]').exists()).toBe(false)
    expect(panel.get('[data-panel-key="quiz:review"] .aimd-panel-value').text()).toContain('Reviewed')
    panel.unmount()
  })

  it('resolves a saved attachment for viewing and retains historical values without an upload control', async () => {
    const resolveFileInfo = vi.fn().mockResolvedValue({ url: '/attachments/demo.jpg', name: 'demo.jpg', type: 'image/jpeg' })
    const panel = mount(AimdRecorder, { props: {
      content, layout: 'field-panel', readonly: true, resolveFileInfo,
      modelValue: { var: { photo: 'airalogy.id.file.demo.jpg', archived: 'historical' } },
    } })
    await flushPromises()
    const photo = panel.get('[data-panel-key="var:photo"]')
    expect(photo.get('img').attributes('src')).toBe('/attachments/demo.jpg')
    expect(resolveFileInfo).toHaveBeenCalledWith('airalogy.id.file.demo.jpg', expect.objectContaining({fieldKey: 'photo'}))
    expect(panel.find('input[type=file]').exists()).toBe(false)
    const archived = panel.get('[data-panel-key="var:archived"]')
    expect(archived.text()).toContain('historical')
    expect(archived.find('[data-navigate-field]').exists()).toBe(false)
    panel.unmount()
  })

  it('shows upload progress, preserves a failed value and emits the confirmed reference on retry', async () => {
    let reject!: (error: Error) => void
    const uploadFile = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail })).mockResolvedValue('airalogy.id.file.test.jpg')
    const panel = mount(AimdRecorder, { props: { content, layout: 'field-panel', uploadFile, locale: 'zh-CN' } })
    await flushPromises()
    expect(panel.get('.aimd-panel-upload button').text()).toContain('JPG')
    const input = panel.get('input[type=file]')
    const file = new File(['photo'], 'label.jpg', {type:'image/jpeg'})
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(panel.get('[role=status]').text()).toBe('上传中…')
    expect(panel.emitted('field-change')).toBeUndefined()
    reject(new Error('offline'))
    await flushPromises()
    expect(panel.find('.aimd-rec-file-field__error').exists()).toBe(true)
    await input.trigger('change')
    await flushPromises()
    expect(panel.emitted('field-change')?.[0]?.[0]).toMatchObject({ fieldKey:'photo', value:'airalogy.id.file.test.jpg' })
  })
})
