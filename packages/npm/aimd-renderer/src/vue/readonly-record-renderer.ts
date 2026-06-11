import type {
  AimdCheckNode,
  AimdFigNode,
  AimdNode,
  AimdQuizNode,
  AimdVarNode,
  AimdVarTableNode,
  RenderContext,
} from '@airalogy/aimd-core/types'
import {
  AIMD_FILE_BADGE_BY_KIND,
  AIMD_FILE_REFERENCE_VALUE_KEYS,
  AIMD_RECORD_DATA_SCOPES,
  getAimdAssetMediaSource,
  getAimdDisplayValue,
  getAimdFieldDisplayLabel,
  getAimdFileDisplayName,
  getAimdFileValueId,
  inferAimdAssetKind,
  isAimdAiralogyFileId,
  isAimdBooleanType,
  isAimdCodeType,
  isAimdDnaType,
  isAimdFileLikeType,
  isAimdMarkdownType,
  isAimdPlainRecord,
  normalizeAimdRecordDataValue,
  normalizeAimdString,
  stringifyAimdDisplayValue,
  toAimdBooleanValue,
  type AimdAssetKind,
  type AimdAssetLike,
  type AimdRecordDataScope,
  type AimdRecordDataValue,
} from '@airalogy/aimd-core/utils'
import { h, type VNode } from 'vue'

import type { AimdRendererOptions, RenderResult } from '../common/processor'
import { renderToVue } from '../common/processor'
import type { AimdComponentRenderer, AimdRendererContext, ElementRenderer, VueRendererOptions } from './vue-renderer'

export const AIMD_RECORD_RENDER_SCOPES = AIMD_RECORD_DATA_SCOPES

export type AimdRecordRenderScope = AimdRecordDataScope

export type ReadonlyRecordAssetKind = AimdAssetKind

export type AimdRecordRenderValue = AimdRecordDataValue

export interface ReadonlyRecordAsset extends AimdAssetLike {
  url?: string
  href?: string
  name?: string
  filename?: string
  mimeType?: string
  size?: number
  kind?: ReadonlyRecordAssetKind
  downloadName?: string
}

export interface ReadonlyRecordAssetResolveContext {
  fieldId: string
  fieldPath: string
  scope: string
  node: AimdNode
  value: unknown
  normalizedValue: unknown
  fileId?: string
  recordValue: RenderContext['value']
}

export type ReadonlyRecordAssetResolver = (
  context: ReadonlyRecordAssetResolveContext,
) => ReadonlyRecordAsset | null | undefined

export type ReadonlyRecordRenderContextInput = Partial<RenderContext>
  & Partial<Pick<AimdRendererContext, 'locale' | 'messages'>>

export interface ReadonlyRecordVueRendererOptions extends AimdRendererOptions, VueRendererOptions {
  resolveAsset?: ReadonlyRecordAssetResolver
}

type ReadonlyRecordVarValueRendererKind = 'file' | 'boolean' | 'markdown' | 'code' | 'dna' | 'scalar'

interface ReadonlyRecordVarValueRendererContext {
  node: AimdNode
  varNode: AimdVarNode
  definition: AimdVarNode['definition']
  kwargs?: Record<string, unknown>
  value: unknown
  asset: ReadonlyRecordAsset | null | undefined
  fileId?: string
}

interface ReadonlyRecordVarValueRendererEntry {
  kind: ReadonlyRecordVarValueRendererKind
  render: (context: ReadonlyRecordVarValueRendererContext) => VNode | null
}

function fieldPathFor(scope: string, id: string): string {
  return `data.${scope}.${id}`
}

function fieldDisplayLabel(node: AimdNode): string {
  if ((node.fieldType === 'var' || node.fieldType === 'var_table') && 'definition' in node) {
    return getAimdFieldDisplayLabel(node.id, node.definition)
  }
  if (node.fieldType === 'check' && 'label' in node && typeof node.label === 'string' && node.label.trim()) {
    return node.label.trim()
  }
  if (node.fieldType === 'quiz' && 'title' in node && typeof node.title === 'string' && node.title.trim()) {
    return node.title.trim()
  }
  return node.id
}

function fieldMetadataTitle(node: AimdNode): string {
  const label = fieldDisplayLabel(node)
  const path = fieldPathFor(node.scope, node.id)
  return label === node.id ? path : `${label} · ${path}`
}

