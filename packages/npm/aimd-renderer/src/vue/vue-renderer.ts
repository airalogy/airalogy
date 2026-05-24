import type { Element, Root as HastRoot, Text as HastText, RootContent } from "hast"
import type { Component, VNode, VNodeChild } from "vue"
import type { AimdNode, AimdQuizNode, AimdStepNode, RenderContext } from "@airalogy/aimd-core/types"
import { Fragment, h } from "vue"
import type { AimdRendererI18nOptions, AimdRendererLocale, AimdRendererMessages } from "../locales"
import { resolveQuizPreviewOptions, type ResolvedQuizPreviewOptions } from "../common/quiz-preview"
import {
  createAimdRendererMessages,
  DEFAULT_AIMD_RENDERER_LOCALE,
  getAimdRendererQuizTypeLabel,
  getAimdRendererScopeLabel,
  resolveAimdRendererLocale,
} from "../locales"

/**
 * Extended Element data type
 */
export interface AimdElementData {
  aimd?: AimdNode
}

/**
 * AIMD component renderer function type
 * Can return VNode directly or a Promise for async rendering
 */
export type AimdComponentRenderer = (
  node: AimdNode,
  ctx: AimdRendererContext,
  children?: VNodeChild[]
) => VNode | Promise<VNode> | null

/**
 * Element renderer function type
 */
export type ElementRenderer = (
  node: Element,
  children: VNodeChild[],
  ctx: AimdRendererContext
) => VNode | null

export interface AimdRendererContext extends RenderContext {
  locale: AimdRendererLocale
  messages: AimdRendererMessages
}

export interface AimdStepCardRendererOptions {
  showScopeLabel?: boolean
  showCheckBadge?: boolean
  bodyClassName?: string
  className?: string
}

function resolveQuizPreviewOptionsFromContext(ctx: RenderContext): ResolvedQuizPreviewOptions {
  return resolveQuizPreviewOptions(ctx.mode, ctx.quizPreview)
}

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

function buildQuizStemChildren(
  quizType: AimdQuizNode["quizType"],
  stem: string,
): VNodeChild[] {
  if (quizType !== "blank") {
    return [stem]
  }

  const children: VNodeChild[] = []
  let lastIndex = 0

  for (const match of stem.matchAll(BLANK_PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0
    const fullMatch = match[0]
    const key = match[1]

    if (start > lastIndex) {
      children.push(stem.slice(lastIndex, start))
    }

    children.push(
      h("span", {
        class: "aimd-quiz__blank-placeholder",
        "data-blank-key": key,
      }, key),
    )
    lastIndex = start + fullMatch.length
  }

  if (lastIndex < stem.length) {
    children.push(stem.slice(lastIndex))
  }

  if (children.length === 0) {
    children.push(stem)
  }

  return children
}

function formatScaleOptionLabel(option: NonNullable<AimdQuizNode["options"]>[number]): string {
  if (typeof option.points === "number" && Number.isFinite(option.points)) {
    return `${option.text} (${option.points})`
  }
  return option.text
}

function buildScalePreviewChildren(quizNode: AimdQuizNode): VNodeChild[] {
  if (!Array.isArray(quizNode.items) || quizNode.items.length === 0 || !Array.isArray(quizNode.options) || quizNode.options.length === 0) {
    return [h("div", { class: "aimd-scale__empty" }, "Scale definition is incomplete.")]
  }

  if (quizNode.display === "list") {
    return [
      h("div", { class: "aimd-scale__list" }, quizNode.items.map(item =>
        h("div", { class: "aimd-scale__list-item" }, [
          h("div", { class: "aimd-scale__item-stem" }, item.stem),
          h("ul", { class: "aimd-scale__item-options" }, quizNode.options!.map(option =>
            h("li", formatScaleOptionLabel(option)),
          )),
        ]),
      )),
    ]
  }

  return [
    h("table", { class: "aimd-scale__table" }, [
      h("thead", [
        h("tr", [
          h("th", { class: "aimd-scale__item-header" }, "Item"),
          ...quizNode.options.map(option => h("th", formatScaleOptionLabel(option))),
        ]),
      ]),
      h("tbody", quizNode.items.map(item =>
        h("tr", [
          h("th", { class: "aimd-scale__item-stem", scope: "row" }, item.stem),
          ...quizNode.options!.map(() => h("td", { class: "aimd-scale__cell" }, "○")),
        ]),
      )),
    ]),
  ]
}

function buildScaleBandChildren(quizNode: AimdQuizNode): VNodeChild[] {
  const bands = Array.isArray((quizNode.grading as any)?.bands) ? (quizNode.grading as any).bands : []
  if (bands.length === 0) {
    return []
  }

  return [
    h("ul", { class: "aimd-scale__bands" }, bands.map((band: any) =>
      h("li", `${band.min}-${band.max}: ${band.label}${band.interpretation ? ` · ${band.interpretation}` : ""}`),
    )),
  ]
}

function isStepBodyVNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object") {
    return false
  }

  const props = (node as VNode).props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classValue = props.class
  const classNames = Array.isArray(classValue)
    ? classValue
    : typeof classValue === "string"
      ? [classValue]
      : []

  return props["data-aimd-step-body"] === "true"
    || props["data-aimd-step-body"] === true
    || props.dataAimdStepBody === "true"
    || props.dataAimdStepBody === true
    || classNames.some((className) => typeof className === "string" && className.includes("aimd-step-body"))
}

