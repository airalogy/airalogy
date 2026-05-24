import type { Element, Properties, Root as HastRoot, Text as HastText } from "hast"
import type { VFile } from "vfile"
import type { VNode } from "vue"
import type {
  AimdFieldType,
  AimdNode,
  AimdQuizNode,
  AimdStepNode,
  ProcessorOptions,
  RenderContext,
} from "@airalogy/aimd-core/types"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type { AimdRendererI18nOptions } from "../locales"
import type { VueRendererOptions } from "../vue/vue-renderer"
import { resolveQuizPreviewOptions } from "./quiz-preview"

// ---------------------------------------------------------------------------
// Sub-module imports
// ---------------------------------------------------------------------------

import { remarkInsertVisibleAssigners, remarkStripAssignerCodeBlocks } from "./assignerVisibility"
import { highlightVisibleAssigners } from "./assignerHighlighting"
import { annotateStepReferenceSequence } from "./annotateStepReferences"
import { buildFigureChildren, assignFigureSequenceNumbers } from "./figureNumbering"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Render result
 */
export interface RenderResult {
  nodes: VNode[]
  fields: ExtractedAimdFields
}

export type AimdAssignerVisibility = "hidden" | "collapsed" | "expanded"

export interface AimdHtmlRendererContext extends RenderContext {
  locale: NonNullable<AimdRendererI18nOptions["locale"]> | string
  messages: ReturnType<typeof createAimdRendererMessages>
}

export type AimdHtmlNodeRenderer = (
  node: AimdNode,
  defaultElement: Element,
  context: AimdHtmlRendererContext,
) => Element | null | undefined

export interface AimdRendererOptions extends ProcessorOptions, AimdRendererI18nOptions {
  assignerVisibility?: AimdAssignerVisibility
  aimdElementRenderers?: Partial<Record<AimdFieldType, AimdHtmlNodeRenderer>>
  groupStepBodies?: boolean
  groupCheckBodies?: boolean
  blockVarTypes?: string[]
}

export interface CustomElementAimdRendererOptions {
  container?: boolean
  stripDefaultChildren?: boolean
}

function assignAimdNodeData(element: Element, node: AimdNode): Element {
  const existingData = (element as any).data || {}
  ;(element as any).data = {
    ...existingData,
    aimd: node,
  }
  return element
}

function cleanProperties(properties: Properties): Properties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== null),
  ) as Properties
}

export function createCustomElementAimdRenderer(
  tagName: string,
  mapProperties?: (
    node: AimdNode,
    context: AimdHtmlRendererContext,
    defaultElement: Element,
  ) => Properties,
  options: CustomElementAimdRendererOptions = {},
): AimdHtmlNodeRenderer {
  return (node, defaultElement, context) => {
    const mappedProperties = mapProperties ? mapProperties(node, context, defaultElement) : {}
    return assignAimdNodeData({
      ...defaultElement,
      tagName,
      properties: cleanProperties({
        ...defaultElement.properties,
        ...mappedProperties,
        ...(options.container ? { "data-aimd-step-container": "true" } : {}),
        ...(options.stripDefaultChildren ? { "data-aimd-strip-default-children": "true" } : {}),
      }),
    }, node)
  }
}

function isWhitespaceTextNode(node: unknown): node is HastText {
  return typeof node === "object"
    && node !== null
    && (node as HastText).type === "text"
    && !String((node as HastText).value || "").trim()
}

function isElementNode(node: unknown): node is Element {
  return typeof node === "object"
    && node !== null
    && (node as Element).type === "element"
}

function toCamelCaseKey(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function getPropertyValue(properties: Properties | undefined, key: string): string | undefined {
  const value = properties?.[key] ?? properties?.[toCamelCaseKey(key)]
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value)
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    return typeof first === "string" ? first : undefined
  }
  return undefined
}

function isAimdStepElement(node: unknown): node is Element {
  return typeof node === "object"
    && node !== null
    && (node as Element).type === "element"
    && getPropertyValue((node as Element).properties, "data-aimd-type") === "step"
}

function isAimdCheckElement(node: unknown): node is Element {
  return typeof node === "object"
    && node !== null
    && (node as Element).type === "element"
    && getPropertyValue((node as Element).properties, "data-aimd-type") === "check"
}

function isHeadingOrDivider(node: unknown): boolean {
  if (typeof node !== "object" || node === null || (node as Element).type !== "element") {
    return false
  }

  const tagName = (node as Element).tagName
  return tagName === "hr" || /^h[1-6]$/.test(tagName)
}

function unwrapStandaloneContainerStep(node: unknown): Element | null {
  if (isAimdStepElement(node)) {
    return getPropertyValue(node.properties, "data-aimd-step-container") === "true" ? node : null
  }

  if (
    typeof node !== "object"
    || node === null
    || (node as Element).type !== "element"
    || (node as Element).tagName !== "p"
  ) {
    return null
  }

  const meaningfulChildren = ((node as Element).children || []).filter((child) => !isWhitespaceTextNode(child))
  if (meaningfulChildren.length !== 1 || !isAimdStepElement(meaningfulChildren[0])) {
    return null
  }

  const stepElement = meaningfulChildren[0]
  return getPropertyValue(stepElement.properties, "data-aimd-step-container") === "true" ? stepElement : null
}

