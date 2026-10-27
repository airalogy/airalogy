/**
 * Milkdown plugin for AIMD inline nodes.
 *
 * Parses `{{type|content}}` syntax in markdown and renders them as
 * styled inline chips in the WYSIWYG editor. The chips are editable
 * via a click-to-edit popover.
 *
 * Also provides an InputRule so typing `{{` triggers the node creation flow.
 */
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'
import type { NodeSchema, MarkdownNode } from '@milkdown/kit/transformer'
import type { Node as ProsemirrorNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { restoreAimdInlineTemplates } from '@airalogy/aimd-core'
import { findAimdInlineTemplates, parseCheckContent, parseStepContent, parseVarDefinition } from '@airalogy/aimd-core/parser'
import type { AimdEditorMessages } from './locales'
import { hardbreakAttr, hardbreakSchema } from '@milkdown/kit/preset/commonmark'
import { $node, $view, $remark, $inputRule } from '@milkdown/kit/utils'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import { normalizeAimdInlineTemplateMarkdownEscapes } from './aimdInlineMarkdownNormalization'

// ─── AIMD field type colors (matches types.ts) ───
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

function getColor(fieldType: string): string {
  return AIMD_COLORS[fieldType] || '#6b7280'
}

// ─── 1. Remark plugin: parse {{type|content}} into custom MDAST nodes ───

function remarkAimdInline(this: { data(): { toMarkdownExtensions?: unknown[] } }) {
  const data = this.data()
  const extensions = (data.toMarkdownExtensions ??= [])
  extensions.push({
    handlers: {
      // AIMD is structured source, not Markdown prose to escape or re-indent.
      aimdField: (node: any) => String(node.value),
    },
  })
  function transformer(tree: any) {
    visitNode(tree)
  }

  function visitNode(node: any) {
    if (
      typeof node.value === 'string'
      && (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode' || node.type === 'html')
    ) {
      node.value = restoreAimdInlineTemplates(node.value)
    }

    if (node.type === 'text' && typeof node.value === 'string') {
      const value = normalizeAimdInlineTemplateMarkdownEscapes(node.value)
      const matches = findAimdInlineTemplates(value)
      if (matches.length === 0) return

      // Split text around AIMD fields
      const children: any[] = []
      let lastIndex = 0

      for (const match of matches) {
        if (match.start > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.start) })
        }
        children.push({
          type: 'aimdField',
          data: {
            hName: 'aimd-field',
            hProperties: { fieldType: match.type, fieldContent: match.content },
          },
          fieldType: match.type,
          fieldContent: match.content,
        })
        lastIndex = match.end
      }

      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) })
      }

      if (children.length > 0) {
        // Replace this text node with the split children
        node._aimdChildren = children
      }
    }

    // Recurse into children
    if (node.children) {
      const newChildren: any[] = []
      for (const child of node.children) {
        visitNode(child)
        if (child._aimdChildren) {
          newChildren.push(...child._aimdChildren)
          delete child._aimdChildren
        } else {
          newChildren.push(child)
        }
      }
      node.children = newChildren
    }
  }

  return transformer
}

// ─── 2. $remark plugin registration ───

export const aimdRemarkPlugin = $remark('aimdInline', () => remarkAimdInline)

// ─── 3. $node: ProseMirror node schema + markdown parser/serializer ───

export const aimdFieldNode = $node('aimd_field', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    fieldType: { default: 'var' },
    fieldContent: { default: '' },
  },
  parseDOM: [{
    tag: 'aimd-field',
    getAttrs: (dom: HTMLElement) => ({
      fieldType: (dom as HTMLElement).getAttribute('data-field-type') || 'var',
      fieldContent: (dom as HTMLElement).getAttribute('data-field-content') || '',
    }),
  }],
  toDOM: (node: ProsemirrorNode) => ['aimd-field', {
    'data-field-type': node.attrs.fieldType,
    'data-field-content': node.attrs.fieldContent,
    class: 'aimd-field-inline',
  }],
  parseMarkdown: {
    match: (mdNode: MarkdownNode) => mdNode.type === 'aimdField',
    runner: (state, mdNode, proseType) => {
      state.addNode(proseType, {
        fieldType: (mdNode as any).fieldType || 'var',
        fieldContent: (mdNode as any).fieldContent || '',
      })
    },
  },
  toMarkdown: {
    match: (node: ProsemirrorNode) => node.type.name === 'aimd_field',
    runner: (state, node) => {
      state.addNode('aimdField', undefined, `{{${node.attrs.fieldType}|${node.attrs.fieldContent}}}`)
    },
  },
} as NodeSchema))

// ─── 4. $view: Custom NodeView for rendering AIMD fields as styled chips ───

