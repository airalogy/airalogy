import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AimdRecorder from '../components/AimdRecorder.vue'

vi.mock('../components/AimdCodeField.vue', () => ({
  __esModule: true,
  default: {
    name: 'AimdCodeField',
    props: ['modelValue', 'language', 'disabled', 'compact'],
    emits: ['update:modelValue', 'blur'],
    template: '<textarea class="aimd-code-field-stub" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  },
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const recorderSource = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')
const searchToolbarSource = readFileSync(resolve(__dirname, '../components/AimdRecorderSearchToolbar.vue'), 'utf8')
const recordSearchSource = readFileSync(resolve(__dirname, '../composables/useRecordSearch.ts'), 'utf8')
const recorderSurfaceStyles = readFileSync(resolve(__dirname, '../styles/recorder-surface.css'), 'utf8')

describe('AimdRecorder record search', () => {
  it('keeps search state and toolbar rendering outside the main recorder component', () => {
    expect(recorderSource).toContain('useRecordSearch')
    expect(recorderSource).toContain('<AimdRecorderSearchToolbar')
    expect(recordSearchSource).toContain('searchAimdRecordFields')
    expect(recordSearchSource).toContain('collectAimdRecordFieldRefs')
    expect(recordSearchSource).toContain('setSelectionRange')
    expect(searchToolbarSource).toContain('data-rec-search-toggle')
  })

  it('keeps the sticky search toolbar flush with recorder gutters', () => {
    expect(recorderSurfaceStyles).toMatch(/\.aimd-protocol-recorder \{[\s\S]*?--aimd-recorder-gutter-x: 0px;[\s\S]*?padding: 0 var\(--aimd-recorder-gutter-x\) var\(--aimd-recorder-gutter-bottom\);/)
    expect(searchToolbarSource).toContain('position: sticky;')
    expect(searchToolbarSource).toContain('--aimd-recorder-search-sticky-top')
    expect(searchToolbarSource).toMatch(/\.aimd-protocol-recorder__search-shell \{[\s\S]*?margin-inline: calc\(-1 \* var\(--aimd-recorder-gutter-x\)\);[\s\S]*?background: transparent;[\s\S]*?pointer-events: none;/)
    expect(searchToolbarSource).toMatch(/\.aimd-protocol-recorder__search-shell--expanded \{[\s\S]*?padding-inline: var\(--aimd-recorder-gutter-x\);[\s\S]*?background: #f8fbff;[\s\S]*?pointer-events: auto;/)
    expect(searchToolbarSource).toMatch(/\.aimd-protocol-recorder__search \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/)
    expect(recorderSurfaceStyles).toContain('aimd-field--record-search-pulse')
    expect(recorderSurfaceStyles).toContain('@keyframes aimd-rec-record-search-pulse')
  })

  it('searches the current record and highlights matching fields in AimdRecorder', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'Reaction: {{var|reaction_note: str}} Other: {{var|other_note: str}}',
        locale: 'en-US',
        modelValue: {
          var: {
            reaction_note: 'heated sample',
            other_note: 'cold sample',
          },
          step: {},
          check: {},
          quiz: {},
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.find('.aimd-protocol-recorder__search-shell').exists()).toBe(true)

    const toggle = wrapper.find('[data-rec-search-toggle]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('Search current record')
    await toggle.trigger('click')
    await wrapper.vm.$nextTick()

    const input = wrapper.find('input[type="search"]')
    expect(input.exists()).toBe(true)

    await input.setValue('heated')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('1 / 1')
    expect(wrapper.find('.aimd-field--record-search-match').exists()).toBe(true)
    expect(wrapper.find('.aimd-field--record-search-active').exists()).toBe(true)

    await input.trigger('keydown.enter')
    await flushPromises()
    await wrapper.vm.$nextTick()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const matchedControl = wrapper.find('[data-rec-focus-key="var:reaction_note"]')
    expect(matchedControl.exists()).toBe(true)
    expect((matchedControl.element as HTMLInputElement | HTMLTextAreaElement).selectionStart).toBe(0)
    expect((matchedControl.element as HTMLInputElement | HTMLTextAreaElement).selectionEnd).toBe('heated'.length)
    expect(wrapper.find('.aimd-field--record-search-pulse').exists()).toBe(true)

    const fieldSelect = wrapper.find('.aimd-protocol-recorder__search-field')
    await fieldSelect.setValue('var:other_note')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No matches')
    expect(wrapper.find('.aimd-field--record-search-match').exists()).toBe(false)
  })
})