function cloneNodeForStepBody<T extends Element | HastText>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T
}

function groupCheckBodiesInParent(parent: HastRoot | Element): void {
  const originalChildren = (parent.children || []) as Array<Element | HastText>
  const nextChildren: Array<Element | HastText> = []

  for (let index = 0; index < originalChildren.length; index += 1) {
    const currentNode = originalChildren[index]

    if (typeof currentNode === "object" && currentNode !== null && (currentNode as Element).type === "element") {
      groupCheckBodiesInParent(currentNode as Element)
    }

    if (
      typeof currentNode !== "object"
      || currentNode === null
      || (currentNode as Element).type !== "element"
      || (currentNode as Element).tagName !== "p"
    ) {
      nextChildren.push(currentNode)
      continue
    }

    const paragraph = currentNode as Element
    const paragraphChildren = (paragraph.children || []) as Array<Element | HastText>
    const meaningfulChildren = paragraphChildren.filter((child) => !isWhitespaceTextNode(child))

    if (meaningfulChildren.length < 2 || !isAimdCheckElement(meaningfulChildren[0])) {
      nextChildren.push(currentNode)
      continue
    }

    const checkElement = meaningfulChildren[0] as Element
    const checkIndex = paragraphChildren.indexOf(checkElement)
    if (checkIndex < 0) {
      nextChildren.push(currentNode)
      continue
    }

    const tailChildren = paragraphChildren
      .slice(checkIndex + 1)
      .map((child) => cloneNodeForStepBody(child as Element | HastText))
      .filter((child) => !isWhitespaceTextNode(child))

    if (tailChildren.length === 0) {
      nextChildren.push(currentNode)
      continue
    }

    checkElement.properties = {
      ...(checkElement.properties || {}),
      "data-aimd-check-container": "true",
      "data-aimd-strip-default-children": "true",
    }
    checkElement.children = [{
      type: "element",
      tagName: "div",
      properties: {
        className: ["aimd-check-body"],
        "data-aimd-check-body": "true",
      },
      children: tailChildren,
    }]

    nextChildren.push(checkElement)
  }

  parent.children = nextChildren
}

function groupCheckBodies(tree: HastRoot): void {
  groupCheckBodiesInParent(tree)
}

function groupStepBodiesInParent(parent: HastRoot | Element): void {
  const originalChildren = (parent.children || []) as Array<Element | HastText>
  const nextChildren: Array<Element | HastText> = []

  for (let index = 0; index < originalChildren.length; index += 1) {
    const currentNode = originalChildren[index]
    const stepContainer = unwrapStandaloneContainerStep(currentNode)

    if (!stepContainer) {
      if (typeof currentNode === "object" && currentNode !== null && (currentNode as Element).type === "element") {
        groupStepBodiesInParent(currentNode as Element)
      }
      nextChildren.push(currentNode)
      continue
    }

    const bodyChildren: Array<Element | HastText> = []
    let scanIndex = index + 1
    while (scanIndex < originalChildren.length) {
      const candidate = originalChildren[scanIndex]
      if (unwrapStandaloneContainerStep(candidate) || isHeadingOrDivider(candidate)) {
        break
      }

      if (typeof candidate === "object" && candidate !== null && (candidate as Element).type === "element") {
        groupStepBodiesInParent(candidate as Element)
      }

      bodyChildren.push(cloneNodeForStepBody(candidate as Element | HastText))
      scanIndex += 1
    }

    const stripChildren = getPropertyValue(stepContainer.properties, "data-aimd-strip-default-children") === "true"
    stepContainer.children = stripChildren ? [] : [...(stepContainer.children || [])]
    if (bodyChildren.length > 0) {
      stepContainer.children.push({
        type: "element",
        tagName: "div",
        properties: {
          className: ["aimd-step-body"],
          "data-aimd-step-body": "true",
        },
        children: bodyChildren,
      })
    }

    nextChildren.push(stepContainer)
    index = scanIndex - 1
  }

  ;(parent as HastRoot | Element).children = nextChildren as any
}

function groupStepBodies(tree: HastRoot): void {
  groupStepBodiesInParent(tree)
}

function normalizeAimdTypeToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function getAimdNodeFromElement(element: Element): AimdNode | null {
  const fromData = (element as any).data?.aimd
  if (fromData) {
    return fromData as AimdNode
  }

  const rawJson = getPropertyValue(element.properties, "data-aimd-json")
  if (!rawJson) {
    return null
  }

  try {
    return JSON.parse(rawJson) as AimdNode
  } catch {
    return null
  }
}

function isBlockVarElement(node: unknown, blockVarTypes: Set<string>): node is Element {
  if (typeof node !== "object" || node === null || (node as Element).type !== "element") {
    return false
  }

  const aimdNode = getAimdNodeFromElement(node as Element)
  if (!aimdNode || aimdNode.fieldType !== "var") {
    return false
  }

  return blockVarTypes.has(normalizeAimdTypeToken((aimdNode as any).definition?.type))
}