class AimdFieldNodeView implements NodeView {
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

    const fieldType = node.attrs.fieldType as string
    const fieldContent = node.attrs.fieldContent as string
    const color = getColor(fieldType)

    // Create DOM
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

    // Type label
    this.labelEl = document.createElement('span')
    this.labelEl.className = 'aimd-field-chip-label'
    this.labelEl.textContent = AIMD_LABELS[fieldType] || fieldType
    this.labelEl.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      opacity: 0.7;
      margin-right: 2px;
    `

    // Content
    this.contentEl = document.createElement('span')
    this.contentEl.className = 'aimd-field-chip-content'
    this.contentEl.textContent = fieldContent
    this.contentEl.style.cssText = `
      font-weight: 500;
    `

    this.dom.appendChild(this.labelEl)
    this.dom.appendChild(this.contentEl)

    // Hover effect
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

    // Click to edit
    this.dom.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.startEditing()
    })
  }

  private startEditing() {
    if (this.editing) return
    this.editing = true

    const fieldType = this.node.attrs.fieldType as string
    const fieldContent = this.node.attrs.fieldContent as string
    const color = getColor(fieldType)

    // Make content editable
    this.contentEl.contentEditable = 'true'
    this.contentEl.style.outline = 'none'
    this.contentEl.style.minWidth = '30px'
    this.contentEl.style.borderBottom = `1px dashed ${color}`
    this.dom.style.background = `${color}1a`
    this.dom.style.borderColor = `${color}66`

    // Focus and select all
    this.contentEl.focus()
    const range = document.createRange()
    range.selectNodeContents(this.contentEl)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    // Handle blur = commit
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
          const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            fieldContent: newContent,
          })
          this.view.dispatch(tr)
        }
      }
    }

    this.contentEl.addEventListener('blur', commit, { once: true })
    this.contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.contentEl.blur()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this.contentEl.textContent = fieldContent
        this.contentEl.blur()
      }
    })
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type.name !== 'aimd_field') return false
    this.node = node
    const fieldType = node.attrs.fieldType as string
    const fieldContent = node.attrs.fieldContent as string
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
    // Allow events inside the chip when editing
    if (this.editing) return true
    if (event.type === 'click') return true
    return false
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    // cleanup
  }
}

export const aimdFieldView = $view(aimdFieldNode, () => {
  return (node, view, getPos) => new AimdFieldNodeView(node, view, getPos)
})

export interface AimdInputEditRequest {
  content: string
  apply: (content: string) => void
}

interface AimdFieldViewOptions {
  compact: boolean
  messages: AimdEditorMessages
  edit: (request: AimdInputEditRequest) => void
  editStep?: (request: AimdInputEditRequest) => void
  editCheck?: (request: AimdInputEditRequest) => void
}

class AimdInputNodeView implements NodeView {
  dom: HTMLButtonElement
  private refresh = () => {
    const { compact, messages } = this.options()
    if (this.node.attrs.fieldType === 'step' || this.node.attrs.fieldType === 'check') {
      const isCheck = this.node.attrs.fieldType === 'check'
      const step = (isCheck ? parseCheckContent : parseStepContent)(this.node.attrs.fieldContent)
      const labels = isCheck ? messages.checkField : messages.stepField
      this.dom.replaceChildren()
      const name = document.createElement('span')
      name.textContent = `${messages.fieldTypes[isCheck ? 'check' : 'step'].label}${step.title ? `: ${step.title}` : ''}`
      this.dom.append(name)
      if (!compact) {
        const key = document.createElement('small')
        key.textContent = step.id
        this.dom.append(key)
      }
      this.dom.className = `aimd-input-chip ${isCheck ? 'aimd-check-chip' : 'aimd-step-chip'}`
      this.dom.title = labels.edit
      this.dom.setAttribute('aria-label', `${labels.edit}: ${step.title || step.id}`)
      this.dom.disabled = !this.view.editable
      return
    }
    const definition = parseVarDefinition(this.node.attrs.fieldContent)
    const label = typeof definition.kwargs?.title === 'string' ? definition.kwargs.title : messages.fieldTypes.var.label
    this.dom.textContent = compact ? label : `var | ${this.node.attrs.fieldContent}`
    this.dom.className = `aimd-input-chip${compact ? '' : ' aimd-input-chip--detailed'}`
    this.dom.title = messages.inputField.edit
    this.dom.setAttribute('aria-label', `${messages.inputField.edit}: ${label}`)
    this.dom.disabled = !this.view.editable
  }

  constructor(private node: ProsemirrorNode, private view: EditorView, private getPos: () => number | undefined, private options: () => AimdFieldViewOptions) {
    this.dom = document.createElement('button')
    this.dom.type = 'button'
    this.dom.contentEditable = 'false'
    this.dom.dataset.fieldType = this.node.attrs.fieldType
    this.refresh()
    this.view.dom.addEventListener('aimd-field-display-change', this.refresh)
    this.dom.addEventListener('click', event => {
      event.preventDefault()
      if (!this.view.editable) return
      const isStep = this.node.attrs.fieldType === 'step'
      const isCheck = this.node.attrs.fieldType === 'check'
      const edit = isCheck ? this.options().editCheck : isStep ? this.options().editStep : this.options().edit
      edit?.({
        content: this.node.attrs.fieldContent,
        apply: content => {
          const pos = this.getPos()
          if (pos === undefined || !this.view.editable) return
          const current = this.view.state.doc.nodeAt(pos)
          if (!current || !current.eq(this.node)) return
          const parse = isCheck ? parseCheckContent : isStep ? parseStepContent : parseVarDefinition
          const oldId = parse(this.node.attrs.fieldContent).id
          const newId = parse(content).id
          const tr = this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, fieldContent: content })
          if (!isCheck && oldId !== newId) {
            this.view.state.doc.descendants((child, childPos) => {
              if (child.type.name === 'aimd_field' && child.attrs.fieldType === (isStep ? 'ref_step' : 'ref_var') && child.attrs.fieldContent.trim() === oldId) {
                tr.setNodeMarkup(childPos, undefined, { ...child.attrs, fieldContent: newId })
              }
            })
          }
          this.view.dispatch(tr)
          this.view.focus()
        },
      })
    })
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type.name !== 'aimd_field' || node.attrs.fieldType !== this.node.attrs.fieldType || (node.attrs.fieldType === 'var' && parseVarDefinition(node.attrs.fieldContent).subvars)) return false
    if (node.attrs.fieldType === 'step' || node.attrs.fieldType === 'check') {
      try {
        (node.attrs.fieldType === 'check' ? parseCheckContent : parseStepContent)(node.attrs.fieldContent)
      }
      catch {
        // Let the raw node view represent an incomplete source edit.
        return false
      }
    }
    this.node = node
    this.refresh()
    return true
  }
  stopEvent() { return true }
  ignoreMutation() { return true }
  destroy() { this.view.dom.removeEventListener('aimd-field-display-change', this.refresh) }
}

export function createAimdAuthoringPlugins(options: () => AimdFieldViewOptions): MilkdownPlugin[] {
  const fieldView = $view(aimdFieldNode, () => (node, view, getPos) => {
    try {
      if (node.attrs.fieldType === 'step' && options().editStep) {
        parseStepContent(node.attrs.fieldContent)
        return new AimdInputNodeView(node, view, getPos, options)
      }
      if (node.attrs.fieldType === 'check' && options().editCheck) {
        parseCheckContent(node.attrs.fieldContent)
        return new AimdInputNodeView(node, view, getPos, options)
      }
      if (node.attrs.fieldType === 'var' && !parseVarDefinition(node.attrs.fieldContent).subvars) {
        return new AimdInputNodeView(node, view, getPos, options)
      }
    } catch {
      // Keep invalid drafts editable as raw syntax rather than breaking the whole editor.
    }
    return new AimdFieldNodeView(node, view, getPos)
  })
  return [aimdRemarkPlugin, aimdFieldNode, fieldView, inlineHardbreakSchema, aimdFieldInputRule].flat()
}

// ─── 5. Schema override: render inline hardbreak (`\n`) as <br> in WYSIWYG ───
// Use schema-level toDOM override for stable rendering across editor view init/order.
export const inlineHardbreakSchema = hardbreakSchema.extendSchema((prev) => {
  return (ctx) => {
    const schema = prev(ctx)
    return {
      ...schema,
      toDOM: (node: ProsemirrorNode) => ['br', ctx.get(hardbreakAttr.key)(node)],
    } as NodeSchema
  }
})

// ─── 6. $inputRule: typing `{{type|content}}` creates an AIMD field node ───

export const aimdFieldInputRule = $inputRule((ctx) => {
  return new InputRule(
    /\{\{(\w+)\|([^}]*)\}\}$/,
    (state, match, start, end) => {
      const [, fieldType, fieldContent] = match
      const nodeType = aimdFieldNode.type(ctx)
      const node = nodeType.create({ fieldType, fieldContent })
      return state.tr.replaceRangeWith(start, end, node)
    }
  )
})

// ─── 7. Combined plugin list for easy use ───

export const aimdMilkdownPlugins: MilkdownPlugin[] = [
  aimdRemarkPlugin,
  aimdFieldNode,
  aimdFieldView,
  inlineHardbreakSchema,
  aimdFieldInputRule,
].flat()
