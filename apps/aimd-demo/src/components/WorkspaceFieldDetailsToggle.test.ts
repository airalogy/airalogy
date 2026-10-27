// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import WorkspaceFieldDetailsToggle from './WorkspaceFieldDetailsToggle.vue'

const wrappers: VueWrapper[] = []
function create() {
  const wrapper = mount(WorkspaceFieldDetailsToggle, {
    attachTo: document.body,
    props: { modelValue: true, label: 'Show field details' },
  })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })

describe('workspace field details toggle', () => {
  it('always exposes a labelled native switch without a popover', async () => {
    const wrapper = create()
    expect(wrapper.get('label').text()).toBe('Show field details')
    const input = wrapper.get<HTMLInputElement>('input[type="checkbox"][role="switch"]')
    expect(input.isVisible()).toBe(true)
    expect(input.element.checked).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await input.setValue(false)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('keeps the two panels synchronized in both directions', async () => {
    const parent = mount(defineComponent({
      components: { WorkspaceFieldDetailsToggle },
      setup: () => ({ details: ref(true) }),
      template: '<WorkspaceFieldDetailsToggle v-for="panel in 2" :key="panel" v-model="details" label="Show field details" />',
    }), { attachTo: document.body })
    wrappers.push(parent)
    const [first, second] = parent.findAllComponents(WorkspaceFieldDetailsToggle)
    await first.get('input').setValue(false)
    expect(second.get<HTMLInputElement>('input').element.checked).toBe(false)
    await second.get('input').setValue(true)
    expect(first.get<HTMLInputElement>('input').element.checked).toBe(true)
  })

  it('retains keyboard focus when the controlled value changes', async () => {
    const wrapper = create()
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.focus()
    await wrapper.setProps({ modelValue: false, label: '显示字段信息' })
    expect(document.activeElement).toBe(input.element)
    expect(input.element.checked).toBe(false)
    expect(wrapper.get('label').text()).toBe('显示字段信息')
  })
})