function promoteBlockVarElement(element: Element): Element {
  const aimdNode = getAimdNodeFromElement(element)
  const className = Array.isArray(element.properties.className)
    ? [...element.properties.className]
    : element.properties.className
      ? [element.properties.className]
      : []

  const promoted = {
    ...element,
    tagName: "div",
    properties: {
      ...element.properties,
      className: [...className, "aimd-block-var"],
    },
  } as Element

  return aimdNode ? assignAimdNodeData(promoted, aimdNode) : promoted
}

function cloneParagraphWithChildren(paragraph: Element, children: Array<Element | HastText>): Element {
  return {
    ...paragraph,
    children,
  } as Element
}

function createInlineParagraph(children: Array<Element | HastText>): Element {
  return {
    type: "element",
    tagName: "p",
    properties: {},
    children,
  }
}

function liftBlockVarParagraph(paragraph: Element, blockVarTypes: Set<string>): Array<Element | HastText> {
  const nextNodes: Array<Element | HastText> = []
  let inlineRun: Array<Element | HastText> = []

  const flushInlineRun = () => {
    if (!inlineRun.some((child) => !isWhitespaceTextNode(child))) {
      inlineRun = []
      return
    }

    nextNodes.push(cloneParagraphWithChildren(paragraph, inlineRun))
    inlineRun = []
  }

  for (const child of (paragraph.children || []) as Array<Element | HastText>) {
    if (isBlockVarElement(child, blockVarTypes)) {
      flushInlineRun()
      nextNodes.push(promoteBlockVarElement(child))
      continue
    }

    inlineRun.push(child)
  }

  flushInlineRun()
  return nextNodes.length > 0 ? nextNodes : [paragraph]
}

function liftBlockVarListItem(listItem: Element, blockVarTypes: Set<string>): Element {
  const originalChildren = (listItem.children || []) as Array<Element | HastText>
  const nextChildren: Array<Element | HastText> = []
  let inlineRun: Array<Element | HastText> = []
  let foundDirectBlockVar = false

  const flushInlineRun = () => {
    if (!inlineRun.some((child) => !isWhitespaceTextNode(child))) {
      inlineRun = []
      return
    }

    nextChildren.push(createInlineParagraph(inlineRun))
    inlineRun = []
  }

  for (const child of originalChildren) {
    if (isBlockVarElement(child, blockVarTypes)) {
      foundDirectBlockVar = true
      flushInlineRun()
      nextChildren.push(promoteBlockVarElement(child))
      continue
    }

    if (isElementNode(child)) {
      flushInlineRun()
      nextChildren.push(child)
      continue
    }

    inlineRun.push(child)
  }

  flushInlineRun()

  return foundDirectBlockVar
    ? {
        ...listItem,
        children: nextChildren,
      } as Element
    : listItem
}

function liftBlockVarElementsInParent(parent: HastRoot | Element, blockVarTypes: Set<string>): void {
  const nextChildren: Array<Element | HastText> = []

  for (const child of (parent.children || []) as Array<Element | HastText>) {
    if (typeof child !== "object" || child === null || child.type !== "element") {
      nextChildren.push(child)
      continue
    }

    const clonedChild = { ...child } as Element
    if (clonedChild.children?.length) {
      liftBlockVarElementsInParent(clonedChild, blockVarTypes)
    }

    if (clonedChild.tagName === "p") {
      nextChildren.push(...liftBlockVarParagraph(clonedChild, blockVarTypes))
      continue
    }

    if (clonedChild.tagName === "li") {
      nextChildren.push(liftBlockVarListItem(clonedChild, blockVarTypes))
      continue
    }

    nextChildren.push(clonedChild)
  }

  ;(parent as HastRoot | Element).children = nextChildren as any
}

function liftBlockVarElements(tree: HastRoot, blockVarTypes?: string[]): void {
  const normalizedTypes = new Set(
    (blockVarTypes ?? [])
      .map(type => normalizeAimdTypeToken(type))
      .filter(Boolean),
  )

  if (normalizedTypes.size === 0) {
    return
  }

  liftBlockVarElementsInParent(tree, normalizedTypes)
}

// ---------------------------------------------------------------------------
// Third-party imports
// ---------------------------------------------------------------------------

import { toHtml } from "hast-util-to-html"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"
import {
  createAimdRendererMessages,
  getAimdRendererQuizTypeLabel,
  getAimdRendererScopeLabel,
} from "../locales"
import { renderToVNodes } from "../vue/vue-renderer"

// ---------------------------------------------------------------------------
// Module-level singletons
// ---------------------------------------------------------------------------

let mathStylesLoadPromise: Promise<unknown> | null = null

// ---------------------------------------------------------------------------
// Internal helpers that remain in the coordinator
// ---------------------------------------------------------------------------