function normalizeStepCardBodyChildren(children?: VNodeChild[]): VNodeChild[] {
  if (!children || children.length === 0) {
    return []
  }

  const groupedBody = children.find((child) => isStepBodyVNode(child))
  if (groupedBody && typeof groupedBody === "object" && groupedBody !== null) {
    const groupedChildren = (groupedBody as VNode).children
    if (Array.isArray(groupedChildren)) {
      return groupedChildren as VNodeChild[]
    }
    if (groupedChildren !== null && groupedChildren !== undefined) {
      return [groupedChildren as VNodeChild]
    }
  }

  return children
}

/**
 * Default AIMD component renderers
 */
const defaultAimdRenderers: Record<string, AimdComponentRenderer> = {
  var: (node, ctx) => {
    const { id, scope } = node
    const definition = "definition" in node ? node.definition : undefined

    if (ctx.mode === "preview") {
      return h("span", {
        "class": "aimd-field aimd-field--var",
        "data-aimd-type": "var",
        "data-aimd-id": id,
        "data-aimd-scope": scope,
      }, [
        h("span", { class: "aimd-field__scope" }, getAimdRendererScopeLabel(scope, ctx.messages)),
        h("span", { class: "aimd-field__name" }, id),
        definition?.type ? h("span", { class: "aimd-field__type" }, `: ${definition.type}`) : null,
      ])
    }

    // Edit mode - render as editable field with value display
    const fieldData = ctx.value?.[scope]?.[id]
    const value = typeof fieldData === "object" && fieldData !== null && "value" in fieldData
      ? (fieldData as { value: unknown }).value
      : fieldData
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : id

    return h("span", {
      "class": "aimd-field aimd-field--var aimd-field--editable",
      "data-aimd-type": "var",
      "data-aimd-id": id,
      "data-aimd-scope": scope,
      "data-has-variable": "true",
      "id": `${scope}-${id}`,
    }, [
      h("span", { class: "aimd-field__value" }, displayValue),
    ])
  },

  var_table: (node, ctx) => {
    const { id } = node
    const columns = "columns" in node ? node.columns : []

    if (ctx.mode === "preview") {
      // Preview mode: render tag with table preview inside
      const children: VNodeChild[] = [
        h("div", { class: "aimd-field__header" }, [
          h("span", { class: "aimd-field__scope" }, ctx.messages.scope.table),
          h("span", { class: "aimd-field__name" }, id),
        ]),
      ]
      // Add table preview inside the container
      if (columns && columns.length > 0) {
        children.push(
          h("table", { class: "aimd-field__table-preview" }, [
            h("thead", [
              h("tr", columns.map(col => h("th", col))),
            ]),
            h("tbody", [
              h("tr", columns.map(() => h("td", "..."))),
            ]),
          ]),
        )
      }
      return h("div", {
        "class": "aimd-field aimd-field--var-table",
        "data-aimd-type": "var_table",
        "data-aimd-id": id,
      }, children)
    }

    // Edit mode: render empty container (will be replaced by AIMDTag component)
    return h("div", {
      "class": "aimd-field aimd-field--var-table aimd-field--editable",
      "data-aimd-type": "var_table",
      "data-aimd-id": id,
      "id": `var_table-${id}`,
    })
  },

  quiz: (node, ctx) => {
    const quizNode = node as AimdQuizNode
    const { id, scope, quizType, stem, score } = quizNode
    const typeLabel = getAimdRendererQuizTypeLabel(quizType, quizNode.mode, ctx.messages)

    if (ctx.mode === "preview") {
      const previewChildren: VNodeChild[] = [
        h("div", { class: "aimd-quiz__meta" }, [
          h("span", { class: "aimd-field__scope" }, getAimdRendererScopeLabel(scope, ctx.messages)),
          h("span", { class: "aimd-field__name" }, id),
          h("span", { class: "aimd-field__type" }, `(${typeLabel})`),
          score !== undefined ? h("span", { class: "aimd-quiz__score" }, ctx.messages.quiz.score(score)) : null,
        ]),
        typeof quizNode.title === "string" && quizNode.title.trim()
          ? h("div", { class: "aimd-quiz__title" }, quizNode.title)
          : null,
        h("div", { class: "aimd-quiz__stem" }, buildQuizStemChildren(quizType, stem || id)),
        typeof quizNode.description === "string" && quizNode.description.trim()
          ? h("div", { class: "aimd-quiz__description" }, quizNode.description)
          : null,
      ]

      if ((quizType === "choice" || quizType === "true_false") && Array.isArray(quizNode.options) && quizNode.options.length > 0) {
        previewChildren.push(
          h("ul", { class: "aimd-quiz__options" }, quizNode.options.map(opt =>
            h("li", `${opt.key}. ${opt.text}`),
          )),
        )
      }

      if (quizType === "scale") {
        previewChildren.push(...buildScalePreviewChildren(quizNode))
        previewChildren.push(...buildScaleBandChildren(quizNode))
      }

      const quizPreview = resolveQuizPreviewOptionsFromContext(ctx)

      if (quizPreview.showAnswers && (quizType === "choice" || quizType === "true_false") && quizNode.answer !== undefined) {
        const answerText = Array.isArray(quizNode.answer)
          ? quizNode.answer.join(", ")
          : String(quizNode.answer)
        if (answerText.trim()) {
          previewChildren.push(
            h("div", { class: "aimd-quiz__answer" }, ctx.messages.quiz.answer(answerText)),
          )
        }
      }

      if (quizPreview.showAnswers && quizType === "blank" && Array.isArray(quizNode.blanks) && quizNode.blanks.length > 0) {
        previewChildren.push(
          h("ul", { class: "aimd-quiz__blanks" }, quizNode.blanks.map(blank =>
            h("li", `${blank.key}: ${blank.answer}`),
          )),
        )
      }

      if (quizPreview.showRubric && quizType === "open" && typeof quizNode.rubric === "string" && quizNode.rubric.trim()) {
        previewChildren.push(
          h("div", { class: "aimd-quiz__rubric" }, ctx.messages.quiz.rubric(quizNode.rubric)),
        )
      }

      return h("div", {
        "class": "aimd-field aimd-field--quiz",
        "data-aimd-type": "quiz",
        "data-aimd-id": id,
        "data-aimd-scope": scope,
        "id": `quiz-${id}`,
      }, previewChildren)
    }

    const fieldData = ctx.value?.[scope]?.[id]
    let displayValue: string
    if (Array.isArray(fieldData)) {
      displayValue = fieldData.join(", ")
    }
    else if (isPlainObject(fieldData)) {
      displayValue = JSON.stringify(fieldData)
    }
    else if (fieldData === undefined || fieldData === null || fieldData === "") {
      displayValue = id
    }
    else {
      displayValue = String(fieldData)
    }

    return h("div", {
      "class": "aimd-field aimd-field--quiz aimd-field--editable",
      "data-aimd-type": "quiz",
      "data-aimd-id": id,
      "data-aimd-scope": scope,
      "id": `quiz-${id}`,
    }, [
      h("span", { class: "aimd-field__value" }, displayValue),
    ])
  },

  step: (node, ctx, children) => {
    const { id, scope } = node
    const stepNode = node as AimdStepNode
    const stepNum = stepNode.step || "1"

    if (ctx.mode === "preview") {
      // Preview mode: render as localized step label + sequence + id
      return h("span", {
        "class": "aimd-field aimd-field--step",
        "data-aimd-type": "step",
        "data-aimd-id": id,
        "data-aimd-step": stepNum,
        "id": `step-${id}`,
      }, [
        h("span", { class: "aimd-field__scope" }, getAimdRendererScopeLabel(scope, ctx.messages)),
        h("span", { class: "aimd-field__step-num" }, stepNum),
        h("span", { class: "aimd-field__name" }, id),
      ])
    }

    // Edit mode - render step container with children
    return h("div", {
      "class": "aimd-field aimd-field--step aimd-field--editable research-step__item",
      "data-aimd-type": "step",
      "data-aimd-id": id,
      "data-aimd-step": stepNum,
      "data-aimd-level": stepNode.level,
      "id": `step-${id}`,
    }, [
      h("div", { class: "research-step__header" }, [
        h("span", { class: "research-step__sequence" }, ctx.messages.step.sequence(stepNum)),
      ]),
      children && children.length > 0
        ? h("div", { class: "research-step__content" }, children)
        : null,
    ])
  },

  check: (node, ctx, children) => {
    const { id, scope } = node
    const label = "label" in node ? node.label : id

    if (ctx.mode === "preview") {
      // Preview mode: render with checkbox (disabled)
      return h("label", {
        "class": "aimd-field aimd-field--check",
        "data-aimd-type": "check",
        "data-aimd-id": id,
        "id": `check-${id}`,
      }, [
        h("input", {
          type: "checkbox",
          disabled: true,
          class: "aimd-checkbox",
        }),
        h("span", { class: "aimd-field__label" }, label),
      ])
    }

    const scopeValue = ctx.value?.[scope]?.[id]
    const checked = typeof scopeValue === "object" && scopeValue !== null && "checked" in scopeValue
      ? Boolean((scopeValue as Record<string, unknown>).checked)
      : false

    return h("label", {
      "class": "aimd-field aimd-field--check aimd-field--editable",
      "data-aimd-type": "check",
      "data-aimd-id": id,
      "id": `check-${id}`,
    }, [
      h("input", {
        type: "checkbox",
        checked,
        disabled: ctx.readonly,
        class: "aimd-checkbox",
        onChange: (e: Event) => {
          if (!ctx.value)
            return

          const scopeValues = (ctx.value[scope] ??= {})
          const nextChecked = (e.target as HTMLInputElement).checked
          const currentValue = scopeValues[id]

          if (typeof currentValue === "object" && currentValue !== null) {
            (currentValue as Record<string, unknown>).checked = nextChecked
          }
          else {
            scopeValues[id] = { checked: nextChecked }
          }
        },
      }),
      h("span", { class: "aimd-field__label" }, label),
      children && children.length > 0 ? children : null,
    ])
  },

  ref_step: (node, ctx) => {
    const { id } = node
    const refTarget = "refTarget" in node ? node.refTarget : id
    const stepSequence = "stepSequence" in node && typeof (node as any).stepSequence === "string"
      ? (node as any).stepSequence
      : undefined
    const displayText = stepSequence ? ctx.messages.step.reference(stepSequence) : refTarget

    return h("span", {
      "class": "aimd-ref aimd-ref--step",
      "data-aimd-type": "ref_step",
      "data-aimd-ref": refTarget,
      "data-aimd-step-sequence": stepSequence,
      "title": refTarget,
    }, [
      h("span", { class: "aimd-ref__content" }, [
        h("span", { class: "aimd-field aimd-field--step aimd-field--readonly" }, [
          h("span", { class: "research-step__sequence" }, displayText),
        ]),
      ]),
    ])
  },

  ref_var: (node, ctx) => {
    const { id } = node
    const refTarget = "refTarget" in node ? node.refTarget : id
    const referencedValue = ctx.mode === "edit" ? getReferencedVarDisplayValue(ctx.value, refTarget) : null

    return h("span", {
      "class": "aimd-ref aimd-ref--var",
      "data-aimd-type": "ref_var",
      "data-aimd-ref": refTarget,
      "title": refTarget,
    }, [
      h("span", { class: "aimd-ref__content" }, [
        referencedValue !== null
          ? h("span", {
            class: "aimd-field aimd-field--var aimd-field--readonly",
            "data-aimd-id": refTarget,
            "data-aimd-scope": "var",
          }, [
            h("span", { class: "aimd-field__value" }, referencedValue),
          ])
          : h("span", { class: "aimd-field aimd-field--var" }, [
            h("span", { class: "aimd-field__scope" }, ctx.messages.scope.var),
            h("span", { class: "aimd-field__name" }, refTarget),
          ]),
      ]),
    ])
  },

  ref_fig: (node, ctx) => {
    const { id } = node
    const refTarget = "refTarget" in node ? node.refTarget : id
    const figureNumber = "figureNumber" in node ? (node as any).figureNumber : undefined

    // Display figure number if available, otherwise show ID
    const displayText = ctx.messages.figure.reference(figureNumber !== undefined ? figureNumber : refTarget)

    // Render as link reference to the figure
    return h("a", {
      "class": "aimd-ref aimd-ref--fig",
      "data-aimd-type": "ref_fig",
      "data-aimd-ref": refTarget,
      "href": `#fig-${refTarget}`,
    }, [
      h("span", { class: "aimd-ref__content" }, displayText),
    ])
  },

  cite: (node, ctx) => {
    const refs = "refs" in node ? (node as any).refs : [node.id]

    return h("span", {
      "class": "aimd-cite",
      "data-aimd-type": "cite",
      "data-aimd-refs": refs.join(","),
    }, [
      h("span", { class: "aimd-cite__refs" }, `[${refs.join(", ")}]`),
    ])
  },

  fig: (node, ctx) => {
    const figNode = node as any
    const figId = figNode.id || node.id
    const figSrc = figNode.src || ""
    const figTitle = figNode.title
    const figLegend = figNode.legend
    const figSequence = figNode.sequence

    const children: VNodeChild[] = []

    // Image element
    children.push(
      h("img", {
        class: "aimd-figure__image",
        src: figSrc,
        alt: figTitle || figId,
        loading: "lazy",
      }),
    )

    // Caption (title + legend)
    if (figTitle || figLegend || figSequence !== undefined) {
      const captionChildren: VNodeChild[] = []

      // Figure number and title
      if (figSequence !== undefined || figTitle) {
        const titleText = figSequence !== undefined
          ? ctx.messages.figure.captionTitle(figSequence + 1, figTitle)
          : figTitle
        captionChildren.push(
          h("div", { class: "aimd-figure__title" }, titleText),
        )
      }

      // Legend
      if (figLegend) {
        captionChildren.push(
          h("div", { class: "aimd-figure__legend" }, figLegend),
        )
      }

      children.push(
        h("figcaption", { class: "aimd-figure__caption" }, captionChildren),
      )
    }

    return h("figure", {
      "class": "aimd-figure",
      "data-aimd-type": "fig",
      "data-aimd-fig-id": figId,
      "data-aimd-fig-src": figSrc,
      "id": `fig-${figId}`,
    }, children)
  },
}

