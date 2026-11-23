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
  it('uses unique titled fields, keeps authored hints, and navigates by stable keys', async () => {
    const panel = mount(AimdRecorder, { props: { content, layout: 'field-panel', locale: 'en-US' } })
    await flushPromises()
    expect(panel.findAll('[data-panel-field]').map(f => f.attributes('data-panel-field'))).toEqual(['var:sample', 'var:photo'])
    expect(panel.get('[data-rec-focus-key="var:sample"]').attributes('placeholder')).toBe('S-01')
    expect(panel.get('[data-panel-field="var:photo"]').text()).toContain('Optional')
    expect(panel.findAll('.aimd-panel-outline button').map(b => b.text())).toEqual(['Prepare', 'Inspect label', 'legacy'])
    await panel.get('.aimd-panel-outline button').trigger('click')
    expect(panel.emitted('navigate-field')).toEqual([['step:start']])
    await panel.setProps({ panelVariables: ['extra', 'photo', 'photo'], fieldMeta: { 'var:extra': {title:'Additional field'} } })
    await flushPromises()
    expect(panel.findAll('[data-panel-field]').map(f => f.attributes('aria-label'))).toEqual(['Additional field', 'Label photo'])
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