const EMPTY_EXTRACTED_FIELDS: ExtractedAimdFields = {
  var: [],
  var_definitions: [],
  var_table: [],
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

async function ensureMathStylesLoaded(mathEnabled: boolean | undefined): Promise<void> {
  if (mathEnabled === false) {
    return
  }
  if (typeof document === "undefined") {
    return
  }
  if (!mathStylesLoadPromise) {
    mathStylesLoadPromise = import("../styles/katex.css").catch(() => undefined)
  }
  await mathStylesLoadPromise
}

function createAimdParseInput(content: string) {
  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file: VFile = {
    data: {
      aimdInlineTemplates: templates,
    },
  } as unknown as VFile

  return {
    content: protectedContent,
    file,
  }
}

function createEmptyExtractedFields(): ExtractedAimdFields {
  return {
    var: [...EMPTY_EXTRACTED_FIELDS.var],
    var_definitions: [...(EMPTY_EXTRACTED_FIELDS.var_definitions || [])],
    var_table: [...EMPTY_EXTRACTED_FIELDS.var_table],
    client_assigner: [...EMPTY_EXTRACTED_FIELDS.client_assigner],
    quiz: [...EMPTY_EXTRACTED_FIELDS.quiz],
    step: [...EMPTY_EXTRACTED_FIELDS.step],
    check: [...EMPTY_EXTRACTED_FIELDS.check],
    ref_step: [...EMPTY_EXTRACTED_FIELDS.ref_step],
    ref_var: [...EMPTY_EXTRACTED_FIELDS.ref_var],
    ref_fig: [...(EMPTY_EXTRACTED_FIELDS.ref_fig || [])],
    cite: [...(EMPTY_EXTRACTED_FIELDS.cite || [])],
    fig: [...(EMPTY_EXTRACTED_FIELDS.fig || [])],
  }
}

function getExtractedFields(file: VFile): ExtractedAimdFields {
  return (file.data.aimdFields as ExtractedAimdFields) || createEmptyExtractedFields()
}

// ---------------------------------------------------------------------------
// Field-type helpers used by createAimdHandler
// ---------------------------------------------------------------------------

/**
 * Map field type to CSS class modifier (BEM format)
 */
function getFieldTypeClass(fieldType: AimdNode["fieldType"]): string {
  switch (fieldType) {
    case "var_table":
      return "var-table"
    default:
      return fieldType
  }
}

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

function buildQuizStemChildren(
  quizType: AimdQuizNode["quizType"],
  stem: string,
): Array<Element | HastText> {
  if (quizType !== "blank") {
    return [{ type: "text", value: stem }]
  }

  const children: Array<Element | HastText> = []
  let lastIndex = 0

  for (const match of stem.matchAll(BLANK_PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0
    const fullMatch = match[0]
    const key = match[1]

    if (start > lastIndex) {
      children.push({
        type: "text",
        value: stem.slice(lastIndex, start),
      })
    }

    children.push({
      type: "element",
      tagName: "span",
      properties: {
        className: ["aimd-quiz__blank-placeholder"],
        "data-blank-key": key,
      },
      children: [{ type: "text", value: key }],
    } as Element)

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < stem.length) {
    children.push({
      type: "text",
      value: stem.slice(lastIndex),
    })
  }

  if (children.length === 0) {
    children.push({ type: "text", value: stem })
  }

  return children
}

function formatScaleOptionLabel(option: NonNullable<AimdQuizNode["options"]>[number]): string {
  if (typeof option.points === "number" && Number.isFinite(option.points)) {
    return `${option.text} (${option.points})`
  }
  return option.text
}

function buildScalePreviewChildren(quizNode: AimdQuizNode): Array<Element | HastText> {
  if (!Array.isArray(quizNode.items) || quizNode.items.length === 0 || !Array.isArray(quizNode.options) || quizNode.options.length === 0) {
    return [{
      type: "element",
      tagName: "div",
      properties: { className: ["aimd-scale__empty"] },
      children: [{ type: "text", value: "Scale definition is incomplete." }],
    } as Element]
  }

  if (quizNode.display === "list") {
    return [{
      type: "element",
      tagName: "div",
      properties: { className: ["aimd-scale__list"] },
      children: quizNode.items.map(item => ({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-scale__list-item"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["aimd-scale__item-stem"] },
            children: [{ type: "text", value: item.stem }],
          } as Element,
          {
            type: "element",
            tagName: "ul",
            properties: { className: ["aimd-scale__item-options"] },
            children: quizNode.options!.map(option => ({
              type: "element",
              tagName: "li",
              properties: {},
              children: [{ type: "text", value: formatScaleOptionLabel(option) }],
            } as Element)),
          } as Element,
        ],
      } as Element)),
    } as Element]
  }

  return [{
    type: "element",
    tagName: "table",
    properties: { className: ["aimd-scale__table"] },
    children: [
      {
        type: "element",
        tagName: "thead",
        properties: {},
        children: [{
          type: "element",
          tagName: "tr",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "th",
              properties: { className: ["aimd-scale__item-header"] },
              children: [{ type: "text", value: "Item" }],
            } as Element,
            ...quizNode.options.map(option => ({
              type: "element",
              tagName: "th",
              properties: {},
              children: [{ type: "text", value: formatScaleOptionLabel(option) }],
            } as Element)),
          ],
        } as Element],
      } as Element,
      {
        type: "element",
        tagName: "tbody",
        properties: {},
        children: quizNode.items.map(item => ({
          type: "element",
          tagName: "tr",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "th",
              properties: { className: ["aimd-scale__item-stem"], scope: "row" },
              children: [{ type: "text", value: item.stem }],
            } as Element,
            ...quizNode.options!.map(() => ({
              type: "element",
              tagName: "td",
              properties: { className: ["aimd-scale__cell"] },
              children: [{ type: "text", value: "○" }],
            } as Element)),
          ],
        } as Element)),
      } as Element,
    ],
  } as Element]
}