/**
 * Render options
 */
export interface VueRendererOptions {
  /**
   * Built-in renderer locale
   */
  locale?: AimdRendererI18nOptions["locale"]
  /**
   * Optional overrides for built-in renderer copy
   */
  messages?: AimdRendererI18nOptions["messages"]
  /**
   * Render mode shorthand (used when context is not provided)
   */
  mode?: RenderContext["mode"]
  /**
   * Quiz preview visibility shorthand (used when context is not provided)
   */
  quizPreview?: RenderContext["quizPreview"]
  /**
   * Render context
   */
  context?: RenderContext & Partial<Pick<AimdRendererContext, "locale" | "messages">>
  /**
   * Custom AIMD component renderers
   * Override default renderers or add new ones
   */
  aimdRenderers?: Record<string, AimdComponentRenderer>
  /**
   * Custom HTML element renderers
   * Render specific HTML tags with custom components
   */
  elementRenderers?: Record<string, ElementRenderer>
  /**
   * Component map for rendering Vue components by tag name
   * e.g., { 'step-renderer': StepRendererComponent }
   */
  componentMap?: Record<string, Component>
}

/**
 * Default render context
 */
const defaultContext: AimdRendererContext = {
  mode: "preview",
  readonly: false,
  locale: DEFAULT_AIMD_RENDERER_LOCALE,
  messages: createAimdRendererMessages(DEFAULT_AIMD_RENDERER_LOCALE),
}

