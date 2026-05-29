import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AimdCheckNode, AimdStepNode } from '@airalogy/aimd-core/types'

import { createAimdRecorderMessages } from '../locales'
import { AimdCheckField, AimdStepField } from '../components/AimdStepCheckField.vue'
import { createEmptyStepRecordItem, startStepTimer } from '../composables/useStepTimers'

vi.mock('@airalogy/aimd-editor/vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    AimdEditor: defineComponent({
      name: 'AimdEditorMock',
      props: {
        modelValue: {
          type: String,
          default: '',
        },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () => h('textarea', {
          class: 'aimd-editor-mock',
          value: props.modelValue,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
        })
      },
    }),
  }
})

vi.mock('@airalogy/aimd-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@airalogy/aimd-renderer')>()
  const { h } = await import('vue')

  return {
    ...actual,
    loadShikiHighlighter: vi.fn(() => new Promise(() => {})),
    renderToVue: async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-note' }, content)],
      fields: {},
    }),
  }
})

async function flushStepFieldAsync() {
  await flushPromises()
  await nextTick()
}

describe('AimdStepField', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function createBaseProps(nodeOverrides: Partial<AimdStepNode> = {}) {
    const node: AimdStepNode = {
      id: 'prepare',
      fieldType: 'step',
      scope: 'step',
      type: 'aimd',
      raw: '{{step|prepare}}',
      level: 1,
      sequence: 0,
      step: '1',
      check: false,
      estimated_duration_ms: 90_000,
      ...nodeOverrides,
    }

    return {
      locale: 'en-US',
      node,
      disabled: false,
      extraClasses: [] as string[],
      messages: createAimdRecorderMessages('en-US'),
    }
  }

  it('keeps timer controls and annotation input collapsed by default in auto mode', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    expect(wrapper.text()).toContain('ETA 1m 30s')
    expect(wrapper.text()).not.toContain('Timer 0s')
    expect(wrapper.text()).toContain('Notes')
    expect(wrapper.text()).toContain('Timer')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(false)
  })

  it('renders a checkbox only when step check is enabled', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          check: true,
        }),
        state,
      },
    })

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows the annotation detail when a note already exists in auto mode', async () => {
    const state = reactive({
      ...createEmptyStepRecordItem(),
      annotation: 'Keep on ice',
    })
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    await flushStepFieldAsync()

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(true)
    expect(wrapper.text()).toContain('Timer')
  })

  it('opens the annotation detail when clicking the notes toggle', async () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
      attachTo: document.body,
    })

    await wrapper.find('.aimd-step-field__toggle--annotation').trigger('click')
    await flushStepFieldAsync()

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(true)
    expect(wrapper.emitted('timer-start')).toBeFalsy()

    wrapper.unmount()
  })

  it('keeps a single step note entry at the end of long body content', async () => {
    const state = reactive(createEmptyStepRecordItem())
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
        bodyNodes: ['Long protocol step body'],
      },
      attachTo: document.body,
    })

    expect(wrapper.find('.aimd-step-field__main .aimd-step-field__toggle--annotation').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__body-action').exists()).toBe(true)

    await wrapper.find('.aimd-step-field__body-action').trigger('click')
    await flushStepFieldAsync()

    const children = Array.from(wrapper.element.children)
    const detailsSlotIndex = children.indexOf(wrapper.find('.aimd-step-field__details-slot--annotation').element)
    const bodyIndex = children.indexOf(wrapper.find('.aimd-step-field__body').element)
    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(detailsSlotIndex).toBeGreaterThan(-1)
    expect(bodyIndex).toBeGreaterThan(-1)
    expect(detailsSlotIndex).toBeGreaterThan(bodyIndex)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })

    wrapper.unmount()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    })
  })

  it('opens timer controls on demand in auto mode', async () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    await wrapper.find('.aimd-step-field__toggle--timer').trigger('click')

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Timer 0s')
    expect(wrapper.text()).toContain('Start')
    expect(wrapper.emitted('timer-start')).toBeTruthy()
  })

  it('renders estimated and recorded timing UI and updates while running in always mode', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))

    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        detailDisplay: 'always',
        state,
      },
    })

    await flushStepFieldAsync()

    expect(wrapper.text()).toContain('ETA 1m 30s')
    expect(wrapper.text()).toContain('Timer 0s')
    expect(wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').text()).toBe('Start')

    await wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').trigger('click')
    expect(wrapper.emitted('timer-start')).toBeTruthy()

    startStepTimer(state, Date.now())
    await nextTick()

    await vi.advanceTimersByTimeAsync(2_000)
    await nextTick()

    expect(wrapper.text()).toContain('Timer 2s')
    expect(wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').text()).toBe('Pause')
  })

  it('auto-expands countdown mode and switches to warning and overtime states', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))

    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          estimated_duration_ms: 30_000,
          timer_mode: 'countdown',
        }),
        state,
      },
    })

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Remain 30s')
    expect(wrapper.find('.aimd-step-timer__hero--countdown').exists()).toBe(true)

    await wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').trigger('click')
    expect(wrapper.emitted('timer-start')).toBeTruthy()

    startStepTimer(state, Date.now())
    await nextTick()

    await vi.advanceTimersByTimeAsync(25_000)
    await nextTick()

    expect(wrapper.text()).toContain('Remain 5s')
    expect(wrapper.find('.aimd-step-timer__hero--warning').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(10_000)
    await nextTick()

    expect(wrapper.text()).toContain('Overtime 5s')
    expect(wrapper.find('.aimd-step-timer__hero--overtime').exists()).toBe(true)
  })

  it('shows countdown and elapsed time together in both mode', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          estimated_duration_ms: 60_000,
          timer_mode: 'both',
        }),
        state,
      },
    })

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Remain 1m')
    expect(wrapper.text()).toContain('Timer 0s')
  })

  it('renders check cards as lightweight cards that absorb body text and checked state messaging', async () => {
    const node: AimdCheckNode = {
      id: 'verify_tube_label',
      label: 'Verify that the tube label matches the sample name and the processing batch identifier before continuing',
      fieldType: 'check',
      scope: 'check',
      type: 'aimd',
      raw: '{{check|verify_tube_label}}',
      checked_message: 'Tube label verified',
    }
    const wrapper = mount(AimdCheckField, {
      props: {
        node,
        state: reactive({
          checked: true,
          annotation: 'Resolved from assigner context',
        }),
        bodyNodes: [
          h('p', 'Verify that the tube label matches the sample name before continuing.'),
        ],
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    await flushStepFieldAsync()

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.classes()).toContain('aimd-rec-inline--check-passed')
    expect(wrapper.classes()).toContain('aimd-rec-inline--check-with-body')
    expect(wrapper.find('.aimd-check-field__body').text()).toContain('Verify that the tube label matches the sample name before continuing.')
    expect(wrapper.find('.aimd-check-field__body--checked').exists()).toBe(true)
    expect(wrapper.find('.aimd-check-field__banner').text()).toContain('Tube label verified')
    expect(wrapper.find('.aimd-rec-inline__input--annotation').exists()).toBe(false)
    expect(wrapper.find('.aimd-check-field__detail--annotation').exists()).toBe(true)
    expect(wrapper.find('.aimd-check-field__key').exists()).toBe(false)
  })

  it('falls back to the check id when no body text is available', () => {
    const node: AimdCheckNode = {
      id: 'verify_tube_label',
      label: 'verify_tube_label',
      fieldType: 'check',
      scope: 'check',
      type: 'aimd',
      raw: '{{check|verify_tube_label}}',
    }
    const wrapper = mount(AimdCheckField, {
      props: {
        node,
        state: reactive({
          checked: false,
          annotation: '',
        }),
        bodyNodes: [],
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    expect(wrapper.classes()).toContain('aimd-rec-inline--check-open')
    expect(wrapper.classes()).toContain('aimd-rec-inline--check-bodyless')
    expect(wrapper.find('.aimd-check-field__key').text()).toBe('verify_tube_label')
  })

  it('opens the check annotation editor on demand', async () => {
    const node: AimdCheckNode = {
      id: 'verify_tube_label',
      label: 'verify_tube_label',
      fieldType: 'check',
      scope: 'check',
      type: 'aimd',
      raw: '{{check|verify_tube_label}}',
    }
    const wrapper = mount(AimdCheckField, {
      props: {
        node,
        state: reactive({
          checked: false,
          annotation: '',
        }),
        bodyNodes: [],
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    expect(wrapper.find('.aimd-check-field__detail--annotation').exists()).toBe(false)

    await wrapper.find('.aimd-check-field__toggle-btn').trigger('click')
    await flushStepFieldAsync()

    expect(wrapper.find('.aimd-check-field__detail--annotation').exists()).toBe(true)
  })
})