function buildScaleBandChildren(quizNode: AimdQuizNode): Array<Element | HastText> {
  const bands = Array.isArray((quizNode.grading as any)?.bands)
    ? (quizNode.grading as any).bands
    : []
  if (bands.length === 0) {
    return []
  }

  return [{
    type: "element",
    tagName: "ul",
    properties: { className: ["aimd-scale__bands"] },
    children: bands.map((band: any) => ({
      type: "element",
      tagName: "li",
      properties: {},
      children: [{
        type: "text",
        value: `${band.min}-${band.max}: ${band.label}${band.interpretation ? ` · ${band.interpretation}` : ""}`,
      }],
    } as Element)),
  } as Element]
}

// ---------------------------------------------------------------------------
// AIMD handler (remark-rehype custom handler)
// ---------------------------------------------------------------------------

/**
 * Custom handler for AIMD nodes in remark-rehype
 * Converts MDAST AIMD nodes to HAST elements
 */
function createAimdHandler(options: AimdRendererOptions = {}) {
  const quizPreview = resolveQuizPreviewOptions(options.mode ?? "preview", options.quizPreview)
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const htmlRendererContext: AimdHtmlRendererContext = {
    mode: options.mode ?? "preview",
    readonly: false,
    value: undefined,
    quizPreview: options.quizPreview,
    locale: options.locale ?? "en-US",
    messages,
  }

  return function aimdHandler(state: any, node: AimdNode): Element {
  // Build full node data including step hierarchy
  const nodeData: Record<string, unknown> = {
    type: node.type,
    fieldType: node.fieldType,
    id: node.id,
    scope: node.scope,
    raw: node.raw,
  }

  // Add type-specific fields
  if ("definition" in node)
    nodeData.definition = node.definition
  if ("columns" in node)
    nodeData.columns = node.columns
  if ("label" in node)
    nodeData.label = node.label
  if ("refTarget" in node)
    nodeData.refTarget = node.refTarget
  if ("checked_message" in node)
    nodeData.checked_message = node.checked_message

  // Add quiz-specific fields
  if (node.fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    nodeData.quizType = quizNode.quizType
    nodeData.stem = quizNode.stem
    nodeData.score = quizNode.score
    nodeData.title = quizNode.title
    nodeData.description = quizNode.description
    nodeData.mode = quizNode.mode
    nodeData.display = quizNode.display
    nodeData.options = quizNode.options
    nodeData.answer = quizNode.answer
    nodeData.blanks = quizNode.blanks
    nodeData.items = quizNode.items
    nodeData.rubric = quizNode.rubric
    nodeData.grading = quizNode.grading
    nodeData.default = quizNode.default
    nodeData.extra = quizNode.extra
  }

  // Add fig-specific fields
  if (node.fieldType === "fig") {
    const figNode = node as any
    nodeData.id = figNode.id
    nodeData.src = figNode.src
    nodeData.title = figNode.title
    nodeData.legend = figNode.legend
    nodeData.sequence = figNode.sequence
  }

  // Add step-specific fields
  if (node.fieldType === "step") {
    const stepNode = node as AimdStepNode
    nodeData.level = stepNode.level
    nodeData.sequence = stepNode.sequence
    nodeData.step = stepNode.step
    nodeData.parent_id = stepNode.parent_id
    nodeData.prev_id = stepNode.prev_id
    nodeData.next_id = stepNode.next_id
    nodeData.has_children = stepNode.has_children
    nodeData.check = stepNode.check
    nodeData.title = stepNode.title
    nodeData.subtitle = stepNode.subtitle
    nodeData.checked_message = stepNode.checked_message
    nodeData.estimated_duration_ms = stepNode.estimated_duration_ms
    nodeData.timer_mode = stepNode.timer_mode
    nodeData.result = stepNode.result
    nodeData.props = stepNode.props
  }

  // Serialize AIMD node data to JSON for preservation through rehypeRaw
  const aimdJson = JSON.stringify(nodeData)

  const fieldType = node.fieldType
  const id = node.id
  const typeClass = getFieldTypeClass(fieldType)

  // Determine if this is a reference type
  const isRef = fieldType === "ref_step" || fieldType === "ref_var" || fieldType === "ref_fig"
  const isCite = fieldType === "cite"
  const isQuiz = fieldType === "quiz"
  const isFig = fieldType === "fig"
  const baseClass = isRef
    ? "aimd-ref"
    : (isCite ? "aimd-cite" : (isFig ? "aimd-figure" : "aimd-field"))
  const modifierClass = isRef
    ? `aimd-ref--${fieldType === "ref_step" ? "step" : (fieldType === "ref_var" ? "var" : "fig")}`
    : (isCite ? "" : (isFig ? "" : `aimd-field--${typeClass}`))

  // Generate children based on field type
  const children: (Element | HastText)[] = []

  if (isRef) {
    // Reference: blockquote-style with appropriate content
    if (fieldType === "ref_step") {
      // Step reference: render with step-like field styling, then patch localized sequence later.
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-ref__content"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field", "aimd-field--step", "aimd-field--readonly"] },
            children: [{
              type: "element",
              tagName: "span",
              properties: { className: ["research-step__sequence"] },
              children: [{ type: "text", value: id }],
            } as Element],
          } as Element,
        ],
      } as Element)
    }
    else {
      // Variable or figure reference: show as field with scope + id
      const scopeLabel = fieldType === "ref_var" ? messages.scope.var : messages.scope.figure
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-ref__content"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field", "aimd-field--var"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field__scope"] },
                children: [{ type: "text", value: scopeLabel }],
              } as Element,
              {
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field__name"] },
                children: [{ type: "text", value: id }],
              } as Element,
            ],
          } as Element,
        ],
      } as Element)
    }
  }
  else if (isCite) {
    // Citation: [refs]
    const refs = "refs" in node ? (node as any).refs : [id]
    children.push({
      type: "element",
      tagName: "span",
      properties: { className: ["aimd-cite__refs"] },
      children: [{ type: "text", value: `[${refs.join(", ")}]` }],
    } as Element)
  }
  else if (fieldType === "var") {
    // Variable: type label + id + optional type annotation
    const definition = "definition" in node ? node.definition : undefined
    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: getAimdRendererScopeLabel("var", messages) }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: id }],
      } as Element,
    )
    if (definition?.type) {
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__type"] },
        children: [{ type: "text", value: `: ${definition.type}` }],
      } as Element)
    }
  }
  else if (fieldType === "var_table") {
    // var_table: render header + table preview
    const columns = "columns" in node ? (node as any).columns as string[] : []
    children.push(
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-field__header"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__scope"] },
            children: [{ type: "text", value: getAimdRendererScopeLabel("var_table", messages) }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__name"] },
            children: [{ type: "text", value: id }],
          } as Element,
        ],
      } as Element,
    )
    if (columns && columns.length > 0) {
      children.push({
        type: "element",
        tagName: "table",
        properties: { className: ["aimd-field__table-preview"] },
        children: [
          {
            type: "element",
            tagName: "thead",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: columns.map(col => ({
                  type: "element",
                  tagName: "th",
                  properties: {},
                  children: [{ type: "text", value: col }],
                } as Element)),
              } as Element,
            ],
          } as Element,
          {
            type: "element",
            tagName: "tbody",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: columns.map(() => ({
                  type: "element",
                  tagName: "td",
                  properties: {},
                  children: [{ type: "text", value: "..." }],
                } as Element)),
              } as Element,
            ],
          } as Element,
        ],
      } as Element)
    }
  }
  else if (fieldType === "step") {
    // Step: scope label + sequence + id
    const stepNode = node as AimdStepNode
    const stepNum = stepNode.step || "1"

    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: getAimdRendererScopeLabel("step", messages) }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__step-num"] },
        children: [{ type: "text", value: stepNum }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: id }],
      } as Element,
    )
  }
  else if (fieldType === "check") {
    // Check: checkbox + label
    const label = "label" in node ? node.label : id
    children.push(
      {
        type: "element",
        tagName: "input",
        properties: { type: "checkbox", className: ["aimd-checkbox"], disabled: true },
        children: [],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__label"] },
        children: [{ type: "text", value: label || id }],
      } as Element,
    )
  }
  else if (fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    const quizType = quizNode.quizType
    const typeLabel = getAimdRendererQuizTypeLabel(quizType, quizNode.mode, messages)

    children.push(
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__meta"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__scope"] },
            children: [{ type: "text", value: getAimdRendererScopeLabel("quiz", messages) }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__name"] },
            children: [{ type: "text", value: id }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__type"] },
            children: [{ type: "text", value: `(${typeLabel})` }],
          } as Element,
          ...(quizNode.score !== undefined
            ? [{
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-quiz__score"] },
                children: [{ type: "text", value: messages.quiz.score(quizNode.score) }],
              } as Element]
            : []),
        ],
      } as Element,
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__stem"] },
        children: buildQuizStemChildren(quizType, quizNode.stem),
      } as Element,
    )

    if (typeof quizNode.title === "string" && quizNode.title.trim()) {
      children.splice(1, 0, {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__title"] },
        children: [{ type: "text", value: quizNode.title }],
      } as Element)
    }

    if (typeof quizNode.description === "string" && quizNode.description.trim()) {
      children.push({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__description"] },
        children: [{ type: "text", value: quizNode.description }],
      } as Element)
    }

    if ((quizType === "choice" || quizType === "true_false") && Array.isArray(quizNode.options) && quizNode.options.length > 0) {
      children.push({
        type: "element",
        tagName: "ul",
        properties: { className: ["aimd-quiz__options"] },
        children: quizNode.options.map(option => ({
          type: "element",
          tagName: "li",
          properties: {},
          children: [{ type: "text", value: `${option.key}. ${option.text}` }],
        } as Element)),
      } as Element)
    }

    if (quizType === "scale") {
      children.push(...buildScalePreviewChildren(quizNode))
      children.push(...buildScaleBandChildren(quizNode))
    }

    if (quizPreview.showAnswers && (quizType === "choice" || quizType === "true_false") && quizNode.answer !== undefined) {
      const answerText = Array.isArray(quizNode.answer)
        ? quizNode.answer.join(", ")
        : String(quizNode.answer)
      if (answerText.trim()) {
        children.push({
          type: "element",
          tagName: "div",
          properties: { className: ["aimd-quiz__answer"] },
          children: [{ type: "text", value: messages.quiz.answer(answerText) }],
        } as Element)
      }
    }

    if (quizPreview.showAnswers && quizType === "blank" && Array.isArray(quizNode.blanks) && quizNode.blanks.length > 0) {
      children.push({
        type: "element",
        tagName: "ul",
        properties: { className: ["aimd-quiz__blanks"] },
        children: quizNode.blanks.map(blank => ({
          type: "element",
          tagName: "li",
          properties: {},
          children: [{ type: "text", value: `${blank.key}: ${blank.answer}` }],
        } as Element)),
      } as Element)
    }

    if (quizPreview.showRubric && quizType === "open" && typeof quizNode.rubric === "string" && quizNode.rubric.trim()) {
      children.push({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__rubric"] },
        children: [{ type: "text", value: messages.quiz.rubric(quizNode.rubric) }],
      } as Element)
    }
  }
  else if (fieldType === "fig") {
    // Figure: delegate to figureNumbering module
    const figNode = node as any
    children.push(...buildFigureChildren({
      id: figNode.id || id,
      src: figNode.src,
      title: figNode.title,
      legend: figNode.legend,
      sequence: figNode.sequence,
    }))
  }

  // Build properties
  const properties: Properties = {
    "className": [baseClass, modifierClass],
    "data-aimd-type": node.fieldType,
    "data-aimd-id": node.id,
    "data-aimd-scope": node.scope,
    "data-aimd-raw": node.raw,
    "data-aimd-json": aimdJson,
  }

  // Add reference href
  if (isRef) {
    if (fieldType === "ref_step") {
      properties.href = `#step-${id}`
    }
    else if (fieldType === "ref_var") {
      properties.href = `#var-${id}`
    }
    else if (fieldType === "ref_fig") {
      properties.href = `#fig-${id}`
    }
  }

  // Add step-specific properties
  if (node.fieldType === "step") {
    const stepNode = node as AimdStepNode
    properties["data-aimd-step"] = stepNode.step
    properties["data-aimd-level"] = stepNode.level
    properties["data-aimd-check"] = stepNode.check ? "true" : "false"
    if (options.groupStepBodies) {
      properties["data-aimd-step-container"] = "true"
    }
    if (stepNode.title) {
      properties["data-aimd-title"] = stepNode.title
    }
    if (stepNode.subtitle) {
      properties["data-aimd-subtitle"] = stepNode.subtitle
    }
    if (stepNode.checked_message) {
      properties["data-aimd-checked-message"] = stepNode.checked_message
    }
    if (typeof stepNode.estimated_duration_ms === "number") {
      properties["data-aimd-estimated-duration-ms"] = stepNode.estimated_duration_ms
    }
    if (stepNode.timer_mode) {
      properties["data-aimd-timer-mode"] = stepNode.timer_mode
    }
    if (stepNode.result) {
      properties["data-aimd-result"] = "true"
    }
    properties.id = `step-${id}`
  }

  // Add check id
  if (node.fieldType === "check") {
    properties.id = `check-${id}`
  }

  // Add var id
  if (node.fieldType === "var") {
    properties.id = `var-${id}`
  }

  // Add var_table id
  if (node.fieldType === "var_table") {
    properties.id = `var_table-${id}`
  }

  // Add quiz id
  if (node.fieldType === "quiz") {
    properties.id = `quiz-${id}`
  }

  // Add fig id
  if (node.fieldType === "fig") {
    const figNode = node as any
    properties.id = `fig-${figNode.id || id}`
    properties["data-aimd-fig-id"] = figNode.id
    properties["data-aimd-fig-src"] = figNode.src
  }

  // Add quiz metadata for fallback reconstruction
  if (node.fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    properties["data-aimd-quiz-type"] = quizNode.quizType
    properties["data-aimd-quiz-stem"] = quizNode.stem
  }

  const isGroupedStepContainer = fieldType === "step" && options.groupStepBodies
  const element: Element = assignAimdNodeData({
    type: "element",
    tagName: isRef
      ? "a"
      : (isFig ? "figure" : ((fieldType === "var_table" || isQuiz || isGroupedStepContainer) ? "div" : "span")),
    properties,
    children,
  }, node)

  const customRenderer = options.aimdElementRenderers?.[node.fieldType]
  if (customRenderer) {
    const customElement = customRenderer(node, element, htmlRendererContext)
    if (customElement) {
      return assignAimdNodeData(customElement, node)
    }
  }

  return element
  }
}