function resolveRenderContext(options: VueRendererOptions): AimdRendererContext {
  const topLevelMode = options.mode
  const topLevelQuizPreview = options.quizPreview
  const context = options.context
  const locale = context?.locale ?? resolveAimdRendererLocale(options.locale)
  const messages = context?.messages ?? createAimdRendererMessages(locale, options.messages)

  return {
    ...defaultContext,
    ...(context ?? {}),
    mode: context?.mode ?? topLevelMode ?? defaultContext.mode,
    quizPreview: context?.quizPreview ?? topLevelQuizPreview ?? undefined,
    locale,
    messages,
  }
}

/**
 * Figure context for tracking figure numbers and references
 */
export interface FigureContext {
  /** Map from fig ID to sequence number */
  figureNumbers: Map<string, number>
  /** Current figure sequence counter */
  sequence: number
}

/**
 * Create initial figure context
 */
function createFigureContext(): FigureContext {
  return {
    figureNumbers: new Map(),
    sequence: 0,
  }
}

/**
 * Pre-process HAST tree to assign figure numbers
 */
function preprocessFigures(node: HastRoot | RootContent, figCtx: FigureContext): void {
  if (node.type === "root") {
    for (const child of node.children) {
      preprocessFigures(child, figCtx)
    }
    return
  }

  if (node.type === "element") {
    const element = node as Element
    const aimdType = element.properties?.["data-aimd-type"] || element.properties?.dataAimdType

    // Process fig nodes
    if (aimdType === "fig") {
      const figId = element.properties?.["data-aimd-fig-id"] || element.properties?.dataAimdFigId
      if (figId && typeof figId === "string") {
        // Assign sequence number if not already assigned
        if (!figCtx.figureNumbers.has(figId)) {
          figCtx.figureNumbers.set(figId, figCtx.sequence)
          figCtx.sequence++
        }

        // Update AIMD node data if present
        const aimdData = (element.data as AimdElementData | undefined)?.aimd
        if (aimdData && "sequence" in aimdData) {
          (aimdData as any).sequence = figCtx.figureNumbers.get(figId)
        }
      }
    }

    // Recursively process children
    for (const child of element.children || []) {
      preprocessFigures(child, figCtx)
    }
  }
}

