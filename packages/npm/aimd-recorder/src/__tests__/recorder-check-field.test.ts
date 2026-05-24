import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  parseAndExtract: vi.fn(),
  renderToVue: vi.fn(),
}))

vi.mock('@airalogy/aimd-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@airalogy/aimd-renderer')>()
  return {
    ...actual,
    parseAndExtract: mocks.parseAndExtract,
    renderToVue: mocks.renderToVue,
  }
})

import AimdRecorder from '../components/AimdRecorder.vue'

const checkNode = {
  type: 'aimd',
  fieldType: 'check',
  id: 'quality_control',
  name: 'quality_control',
  label: 'quality_control',
  raw: '{{check|quality_control}}',
  scope: 'check',
}

function createFields() {
  return {
    var: [],
    var_definitions: [],
    var_table: [],
    client_assigner: [],
    quiz: [],
    step: [],
    check: [{ name: 'quality_control', label: 'quality_control' }],
    ref_step: [],
    ref_var: [],
    ref_fig: [],
    cite: [],
    fig: [],
  }
}

async function mountRecorder(content: string) {
  const wrapper = mount(AimdRecorder, {
    props: {
      content,
      locale: 'zh-CN',
      modelValue: { var: {}, step: {}, check: {}, quiz: {} },
    },
  })

  await flushPromises()
  await nextTick()

  return wrapper
}

describe('AimdRecorder check fields', () => {
  beforeEach(() => {
    mocks.parseAndExtract.mockImplementation(() => createFields())
    mocks.renderToVue.mockImplementation(async (
      content: string,
      options: { aimdRenderers: { check: (node: unknown, ctx: unknown, children: unknown[]) => unknown } },
    ) => {
      const children = content.includes('with body')
        ? [
            h('div', { class: 'aimd-check-body', 'data-aimd-check-body': 'true' }, [
              h('span', '数据完整性检查。'),
            ]),
          ]
        : [
            h('input', { type: 'checkbox', class: 'aimd-checkbox', disabled: true }),
            h('span', { class: 'aimd-field__label' }, 'quality_control'),
          ]

      return {
        fields: createFields(),
        nodes: [options.aimdRenderers.check(checkNode, {}, children)],
      }
    })
  })

  it('strips the renderer default checkbox from bare check bodies', async () => {
    const wrapper = await mountRecorder('{{check|quality_control}}')

    expect(wrapper.findAll('.aimd-rec-inline--check input[type="checkbox"]')).toHaveLength(1)
    expect(wrapper.find('.aimd-check-field__body input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('.aimd-check-field__key').text()).toBe('quality_control')
  })

  it('keeps grouped check body text while using one interactive checkbox', async () => {
    const wrapper = await mountRecorder('{{check|quality_control}} with body')

    expect(wrapper.findAll('.aimd-rec-inline--check input[type="checkbox"]')).toHaveLength(1)
    expect(wrapper.find('.aimd-check-field__body').text()).toContain('数据完整性检查。')
    expect(wrapper.find('.aimd-check-field__key').exists()).toBe(false)
  })
})