// ---------------------------------------------------------------------------
// Processor pipeline
// ---------------------------------------------------------------------------

/**
 * Create base processor
 */
function createBaseProcessor(options: AimdRendererOptions = {}) {
  const { gfm = true, math = true, breaks = true } = options

  const processor = unified()
    .use(remarkParse)

  // GFM support (tables, strikethrough, task lists, etc.)
  if (gfm) {
    processor.use(remarkGfm)
  }

  // Math formula support
  if (math) {
    processor.use(remarkMath)
  }

  processor.use(remarkInsertVisibleAssigners, options)

  // AIMD syntax support - MUST run before remarkBreaks
  // to properly parse multiline AIMD syntax like var_table with subvars
  processor.use(remarkAimd)
  processor.use(remarkStripAssignerCodeBlocks)

  // Single line break to <br> conversion (default enabled for AIMD)
  if (breaks) {
    processor.use(remarkBreaks)
  }

  return processor
}

/**
 * Create HTML output processor
 */
export function createHtmlProcessor(options: AimdRendererOptions = {}) {
  const { math = true, sanitize = true } = options
  const aimdHandler = createAimdHandler(options)

  const processor = createBaseProcessor(options)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        // Custom handler for AIMD nodes
        aimd: aimdHandler,
      },
    } as any)
    .use(rehypeRaw)

  // Math formula rendering
  if (math) {
    processor.use(rehypeKatex)
  }

  return processor
}