/**
 * Parse AIMD node from HAST element properties
 */
function parseAimdFromProps(props: Record<string, unknown>): AimdNode | undefined {
  let parsedFromJson: Record<string, unknown> | undefined

  // Try to get from JSON attribute first
  const jsonData = props["data-aimd-json"] || props.dataAimdJson
  if (jsonData && typeof jsonData === "string") {
    try {
      parsedFromJson = JSON.parse(jsonData) as Record<string, unknown>
    }
    catch (e) {
      console.warn("Failed to parse AIMD JSON:", e)
    }
  }

  // Reconstruct from individual properties
  const fieldType = (props["data-aimd-type"] || props.dataAimdType) as string
  const id = (props["data-aimd-id"] || props.dataAimdId) as string
  const scope = (props["data-aimd-scope"] || props.dataAimdScope) as string
  const raw = (props["data-aimd-raw"] || props.dataAimdRaw) as string

  if (!fieldType || !id) {
    return undefined
  }

  const baseNode: Record<string, unknown> = {
    type: "aimd" as const,
    fieldType: fieldType as AimdNode["fieldType"],
    id,
    scope: (scope || "var") as AimdNode["scope"],
    raw: raw || `{{${fieldType}|${id}}}`,
  }

  const stepSequence = props["data-aimd-step-sequence"] || props.dataAimdStepSequence
  if (parsedFromJson) {
    if (typeof stepSequence === "string" && stepSequence.trim()) {
      parsedFromJson.stepSequence = stepSequence
    }
    return parsedFromJson as unknown as AimdNode
  }

  if (typeof stepSequence === "string" && stepSequence.trim()) {
    baseNode.stepSequence = stepSequence
  }

  // Add step-specific properties
  if (fieldType === "step") {
    const step = (props["data-aimd-step"] || props.dataAimdStep) as string
    const level = Number.parseInt((props["data-aimd-level"] || props.dataAimdLevel) as string || "0", 10)
    return {
      ...baseNode,
      fieldType: "step",
      level,
      sequence: 0,
      step: step || "1",
    } as AimdNode
  }

  // Add fig-specific properties
  if (fieldType === "fig") {
    const figId = (props["data-aimd-fig-id"] || props.dataAimdFigId) as string
    const figSrc = (props["data-aimd-fig-src"] || props.dataAimdFigSrc) as string
    return {
      ...baseNode,
      fieldType: "fig",
      id: figId || id,
      src: figSrc || "",
      title: undefined,
      legend: undefined,
    } as AimdNode
  }

  // Add quiz-specific properties
  if (fieldType === "quiz") {
    const quizType = (props["data-aimd-quiz-type"] || props.dataAimdQuizType || "open") as string
    const stem = (props["data-aimd-quiz-stem"] || props.dataAimdQuizStem || "") as string
    return {
      ...baseNode,
      fieldType: "quiz",
      quizType: quizType as AimdQuizNode["quizType"],
      stem,
    } as AimdNode
  }

  return baseNode as unknown as AimdNode
}

