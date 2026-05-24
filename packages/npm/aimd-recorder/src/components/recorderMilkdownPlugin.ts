import { h, render, type AppContext } from 'vue'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import type { NodeSchema, MarkdownNode } from '@milkdown/kit/transformer'
import { dropCursor } from '@milkdown/kit/prose/dropcursor'
import type { Node as ProsemirrorNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { NodeSelection } from '@milkdown/kit/prose/state'
import { hardbreakAttr, hardbreakSchema } from '@milkdown/kit/preset/commonmark'
import { $node, $prose, $remark, $view } from '@milkdown/kit/utils'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'
import {
  aimdFieldInputRule,
  aimdFieldNode,
  aimdRemarkPlugin,
} from '@airalogy/aimd-editor/vue'
import type { AimdComponentRenderer } from '@airalogy/aimd-renderer'
import type { AimdRecorderMessagesInput } from '../locales'
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  AimdRecorderFieldAdapters,
  AimdStepDetailDisplay,
  AimdTypePlugin,
  FieldEventPayload,
  TableEventPayload,
} from '../types'
import type { AimdWorkbenchFieldType } from '../composables/workbenchFieldEditing'
import { scanWorkbenchFields } from '../composables/workbenchFieldEditing'
import AimdRecorderWysiwygFieldHost from './AimdRecorderWysiwygFieldHost.vue'

export interface RecorderMilkdownFieldIdentity {
  fieldType: AimdWorkbenchFieldType
  id: string
  raw: string
}

export interface RecorderMilkdownSurfaceState {
  record: AimdProtocolRecordData
  readonly: boolean
  currentUserName?: string
  now?: Date | string | number
  locale?: string
  messages?: AimdRecorderMessagesInput
  stepDetailDisplay: AimdStepDetailDisplay
  fieldMeta?: Record<string, AimdFieldMeta>
  fieldState?: Record<string, AimdFieldState>
  wrapField?: (fieldKey: string, fieldType: string, defaultVNode: any) => any
  customRenderers?: Partial<Record<string, AimdComponentRenderer>>
  fieldAdapters?: AimdRecorderFieldAdapters
  resolveFile?: (src: string) => string | null
  typePlugins?: AimdTypePlugin[]
  onUpdateRecord: (value: AimdProtocolRecordData) => void
  onFieldsChange?: (fields: ExtractedAimdFields) => void
  onError?: (message: string) => void
  onFieldChange?: (payload: FieldEventPayload) => void
  onFieldBlur?: (payload: FieldEventPayload) => void
  onAssignerRequest?: (payload: FieldEventPayload) => void
  onAssignerCancel?: (payload: FieldEventPayload) => void
  onTableAddRow?: (payload: TableEventPayload) => void
  onTableRemoveRow?: (payload: TableEventPayload) => void
}

interface RecorderMilkdownPluginOptions {
  appContext?: AppContext | null
  surfaceState: RecorderMilkdownSurfaceState
  onEditField?: (field: RecorderMilkdownFieldIdentity) => void
  onDeleteField?: (field: RecorderMilkdownFieldIdentity) => void
}

const RECORDER_QUIZ_MDAST_TYPE = 'aimdRecorderQuizBlock'
const RECORDER_EDITABLE_INLINE_FIELD_TYPES = new Set(['var', 'var_table', 'step', 'check'])

const AIMD_COLORS: Record<string, string> = {
  var: '#2563eb',
  var_table: '#059669',
  step: '#d97706',
  check: '#dc2626',
  ref_step: '#0891b2',
  ref_var: '#0891b2',
  ref_fig: '#0891b2',
  cite: '#6d28d9',
}

const AIMD_LABELS: Record<string, string> = {
  var: 'var',
  var_table: 'var_table',
  step: 'step',
  check: 'check',
  ref_step: 'ref_step',
  ref_var: 'ref_var',
  ref_fig: 'ref_fig',
  cite: 'cite',
}