// ---------------------------------------------------------------------------
// Public render functions
// ---------------------------------------------------------------------------

/**
 * Render Markdown/AIMD to HTML string
 */
export async function renderToHtml(
  content: string,
  options: AimdRendererOptions = {},
): Promise<{ html: string, fields: ExtractedAimdFields }> {
  await ensureMathStylesLoaded(options.math)
  const processor = createHtmlProcessor(options)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = await processor.run(tree, file) as HastRoot

  const fields = getExtractedFields(file)
  annotateStepReferenceSequence(hastTree, fields, options)
  assignFigureSequenceNumbers(hastTree, fields)
  liftBlockVarElements(hastTree, options.blockVarTypes)
  if (options.groupStepBodies) {
    groupStepBodies(hastTree)
  }
  if (options.groupCheckBodies) {
    groupCheckBodies(hastTree)
  }
  await highlightVisibleAssigners(hastTree, options)
  const html = toHtml(hastTree, { allowDangerousHtml: true })

  return { html, fields }
}

/**
 * Render Markdown/AIMD to Vue VNodes
 */
export async function renderToVue(
  content: string,
  options: AimdRendererOptions & VueRendererOptions = {},
): Promise<RenderResult> {
  await ensureMathStylesLoaded(options.math)
  const processor = createHtmlProcessor(options)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = await processor.run(tree, file) as HastRoot

  const fields = getExtractedFields(file)
  annotateStepReferenceSequence(hastTree, fields, options)
  assignFigureSequenceNumbers(hastTree, fields)
  liftBlockVarElements(hastTree, options.blockVarTypes)
  if (options.groupStepBodies) {
    groupStepBodies(hastTree)
  }
  if (options.groupCheckBodies) {
    groupCheckBodies(hastTree)
  }
  await highlightVisibleAssigners(hastTree, options)
  const nodes = renderToVNodes(hastTree, options)

  return { nodes, fields }
}