/**
 * Convert HAST element properties to Vue props
 */
function convertProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(properties)) {
    // Convert className to class
    if (key === "className") {
      props.class = Array.isArray(value) ? value.join(" ") : value
    }
    else if (key === "htmlFor") {
      props.for = value
    }
    else if (key.startsWith("data")) {
      // Convert camelCase data attributes to kebab-case
      const dataKey = key.replace(/([A-Z])/g, "-$1").toLowerCase()
      props[dataKey] = value
    }
    else {
      props[key] = value
    }
  }

  return props
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getReferencedVarDisplayValue(
  value: RenderContext["value"] | undefined,
  refTarget: string,
): string | null {
  const fieldData = value?.var?.[refTarget]
  const resolvedValue = isPlainObject(fieldData) && "value" in fieldData
    ? fieldData.value
    : fieldData

  if (resolvedValue === undefined || resolvedValue === null || resolvedValue === "") {
    return null
  }

  if (Array.isArray(resolvedValue)) {
    return resolvedValue.map(item => String(item)).join(", ")
  }

  if (isPlainObject(resolvedValue)) {
    try {
      return JSON.stringify(resolvedValue)
    }
    catch {
      return null
    }
  }

  return String(resolvedValue)
}

/**
 * Void elements that don't have children
 */
const VOID_ELEMENTS = new Set([
  "img",
  "br",
  "hr",
  "input",
  "meta",
  "link",
  "area",
  "base",
  "col",
  "embed",
  "param",
  "source",
  "track",
  "wbr",
])

/**
 * Convert HAST node to Vue VNode
 */
export function hastToVue(
  node: HastRoot | RootContent,
  options: VueRendererOptions = {},
  figCtx?: FigureContext,
): VNodeChild {
  const {
    aimdRenderers = {},
    elementRenderers = {},
    componentMap = {},
  } = options
  const context = resolveRenderContext(options)

  // Merge custom renderers with defaults
  const mergedAimdRenderers = { ...defaultAimdRenderers, ...aimdRenderers }

  // Initialize figure context on root
  if (!figCtx && node.type === "root") {
    figCtx = createFigureContext()
    preprocessFigures(node, figCtx)
  }

  // Handle root node
  if (node.type === "root") {
    const children = node.children
      .map(child => hastToVue(child, options, figCtx))
      .filter(Boolean)
    return h(Fragment, null, children)
  }

  // Handle text node
  if (node.type === "text") {
    return (node as HastText).value
  }

  // Handle element node
  if (node.type === "element") {
    const element = node as Element
    const { tagName, properties = {}, children = [] } = element

    // Check for AIMD node
    const aimdType = properties["data-aimd-type"] || properties.dataAimdType
    if (aimdType) {
      // Try to get AIMD data from node.data first
      let aimdData = (element.data as AimdElementData | undefined)?.aimd

      // If not found, parse from properties
      if (!aimdData) {
        aimdData = parseAimdFromProps(properties as Record<string, unknown>)
      }

      if (aimdData) {
        // Add figure sequence number if this is a fig node
        if (aimdData.fieldType === "fig" && figCtx) {
          const figId = aimdData.id
          const sequence = figCtx.figureNumbers.get(figId)
          if (sequence !== undefined) {
            (aimdData as any).sequence = sequence
          }
        }

        // Add figure number to ref_fig references
        if (aimdData.fieldType === "ref_fig" && figCtx) {
          const refTarget = aimdData.refTarget
          const sequence = figCtx.figureNumbers.get(refTarget)
          if (sequence !== undefined) {
            (aimdData as any).figureNumber = sequence + 1
          }
        }

        const renderer = mergedAimdRenderers[aimdData.fieldType]
        if (renderer) {
          // Process children for container elements (step, check)
          const childVNodes = children
            .map(child => hastToVue(child, options, figCtx))
            .filter(Boolean)
          const result = renderer(aimdData, context, childVNodes)
          if (isPromiseLike<VNode>(result)) {
            if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
              console.warn(
                `[aimd-renderer] Async renderer for "${aimdData.fieldType}" returned a Promise, `
                + `but hastToVue() is synchronous. The node will be skipped. `
                + `Use a synchronous renderer or handle async rendering at a higher level.`,
              )
            }
            return null
          }
          if (result) {
            return result
          }
        }
      }
    }

    // Check for component map
    if (componentMap[tagName]) {
      const childVNodes = children
        .map(child => hastToVue(child, options, figCtx))
        .filter(Boolean)
      return h(componentMap[tagName], convertProperties(properties as Record<string, unknown>), childVNodes)
    }

    // Check custom element renderer
    if (elementRenderers[tagName]) {
      const childVNodes = children
        .map(child => hastToVue(child, options, figCtx))
        .filter(Boolean)
      const rendered = elementRenderers[tagName](element, childVNodes, context)
      if (rendered !== null && rendered !== undefined) {
        return rendered
      }
    }

    // Convert properties
    const vueProps = convertProperties(properties as Record<string, unknown>)

    // Handle void elements
    if (VOID_ELEMENTS.has(tagName)) {
      return h(tagName, vueProps)
    }

    // Recursively process children
    const childVNodes = children
      .map(child => hastToVue(child, options, figCtx))
      .filter(Boolean)

    return h(tagName, vueProps, childVNodes)
  }

  // Handle comment node (ignore)
  if (node.type === "comment") {
    return null
  }

  // Handle doctype (ignore)
  if (node.type === "doctype") {
    return null
  }

  // Handle raw node
  if (node.type === "raw") {
    return h("span", {
      innerHTML: (node as any).value,
    })
  }

  return null
}

