import type {
  AimdWorkflowAssignValue,
  AimdWorkflowAssignerField,
  AimdWorkflowField,
  AimdWorkflowNodeField,
  AimdWorkflowPermissions,
  AimdWorkflowTransitionField,
} from "../types/aimd"
import { parseDocument } from "yaml"

const WORKFLOW_VERSION = "airalogy.workflow.v1"
const WORKFLOW_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const WORKFLOW_FIELD_PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/
const WORKFLOW_REFERENCE_PATTERN = /^\$\{[A-Za-z][A-Za-z0-9_]*(?:(?:\.[A-Za-z][A-Za-z0-9_]*){2,}|\.(?:status|iteration))\}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  return value.trim()
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeId(value: unknown, fieldName: string): string {
  const id = nonEmptyString(value, fieldName)
  if (!WORKFLOW_ID_PATTERN.test(id)) {
    throw new Error(`${fieldName} must start with a letter and contain only letters, digits, and underscores`)
  }
  return id
}

function normalizeIdList(value: unknown, fieldName: string): string[] {
  const values = Array.isArray(value)
    ? value.map((item, index) => normalizeId(item, `${fieldName}[${index}]`))
    : [normalizeId(value, fieldName)]
  if (values.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string or list`)
  }
  const seen = new Set<string>()
  for (const item of values) {
    if (seen.has(item)) {
      throw new Error(`${fieldName} contains duplicate node id: ${item}`)
    }
    seen.add(item)
  }
  return values
}

function normalizeStringRecord(value: unknown, fieldName: string): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }

  const result: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!WORKFLOW_ID_PATTERN.test(key)) {
      throw new Error(`${fieldName}.${key} must use an identifier key`)
    }
    result[key] = nonEmptyString(rawValue, `${fieldName}.${key}`)
  }
  return result
}

function normalizeValueRecord(value: unknown, fieldName: string): Record<string, AimdWorkflowAssignValue> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }

  const result: Record<string, AimdWorkflowAssignValue> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!WORKFLOW_ID_PATTERN.test(key)) {
      throw new Error(`${fieldName}.${key} must use an identifier key`)
    }
    result[key] = rawValue as AimdWorkflowAssignValue
  }
  return result
}

function normalizePermissions(value: unknown): AimdWorkflowPermissions | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isPlainObject(value)) {
    throw new Error("assigner permissions must be a mapping/object")
  }

  const permissions: AimdWorkflowPermissions = {}
  for (const key of ["network", "secrets"] as const) {
    const rawList = value[key]
    if (rawList === undefined || rawList === null) {
      continue
    }
    if (!Array.isArray(rawList) || !rawList.every(item => typeof item === "string" && item.trim())) {
      throw new Error(`permissions.${key} must be a list of non-empty strings`)
    }
    permissions[key] = rawList.map(item => item.trim())
  }
  return Object.keys(permissions).length > 0 ? permissions : undefined
}

function normalizeNode(rawNode: unknown, index: number): AimdWorkflowNodeField {
  if (!isPlainObject(rawNode)) {
    throw new Error(`nodes[${index}] must be a mapping/object`)
  }

  const node: AimdWorkflowNodeField = {
    id: normalizeId(rawNode.id, `nodes[${index}].id`),
  }

  const protocol = optionalString(rawNode.protocol, `nodes[${index}].protocol`)
  const protocolId = optionalString(rawNode.protocol_id, `nodes[${index}].protocol_id`)
  if (!protocol && !protocolId) {
    throw new Error(`nodes[${index}] must define protocol or protocol_id`)
  }
  if (protocol) node.protocol = protocol
  if (protocolId) node.protocol_id = protocolId

  const protocolVersion = optionalString(rawNode.protocol_version, `nodes[${index}].protocol_version`)
  const title = optionalString(rawNode.title, `nodes[${index}].title`)
  const description = optionalString(rawNode.description, `nodes[${index}].description`)
  if (protocolVersion) node.protocol_version = protocolVersion
  if (title) node.title = title
  if (description) node.description = description
  return node
}

function normalizeAssigner(rawAssigner: unknown, index: number): AimdWorkflowAssignerField {
  if (!isPlainObject(rawAssigner)) {
    throw new Error(`assigners[${index}] must be a mapping/object`)
  }

  const assigner: AimdWorkflowAssignerField = {
    id: normalizeId(rawAssigner.id, `assigners[${index}].id`),
    runtime: nonEmptyString(rawAssigner.runtime, `assigners[${index}].runtime`),
  }

  const entrypoint = optionalString(rawAssigner.entrypoint, `assigners[${index}].entrypoint`)
  if (assigner.runtime === "python" && !entrypoint) {
    throw new Error(`assigners[${index}].entrypoint is required for python runtime`)
  }
  if (entrypoint) assigner.entrypoint = entrypoint

  const description = optionalString(rawAssigner.description, `assigners[${index}].description`)
  if (description) assigner.description = description

  const outputs = normalizeStringRecord(rawAssigner.outputs, `assigners[${index}].outputs`)
  if (outputs) assigner.outputs = outputs

  const permissions = normalizePermissions(rawAssigner.permissions)
  if (permissions) assigner.permissions = permissions

  return assigner
}

function normalizeFieldAssignmentRecord(
  value: unknown,
  fieldName: string,
): Record<string, AimdWorkflowAssignValue> {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }

  const result: Record<string, AimdWorkflowAssignValue> = {}
  for (const [fieldPath, rawValue] of Object.entries(value)) {
    if (!WORKFLOW_FIELD_PATH_PATTERN.test(fieldPath)) {
      throw new Error(`${fieldName}.${fieldPath} must be a workflow field path like var.sample_id`)
    }
    result[fieldPath] = rawValue as AimdWorkflowAssignValue
  }
  return result
}

function normalizeTransitionAssign(
  value: unknown,
  targetIds: string[],
  fieldName: string,
): Record<string, Record<string, AimdWorkflowAssignValue>> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }

  const targetSet = new Set(targetIds)
  const result: Record<string, Record<string, AimdWorkflowAssignValue>> = {}
  if (targetIds.length === 1) {
    const onlyTarget = targetIds[0]
    const groupedKeys = Object.keys(value).filter(key => targetSet.has(key))
    if (groupedKeys.length > 0) {
      for (const [targetId, rawAssignments] of Object.entries(value)) {
        if (!targetSet.has(targetId)) {
          throw new Error(`${fieldName}.${targetId} must reference a transition target node`)
        }
        result[targetId] = normalizeFieldAssignmentRecord(rawAssignments, `${fieldName}.${targetId}`)
      }
    } else {
      result[onlyTarget] = normalizeFieldAssignmentRecord(value, `${fieldName}.${onlyTarget}`)
    }
    return result
  }

  for (const [targetId, rawAssignments] of Object.entries(value)) {
    if (!targetSet.has(targetId)) {
      throw new Error(`${fieldName}.${targetId} must reference a transition target node`)
    }
    result[targetId] = normalizeFieldAssignmentRecord(rawAssignments, `${fieldName}.${targetId}`)
  }
  return result
}

function normalizeTransition(
  rawTransition: unknown,
  index: number,
  nodeIds: Set<string>,
  assignerIds: Set<string>,
): AimdWorkflowTransitionField {
  if (!isPlainObject(rawTransition)) {
    throw new Error(`transitions[${index}] must be a mapping/object`)
  }

  const id = normalizeId(rawTransition.id, `transitions[${index}].id`)
  const from = normalizeIdList(rawTransition.from, `transitions[${index}].from`)
  const to = normalizeIdList(rawTransition.to, `transitions[${index}].to`)
  for (const sourceId of from) {
    if (!nodeIds.has(sourceId)) {
      throw new Error(`transitions[${index}].from references unknown node: ${sourceId}`)
    }
  }
  for (const targetId of to) {
    if (!nodeIds.has(targetId)) {
      throw new Error(`transitions[${index}].to references unknown node: ${targetId}`)
    }
  }

  const transition: AimdWorkflowTransitionField = { id, from, to }
  const when = optionalString(rawTransition.when, `transitions[${index}].when`)
  const run = optionalString(rawTransition.run, `transitions[${index}].run`)
  const label = optionalString(rawTransition.label, `transitions[${index}].label`)
  if (when) transition.when = when
  if (label) transition.label = label
  if (run) {
    if (!assignerIds.has(run)) {
      throw new Error(`transitions[${index}].run references unknown assigner: ${run}`)
    }
    transition.run = run
  }

  const inputs = normalizeValueRecord(rawTransition.inputs, `transitions[${index}].inputs`)
  if (inputs) transition.inputs = inputs

  const maxIterations = rawTransition.max_iterations
  if (maxIterations !== undefined && maxIterations !== null) {
    if (typeof maxIterations !== "number" || !Number.isInteger(maxIterations) || maxIterations <= 0) {
      throw new Error(`transitions[${index}].max_iterations must be a positive integer`)
    }
    transition.max_iterations = maxIterations
  }

  const assign = normalizeTransitionAssign(rawTransition.assign, to, `transitions[${index}].assign`)
  if (assign) transition.assign = assign

  return transition
}

function collectDuplicateIds(items: Array<{ id: string }>, fieldName: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`${fieldName} contains duplicate id: ${item.id}`)
    }
    seen.add(item.id)
  }
}

function parseWorkflowYamlMapping(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n?/g, "\n")
  const document = parseDocument(normalized, {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)

  if (document.errors.length > 0) {
    const firstError = document.errors[0]
    throw new Error(`Invalid workflow YAML: ${firstError.message}`)
  }

  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error("workflow block must be a YAML mapping/object")
  }
  return value
}

export function isAimdWorkflowReference(value: unknown): value is string {
  return typeof value === "string" && WORKFLOW_REFERENCE_PATTERN.test(value.trim())
}

export function parseWorkflowContent(content: string): AimdWorkflowField {
  const data = parseWorkflowYamlMapping(content)
  const version = nonEmptyString(data.version, "workflow.version")
  if (version !== WORKFLOW_VERSION) {
    throw new Error(`workflow.version must be ${WORKFLOW_VERSION}`)
  }

  const rawNodes = data.nodes
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new Error("workflow.nodes must be a non-empty list")
  }
  const nodes = rawNodes.map(normalizeNode)
  collectDuplicateIds(nodes, "workflow.nodes")
  const nodeIds = new Set(nodes.map(node => node.id))

  const rawAssigners = data.assigners
  const assigners = Array.isArray(rawAssigners)
    ? rawAssigners.map(normalizeAssigner)
    : []
  if (rawAssigners !== undefined && !Array.isArray(rawAssigners)) {
    throw new Error("workflow.assigners must be a list")
  }
  collectDuplicateIds(assigners, "workflow.assigners")
  const assignerIds = new Set(assigners.map(assigner => assigner.id))

  const rawTransitions = data.transitions
  if (!Array.isArray(rawTransitions) || rawTransitions.length === 0) {
    throw new Error("workflow.transitions must be a non-empty list")
  }
  const transitions = rawTransitions.map((transition, index) =>
    normalizeTransition(transition, index, nodeIds, assignerIds))
  collectDuplicateIds(transitions, "workflow.transitions")

  const workflow: AimdWorkflowField = {
    id: normalizeId(data.id, "workflow.id"),
    version: WORKFLOW_VERSION,
    nodes,
    assigners,
    transitions,
    raw: content,
  }

  const title = optionalString(data.title, "workflow.title")
  const description = optionalString(data.description, "workflow.description")
  const logic = optionalString(data.logic, "workflow.logic")
  const defaultInitialNode = optionalString(data.default_initial_node, "workflow.default_initial_node")
  const defaultResearchPurpose = optionalString(data.default_research_purpose, "workflow.default_research_purpose")
  const defaultResearchStrategy = optionalString(data.default_research_strategy, "workflow.default_research_strategy")
  if (title) workflow.title = title
  if (description) workflow.description = description
  if (logic) workflow.logic = logic
  if (defaultInitialNode) {
    if (!nodeIds.has(defaultInitialNode)) {
      throw new Error(`workflow.default_initial_node references unknown node: ${defaultInitialNode}`)
    }
    workflow.default_initial_node = defaultInitialNode
  }
  if (defaultResearchPurpose) workflow.default_research_purpose = defaultResearchPurpose
  if (defaultResearchStrategy) workflow.default_research_strategy = defaultResearchStrategy

  return workflow
}