function recordFieldProps(node: AimdNode, className: string): Record<string, unknown> {
  const label = fieldDisplayLabel(node)
  return {
    class: className,
    title: fieldMetadataTitle(node),
    'aria-label': label,
    'data-aimd-type': node.fieldType,
    'data-aimd-id': node.id,
    'data-aimd-scope': node.scope,
    'data-aimd-field-label': label,
  }
}

function createAssetFallbackNode(id: string): AimdNode {
  return {
    type: 'aimd',
    fieldType: 'fig',
    scope: 'fig',
    id,
    raw: id,
    src: id,
  } as AimdNode
}

function resolveAssetForField(
  node: AimdNode,
  value: unknown,
  recordValue: RenderContext['value'],
  resolver: ReadonlyRecordAssetResolver | undefined,
): ReadonlyRecordAsset | null | undefined {
  if (!resolver) {
    return undefined
  }
  const normalizedValue = getAimdDisplayValue(value)
  const fileId = getAimdFileValueId(value, AIMD_FILE_REFERENCE_VALUE_KEYS)
  return resolver({
    fieldId: node.id,
    fieldPath: fieldPathFor(node.scope, node.id),
    scope: node.scope,
    node,
    value,
    normalizedValue,
    fileId,
    recordValue,
  })
}

function resolveAssetForReference(
  source: unknown,
  recordValue: RenderContext['value'],
  resolver: ReadonlyRecordAssetResolver | undefined,
  node?: AimdNode,
): ReadonlyRecordAsset | null | undefined {
  if (!resolver) {
    return undefined
  }
  const normalizedValue = getAimdDisplayValue(source)
  const fileId = normalizeAimdString(normalizedValue)
  const fallbackNode = node ?? createAssetFallbackNode(fileId ?? 'asset')
  return resolver({
    fieldId: fallbackNode.id,
    fieldPath: node ? fieldPathFor(node.scope, node.id) : (fileId ?? ''),
    scope: fallbackNode.scope,
    node: fallbackNode,
    value: source,
    normalizedValue,
    fileId,
    recordValue,
  })
}

function renderEmptyValue(node: AimdNode): VNode {
  return h('span', recordFieldProps(node, 'aimd-record-field aimd-record-field--empty'), [
    h('span', { class: 'aimd-record-field__missing-label' }, 'Missing'),
    h('span', { class: 'aimd-record-field__missing-name' }, fieldDisplayLabel(node)),
  ])
}

function renderScalarValue(node: AimdNode, value: unknown, className = ''): VNode {
  const displayValue = stringifyAimdDisplayValue(value)
  if (!displayValue) {
    return renderEmptyValue(node)
  }
  return h('span', recordFieldProps(
    node,
    ['aimd-record-field', 'aimd-record-field--scalar', className].filter(Boolean).join(' '),
  ), displayValue)
}

function renderBooleanValue(node: AimdNode, value: unknown): VNode {
  const checked = toAimdBooleanValue(value)
  return h('span', recordFieldProps(node, 'aimd-record-field aimd-record-field--boolean'), [
    h('input', {
      type: 'checkbox',
      checked,
      disabled: true,
      class: 'aimd-checkbox',
    }),
    h('span', { class: 'aimd-record-field__value' }, checked ? 'Yes' : 'No'),
  ])
}

function renderMarkdownValue(node: AimdNode, value: unknown): VNode {
  const displayValue = stringifyAimdDisplayValue(value)
  if (!displayValue) {
    return renderEmptyValue(node)
  }
  return h('div', recordFieldProps(node, 'aimd-record-field aimd-record-field--markdown'), displayValue)
}

function renderCodeValue(node: AimdNode, value: unknown, language?: unknown): VNode {
  const lang = normalizeAimdString(language)
  const displayValue = stringifyAimdDisplayValue(value)
  if (!displayValue) {
    return renderEmptyValue(node)
  }
  return h('pre', recordFieldProps(node, 'aimd-record-field aimd-record-field--code'), [
    h('code', {
      class: lang ? `language-${lang}` : undefined,
    }, displayValue),
  ])
}

function renderDnaValue(node: AimdNode, value: unknown): VNode {
  const normalized = getAimdDisplayValue(value)
  const sequence = isAimdPlainRecord(normalized)
    ? normalizeAimdString(normalized.sequence) ?? stringifyAimdDisplayValue(normalized)
    : stringifyAimdDisplayValue(normalized)
  if (!sequence) {
    return renderEmptyValue(node)
  }
  const name = isAimdPlainRecord(normalized) ? normalizeAimdString(normalized.name) : undefined
  return h('div', recordFieldProps(node, 'aimd-record-field aimd-record-field--dna'), [
    name ? h('div', { class: 'aimd-record-field__label' }, name) : null,
    h('pre', { class: 'aimd-record-field__sequence' }, sequence),
  ])
}

