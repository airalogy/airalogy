/**
 * AIMD Domain Constants
 *
 * Canonical source for AIMD scope mappings, color records, and field key helpers.
 * App packages should re-export from here.
 */

import type { FieldKey, FieldResponseKey, FiledName, ScopeFieldKey } from "../types/aimd"

// Scope color record — maps field names to display colors
export const scopeColorRecord: Record<FiledName, string> = {
  step: "#1A79FF",
  check: "#18a058",
  var: "#1A79FF",
  var_table: "#1A79FF",
  ref_step: "#1A79FF",
  ref_var: "#1A79FF",
  rp: "#1A79FF",
  rr: "#1A79FF",
  rrec: "#1A79FF",
  rq: "#1A79FF",
  rnw: "#1A79FF",
  rn: "#1A79FF",
  step_ref: "#1A79FF",
  rv_ref: "#1A79FF",
}

// Scope name record — maps short field names to full field keys
export const scopeNameRecord: Record<string, FieldKey> = {
  step: "research_step",
  check: "research_check",
  var: "research_variable",
  rn: "research_node",
  rp: "research_protocol",
  rr: "research_result",
  rrec: "research_record",
  rq: "research_question",
  rnw: "research_workflow",
  step_ref: "research_step_ref",
}

// Scope key record — reverse mapping from full field keys to short names
export const scopeKeyRecord: Record<ScopeFieldKey, FiledName> = {
  research_check: "check",
  research_node: "rn",
  research_protocol: "rp",
  research_result: "rr",
  research_record: "rrec",
  research_step: "step",
  research_variable: "var",
  research_question: "rq",
  research_workflow: "rnw",
  research_step_ref: "step_ref",
  var_table: "var_table",
  ref_step: "ref_step",
  rv_ref: "rv_ref",
}

/**
 * Get schema key from API response key
 */
export function getSchemaKey(
  scope: FieldResponseKey,
): "research_variable" | "research_check" | "research_step" | null {
  if (scope === "vars") {
    return "research_variable"
  }

  if (scope === "checks") {
    return "research_check"
  }

  if (scope === "steps") {
    return "research_step"
  }

  return null
}

/**
 * Get record data key from scope field key
 */
export function getRecordDataKey(scope?: ScopeFieldKey | null) {
  if (scope === "research_variable") {
    return "vars"
  }

  if (scope === "research_step") {
    return "steps"
  }

  if (scope === "research_check") {
    return "checks"
  }

  return null
}