/**
 * Convert HAST tree to Vue VNode array
 */
export function renderToVNodes(
  tree: HastRoot,
  options: VueRendererOptions = {},
): VNode[] {
  const result = hastToVue(tree, options)

  if (result === null || result === undefined) {
    return []
  }

  if (Array.isArray(result)) {
    return result.filter((v): v is VNode => v !== null && typeof v === "object")
  }

  if (typeof result === "object" && "type" in result) {
    return [result as VNode]
  }

  // Wrap text node in span
  return [h("span", null, String(result))]
}

/**
 * Create a custom AIMD renderer that wraps a Vue component
 */
export function createComponentRenderer(
  component: Component,
  propsMapper?: (node: AimdNode, ctx: AimdRendererContext) => Record<string, unknown>,
): AimdComponentRenderer {
  return (node, ctx, children) => {
    const props = propsMapper ? propsMapper(node, ctx) : { node, ctx }
    return h(component, props, children ? { default: () => children } : undefined)
  }
}

export function createStepCardRenderer(
  options: AimdStepCardRendererOptions = {},
): AimdComponentRenderer {
  const {
    showScopeLabel = true,
    showCheckBadge = true,
    bodyClassName = "",
    className = "",
  } = options

  return (node, ctx, children) => {
    const stepNode = node as AimdStepNode
    const stepLabel = stepNode.step || "?"
    const title = stepNode.title || stepNode.id
    const subtitle = stepNode.subtitle || ""
    const isResult = Boolean(stepNode.result)
    const hasCheck = Boolean(stepNode.check)
    const level = Number(stepNode.level || 1)
    const bodyChildren = normalizeStepCardBodyChildren(children)

    const rootClasses = [
      "aimd-step-card",
      className,
      level > 1 ? `aimd-step-card--level-${level}` : "",
      isResult ? "aimd-step-card--result" : "",
      hasCheck ? "aimd-step-card--checkable" : "",
    ].filter(Boolean)

    return h("article", {
      class: rootClasses,
      "data-aimd-step-id": stepNode.id,
      "data-aimd-step-level": String(level),
      style: {
        display: "grid",
        gap: "14px",
        padding: level > 1 ? "16px 18px 16px 20px" : "18px 20px",
        margin: "12px 0",
        borderRadius: "18px",
        border: "1px solid rgba(26, 39, 31, 0.12)",
        background: isResult
          ? "linear-gradient(180deg, rgba(255,248,233,0.98) 0%, rgba(255,252,245,0.98) 100%)"
          : "linear-gradient(180deg, rgba(248,252,249,0.98) 0%, rgba(255,255,255,0.98) 100%)",
        boxShadow: "0 18px 40px rgba(15, 31, 23, 0.08)",
        position: "relative",
        overflow: "hidden",
      },
    }, [
      h("header", {
        class: "aimd-step-card__header",
        style: {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "14px",
        },
      }, [
        h("div", {
          style: {
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            minWidth: "0",
          },
        }, [
          h("div", {
            class: "aimd-step-card__badge",
            style: {
              minWidth: "42px",
              height: "42px",
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              fontSize: "14px",
              color: "#0d5139",
              background: hasCheck
                ? "linear-gradient(180deg, rgba(212,242,227,1) 0%, rgba(184,233,208,1) 100%)"
                : "linear-gradient(180deg, rgba(232,241,236,1) 0%, rgba(216,232,222,1) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
              flexShrink: 0,
            },
          }, stepLabel),
          h("div", {
            style: {
              display: "grid",
              gap: "6px",
              minWidth: "0",
            },
          }, [
            showScopeLabel
              ? h("div", {
                  style: {
                    fontSize: "11px",
                    fontWeight: "700",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#5d7066",
                  },
                }, ctx.messages.scope.step)
              : null,
            h("div", {
              class: "aimd-step-card__title",
              style: {
                fontSize: "18px",
                fontWeight: "700",
                lineHeight: "1.2",
                color: "#1b2b22",
                wordBreak: "break-word",
              },
            }, title),
            subtitle
              ? h("div", {
                  class: "aimd-step-card__subtitle",
                  style: {
                    fontSize: "13px",
                    lineHeight: "1.45",
                    color: "#5c6f65",
                  },
                }, subtitle)
              : null,
          ]),
        ]),
        h("div", {
          style: {
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          },
        }, [
          showCheckBadge && hasCheck
            ? h("span", {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "rgba(22, 114, 79, 0.10)",
                  color: "#0d5139",
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                },
              }, "Check")
            : null,
          isResult
            ? h("span", {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "rgba(181, 118, 0, 0.10)",
                  color: "#8a4f00",
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                },
              }, "Result")
            : null,
        ]),
      ]),
      bodyChildren.length > 0
        ? h("div", {
            class: ["aimd-step-card__body", bodyClassName].filter(Boolean),
            style: {
              display: "grid",
              gap: "10px",
              color: "#24352c",
              fontSize: "14px",
              lineHeight: "1.75",
            },
          }, bodyChildren)
        : null,
    ])
  }
}