function renderFileValue(
  node: AimdNode,
  value: unknown,
  asset: ReadonlyRecordAsset | null | undefined,
  kind: ReadonlyRecordAssetKind,
): VNode {
  if (!asset && !getAimdFileValueId(value, AIMD_FILE_REFERENCE_VALUE_KEYS)) {
    return renderEmptyValue(node)
  }
  const mediaSrc = getAimdAssetMediaSource(asset)
  const href = asset?.href ?? asset?.url
  const name = getAimdFileDisplayName(value, asset) || node.id
  const badge = AIMD_FILE_BADGE_BY_KIND[kind]
  const commonProps: Record<string, unknown> = {
    ...recordFieldProps(node, `aimd-record-field aimd-record-field--asset aimd-record-field--${kind}`),
    'data-aimd-file-id': getAimdFileValueId(value, AIMD_FILE_REFERENCE_VALUE_KEYS),
  }

  if (kind === 'image' && mediaSrc) {
    return h('figure', commonProps, [
      h('img', {
        src: mediaSrc,
        alt: name,
        loading: 'lazy',
        class: 'aimd-record-field__image',
      }),
      h('figcaption', { class: 'aimd-record-field__caption' }, name),
    ])
  }

  if (kind === 'audio' && mediaSrc) {
    return h('div', commonProps, [
      h('audio', {
        src: mediaSrc,
        controls: true,
        class: 'aimd-record-field__audio',
      }),
      h('span', { class: 'aimd-record-field__caption' }, name),
    ])
  }

  if (kind === 'video' && mediaSrc) {
    return h('figure', commonProps, [
      h('video', {
        src: mediaSrc,
        controls: true,
        class: 'aimd-record-field__video',
      }),
      h('figcaption', { class: 'aimd-record-field__caption' }, name),
    ])
  }

  const label = [
    h('span', { class: 'aimd-record-field__badge' }, badge),
    h('span', { class: 'aimd-record-field__filename' }, name),
  ]
  if (href) {
    return h('a', {
      ...commonProps,
      href,
      download: asset?.downloadName ?? asset?.filename ?? asset?.name ?? undefined,
    }, label)
  }

  return h('span', {
    ...commonProps,
    class: `${commonProps.class} aimd-record-field--asset-missing`,
  }, label)
}

function createReadonlyRecordVarValueRendererEntries(): ReadonlyRecordVarValueRendererEntry[] {
  return [
    {
      kind: 'file',
      render: ({ node, definition, kwargs, value, asset, fileId }) => {
        if (!isAimdFileLikeType(definition?.type, kwargs) && !asset && !isAimdAiralogyFileId(fileId)) {
          return null
        }
        const kind = inferAimdAssetKind(asset, value, definition?.type, kwargs)
        return renderFileValue(node, value, asset, kind)
      },
    },
    {
      kind: 'boolean',
      render: ({ node, definition, kwargs, value }) =>
        isAimdBooleanType(definition?.type, kwargs) ? renderBooleanValue(node, value) : null,
    },
    {
      kind: 'markdown',
      render: ({ node, definition, kwargs, value }) =>
        isAimdMarkdownType(definition?.type, kwargs) ? renderMarkdownValue(node, value) : null,
    },
    {
      kind: 'code',
      render: ({ node, definition, kwargs, value }) =>
        isAimdCodeType(definition?.type, kwargs)
          ? renderCodeValue(node, value, kwargs?.language ?? kwargs?.lang ?? kwargs?.code_language ?? kwargs?.codeLanguage)
          : null,
    },
    {
      kind: 'dna',
      render: ({ node, definition, kwargs, value }) =>
        isAimdDnaType(definition?.type, kwargs) ? renderDnaValue(node, value) : null,
    },
    {
      kind: 'scalar',
      render: ({ node, value }) => renderScalarValue(node, value),
    },
  ]
}

const READONLY_RECORD_VAR_VALUE_RENDERERS = createReadonlyRecordVarValueRendererEntries()

function renderReadonlyRecordVarValue(context: ReadonlyRecordVarValueRendererContext): VNode {
  for (const renderer of READONLY_RECORD_VAR_VALUE_RENDERERS) {
    const vnode = renderer.render(context)
    if (vnode) {
      return vnode
    }
  }
  return renderScalarValue(context.node, context.value)
}

