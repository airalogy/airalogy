import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { codePreRendererMock, createCodeBlockRendererMock, createMermaidRendererMock, loadShikiHighlighterMock, mermaidPreRendererMock, renderToVueMock } = vi.hoisted(() => {
  const mermaidPreRendererMock = vi.fn()
  const codePreRendererMock = vi.fn()
  return {
    codePreRendererMock,
    createCodeBlockRendererMock: vi.fn(() => codePreRendererMock),
    createMermaidRendererMock: vi.fn(() => mermaidPreRendererMock),
    loadShikiHighlighterMock: vi.fn(() => new Promise(() => {})),
    mermaidPreRendererMock,
    renderToVueMock: vi.fn(),
  }
})

vi.mock('@airalogy/aimd-editor/vue', () => ({
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
}))

vi.mock('@airalogy/aimd-renderer', () => ({
  createCodeBlockRenderer: createCodeBlockRendererMock,
  createMermaidRenderer: createMermaidRendererMock,
  loadShikiHighlighter: loadShikiHighlighterMock,
  renderToVue: renderToVueMock,
}))

import AimdMarkdownField from '../components/AimdMarkdownField.vue'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdMarkdownField.vue'), 'utf8')

const recorderMessages = {
  scope: {
    var: '变量',
    quiz: '题目',
    step: '步骤',
    check: '检查点',
    table: '表格',
  },
}

async function flushUi() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('AimdMarkdownField', () => {
  beforeEach(() => {
    createMermaidRendererMock.mockClear()
    createCodeBlockRendererMock.mockClear()
    loadShikiHighlighterMock.mockClear()
    mermaidPreRendererMock.mockClear()
    codePreRendererMock.mockClear()
    renderToVueMock.mockReset()
  })

  it('embeds the full AimdEditor so toolbar controls remain available', () => {
    expect(source).toMatch(/import \{ AimdEditor \} from '@airalogy\/aimd-editor\/vue'/)
    expect(source).toMatch(/<AimdEditor/)
    expect(source).toMatch(/mode="source"/)
    expect(source).toMatch(/:show-top-bar="true"/)
    expect(source).toMatch(/:show-toolbar="!disabled"/)
    expect(source).toMatch(/:show-md-toolbar="true"/)
    expect(source).toMatch(/:show-aimd-toolbar="true"/)
  })

  it('renders as an embedded block editor instead of using a trigger dialog', () => {
    expect(source).not.toMatch(/<Teleport to="body">/)
    expect(source).toMatch(/aimd-rec-inline--var-markdown/)
    expect(source).toMatch(/aimd-markdown-field__editor-shell/)
    expect(source).toMatch(/aimd-markdown-field__editor/)
  })

  it('fills the available recorder width as a block field', () => {
    expect(source).toMatch(/\.aimd-markdown-field \{[\s\S]*?width: 100%;[\s\S]*?box-sizing: border-box;/)
    expect(source).not.toContain('width: min(100%, 1040px);')
  })

  it('starts the embedded AiralogyMarkdown editor at a compact content-driven height', () => {
    expect(source).toMatch(/const MARKDOWN_EDITOR_MIN_HEIGHT = MARKDOWN_EDITOR_LINE_HEIGHT \+ MARKDOWN_EDITOR_VERTICAL_PADDING/)
    expect(source).toMatch(/const markdownEditorHeight = ref\(estimateMarkdownEditorHeight\(draftValue\.value\)\)/)
    expect(source).toMatch(/:min-height="markdownEditorHeight"/)
    expect(source).toMatch(/@ready="handleMarkdownEditorReady"/)
    expect(source).toContain('--aimd-markdown-field-editor-height')
    expect(source).not.toMatch(/:min-height="360"/)
    expect(source).not.toContain('min-height: 360px;')
  })

  it('can switch AiralogyMarkdown output into rendered preview mode', () => {
    expect(source).toMatch(/renderToVue/)
    expect(source).toMatch(/createMermaidRenderer/)
    expect(source).toMatch(/aimd-markdown-field__view-switch/)
    expect(source).toMatch(/aimd-markdown-field__preview/)
  })

  it('can host assigner controls inside the markdown field shell', () => {
    expect(source).toMatch(/assignerControl/)
    expect(source).toMatch(/assignerStatus/)
    expect(source).toMatch(/aimd-markdown-field__assigner-actions/)
  })

  it('keeps a local draft so parent v-model echoes do not reset the editor session', () => {
    expect(source).toMatch(/const draftValue = ref\(normalizeMarkdownModelValue\(props\.modelValue\)\)/)
    expect(source).toMatch(/watch\(\(\) => props\.modelValue, \(value\) => \{/)
    expect(source).toMatch(/if \(nextValue === draftValue\.value\)/)
    expect(source).toMatch(/emitDraftValue/)
  })

  it('renders markdown previews through the renderer and wires Mermaid code fences', async () => {
    renderToVueMock.mockImplementation(async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-markdown' }, `rendered:${content}`)],
      fields: {},
    }))

    const wrapper = mount(AimdMarkdownField, {
      props: {
        modelValue: '```mermaid\nflowchart TD\nA-->B\n```',
        varId: 'graph_mermaid_preview',
        locale: 'zh-CN',
        messages: recorderMessages,
      },
    })

    await flushUi()

    expect(createMermaidRendererMock).toHaveBeenCalled()
    expect(renderToVueMock).toHaveBeenCalledWith('```mermaid\nflowchart TD\nA-->B\n```', expect.objectContaining({
      locale: 'zh-CN',
      mode: 'preview',
      elementRenderers: { pre: expect.any(Function) },
    }))
    expect(wrapper.find('.aimd-markdown-field__preview').exists()).toBe(true)
    expect(wrapper.find('.aimd-rendered-markdown').text()).toContain('flowchart TD')
    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(false)
  })

  it('lets users switch from preview back to source editing', async () => {
    renderToVueMock.mockImplementation(async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-markdown' }, `rendered:${content}`)],
      fields: {},
    }))

    const wrapper = mount(AimdMarkdownField, {
      props: {
        modelValue: '# Summary',
        varId: 'graph_summary',
        locale: 'en-US',
        messages: recorderMessages,
      },
    })

    await flushUi()
    await wrapper.findAll('.aimd-markdown-field__view-btn')[1].trigger('click')
    await nextTick()

    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(true)
    expect(wrapper.find('.aimd-markdown-field__preview').exists()).toBe(false)
  })
})
