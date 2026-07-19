import type { ExtractedAimdFields, RenderContext } from '@airalogy/aimd-core/types'
import type { Component, PropType, VNode, VNodeChild } from 'vue'
import type { AimdRendererOptions, RenderResult } from '../common/processor'
import type { ReadonlyRecordAssetResolver, ReadonlyRecordVueRendererOptions } from './readonly-record-renderer'
import type { ElementRenderer, VueRendererOptions } from './vue-renderer'
import { toTemplateEnv } from '@airalogy/aimd-core/utils'
import { cloneVNode, computed, defineComponent, h, isVNode, ref, shallowRef, watch } from 'vue'
import { renderToVue } from '../common/processor'
import { renderReadonlyRecordToVue } from './readonly-record-renderer'
import { createMermaidRenderer } from './vue-renderer'

import '../styles/renderer.css'

type VueClassValue = string | unknown[] | Record<string, boolean>

export interface AimdMarkdownPreviewRenderOptions extends AimdRendererOptions, VueRendererOptions {}

export type AimdMarkdownPreviewRenderResult = RenderResult
export type AimdMarkdownPreviewReadonlyRecordData = object
export type AimdMarkdownPreviewUrlResolverResult = string | { href?: string, url?: string } | null | undefined
export type AimdMarkdownPreviewUrlResolver = (
  url: string,
) => AimdMarkdownPreviewUrlResolverResult | Promise<AimdMarkdownPreviewUrlResolverResult>

function createEmptyFields(): ExtractedAimdFields {
  return {
    var: [],
    var_table: [],
    client_assigner: [],
    connectors: [],
    collectors: [],
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

function createElementRenderers(
  renderers: Record<string, ElementRenderer> | undefined,
  mermaidComponent: Component | undefined,
): Record<string, ElementRenderer> | undefined {
  if (!mermaidComponent) {
    return renderers
  }

  const mermaidRenderer = createMermaidRenderer(mermaidComponent)
  const fallbackPreRenderer = renderers?.pre

  return {
    ...renderers,
    pre: (node, children, context) =>
      mermaidRenderer(node, children, context)
      ?? fallbackPreRenderer?.(node, children, context)
      ?? null,
  }
}

function getResolvedUrl(result: AimdMarkdownPreviewUrlResolverResult): string | undefined {
  if (typeof result === 'string') {
    return result
  }
  return result?.url ?? result?.href
}

function shouldResolveUrl(value: unknown): value is string {
  return typeof value === 'string'
    && Boolean(value.trim())
    && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)
}

async function resolveVNodeUrls(
  node: VNode,
  resolveUrl: AimdMarkdownPreviewUrlResolver,
  cache: Map<string, Promise<string>>,
): Promise<VNode> {
  const extraProps: Record<string, unknown> = {}
  let propsChanged = false

  for (const propName of ['src', 'poster', 'href'] as const) {
    const currentUrl = node.props?.[propName]
    if (!shouldResolveUrl(currentUrl)) {
      continue
    }

    let resolution = cache.get(currentUrl)
    if (!resolution) {
      resolution = Promise.resolve(resolveUrl(currentUrl))
        .then(result => getResolvedUrl(result) ?? currentUrl)
        .catch(() => currentUrl)
      cache.set(currentUrl, resolution)
    }

    const resolvedUrl = await resolution
    if (resolvedUrl !== currentUrl) {
      extraProps[propName] = resolvedUrl
      propsChanged = true
    }
  }

  let childrenChanged = false
  let resolvedChildren = node.children
  if (Array.isArray(node.children)) {
    resolvedChildren = await Promise.all(node.children.map(async (child) => {
      if (!isVNode(child)) {
        return child
      }
      const resolvedChild = await resolveVNodeUrls(child, resolveUrl, cache)
      childrenChanged ||= resolvedChild !== child
      return resolvedChild
    }))
  }

  if (!propsChanged && !childrenChanged) {
    return node
  }

  const resolvedNode = cloneVNode(node, propsChanged ? extraProps : null)
  if (childrenChanged) {
    resolvedNode.children = resolvedChildren
  }
  return resolvedNode
}

async function resolveRenderResultUrls(
  result: RenderResult,
  resolveUrl: AimdMarkdownPreviewUrlResolver | undefined,
): Promise<RenderResult> {
  if (!resolveUrl) {
    return result
  }

  const cache = new Map<string, Promise<string>>()
  const nodes = await Promise.all(result.nodes.map(node => resolveVNodeUrls(node, resolveUrl, cache)))
  return { ...result, nodes }
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
    resolveUrl: {
      type: Function as PropType<AimdMarkdownPreviewUrlResolver>,
      default: undefined,
    },
    mermaidComponent: {
      type: [Object, Function] as PropType<Component>,
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
    const rootElement = ref<HTMLElement | null>(null)
    const nodes = shallowRef<VNode[]>([])
    const fields = shallowRef<ExtractedAimdFields>(createEmptyFields())
    const env = computed(() => toTemplateEnv(fields.value))
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
        const mergedElementRenderers = createElementRenderers({
          ...props.renderOptions.elementRenderers,
          ...props.readonlyRecordRenderOptions.elementRenderers,
        }, props.mermaidComponent)
        const rendered = hasReadonlyRecordData(props.readonlyRecordData)
          ? await renderReadonlyRecordToVue(props.content, props.readonlyRecordData, {
              gfm: true,
              math: true,
              ...props.renderOptions,
              ...props.readonlyRecordRenderOptions,
              elementRenderers: mergedElementRenderers,
              resolveAsset: props.resolveAsset ?? props.readonlyRecordRenderOptions.resolveAsset,
            })
          : await renderToVue(props.content, {
              gfm: true,
              math: true,
              mode: props.mode,
              ...props.renderOptions,
              elementRenderers: createElementRenderers(
                props.renderOptions.elementRenderers,
                props.mermaidComponent,
              ),
              context: createRenderContext(props.mode, props.readonly, props.value, props.renderOptions),
            })
        const result = await resolveRenderResultUrls(rendered, props.resolveUrl)

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
        props.resolveUrl,
        props.mermaidComponent,
      ],
      () => {
        void reload()
      },
      { deep: true, immediate: true },
    )

    expose({
      env,
      fields,
      nodes,
      reload,
      renderError,
      rendering,
      rootElement,
    })

    return () => {
      const readonlyRecord = hasReadonlyRecordData(props.readonlyRecordData)
      const children: VNodeChild[] = renderError.value
        ? [h('pre', { class: 'aimd-markdown-preview__error' }, renderError.value)]
        : nodes.value

      return h('div', {
        ref: rootElement,
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