function isZhLocale(locale?: string): boolean {
  return (locale || '').toLowerCase().startsWith('zh')
}

function getRecorderNodeUi(locale?: string) {
  const zh = isZhLocale(locale)
  return {
    edit: zh ? '编辑' : 'Edit',
    editTitle: zh ? '编辑字段' : 'Edit field',
    delete: zh ? '删除' : 'Delete',
    deleteTitle: zh ? '删除字段' : 'Delete field',
    dragTitle: zh ? '拖动字段' : 'Drag field',
  }
}

function buildInlineFieldRaw(fieldType: string, fieldContent: string): string {
  return `{{${fieldType}|${fieldContent}}}`
}

function buildQuizBlockRaw(fieldContent: string): string {
  const normalizedContent = fieldContent.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  return `\`\`\`quiz\n${normalizedContent}\n\`\`\``
}

function resolveFieldIdentity(raw: string, fallbackFieldType: AimdWorkbenchFieldType): RecorderMilkdownFieldIdentity | null {
  const matched = scanWorkbenchFields(raw)[0]
  if (matched) {
    return {
      fieldType: matched.fieldType,
      id: matched.id,
      raw: matched.raw,
    }
  }

  return {
    fieldType: fallbackFieldType,
    id: '',
    raw,
  }
}

function getColor(fieldType: string): string {
  return AIMD_COLORS[fieldType] || '#6b7280'
}

function remarkRecorderQuizBlock() {
  function transformer(tree: any) {
    visitNode(tree)
  }

  function visitNode(node: any) {
    if (node.type === 'code' && node.lang === 'quiz') {
      node.type = RECORDER_QUIZ_MDAST_TYPE
      node.fieldContent = node.value || ''
      node.data = {
        hName: 'aimd-recorder-quiz',
        hProperties: { fieldContent: node.fieldContent },
      }
      return
    }

    if (node.children) {
      const nextChildren: any[] = []
      for (const child of node.children) {
        visitNode(child)
        if (child._aimdChildren) {
          nextChildren.push(...child._aimdChildren)
          delete child._aimdChildren
          continue
        }

        nextChildren.push(child)
      }
      node.children = nextChildren
    }
  }

  return transformer
}

const recorderQuizRemarkPlugin = $remark('aimdRecorderQuizBlock', () => remarkRecorderQuizBlock())

const recorderQuizNode = $node('aimd_recorder_quiz', () => ({
  group: 'block',
  atom: true,
  draggable: true,
  attrs: {
    fieldContent: { default: '' },
  },
  parseDOM: [{
    tag: 'aimd-recorder-quiz',
    getAttrs: (dom: HTMLElement) => ({
      fieldContent: dom.getAttribute('data-field-content') || '',
    }),
  }],
  toDOM: (node: ProsemirrorNode) => ['aimd-recorder-quiz', {
    'data-field-content': node.attrs.fieldContent,
    class: 'aimd-recorder-wysiwyg-field aimd-recorder-wysiwyg-field--block',
  }],
  parseMarkdown: {
    match: (mdNode: MarkdownNode) => mdNode.type === RECORDER_QUIZ_MDAST_TYPE,
    runner: (state, mdNode, proseType) => {
      state.addNode(proseType, {
        fieldContent: (mdNode as any).fieldContent || '',
      })
    },
  },
  toMarkdown: {
    match: (node: ProsemirrorNode) => node.type.name === 'aimd_recorder_quiz',
    runner: (state, node) => {
      state.addNode('code', undefined, String(node.attrs.fieldContent || ''), { lang: 'quiz' })
    },
  },
} as NodeSchema))

class RecorderWidgetNodeView implements NodeView {
  dom: HTMLElement
  private bodyEl: HTMLElement
  private summaryEl: HTMLElement
  private editButtonEl: HTMLButtonElement | null = null
  private deleteButtonEl: HTMLButtonElement | null = null
  private dragHandleEl: HTMLElement | null = null