/**
 * Shiki highlighter type (compatible with @shikijs/core)
 */
export interface ShikiHighlighter {
  codeToHtml: (code: string, options: { lang: string, theme: string }) => string
  codeToTokensWithThemes?: (code: string, options: { lang: string, themes: Record<string, string> }) => Array<Array<{ content: string, variants: Record<string, { color: string }> }>>
}

/**
 * Create code block element renderer with Shiki support
 * @param highlighter - Shiki highlighter instance (can be reactive ref)
 * @param defaultTheme - Default theme to use
 */
export function createCodeBlockRenderer(
  highlighter: ShikiHighlighter | null | (() => ShikiHighlighter | null),
  defaultTheme = "github-dark",
): ElementRenderer {
  return (node, children, ctx) => {
    // Find code element inside pre
    const codeNode = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )

    if (!codeNode) {
      return h("pre", {}, children)
    }

    // Get language from class
    const className = codeNode.properties?.className
    let lang = "text"
    if (Array.isArray(className)) {
      const langClass = className.find(c => typeof c === "string" && c.startsWith("language-"))
      if (langClass && typeof langClass === "string") {
        lang = langClass.replace("language-", "")
      }
    }
    else if (typeof className === "string" && className.startsWith("language-")) {
      lang = className.replace("language-", "")
    }

    // Get code content
    const codeContent = codeNode.children
      .map(child => (child.type === "text" ? child.value : ""))
      .join("")

    // Get highlighter
    const hl = typeof highlighter === "function" ? highlighter() : highlighter

    // Use Shiki if available
    if (hl) {
      try {
        const highlightedHtml = hl.codeToHtml(codeContent, {
          lang,
          theme: defaultTheme,
        })

        return h("div", {
          "class": "shiki-code-block",
          "data-lang": lang,
          "innerHTML": highlightedHtml,
        })
      }
      catch (error) {
        console.error("Failed to highlight code:", error)
      }
    }

    // Fallback: render without highlighting
    return h("pre", { class: `language-${lang}` }, h("code", { class: `language-${lang}` }, codeContent),
    )
  }
}

/**
 * Create Mermaid diagram element renderer
 * @param MermaidComponent - Vue component to render Mermaid diagrams
 */
export function createMermaidRenderer(
  MermaidComponent: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    // Find code element inside pre
    const codeNode = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )

    if (!codeNode) {
      return null
    }

    // Check if it's a mermaid block
    const className = codeNode.properties?.className
    const isMermaid = Array.isArray(className)
      ? className.some(c => typeof c === "string" && c.includes("mermaid"))
      : typeof className === "string" && className.includes("mermaid")

    if (!isMermaid) {
      return null // Not a mermaid block, use default rendering
    }

    // Get code content
    const codeContent = codeNode.children
      .map(child => (child.type === "text" ? child.value : ""))
      .join("")

    return h(MermaidComponent, {
      code: codeContent,
      // Keep compatibility with MermaidBlock-style component APIs.
      attrs: {},
    })
  }
}

/**
 * Asset resolver function type
 */
export type AssetResolver = (id: string) => Promise<{ url: string } | null>

/**
 * Create image element renderer with asset resolution
 * @param AssetComponent - Vue component to render assets (optional)
 * @param getAsset - Function to resolve asset ID to URL
 */
export function createAssetRenderer(
  getAsset?: AssetResolver,
  AssetComponent?: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    const { src, alt, title } = node.properties || {}

    // If AssetComponent is provided, use it
    if (AssetComponent) {
      return h(AssetComponent, {
        src: src as string,
        alt: alt as string,
        title: title as string,
        getStaticResearchAssets: getAsset,
      })
    }

    // Default image rendering
    return h("img", {
      src: src as string,
      alt: alt as string,
      title: title as string,
      class: "aimd-image",
      loading: "lazy",
    })
  }
}

/**
 * Create iframe/video element renderer for embedded content
 * @param EmbeddedComponent - Vue component to render embedded content
 */
export function createEmbeddedRenderer(
  EmbeddedComponent: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    const props = node.properties || {}

    return h(EmbeddedComponent, {
      contentProps: props,
      component: node.tagName,
    })
  }
}
