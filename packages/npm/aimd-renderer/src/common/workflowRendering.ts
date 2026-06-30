import type { Element, Root as HastRoot, Text as HastText } from "hast"
import type {
  AimdWorkflowAssignValue,
  AimdWorkflowField,
  AimdWorkflowTransitionField,
} from "@airalogy/aimd-core/types"

export interface AimdWorkflowRunState {
  records?: Record<string, unknown>
  transition_outputs?: Record<string, unknown>
  executed_transitions?: Array<Record<string, unknown>>
  skipped_transitions?: Array<Record<string, unknown>>
  attempts?: Array<Record<string, unknown>>
  node_iterations?: Record<string, number>
  status?: string
  message?: string
}

export interface AimdWorkflowRenderOptions {
  workflowRuns?: Record<string, AimdWorkflowRunState>
  showWorkflowSource?: boolean
}

interface WorkflowRenderContext {
  workflows: AimdWorkflowField[]
  workflowIndex: number
  options: AimdWorkflowRenderOptions
}

interface TransitionStatus {
  label: string
  tone: "neutral" | "success" | "warning" | "danger"
  detail?: string
}

function text(value: string): HastText {
  return { type: "text", value }
}

function element(
  tagName: string,
  className: string | string[],
  children: Array<Element | HastText> = [],
  properties: Record<string, unknown> = {},
): Element {
  return {
    type: "element",
    tagName,
    properties: {
      ...properties,
      className: Array.isArray(className) ? className : [className],
    },
    children,
  } as Element
}

function label(textValue: string, tone: TransitionStatus["tone"] = "neutral"): Element {
  return element("span", ["aimd-workflow__badge", `aimd-workflow__badge--${tone}`], [text(textValue)])
}

function code(textValue: string): Element {
  return element("code", "aimd-workflow__code", [text(textValue)])
}

function compactText(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (value === null) {
    return "null"
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value)
}