  constructor(
    private node: ProsemirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private options: RecorderMilkdownPluginOptions,
    private block: boolean,
  ) {
    const tagName = block ? 'div' : 'span'
    const ui = getRecorderNodeUi(this.options.surfaceState.locale)
    this.dom = document.createElement(tagName)
    this.dom.className = [
      'aimd-recorder-wysiwyg-node',
      block ? 'aimd-recorder-wysiwyg-node--block' : 'aimd-recorder-wysiwyg-node--inline',
    ].join(' ')
    this.dom.contentEditable = 'false'
    this.dom.draggable = !this.options.surfaceState.readonly

    const chromeEl = document.createElement(block ? 'div' : 'span')
    chromeEl.className = [
      'aimd-recorder-wysiwyg-node__chrome',
      block ? 'aimd-recorder-wysiwyg-node__chrome--block' : 'aimd-recorder-wysiwyg-node__chrome--inline',
    ].join(' ')

    this.summaryEl = document.createElement('span')
    this.summaryEl.className = 'aimd-recorder-wysiwyg-node__summary'
    chromeEl.appendChild(this.summaryEl)

    const actionsEl = document.createElement('span')
    actionsEl.className = 'aimd-recorder-wysiwyg-node__actions'

    this.editButtonEl = document.createElement('button')
    this.editButtonEl.type = 'button'
    this.editButtonEl.className = 'aimd-recorder-wysiwyg-node__action aimd-recorder-wysiwyg-node__action--edit'
    this.editButtonEl.textContent = ui.edit
    this.editButtonEl.title = ui.editTitle
    this.editButtonEl.setAttribute('aria-label', ui.editTitle)
    this.editButtonEl.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (this.options.surfaceState.readonly) {
        return
      }

      const identity = this.resolveIdentity()
      if (identity) {
        this.options.onEditField?.(identity)
      }
    })
    actionsEl.appendChild(this.editButtonEl)

    this.deleteButtonEl = document.createElement('button')
    this.deleteButtonEl.type = 'button'
    this.deleteButtonEl.className = 'aimd-recorder-wysiwyg-node__action aimd-recorder-wysiwyg-node__action--danger'
    this.deleteButtonEl.textContent = ui.delete
    this.deleteButtonEl.title = ui.deleteTitle
    this.deleteButtonEl.setAttribute('aria-label', ui.deleteTitle)
    this.deleteButtonEl.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (this.options.surfaceState.readonly) {
        return
      }

      const identity = this.resolveIdentity()
      if (identity) {
        this.options.onDeleteField?.(identity)
      }
    })
    actionsEl.appendChild(this.deleteButtonEl)

    this.dragHandleEl = document.createElement('span')
    this.dragHandleEl.className = 'aimd-recorder-wysiwyg-node__drag'
    this.dragHandleEl.textContent = '::'
    this.dragHandleEl.title = ui.dragTitle
    this.dragHandleEl.setAttribute('data-drag-handle', 'true')
    this.dragHandleEl.draggable = !this.options.surfaceState.readonly
    this.dragHandleEl.addEventListener('mousedown', (event) => {
      this.selectThisNode()
    })
    this.dragHandleEl.addEventListener('dragstart', () => {
      this.selectThisNode()
    })
    actionsEl.appendChild(this.dragHandleEl)

    chromeEl.appendChild(actionsEl)
    this.dom.appendChild(chromeEl)

    this.bodyEl = document.createElement(tagName)
    this.bodyEl.className = 'aimd-recorder-wysiwyg-node__body'
    this.dom.appendChild(this.bodyEl)

    this.renderField()
  }

  private selectThisNode() {
    const pos = this.getPos()
    if (typeof pos !== 'number') {
      return
    }

    const transaction = this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos))
    this.view.dispatch(transaction)
  }

  private resolveIdentity(): RecorderMilkdownFieldIdentity | null {
    return resolveFieldIdentity(this.resolveRaw(), this.resolveFieldType())
  }

  private resolveFieldType(): AimdWorkbenchFieldType {
    if (this.block) {
      return 'quiz'
    }

    return (this.node.attrs.fieldType || 'var') as AimdWorkbenchFieldType
  }

  private resolveRaw(): string {
    if (this.block) {
      return buildQuizBlockRaw(String(this.node.attrs.fieldContent || ''))
    }

    return buildInlineFieldRaw(
      String(this.node.attrs.fieldType || 'var'),
      String(this.node.attrs.fieldContent || ''),
    )
  }

  private renderField() {
    const identity = this.resolveIdentity()
    const label = identity?.id
      ? `${identity.fieldType} ${identity.id}`
      : this.resolveFieldType()
    this.summaryEl.textContent = label
    this.summaryEl.title = label
    this.dom.setAttribute('data-field-type', this.resolveFieldType())
    this.dom.draggable = !this.options.surfaceState.readonly

    if (this.dragHandleEl) {
      this.dragHandleEl.draggable = !this.options.surfaceState.readonly
    }

    if (this.editButtonEl) {
      this.editButtonEl.disabled = this.options.surfaceState.readonly
    }

    if (this.deleteButtonEl) {
      this.deleteButtonEl.disabled = this.options.surfaceState.readonly
    }

    const vnode = h(AimdRecorderWysiwygFieldHost, {
      surfaceState: this.options.surfaceState,
      rawContent: this.resolveRaw(),
      displayMode: this.block ? 'block' : 'inline',
    })
    vnode.appContext = this.options.appContext ?? null
    render(vnode, this.bodyEl)
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type.name !== this.node.type.name) {
      return false
    }

    this.node = node
    this.renderField()
    return true
  }

  selectNode() {
    this.dom.classList.add('aimd-recorder-wysiwyg-node--selected')
  }

  deselectNode() {
    this.dom.classList.remove('aimd-recorder-wysiwyg-node--selected')
  }

  stopEvent(event: Event): boolean {
    const target = event.target
    if (!(target instanceof Node)) {
      return false
    }

    if (this.dragHandleEl?.contains(target)) {
      return false
    }

    if (this.dom.contains(target)) {
      return true
    }

    return false
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    render(null, this.bodyEl)
  }
}