function createVarRenderer(resolveRecordAsset?: ReadonlyRecordAssetResolver): AimdComponentRenderer {
  return (node, ctx) => {
    const varNode = node as AimdVarNode
    const definition = varNode.definition
    const kwargs = definition?.kwargs
    const value = ctx.value?.var?.[node.id]
    const asset = resolveAssetForField(node, value, ctx.value, resolveRecordAsset)
    const fileId = getAimdFileValueId(value, AIMD_FILE_REFERENCE_VALUE_KEYS)

    return renderReadonlyRecordVarValue({
      node,
      varNode,
      definition,
      kwargs,
      value,
      asset,
      fileId,
    })
  }
}

function normalizeTableRows(value: unknown): Record<string, unknown>[] {
  const normalized = getAimdDisplayValue(value)
  if (Array.isArray(normalized)) {
    return normalized
      .filter((row): row is Record<string, unknown> => isAimdPlainRecord(row))
      .map(row => ({ ...row }))
  }
  if (isAimdPlainRecord(normalized)) {
    return Object.values(normalized)
      .filter((row): row is Record<string, unknown> => isAimdPlainRecord(row))
      .map(row => ({ ...row }))
  }
  return []
}

function createVarTableRenderer(): AimdComponentRenderer {
  return (node, ctx) => {
    const tableNode = node as AimdVarTableNode
    const rows = normalizeTableRows(ctx.value?.var?.[node.id] ?? ctx.value?.var_table?.[node.id])
    const columns = tableNode.columns.length
      ? tableNode.columns
      : [...new Set(rows.flatMap(row => Object.keys(row)))]
    const subvars = tableNode.definition?.subvars

    if (!columns.length || !rows.length) {
      return h('div', recordFieldProps(node, 'aimd-record-table aimd-record-table--empty'), [
        h('span', { class: 'aimd-record-field__missing-label' }, 'Missing'),
        h('span', { class: 'aimd-record-field__missing-name' }, fieldDisplayLabel(node)),
      ])
    }

    return h('div', recordFieldProps(node, 'aimd-record-table'), [
      h('table', [
        h('thead', [
          h('tr', columns.map(column => h('th', {
            'data-column-id': column,
            title: column,
          }, getAimdFieldDisplayLabel(column, subvars?.[column])))),
        ]),
        h('tbody', rows.map(row =>
          h('tr', columns.map(column =>
            h('td', stringifyAimdDisplayValue(row[column])),
          )),
        )),
      ]),
    ])
  }
}

function createCheckRenderer(): AimdComponentRenderer {
  return (node, ctx, children) => {
    const checkNode = node as AimdCheckNode
    const value = ctx.value?.check?.[node.id]
    const normalized = isAimdPlainRecord(value) && 'checked' in value ? value.checked : value
    const checked = toAimdBooleanValue(normalized)
    const label = checkNode.label ?? node.id
    const bodyChildren = children && children.length > 0
      ? children
      : [label]
    return h('label', recordFieldProps(node, 'aimd-record-check'), [
      h('input', {
        type: 'checkbox',
        checked,
        disabled: true,
        class: 'aimd-checkbox',
      }),
      h('span', { class: 'aimd-record-check__body' }, bodyChildren),
    ])
  }
}

function createQuizRenderer(): AimdComponentRenderer {
  return (node, ctx) => {
    const quizNode = node as AimdQuizNode
    const value = ctx.value?.quiz?.[node.id]
    const answer = stringifyAimdDisplayValue(value)
    return h('div', recordFieldProps(node, 'aimd-record-quiz'), [
      h('div', { class: 'aimd-record-quiz__stem' }, quizNode.stem || quizNode.title || node.id),
      answer
        ? h('div', { class: 'aimd-record-quiz__answer' }, answer)
        : h('div', { class: 'aimd-record-quiz__answer aimd-record-quiz__answer--empty' }, 'No answer recorded'),
    ])
  }
}

function mergeClassNames(...values: unknown[]): string | undefined {
  const classNames = values.flatMap((value) => {
    if (!value) {
      return []
    }
    if (Array.isArray(value)) {
      return value.map(item => String(item)).filter(Boolean)
    }
    return String(value).split(/\s+/).filter(Boolean)
  })
  return classNames.length ? [...new Set(classNames)].join(' ') : undefined
}