/**
 * Parse Markdown/AIMD and extract field information (no rendering)
 */
export function parseAndExtract(content: string): ExtractedAimdFields {
  const processor = unified()
    .use(remarkParse)
    .use(remarkAimd)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return getExtractedFields(file)
}

/**
 * Synchronous render to HTML (for simple scenarios)
 */
export function renderToHtmlSync(
  content: string,
  options: AimdRendererOptions = {},
): { html: string, fields: ExtractedAimdFields } {
  // Sync mode does not support KaTeX stylesheet loading, so keep math disabled here.
  const processor = createHtmlProcessor({ ...options, math: false })

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = processor.runSync(tree, file) as HastRoot

  const fields = getExtractedFields(file)
  annotateStepReferenceSequence(hastTree, fields, options)
  assignFigureSequenceNumbers(hastTree, fields)
  liftBlockVarElements(hastTree, options.blockVarTypes)
  if (options.groupStepBodies) {
    groupStepBodies(hastTree)
  }
  const html = toHtml(hastTree, { allowDangerousHtml: true })

  return { html, fields }
}

/**
 * Create reusable renderer instance
 */
export function createRenderer(options: AimdRendererOptions = {}) {
  const processor = createHtmlProcessor(options)

  return {
    /**
     * Render to HTML
     */
    async toHtml(content: string): Promise<{ html: string, fields: ExtractedAimdFields }> {
      return renderToHtml(content, options)
    },

    /**
     * Render to Vue VNodes
     */
    async toVue(
      content: string,
      renderOptions?: VueRendererOptions,
    ): Promise<RenderResult> {
      return renderToVue(content, { ...options, ...renderOptions })
    },

    /**
     * Extract fields only
     */
    extractFields(content: string): ExtractedAimdFields {
      return parseAndExtract(content)
    },
  }
}

// Export default renderer
export const defaultRenderer = createRenderer()
