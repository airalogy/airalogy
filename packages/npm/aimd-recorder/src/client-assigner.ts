import { validateClientAssignerFunctionSource } from "@airalogy/aimd-core/parser"
import type { AimdClientAssignerField } from "@airalogy/aimd-core/types"
import { getNumericConstraintViolation, isNumericVarType } from "./composables/useVarHelpers"

type ClientAssignerExecutor = (dependentFields: Record<string, unknown>) => unknown

export interface ClientAssignerFieldDefinition {
  type?: string
  kwargs?: Record<string, unknown>
}

export type ClientAssignerFieldDefinitions = Record<string, ClientAssignerFieldDefinition | undefined>

const executorCache = new Map<string, ClientAssignerExecutor>()

const SAFE_MATH = Object.freeze({
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  trunc: Math.trunc,
})

const SAFE_OBJECT = Object.freeze({
  entries: Object.entries,
  fromEntries: Object.fromEntries,
  keys: Object.keys,
  values: Object.values,
})

const SAFE_ARRAY = Object.freeze({
  isArray: Array.isArray,
})

const SAFE_JSON = Object.freeze({
  parse: JSON.parse,
  stringify: JSON.stringify,
})

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T
  }
  if (isObjectLike(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    ) as T
  }
  return value
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }
    return left.every((item, index) => isDeepEqual(item, right[index]))
  }

  if (isObjectLike(left) && isObjectLike(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }
    return leftKeys.every(key => key in right && isDeepEqual(left[key], right[key]))
  }

  return false
}

function isReadyValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") {
    return false
  }
  if (typeof value === "string") {
    return value.trim().length > 0
  }
  return true
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function isValidFieldValue(value: unknown, definition: ClientAssignerFieldDefinition | undefined): boolean {
  if (!definition) {
    return true
  }

  if (isNumericVarType(definition.type) && toFiniteNumber(value) === undefined) {
    return false
  }

  return getNumericConstraintViolation(value, definition.type, definition.kwargs) === null
}

function isReadyFieldValue(
  field: string,
  value: unknown,
  fieldDefinitions: ClientAssignerFieldDefinitions | undefined,
): boolean {
  return isReadyValue(value) && isValidFieldValue(value, fieldDefinitions?.[field])
}

function getAssignerDependencies(assigner: AimdClientAssignerField, fieldOwners: Map<string, string>): Set<string> {
  const dependencies = new Set<string>()
  for (const field of assigner.dependent_fields) {
    const owner = fieldOwners.get(field)
    if (owner && owner !== assigner.id) {
      dependencies.add(owner)
    }
  }
  return dependencies
}

function sortClientAssigners(assigners: AimdClientAssignerField[]): AimdClientAssignerField[] {
  const assignerById = new Map(assigners.map(assigner => [assigner.id, assigner]))
  const fieldOwners = new Map<string, string>()

  for (const assigner of assigners) {
    for (const field of assigner.assigned_fields) {
      fieldOwners.set(field, assigner.id)
    }
  }

  const visited = new Set<string>()
  const order: AimdClientAssignerField[] = []

  function visit(assigner: AimdClientAssignerField): void {
    if (visited.has(assigner.id)) {
      return
    }
    visited.add(assigner.id)
    for (const dependencyId of getAssignerDependencies(assigner, fieldOwners)) {
      const dependency = assignerById.get(dependencyId)
      if (dependency) {
        visit(dependency)
      }
    }
    order.push(assigner)
  }

  for (const assigner of assigners) {
    visit(assigner)
  }

  return order
}

function shouldRunAutoFirst(assigner: AimdClientAssignerField, values: Record<string, unknown>): boolean {
  return assigner.assigned_fields.every(field => !isReadyValue(values[field]))
}

function areDependenciesReady(
  assigner: AimdClientAssignerField,
  values: Record<string, unknown>,
  options: ClientAssignerApplyOptions | undefined,
): boolean {
  return assigner.dependent_fields.every(field => isReadyFieldValue(field, values[field], options?.fieldDefinitions))
}

