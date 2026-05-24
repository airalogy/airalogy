/**
 * AIMD Utility Functions
 *
 * Provides helper functions for working with AIMD data structures.
 * These ensure consistent handling of subvars and other AIMD fields.
 */

import type { AimdSubvar, AimdTemplateEnv, AimdVarTableField, ExtractedAimdFields } from "../types/aimd"

/**
 * Normalize subvars to AimdSubvar[] format
 * Handles both string[] and object[] input formats
 */
export function normalizeSubvars(
  subvars: Array<string | AimdSubvar> | undefined | null,
): AimdSubvar[] {
  if (!subvars || !Array.isArray(subvars))
    return []

  return subvars.map((item) => {
    if (typeof item === "string") {
      return { id: item }
    }
    if (!(typeof item.id === "string" && item.id.trim())) {
      return item as AimdSubvar
    }
    return {
      ...item,
      id: item.id,
    }
  })
}

/**
 * Get subvar names as string array
 * Useful for table headers and simple displays
 */
export function getSubvarNames(
  subvars: Array<string | AimdSubvar> | undefined | null,
): string[] {
  if (!subvars || !Array.isArray(subvars))
    return []

  return subvars.map(item =>
    typeof item === "string" ? item : (typeof item.id === "string" ? item.id : ""),
  )
    .filter(Boolean)
}

/**
 * Get a specific subvar definition by id
 */
export function getSubvarDef(
  subvars: Array<string | AimdSubvar> | undefined | null,
  id: string,
): AimdSubvar | undefined {
  if (!subvars || !Array.isArray(subvars))
    return undefined

  const item = subvars.find(s =>
    typeof s === "string"
      ? s === id
      : s.id === id,
  )

  if (!item)
    return undefined
  if (typeof item === "string") {
    return { id: item }
  }
  return {
    ...item,
    id: item.id,
  }
}

/**
 * Check if subvars array has any items
 */
export function hasSubvars(
  subvars: Array<string | AimdSubvar> | undefined | null,
): boolean {
  return Array.isArray(subvars) && subvars.length > 0
}

/**
 * Convert ExtractedAimdFields to AimdTemplateEnv
 * This is the canonical way to build env for field parsing
 */
export function toTemplateEnv(fields: ExtractedAimdFields): AimdTemplateEnv {
  // Build step hierarchy record
  const byId: Record<string, unknown> = {}
  const byLevel: Record<number, unknown[]> = {}

  if (fields.step_hierarchy) {
    for (const step of fields.step_hierarchy) {
      const stepId = step.id
      const parentId = step.parent_id
      const prevId = step.prev_id
      const node = {
        id: stepId,
        scope: "step",
        level: step.level ?? 0,
        step: step.step,
        estimated_duration_ms: step.estimated_duration_ms,
        timer_mode: step.timer_mode,
        parent: parentId ? byId[parentId] : null,
        prev: prevId ? byId[prevId] : null,
        has_children: false,
        has_content: true,
        siblings: [],
        next: null,
      }

      byId[stepId] = node

      const level = step.level ?? 0
      if (!byLevel[level]) {
        byLevel[level] = []
      }
      byLevel[level].push(node)

      // Link prev/next siblings
      if (prevId && byId[prevId]) {
        (byId[prevId] as Record<string, unknown>).next = node
      }
    }
  }

  return {
    fields,
    typed: {},
    record: {
      byId,
      byLevel,
      byScope: {
        var: {},
        step: byId,
        check: {},
        var_table: {},
        quiz: {},
      },
    },
    tables: fields.var_table.map((table): [string, AimdVarTableField] => [
      table.id,
      {
        id: table.id,
        scope: "var_table",
        subvars: normalizeSubvars(table.subvars),
        link: table.link,
        type_annotation: table.type_annotation,
        auto_item_type: table.auto_item_type,
        list_item_type: table.list_item_type,
      },
    ]),
    refs: {
      ref_step: fields.ref_step.map((id, idx) => ({ id, line: 0, sequence: idx })),
      ref_var: fields.ref_var.map((id, idx) => ({ id, line: 0, sequence: idx })),
    },
  }
}

/**
 * Merge var_table info from template into field structure
 * Used when backend doesn't have complete var_table definitions
 */
export function mergeVarTableInfo(
  fieldInfo: Record<string, unknown>,
  tableField: AimdVarTableField,
): Record<string, unknown> {
  return {
    ...fieldInfo,
    type: "table",
    subvars: normalizeSubvars(tableField.subvars),
    link: tableField.link,
    type_annotation: tableField.type_annotation,
    auto_item_type: tableField.auto_item_type,
    list_item_type: tableField.list_item_type,
  }
}

/**
 * Find a var_table field by id
 */
export function findVarTable(
  fields: ExtractedAimdFields,
  id: string,
): AimdVarTableField | undefined {
  return fields.var_table.find(t => t.id === id)
}

/**
 * Check if a field is a var_table
 */
export function isVarTableField(
  fields: ExtractedAimdFields,
  id: string,
): boolean {
  return fields.var_table.some(t => t.id === id)
}