class AimdFieldChipNodeView implements NodeView {
  dom: HTMLElement
  private node: ProsemirrorNode
  private view: EditorView
  private getPos: () => number | undefined
  private editing = false
  private labelEl: HTMLElement
  private contentEl: HTMLElement

  constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    const fieldType = String(node.attrs.fieldType || 'var')
    const fieldContent = String(node.attrs.fieldContent || '')
    const color = getColor(fieldType)

    this.dom = document.createElement('span')
    this.dom.className = 'aimd-field-chip'
    this.dom.setAttribute('data-field-type', fieldType)
    this.dom.contentEditable = 'false'
    this.dom.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 8px 1px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      line-height: 1.6;
      cursor: pointer;
      user-select: none;
      vertical-align: baseline;
      border: 1px solid ${color}33;
      background: ${color}0d;
      color: ${color};
      transition: all 0.15s;
    `

    this.labelEl = document.createElement('span')
    this.labelEl.className = 'aimd-field-chip-label'
    this.labelEl.textContent = AIMD_LABELS[fieldType] || fieldType
    this.labelEl.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      opacity: 0.7;
      margin-right: 2px;
    `

    this.contentEl = document.createElement('span')
    this.contentEl.className = 'aimd-field-chip-content'
    this.contentEl.textContent = fieldContent
    this.contentEl.style.cssText = 'font-weight: 500;'

    this.dom.appendChild(this.labelEl)
    this.dom.appendChild(this.contentEl)

