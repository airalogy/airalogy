import type { AimdNode } from "@airalogy/aimd-core/types"
import type { AimdRecordFieldRef } from "@airalogy/aimd-core/utils"
import type { AimdRecorderMessages } from "../locales"
import type { AimdFieldMeta } from "../types"
import { formatAimdExampleValue } from "@airalogy/aimd-core/utils"

type Label = keyof AimdRecorderMessages["definition"]

/** Describes the protocol declaration, independently of the current or saved value. */
export function panelDefinition(node: AimdNode, field?: AimdRecordFieldRef, meta?: AimdFieldMeta, schema?: Record<string, unknown>) {
  const rows: Array<{ label: Label; text: string }> = []
  function add(label: Label, value: unknown) {
    if (value === undefined || (Array.isArray(value) && !value.length)) return
    const text = Array.isArray(value) ? value.map(formatAimdExampleValue).join("\n") : formatAimdExampleValue(value)
    rows.push({ label, text: text || '""' })
  }

  if (node.fieldType !== "var" && node.fieldType !== "var_table") {
    add("type", node.fieldType === "quiz" ? node.quizType : node.fieldType)
    add("description", meta?.description || field?.description)
    if (node.fieldType === "step" || node.fieldType === "check" || node.fieldType === "quiz") {
      const details = node.fieldType === "step" ? { ...node.props, step: node.step, level: node.level, parent_id: node.parent_id, subtitle: node.subtitle, estimated_duration_ms: node.estimated_duration_ms, checked_message: node.checked_message }
        : node.fieldType === "check" ? { checked_message: node.checked_message }
        : { mode: node.mode, score: node.score }
      add("constraints", Object.entries(details).filter(([k,v]) => k !== "title" && v !== undefined).map(([k,v]) => k + " = " + formatAimdExampleValue(v)))
    }
    return rows
  }

  const def = node.definition
  const properties = { ...schema, ...def?.kwargs }
  add("type", def?.type ?? field?.type ?? properties.airalogy_type ?? properties.airalogy_built_in_type ?? properties.type ?? meta?.inputType)
  add("description", meta?.description || field?.description || properties.description)
  add("unit", properties.unit)
  add("default", def?.default !== undefined ? def.default : properties.default)
  add("examples", meta?.examples?.length ? meta.examples : field?.examples?.length ? field.examples : properties.examples ?? properties.example)
  add("enum", meta?.enumOptions?.map(option => option.value) ?? field?.enum ?? properties.enum)
  add("placeholder", meta?.placeholder ?? properties.placeholder)
  if (node.fieldType === "var_table") {
    add("columns", node.columns.map(column => {
      const child = def?.subvars?.[column]
      return child ? column + " = " + formatAimdExampleValue(child) : column
    }))
  }
  const displayed = new Set(["title", "type", "description", "unit", "default", "examples", "example", "enum", "placeholder", "$defs", "definitions", "$schema"])
  // AIMD length limits apply to characters, items or properties according to the field type.
  const lengthUnit = schema?.type === "array" ? "Items" : schema?.type === "object" ? "Properties" : "Length"
  const constraints: Array<[Label, ...string[]]> = [
    ["minimum", "ge"], ["exclusiveMinimum", "gt"], ["maximum", "le"], ["exclusiveMaximum", "lt"], ["multipleOf", "multiple_of"],
    ["minLength"], ["maxLength"], ["minItems", "min_items"], ["maxItems", "max_items"], ["minProperties"], ["maxProperties"],
  ]
  for (const keys of constraints) {
    const [key] = keys
    if (key === "min" + lengthUnit) keys.push("min_length")
    if (key === "max" + lengthUnit) keys.push("max_length")
    const values = keys.filter(k => Object.prototype.hasOwnProperty.call(properties, k)).map(k => properties[k])
    const [value] = values
    // Keep conflicting or unrecognized definitions inspectable under their original names.
    if (typeof value !== "number" || !values.every(v => v === value)) continue
    add(key, value)
    for (const k of keys) displayed.add(k)
  }
  const remaining = Object.entries(properties).filter(([key]) => !displayed.has(key))
  if (meta?.pattern && properties.pattern === undefined) remaining.push(["pattern", meta.pattern])
  if (remaining.length) add("constraints", remaining.map(([key, value]) => key + " = " + formatAimdExampleValue(value)))
  return rows
}
