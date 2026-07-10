import type { ExtractedAimdFields, RenderContext } from '@airalogy/aimd-core/types'
import type { PropType, VNode, VNodeChild } from 'vue'
import type { AimdRendererOptions, RenderResult } from '../common/processor'
import type { ReadonlyRecordAssetResolver, ReadonlyRecordVueRendererOptions } from './readonly-record-renderer'
import type { VueRendererOptions } from './vue-renderer'
import { defineComponent, h, ref, shallowRef, watch } from 'vue'
import { renderToVue } from '../common/processor'
import { renderReadonlyRecordToVue } from './readonly-record-renderer'

type VueClassValue = string | unknown[] | Record<string, boolean>

export interface AimdMarkdownPreviewRenderOptions extends AimdRendererOptions, VueRendererOptions {}

export type AimdMarkdownPreviewRenderResult = RenderResult
export type AimdMarkdownPreviewReadonlyRecordData = Record<string, unknown>

function createEmptyFields(): ExtractedAimdFields {
  return {
    var: [],
    var_table: [],
    client_assigner: [],
    quiz: [],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
  }
}

function hasReadonlyRecordData(value: unknown): boolean {
  return value !== undefined && value !== null
}

function createRenderContext(
  mode: RenderContext['mode'],
  readonly: boolean,
  value: RenderContext['value'] | undefined,
  options: AimdMarkdownPreviewRenderOptions,
): RenderContext & NonNullable<AimdMarkdownPreviewRenderOptions['context']> {
  return {
    mode,
    readonly,
    value,
    ...(options.context ?? {}),
  }
}

export const AimdMarkdownPreview = defineComponent({
  name: 'AimdMarkdownPreview',
  props: {
    content: {
      type: String,
      default: '',
    },
    mode: {
      type: String as PropType<RenderContext['mode']>,
      default: 'preview',
    },
    value: {
      type: Object as PropType<RenderContext['value']>,
      default: undefined,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    readonlyRecordData: {
      type: Object as PropType<AimdMarkdownPreviewReadonlyRecordData>,
      default: undefined,
    },
    renderOptions: {
      type: Object as PropType<AimdMarkdownPreviewRenderOptions>,
      default: () => ({}),
    },
    readonlyRecordRenderOptions: {
      type: Object as PropType<ReadonlyRecordVueRendererOptions>,
      default: () => ({}),
    },
    resolveAsset: {
      type: Function as PropType<ReadonlyRecordAssetResolver>,
      default: undefined,
    },
    bodyClass: {
      type: [String, Array, Object] as PropType<VueClassValue>,
      default: undefined,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'render:result': (_result: AimdMarkdownPreviewRenderResult) => true,
    'render:error': (_error: unknown) => true,
  },
  setup(props, { emit, expose, slots }) {
    const nodes = shallowRef<VNode[]>([])
    const fields = shallowRef<ExtractedAimdFields>(createEmptyFields())
    const renderError = ref('')
    const rendering = ref(false)
    let requestId = 0

    async function reload() {
      const currentRequestId = ++requestId
      renderError.value = ''

      if (!props.content) {
        nodes.value = []
        fields.value = createEmptyFields()
        return
      }

      rendering.value = true

      try {
        const result = hasReadonlyRecordData(props.readonlyRecordData)
          ? await renderReadonlyRecordToVue(props.content, props.readonlyRecordData, {
              gfm: true,
              math: true,
              ...props.renderOptions,
              ...props.readonlyRecordRenderOptions,
              resolveAsset: props.resolveAsset ?? props.readonlyRecordRenderOptions.resolveAsset,
            })
          : await renderToVue(props.content, {
              gfm: true,
              math: true,
              mode: props.mode,
              ...props.renderOptions,
              context: createRenderContext(props.mode, props.readonly, props.value, props.renderOptions),
            })

        if (currentRequestId !== requestId) {
          return
        }

        nodes.value = result.nodes
        fields.value = result.fields
        emit('render:result', result)
      }
      catch (error) {
        if (currentRequestId !== requestId) {
          return
        }

        nodes.value = []
        fields.value = createEmptyFields()
        renderError.value = error instanceof Error ? error.message : String(error)
        emit('render:error', error)
      }
      finally {
        if (currentRequestId === requestId) {
          rendering.value = false
        }
      }
    }

    watch(
      () => [
        props.content,
        props.mode,
        props.readonly,
        props.value,
        props.readonlyRecordData,
        props.renderOptions,
        props.readonlyRecordRenderOptions,
        props.resolveAsset,
      ],
      () => {
        void reload()
      },
      { deep: true, immediate: true },
    )

    expose({
      fields,
      nodes,
      reload,
      renderError,
      rendering,
    })

    return () => {
      const readonlyRecord = hasReadonlyRecordData(props.readonlyRecordData)
      const children: VNodeChild[] = renderError.value
        ? [h('pre', { class: 'aimd-markdown-preview__error' }, renderError.value)]
        : nodes.value

      return h('div', {
        class: [
          'aimd-markdown-preview',
          {
            'aimd-markdown-preview--loading': props.loading || rendering.value,
            'aimd-markdown-preview--error': Boolean(renderError.value),
            'aimd-markdown-preview--readonly-record': readonlyRecord,
          },
        ],
      }, [
        h('div', {
          class: [
            'aimd-renderer',
            readonlyRecord ? 'rendered-aimd-document' : null,
            props.bodyClass,
          ],
        }, children),
        slots.default?.(),
      ])
    }
  },
})