    this.dom.addEventListener('mouseenter', () => {
      this.dom.style.background = `${color}1a`
      this.dom.style.borderColor = `${color}66`
    })
    this.dom.addEventListener('mouseleave', () => {
      if (!this.editing) {
        this.dom.style.background = `${color}0d`
        this.dom.style.borderColor = `${color}33`
      }
    })
    this.dom.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.startEditing()
    })
  }

  private startEditing() {
    if (this.editing) {
      return
    }

    this.editing = true
    const fieldType = String(this.node.attrs.fieldType || 'var')
    const fieldContent = String(this.node.attrs.fieldContent || '')
    const color = getColor(fieldType)

    this.contentEl.contentEditable = 'true'
    this.contentEl.style.outline = 'none'
    this.contentEl.style.minWidth = '30px'
    this.contentEl.style.borderBottom = `1px dashed ${color}`
    this.dom.style.background = `${color}1a`
    this.dom.style.borderColor = `${color}66`

    this.contentEl.focus()
    const range = document.createRange()
    range.selectNodeContents(this.contentEl)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const commit = () => {
      this.editing = false
      const newContent = this.contentEl.textContent || ''
      this.contentEl.contentEditable = 'false'
      this.contentEl.style.borderBottom = 'none'
      this.dom.style.background = `${color}0d`
      this.dom.style.borderColor = `${color}33`

      if (newContent !== fieldContent) {
        const pos = this.getPos()
        if (pos !== undefined) {
          this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            fieldContent: newContent,
          }))
        }
      }
    }

    this.contentEl.addEventListener('blur', commit, { once: true })
    this.contentEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.contentEl.blur()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        this.contentEl.textContent = fieldContent
        this.contentEl.blur()
      }
    })
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type.name !== 'aimd_field') {
      return false
    }

    this.node = node
    const fieldType = String(node.attrs.fieldType || 'var')
    const fieldContent = String(node.attrs.fieldContent || '')
    const color = getColor(fieldType)

    this.labelEl.textContent = AIMD_LABELS[fieldType] || fieldType
    if (!this.editing) {
      this.contentEl.textContent = fieldContent
    }
    this.dom.setAttribute('data-field-type', fieldType)
    this.dom.style.borderColor = `${color}33`
    this.dom.style.background = `${color}0d`
    this.dom.style.color = color
    return true
  }

  stopEvent(event: Event): boolean {
    if (this.editing) {
      return true
    }

    return event.type === 'click'
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {}
}

const recorderInlineHardbreakSchema = hardbreakSchema.extendSchema((prev) => {
  return (ctx) => {
    const schema = prev(ctx)
    return {
      ...schema,
      toDOM: (node: ProsemirrorNode) => ['br', ctx.get(hardbreakAttr.key)(node)],
    } as NodeSchema
  }
})

const recorderDropCursorPlugin = $prose(() => dropCursor({
  class: 'aimd-recorder-dropcursor',
  color: false,
  width: 4,
}))

export function createRecorderMilkdownPlugins(options: RecorderMilkdownPluginOptions): MilkdownPlugin[] {
  const recorderFieldView = $view(aimdFieldNode, () => {
    return (node, view, getPos) => {
      const fieldType = String(node.attrs.fieldType || 'var')
      if (RECORDER_EDITABLE_INLINE_FIELD_TYPES.has(fieldType)) {
        return new RecorderWidgetNodeView(node, view, getPos, options, false)
      }

      return new AimdFieldChipNodeView(node, view, getPos)
    }
  })

  const recorderQuizView = $view(recorderQuizNode, () => {
    return (node, view, getPos) => new RecorderWidgetNodeView(node, view, getPos, options, true)
  })

  return [
    aimdRemarkPlugin,
    recorderQuizRemarkPlugin,
    aimdFieldNode,
    recorderQuizNode,
    recorderFieldView,
    recorderQuizView,
    recorderInlineHardbreakSchema,
    recorderDropCursorPlugin,
    aimdFieldInputRule,
  ].flat()
}