function isWorkflowReference(value: string): boolean {
  return /^\$\{[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+\}$/.test(value.trim())
}

function valueElement(value: AimdWorkflowAssignValue | unknown): Element {
  const normalized = compactText(value)
  return element(
    "code",
    [
      "aimd-workflow__value",
      typeof value === "string" && isWorkflowReference(value) ? "aimd-workflow__value--reference" : "aimd-workflow__value--literal",
    ],
    [text(normalized)],
  )
}

function isElement(node: unknown): node is Element {
  return typeof node === "object" && node !== null && (node as Element).type === "element"
}

function classList(node: Element): string[] {
  const className = node.properties?.className
  if (Array.isArray(className)) {
    return className.filter((item): item is string => typeof item === "string")
  }
  if (typeof className === "string") {
    return className.split(/\s+/).filter(Boolean)
  }
  return []
}

function getCodeElement(preNode: Element): Element | null {
  return (preNode.children || []).find((child): child is Element =>
    isElement(child) && child.tagName === "code") ?? null
}

function isWorkflowCodeBlock(node: Element): boolean {
  if (node.tagName !== "pre") {
    return false
  }
  const codeNode = getCodeElement(node)
  return codeNode !== null && classList(codeNode).includes("language-workflow")
}

function getCodeContent(codeNode: Element): string {
  return (codeNode.children || [])
    .map((child) => {
      if (typeof child === "object" && child !== null && (child as HastText).type === "text") {
        return (child as HastText).value
      }
      return ""
    })
    .join("")
}

function recordFromList(items: Array<Record<string, unknown>> | undefined, key: string, value: string): Record<string, unknown> | undefined {
  return items?.find((item) => item[key] === value)
}

function getTransitionStatus(
  transition: AimdWorkflowTransitionField,
  runState: AimdWorkflowRunState | undefined,
): TransitionStatus | null {
  if (runState === undefined) {
    return null
  }

  const failedAttempt = runState.attempts?.find((attempt) =>
    attempt.transition === transition.id && attempt.status === "failed")
  if (failedAttempt) {
    return {
      label: "failed",
      tone: "danger",
      detail: typeof failedAttempt.message === "string" ? failedAttempt.message : undefined,
    }
  }

  const skipped = recordFromList(runState.skipped_transitions, "id", transition.id)
  if (skipped) {
    return {
      label: "skipped",
      tone: "warning",
      detail: typeof skipped.reason === "string" ? skipped.reason : undefined,
    }
  }

  const executed = recordFromList(runState.executed_transitions, "id", transition.id)
  if (executed) {
    return { label: "executed", tone: "success" }
  }

  return { label: "pending", tone: "neutral" }
}

function buildKeyValueRows(values: Record<string, unknown> | undefined): Element[] {
  if (!values || Object.keys(values).length === 0) {
    return []
  }

  return Object.entries(values).map(([key, value]) =>
    element("div", "aimd-workflow__kv-row", [
      code(key),
      element("span", "aimd-workflow__kv-arrow", [text("=")]),
      valueElement(value),
    ]))
}

function buildProtocolNode(
  workflow: AimdWorkflowField,
  node: AimdWorkflowField["nodes"][number],
  runState: AimdWorkflowRunState | undefined,
): Element {
  const record = runState?.records?.[node.id]
  const iteration = runState?.node_iterations?.[node.id]
  const children: Array<Element | HastText> = [
    element("div", "aimd-workflow__node-title", [text(node.title || node.id)]),
    element("div", "aimd-workflow__node-id", [code(node.id)]),
  ]

  const meta: Element[] = []
  if (node.protocol) meta.push(code(node.protocol))
  if (node.protocol_id) meta.push(code(node.protocol_id))
  if (workflow.default_initial_node === node.id) meta.push(label("initial"))
  if (typeof iteration === "number") meta.push(label(`iteration ${iteration}`))
  if (record !== undefined) meta.push(label("record", "success"))
  if (meta.length > 0) {
    children.push(element("div", "aimd-workflow__node-meta", meta))
  }
  if (node.description) {
    children.push(element("div", "aimd-workflow__node-description", [text(node.description)]))
  }

  return element("article", "aimd-workflow__node", children, {
    "data-aimd-workflow-node": node.id,
  })
}

function buildAssignmentGroups(assign: AimdWorkflowTransitionField["assign"]): Element | null {
  if (!assign || Object.keys(assign).length === 0) {
    return null
  }

  return element("div", "aimd-workflow__assignments", Object.entries(assign).map(([targetNode, assignments]) =>
    element("div", "aimd-workflow__assignment-group", [
      element("div", "aimd-workflow__assignment-target", [text("assign "), code(targetNode)]),
      element("div", "aimd-workflow__kv-list", buildKeyValueRows(assignments)),
    ])))
}

function buildTransition(
  transition: AimdWorkflowTransitionField,
  runState: AimdWorkflowRunState | undefined,
): Element {
  const status = getTransitionStatus(transition, runState)
  const outputRecord = runState?.transition_outputs?.[transition.id]
  const headerChildren: Array<Element | HastText> = [
    code(transition.id),
    label(`${transition.from.join(", ")} -> ${transition.to.join(", ")}`),
  ]
  if (status) {
    headerChildren.push(label(status.label, status.tone))
  }
  if (transition.when) {
    headerChildren.push(label("when"))
  }
  if (transition.run) {
    headerChildren.push(label(`run ${transition.run}`))
  }
  if (typeof transition.max_iterations === "number") {
    headerChildren.push(label(`max ${transition.max_iterations}`))
  }

  const children: Array<Element | HastText> = [
    element("div", "aimd-workflow__transition-header", headerChildren),
  ]

  if (transition.label) {
    children.push(element("div", "aimd-workflow__transition-label", [text(transition.label)]))
  }
  if (transition.when) {
    children.push(element("div", "aimd-workflow__transition-condition", [text("when "), valueElement(transition.when)]))
  }
  if (status?.detail) {
    children.push(element("div", "aimd-workflow__transition-detail", [text(status.detail)]))
  }

  const inputRows = buildKeyValueRows(transition.inputs)
  if (inputRows.length > 0) {
    children.push(element("div", "aimd-workflow__block", [
      element("div", "aimd-workflow__block-title", [text("inputs")]),
      element("div", "aimd-workflow__kv-list", inputRows),
    ]))
  }

  const assignments = buildAssignmentGroups(transition.assign)
  if (assignments) {
    children.push(element("div", "aimd-workflow__block", [
      element("div", "aimd-workflow__block-title", [text("assign")]),
      assignments,
    ]))
  }

  if (outputRecord !== undefined) {
    children.push(element("div", "aimd-workflow__block", [
      element("div", "aimd-workflow__block-title", [text("outputs")]),
      element("div", "aimd-workflow__kv-list", buildKeyValueRows(
        typeof outputRecord === "object" && outputRecord !== null && !Array.isArray(outputRecord)
          ? outputRecord as Record<string, unknown>
          : { value: outputRecord },
      )),
    ]))
  }

  return element("article", "aimd-workflow__transition", children, {
    "data-aimd-workflow-transition": transition.id,
  })
}

function buildAssigner(assigner: AimdWorkflowField["assigners"][number]): Element {
  const children: Array<Element | HastText> = [
    element("div", "aimd-workflow__assigner-header", [
      code(assigner.id),
      label(assigner.runtime),
      ...(assigner.entrypoint ? [code(assigner.entrypoint)] : []),
    ]),
  ]
  if (assigner.description) {
    children.push(element("div", "aimd-workflow__assigner-description", [text(assigner.description)]))
  }

  const outputRows = buildKeyValueRows(assigner.outputs)
  if (outputRows.length > 0) {
    children.push(element("div", "aimd-workflow__kv-list", outputRows))
  }

  const permissionRows = [
    ...(assigner.permissions?.network?.map((item) => ["network", item] as const) ?? []),
    ...(assigner.permissions?.secrets?.map((item) => ["secret", item] as const) ?? []),
  ]
  if (permissionRows.length > 0) {
    children.push(element("div", "aimd-workflow__permission-list", permissionRows.map(([kind, item]) =>
      element("span", "aimd-workflow__permission", [text(`${kind}: `), code(item)]))))
  }

  return element("article", "aimd-workflow__assigner", children, {
    "data-aimd-workflow-assigner": assigner.id,
  })
}

function countRecords(runState: AimdWorkflowRunState | undefined): number {
  return runState?.records ? Object.keys(runState.records).length : 0
}

function buildRunSummary(runState: AimdWorkflowRunState | undefined): Element | null {
  if (runState === undefined) {
    return null
  }

  const records = countRecords(runState)
  const executed = runState.executed_transitions?.length ?? 0
  const skipped = runState.skipped_transitions?.length ?? 0
  const attempts = runState.attempts?.length ?? 0
  return element("div", "aimd-workflow__run-summary", [
    label(`${records} records`, records > 0 ? "success" : "neutral"),
    label(`${executed} executed`, executed > 0 ? "success" : "neutral"),
    label(`${skipped} skipped`, skipped > 0 ? "warning" : "neutral"),
    label(`${attempts} attempts`),
    ...(runState.status ? [label(runState.status)] : []),
  ])
}

function buildSourceDetails(source: string): Element {
  return element("details", "aimd-workflow__source", [
    element("summary", "aimd-workflow__source-summary", [text("workflow source")]),
    element("pre", "aimd-workflow__source-code", [
      element("code", "language-workflow", [text(source)]),
    ]),
  ])
}

function buildWorkflowPanel(
  workflow: AimdWorkflowField,
  runState: AimdWorkflowRunState | undefined,
  source: string,
  options: AimdWorkflowRenderOptions,
): Element {
  const children: Array<Element | HastText> = [
    element("header", "aimd-workflow__header", [
      element("div", "aimd-workflow__title-group", [
        element("div", "aimd-workflow__eyebrow", [text("Workflow")]),
        element("h2", "aimd-workflow__title", [text(workflow.title || workflow.id)]),
        element("div", "aimd-workflow__id", [code(workflow.id), label(workflow.version)]),
      ]),
      element("div", "aimd-workflow__metrics", [
        label(`${workflow.nodes.length} nodes`),
        label(`${workflow.transitions.length} transitions`),
        label(`${workflow.assigners.length} assigners`),
      ]),
    ]),
  ]

  if (workflow.description) {
    children.push(element("p", "aimd-workflow__description", [text(workflow.description)]))
  }

  const runSummary = buildRunSummary(runState)
  if (runSummary) {
    children.push(runSummary)
  }

  children.push(element("section", "aimd-workflow__section", [
    element("h3", "aimd-workflow__section-title", [text("Nodes")]),
    element("div", "aimd-workflow__nodes", workflow.nodes.map((node) => buildProtocolNode(workflow, node, runState))),
  ]))

  children.push(element("section", "aimd-workflow__section", [
    element("h3", "aimd-workflow__section-title", [text("Transitions")]),
    element("div", "aimd-workflow__transitions", workflow.transitions.map((transition) => buildTransition(transition, runState))),
  ]))

  if (workflow.assigners.length > 0) {
    children.push(element("section", "aimd-workflow__section", [
      element("h3", "aimd-workflow__section-title", [text("Assigners")]),
      element("div", "aimd-workflow__assigners", workflow.assigners.map(buildAssigner)),
    ]))
  }

  if (workflow.logic) {
    children.push(element("section", "aimd-workflow__section", [
      element("h3", "aimd-workflow__section-title", [text("Logic")]),
      element("p", "aimd-workflow__logic", [text(workflow.logic)]),
    ]))
  }

  if (options.showWorkflowSource) {
    children.push(buildSourceDetails(source))
  }

  return element("section", "aimd-workflow", children, {
    "data-aimd-workflow-id": workflow.id,
  })
}

function replaceWorkflowBlocksInParent(parent: HastRoot | Element, context: WorkflowRenderContext): void {
  const children = (parent.children || []) as Array<Element | HastText>

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (!isElement(child)) {
      continue
    }

    if (isWorkflowCodeBlock(child)) {
      const workflow = context.workflows[context.workflowIndex]
      context.workflowIndex += 1
      if (workflow === undefined) {
        continue
      }
      const codeNode = getCodeElement(child)
      const source = codeNode ? getCodeContent(codeNode) : workflow.raw
      children[index] = buildWorkflowPanel(
        workflow,
        context.options.workflowRuns?.[workflow.id],
        source,
        context.options,
      )
      continue
    }

    replaceWorkflowBlocksInParent(child, context)
  }
}

export function renderWorkflowBlocks(
  tree: HastRoot,
  fields: { workflow?: AimdWorkflowField[] },
  options: AimdWorkflowRenderOptions = {},
): void {
  const workflows = fields.workflow ?? []
  if (workflows.length === 0) {
    return
  }

  replaceWorkflowBlocksInParent(tree, {
    workflows,
    workflowIndex: 0,
    options,
  })
}