function compileClientAssigner(assigner: AimdClientAssignerField): ClientAssignerExecutor {
  const cached = executorCache.get(assigner.function_source)
  if (cached) {
    return cached
  }

  validateClientAssignerFunctionSource(assigner.function_source, assigner.id)

  const executorFactory = new Function(
    "__math__",
    "__object__",
    "__array__",
    "__json__",
    `"use strict";
const Math = __math__;
const Object = __object__;
const Array = __array__;
const JSON = __json__;
const window = undefined;
const document = undefined;
const globalThis = undefined;
const self = undefined;
const fetch = undefined;
const XMLHttpRequest = undefined;
const WebSocket = undefined;
const Function = undefined;
const setTimeout = undefined;
const setInterval = undefined;
const Date = undefined;
return (${assigner.function_source});
`,
  )

  const executor = executorFactory(
    SAFE_MATH,
    SAFE_OBJECT,
    SAFE_ARRAY,
    SAFE_JSON,
  )

  if (typeof executor !== "function") {
    throw new Error(`client assigner "${assigner.id}" did not compile to a callable function`)
  }

  executorCache.set(assigner.function_source, executor as ClientAssignerExecutor)
  return executor as ClientAssignerExecutor
}

function executeClientAssigner(
  assigner: AimdClientAssignerField,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const executor = compileClientAssigner(assigner)
  const dependentFields = Object.fromEntries(
    assigner.dependent_fields.map(field => [field, cloneValue(values[field])]),
  )

  const result = executor(dependentFields)
  if (!isObjectLike(result)) {
    throw new Error(`client assigner "${assigner.id}" must return an object`)
  }

  const missingFields = assigner.assigned_fields.filter(field => !(field in result))
  if (missingFields.length > 0) {
    throw new Error(`client assigner "${assigner.id}" is missing assigned fields: ${missingFields.join(", ")}`)
  }

  const extraFields = Object.keys(result).filter(field => !assigner.assigned_fields.includes(field))
  if (extraFields.length > 0) {
    throw new Error(`client assigner "${assigner.id}" returned fields not declared in assigned_fields: ${extraFields.join(", ")}`)
  }

  return Object.fromEntries(
    assigner.assigned_fields.map(field => [field, cloneValue(result[field])]),
  ) as Record<string, unknown>
}

export interface ClientAssignerApplyOptions {
  triggerIds?: string[]
  fieldDefinitions?: ClientAssignerFieldDefinitions
}

export interface ClientAssignerApplyResult {
  changed: boolean
  changedFields: string[]
}

/**
 * Apply frontend-only assigners to the mutable var scope.
 */
export function applyClientAssigners(
  assigners: AimdClientAssignerField[],
  values: Record<string, unknown>,
  options?: ClientAssignerApplyOptions,
): ClientAssignerApplyResult {
  if (assigners.length === 0) {
    return { changed: false, changedFields: [] }
  }

  const explicitlyTriggeredIds = new Set(options?.triggerIds ?? [])
  const changedFields = new Set<string>()

  for (const assigner of sortClientAssigners(assigners)) {
    if (!areDependenciesReady(assigner, values, options)) {
      continue
    }

    const explicitlyTriggered = explicitlyTriggeredIds.has(assigner.id)

    if (!explicitlyTriggered) {
      if (assigner.mode === "manual") {
        continue
      }
      if (assigner.mode === "auto_first" && !shouldRunAutoFirst(assigner, values)) {
        continue
      }
    }

    const nextAssignments = executeClientAssigner(assigner, values)

    for (const [field, nextValue] of Object.entries(nextAssignments)) {
      if (!isDeepEqual(values[field], nextValue)) {
        values[field] = nextValue
        changedFields.add(field)
      }
    }
  }

  return {
    changed: changedFields.size > 0,
    changedFields: Array.from(changedFields),
  }
}
