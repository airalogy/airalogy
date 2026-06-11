import type {
  AimdCheckNode,
  AimdFigNode,
  AimdNode,
  AimdQuizNode,
  AimdVarNode,
  AimdVarTableNode,
  RenderContext,
} from '@airalogy/aimd-core/types'
import { getAimdFieldDisplayLabel } from '@airalogy/aimd-core/utils'
import { h, type VNode } from 'vue'

import type { AimdRendererOptions, RenderResult } from '../common/processor'
import { renderToVue } from '../common/processor'
import type { AimdComponentRenderer, AimdRendererContext, ElementRenderer, VueRendererOptions } from './vue-renderer'

export const AIMD_RECORD_RENDER_SCOPES = ['var', 'var_table', 'step', 'check', 'quiz'] as const

export type AimdRecordRenderScope = typeof AIMD_RECORD_RENDER_SCOPES[number]

export type ReadonlyRecordAssetKind = 'file' | 'image' | 'audio' | 'video' | 'csv' | 'text' | 'document'

export type AimdRecordRenderValue = Partial<Record<AimdRecordRenderScope, Record<string, unknown>>> & {
  [key: string]: unknown
}

export interface ReadonlyRecordAsset {
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

const FILE_KIND_BY_EXTENSION: Record<string, ReadonlyRecordAssetKind> = {
  csv: 'csv',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  webp: 'image',
  tif: 'image',
  tiff: 'image',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  aimd: 'text',
  md: 'text',
  txt: 'text',
  json: 'text',
  pdf: 'document',
  docx: 'document',
  xlsx: 'document',
  pptx: 'document',
}

const FILE_BADGE_BY_KIND: Record<ReadonlyRecordAssetKind, string> = {
  file: 'FILE',
  image: 'IMG',
  audio: 'AUD',
  video: 'VID',
  csv: 'CSV',
  text: 'TXT',
  document: 'DOC',
}

const AIRALOGY_FILE_ID_RE = /^airalogy\.id\.file\.[^\s]+$/i

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolveRecordData(value: unknown): unknown {
  if (isPlainObject(value) && isPlainObject(value.data)) {
    return value.data
  }
  return value
}

function unwrapRecordValue(value: unknown): unknown {
  if (isPlainObject(value) && 'value' in value) {
    return value.value
  }
  return value
}

function normalizeTypeName(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    : ''
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getStringFromRecord(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined
  }
  for (const key of keys) {
    const value = normalizeString(record[key])
    if (value) {
      return value
    }
  }
  return undefined
}

function getFileExtension(value: unknown): string | undefined {
  const text = normalizeString(value)
  if (!text) {
    return undefined
  }
  const withoutQuery = text.split(/[?#]/, 1)[0] ?? text
  const match = withoutQuery.match(/\.([A-Za-z0-9]+)$/)
  return match?.[1]?.toLowerCase()
}

function kindFromMimeType(mimeType: string | undefined): ReadonlyRecordAssetKind | undefined {
  if (!mimeType) {
    return undefined
  }
  const mime = mimeType.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.includes('csv')) return 'csv'
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('markdown')) return 'text'
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document'
  return undefined
}

function kindFromFileExtension(value: unknown): ReadonlyRecordAssetKind | undefined {
  const extension = getFileExtension(value)
  return extension ? FILE_KIND_BY_EXTENSION[extension] : undefined
}

function kindFromType(type: unknown, kwargs?: Record<string, unknown>): ReadonlyRecordAssetKind | undefined {
  const normalizedInputType = normalizeTypeName(kwargs?.input_type ?? kwargs?.inputType)
  const normalizedType = normalizeTypeName(type)
  const normalized = normalizedInputType || normalizedType
  if (!normalized) {
    return undefined
  }
  if (normalized === 'image' || normalized.startsWith('fileidpng') || normalized.startsWith('fileidjpg') || normalized.startsWith('fileidjpeg') || normalized.startsWith('fileidsvg') || normalized.startsWith('fileidwebp') || normalized.startsWith('fileidtiff')) {
    return 'image'
  }
  if (normalized === 'audio' || normalized.startsWith('fileidmp3')) {
    return 'audio'
  }
  if (normalized === 'video' || normalized.startsWith('fileidmp4')) {
    return 'video'
  }
  if (normalized === 'csv' || normalized.startsWith('fileidcsv')) {
    return 'csv'
  }
  if (normalized.startsWith('fileidmd') || normalized.startsWith('fileidtxt') || normalized.startsWith('fileidjson') || normalized.startsWith('fileidaimd')) {
    return 'text'
  }
  if (normalized.startsWith('fileidpdf') || normalized.startsWith('fileiddocx') || normalized.startsWith('fileidxlsx') || normalized.startsWith('fileidpptx')) {
    return 'document'
  }
  if (normalized === 'file' || normalized === 'upload' || normalized.startsWith('fileid')) {
    return 'file'
  }
  const extension = normalizeString(kwargs?.file_extension ?? kwargs?.fileExtension ?? kwargs?.extension)
  return kindFromFileExtension(extension)
}

function getFileValueId(value: unknown): string | undefined {
  const normalized = unwrapRecordValue(value)
  if (typeof normalized === 'string') {
    return normalized.trim() || undefined
  }
  if (!isPlainObject(normalized)) {
    return undefined
  }
  return getStringFromRecord(normalized, ['id', 'file_id', 'fileId', 'blob_id', 'blobId', 'src', 'url', 'href'])
}

function isLikelyAiralogyFileValue(value: unknown): boolean {
  const fileId = getFileValueId(value)
  return Boolean(fileId && AIRALOGY_FILE_ID_RE.test(fileId))
}

function getFileDisplayName(value: unknown, asset?: ReadonlyRecordAsset | null): string {
  const assetName = normalizeString(asset?.name ?? asset?.filename ?? asset?.downloadName)
  if (assetName) {
    return assetName
  }
  const normalized = unwrapRecordValue(value)
  if (typeof normalized === 'string') {
    return normalized
  }
  if (!isPlainObject(normalized)) {
    return ''
  }
  return getStringFromRecord(normalized, [
    'name',
    'fileName',
    'file_name',
    'filename',
    'originalName',
    'original_name',
    'id',
    'file_id',
    'blob_id',
    'src',
    'url',
  ]) ?? ''
}

function getDisplayValue(value: unknown): unknown {
  return unwrapRecordValue(value)
}

function stringifyDisplayValue(value: unknown): string {
  const normalized = getDisplayValue(value)
  if (normalized === null || normalized === undefined) {
    return ''
  }
  if (typeof normalized === 'string') {
    return normalized
  }
  if (typeof normalized === 'number' || typeof normalized === 'boolean') {
    return String(normalized)
  }
  if (Array.isArray(normalized)) {
    return normalized.map(item => stringifyDisplayValue(item)).filter(Boolean).join(', ')
  }
  try {
    return JSON.stringify(normalized, null, 2)
  }
  catch {
    return String(normalized)
  }
}

function booleanDisplayValue(value: unknown): boolean {
  const normalized = getDisplayValue(value)
  if (typeof normalized === 'boolean') return normalized
  if (typeof normalized === 'number') return normalized !== 0
  if (typeof normalized === 'string') {
    const text = normalized.trim().toLowerCase()
    return !['', 'false', '0', 'no', 'off'].includes(text)
  }
  return Boolean(normalized)
}

function isMarkdownType(type: unknown, kwargs?: Record<string, unknown>): boolean {
  const normalized = normalizeTypeName(kwargs?.input_type ?? kwargs?.inputType) || normalizeTypeName(type)
  return normalized === 'md' || normalized === 'markdown' || normalized === 'airalogymarkdown'
}

function isCodeType(type: unknown, kwargs?: Record<string, unknown>): boolean {
  const normalized = normalizeTypeName(kwargs?.input_type ?? kwargs?.inputType) || normalizeTypeName(type)
  return normalized === 'code' || normalized === 'codestr' || normalized === 'pystr' || normalized === 'pythoncode' || normalized === 'javascriptcode'
}

function isDnaType(type: unknown, kwargs?: Record<string, unknown>): boolean {
  const normalized = normalizeTypeName(kwargs?.input_type ?? kwargs?.inputType) || normalizeTypeName(type)
  return normalized === 'dna' || normalized === 'dnasequence'
}

function isBooleanType(type: unknown, kwargs?: Record<string, unknown>): boolean {
  const normalized = normalizeTypeName(kwargs?.input_type ?? kwargs?.inputType) || normalizeTypeName(type)
  return normalized === 'bool' || normalized === 'boolean' || normalized === 'checkbox'
}

function isFileLikeType(type: unknown, kwargs?: Record<string, unknown>): boolean {
  return Boolean(kindFromType(type, kwargs))
}

function inferAssetKind(
  asset: ReadonlyRecordAsset | null | undefined,
  value: unknown,
  type: unknown,
  kwargs?: Record<string, unknown>,
): ReadonlyRecordAssetKind {
  return asset?.kind
    ?? kindFromMimeType(asset?.mimeType)
    ?? kindFromType(type, kwargs)
    ?? kindFromFileExtension(asset?.filename ?? asset?.name ?? asset?.downloadName)
    ?? kindFromFileExtension(getFileValueId(value))
    ?? 'file'
}

function isEmbeddableAssetUrl(value: string | undefined): boolean {
  return Boolean(value && /^(blob:|data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(value))
}

function getAssetMediaSource(asset: ReadonlyRecordAsset | null | undefined): string | undefined {
  if (asset?.url) {
    return asset.url
  }
  return isEmbeddableAssetUrl(asset?.href) ? asset?.href : undefined
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
  const normalizedValue = getDisplayValue(value)
  const fileId = getFileValueId(value)
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
  const normalizedValue = getDisplayValue(source)
  const fileId = normalizeString(normalizedValue)
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
  const displayValue = stringifyDisplayValue(value)
  if (!displayValue) {
    return renderEmptyValue(node)
  }
  return h('span', recordFieldProps(
    node,
    ['aimd-record-field', 'aimd-record-field--scalar', className].filter(Boolean).join(' '),
  ), displayValue)
}

function renderBooleanValue(node: AimdNode, value: unknown): VNode {
  const checked = booleanDisplayValue(value)
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
  const displayValue = stringifyDisplayValue(value)
  if (!displayValue) {
    return renderEmptyValue(node)
  }
  return h('div', recordFieldProps(node, 'aimd-record-field aimd-record-field--markdown'), displayValue)
}

function renderCodeValue(node: AimdNode, value: unknown, language?: unknown): VNode {
  const lang = normalizeString(language)
  const displayValue = stringifyDisplayValue(value)
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
  const normalized = getDisplayValue(value)
  const sequence = isPlainObject(normalized)
    ? normalizeString(normalized.sequence) ?? stringifyDisplayValue(normalized)
    : stringifyDisplayValue(normalized)
  if (!sequence) {
    return renderEmptyValue(node)
  }
  const name = isPlainObject(normalized) ? normalizeString(normalized.name) : undefined
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
  if (!asset && !getFileValueId(value)) {
    return renderEmptyValue(node)
  }
  const mediaSrc = getAssetMediaSource(asset)
  const href = asset?.href ?? asset?.url
  const name = getFileDisplayName(value, asset) || node.id
  const badge = FILE_BADGE_BY_KIND[kind]
  const commonProps: Record<string, unknown> = {
    ...recordFieldProps(node, `aimd-record-field aimd-record-field--asset aimd-record-field--${kind}`),
    'data-aimd-file-id': getFileValueId(value),
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

function createVarRenderer(resolveRecordAsset?: ReadonlyRecordAssetResolver): AimdComponentRenderer {
  return (node, ctx) => {
    const varNode = node as AimdVarNode
    const definition = varNode.definition
    const kwargs = definition?.kwargs
    const value = ctx.value?.var?.[node.id]
    const asset = resolveAssetForField(node, value, ctx.value, resolveRecordAsset)

    if (isFileLikeType(definition?.type, kwargs) || asset || isLikelyAiralogyFileValue(value)) {
      const kind = inferAssetKind(asset, value, definition?.type, kwargs)
      return renderFileValue(node, value, asset, kind)
    }

    if (isBooleanType(definition?.type, kwargs)) {
      return renderBooleanValue(node, value)
    }

    if (isMarkdownType(definition?.type, kwargs)) {
      return renderMarkdownValue(node, value)
    }

    if (isCodeType(definition?.type, kwargs)) {
      return renderCodeValue(node, value, kwargs?.language ?? kwargs?.lang ?? kwargs?.code_language ?? kwargs?.codeLanguage)
    }

    if (isDnaType(definition?.type, kwargs)) {
      return renderDnaValue(node, value)
    }

    return renderScalarValue(node, value)
  }
}

function normalizeTableRows(value: unknown): Record<string, unknown>[] {
  const normalized = getDisplayValue(value)
  if (Array.isArray(normalized)) {
    return normalized
      .filter((row): row is Record<string, unknown> => isPlainObject(row))
      .map(row => ({ ...row }))
  }
  if (isPlainObject(normalized)) {
    return Object.values(normalized)
      .filter((row): row is Record<string, unknown> => isPlainObject(row))
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
            h('td', stringifyDisplayValue(row[column])),
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
    const normalized = isPlainObject(value) && 'checked' in value ? value.checked : value
    const checked = booleanDisplayValue(normalized)
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
    const answer = stringifyDisplayValue(value)
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
    const resolvedSrc = getAssetMediaSource(asset) ?? figSrc
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
    const src = normalizeString(properties.src)
    const asset = resolveAssetForReference(src, ctx.value, resolveRecordAsset)
    const resolvedSrc = getAssetMediaSource(asset) ?? src
    const imgProps: Record<string, unknown> = {
      ...properties,
      src: resolvedSrc,
      alt: normalizeString(properties.alt) ?? asset?.name ?? asset?.filename,
      title: normalizeString(properties.title),
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
  const source = resolveRecordData(recordData)
  const normalized: RenderContext['value'] = {}
  if (!isPlainObject(source)) {
    return normalized
  }

  for (const scope of AIMD_RECORD_RENDER_SCOPES) {
    const scopeValue = source[scope]
    normalized[scope] = isPlainObject(scopeValue) ? { ...scopeValue } : {}
  }
  if (isPlainObject(source.var_table) && !normalized.var_table) {
    normalized.var_table = { ...source.var_table }
  }

  return normalized
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