function createFigRenderer(resolveRecordAsset?: ReadonlyRecordAssetResolver): AimdComponentRenderer {
  return (node, ctx) => {
    const figNode = node as AimdFigNode
    const figId = figNode.id || node.id
    const figSrc = figNode.src || ''
    const asset = resolveAssetForReference(figSrc, ctx.value, resolveRecordAsset, figNode)
    const resolvedSrc = getAimdAssetMediaSource(asset) ?? figSrc
    const figTitle = figNode.title
    const figLegend = figNode.legend
    const figSequence = figNode.sequence
    const captionChildren = [
      figSequence !== undefined || figTitle
        ? h('div', { class: 'aimd-figure__title' }, figSequence !== undefined
          ? ctx.messages.figure.captionTitle(figSequence + 1, figTitle)
          : figTitle)
        : null,
      figLegend ? h('div', { class: 'aimd-figure__legend' }, figLegend) : null,
    ].filter(Boolean)

    return h('figure', {
      class: 'aimd-figure',
      'data-aimd-type': 'fig',
      'data-aimd-fig-id': figId,
      'data-aimd-fig-src': figSrc,
      id: `fig-${figId}`,
    }, [
      h('img', {
        class: 'aimd-figure__image',
        src: resolvedSrc,
        alt: figTitle || asset?.name || asset?.filename || figId,
        loading: 'lazy',
      }),
      captionChildren.length
        ? h('figcaption', { class: 'aimd-figure__caption' }, captionChildren)
        : null,
    ])
  }
}

function createImageElementRenderer(resolveRecordAsset?: ReadonlyRecordAssetResolver): ElementRenderer {
  return (node, _children, ctx) => {
    const properties = node.properties ?? {}
    const src = normalizeAimdString(properties.src)
    const asset = resolveAssetForReference(src, ctx.value, resolveRecordAsset)
    const resolvedSrc = getAimdAssetMediaSource(asset) ?? src
    const imgProps: Record<string, unknown> = {
      ...properties,
      src: resolvedSrc,
      alt: normalizeAimdString(properties.alt) ?? asset?.name ?? asset?.filename,
      title: normalizeAimdString(properties.title),
      loading: properties.loading ?? 'lazy',
      class: mergeClassNames('aimd-image', properties.className, properties.class),
    }
    delete imgProps.className
    return h('img', imgProps)
  }
}

export function createReadonlyRecordAimdRenderers(
  options: Pick<ReadonlyRecordVueRendererOptions, 'resolveAsset'> = {},
): Record<string, AimdComponentRenderer> {
  return {
    var: createVarRenderer(options.resolveAsset),
    var_table: createVarTableRenderer(),
    check: createCheckRenderer(),
    quiz: createQuizRenderer(),
    fig: createFigRenderer(options.resolveAsset),
  }
}

export function createReadonlyRecordElementRenderers(
  options: Pick<ReadonlyRecordVueRendererOptions, 'resolveAsset'> = {},
): Record<string, ElementRenderer> {
  return {
    img: createImageElementRenderer(options.resolveAsset),
  }
}

export function normalizeRecordRenderValue(recordData: unknown): RenderContext['value'] {
  return normalizeAimdRecordDataValue(recordData) as RenderContext['value']
}

export function createReadonlyRecordRenderContext<T extends ReadonlyRecordRenderContextInput>(
  recordData: unknown,
  context?: T,
): T & RenderContext {
  return {
    ...((context ?? {}) as T),
    mode: 'edit',
    readonly: true,
    value: normalizeRecordRenderValue(recordData),
  }
}

export async function renderReadonlyRecordToVue(
  content: string,
  recordData: unknown,
  options: ReadonlyRecordVueRendererOptions = {},
): Promise<RenderResult> {
  const { context, resolveAsset: resolveRecordAsset, aimdRenderers, elementRenderers, ...renderOptions } = options
  const readonlyAimdRenderers = createReadonlyRecordAimdRenderers({ resolveAsset: resolveRecordAsset })
  const readonlyElementRenderers = createReadonlyRecordElementRenderers({ resolveAsset: resolveRecordAsset })
  return renderToVue(content, {
    ...renderOptions,
    aimdRenderers: {
      ...readonlyAimdRenderers,
      ...(aimdRenderers ?? {}),
    },
    elementRenderers: {
      ...readonlyElementRenderers,
      ...(elementRenderers ?? {}),
    },
    context: createReadonlyRecordRenderContext(recordData, context),
  })
}
