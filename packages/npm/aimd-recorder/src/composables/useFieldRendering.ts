import { reactive, type VNode } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import { formatAimdExampleValue, getAimdFieldExamples } from "@airalogy/aimd-core/utils"
import type { AimdFieldMeta, AimdFieldState, AimdTypePlugin, AimdTypePluginInitContext, AimdTypePluginValueContext } from "../types"
import {
  normalizeVarTypeName,
  getVarInputKind,
  getVarInputDisplayValue,
  unwrapStructuredValue,
  formatDateTimeWithTimezone,
  type VarInputKind,
} from "./useVarHelpers"
import { normalizeDnaSequenceValue } from "./useDnaSequence"
import { resolveAimdTypePlugin } from "../type-plugins"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VarInputDisplayOverride {
  display: string
  expectedValue: unknown
}

export interface FieldRenderingOptions {
  readonly: () => boolean
  currentUserName: () => string | undefined
  now: () => Date | string | number | undefined
  fieldMeta: () => Record<string, AimdFieldMeta> | undefined
  fieldState: () => Record<string, AimdFieldState> | undefined
  typePlugins: () => AimdTypePlugin[] | undefined
  wrapField: () => ((fieldKey: string, fieldType: string, defaultVNode: VNode) => VNode) | undefined
}

function getFieldMetaExamples(meta?: AimdFieldMeta): unknown[] {
  if (!meta) return []
  if (Array.isArray(meta.examples)) {
    return meta.examples.filter(value => value !== undefined && value !== null)
  }
  const singleExample = (meta as { example?: unknown }).example
  return singleExample === undefined || singleExample === null ? [] : [singleExample]
}

function isReadonlyAssignerMode(mode?: NonNullable<AimdFieldMeta["assigner"]>["mode"]): boolean {
  return mode === "auto_force" || mode === "auto_readonly" || mode === "manual_readonly"
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useFieldRendering(options: FieldRenderingOptions) {
  const varInputDisplayOverrides = reactive<Record<string, VarInputDisplayOverride>>({})

  // ── Extension helpers ───────────────────────────────────────────────────

  function maybeWrap(fieldKey: string, fieldType: string, vnode: VNode): VNode {
    const wrapper = options.wrapField()
    return wrapper ? wrapper(fieldKey, fieldType, vnode) : vnode
  }

  function fieldStateClasses(fieldKey: string): string[] {
    const state = options.fieldState()?.[fieldKey]
    const cls: string[] = []
    if (state?.validationError) cls.push("aimd-rec-inline--error")
    if (state?.loading) cls.push("aimd-rec-inline--loading")
    return cls
  }

  function isFieldDisabled(fieldKey: string): boolean {
    if (options.readonly()) return true
    const meta = options.fieldMeta()?.[fieldKey]
    const state = options.fieldState()?.[fieldKey]
    return !!(meta?.disabled || state?.disabled || isReadonlyAssignerMode(meta?.assigner?.mode))
  }

  // ── resolveNowDate ─────────────────────────────────────────────────────

  function resolveNowDate(): Date {
    const now = options.now()
    if (now instanceof Date) return Number.isNaN(now.getTime()) ? new Date() : now
    if (typeof now === "string" || typeof now === "number") {
      const d = new Date(now)
      if (!Number.isNaN(d.getTime())) return d
    }
    return new Date()
  }

  function getTypePlugin(fieldKey: string, type: string | undefined): AimdTypePlugin | undefined {
    return resolveAimdTypePlugin(type, options.typePlugins())
  }

  function buildTypePluginInitContext(
    node: AimdVarNode,
    type: string | undefined,
    fieldKey: string,
  ): AimdTypePluginInitContext {
    return {
      type: type || "str",
      normalizedType: normalizeVarTypeName(type),
      fieldKey,
      node,
      fieldMeta: options.fieldMeta()?.[fieldKey],
      currentUserName: options.currentUserName(),
      now: options.now(),
    }
  }

  function buildTypePluginValueContext(
    node: AimdVarNode,
    type: string | undefined,
    fieldKey: string,
    value: unknown,
    inputKind: VarInputKind,
  ): AimdTypePluginValueContext {
    return {
      ...buildTypePluginInitContext(node, type, fieldKey),
      value,
      inputKind,
    }
  }

  // ── Var display value ──────────────────────────────────────────────────

  function getVarInitialDisplayOverride(node: AimdVarNode, type: string | undefined, fieldKey: string): VarInputDisplayOverride | null {
    const raw = node.definition?.defaultRaw?.trim()
    if (!raw) {
      return null
    }

    const normalizedType = normalizeVarTypeName(type)
    if (normalizedType === "int" || normalizedType === "integer") {
      return null
    }

    if (
      getVarInputKind(type, {
        inputType: options.fieldMeta()?.[fieldKey]?.inputType,
        codeLanguage: options.fieldMeta()?.[fieldKey]?.codeLanguage,
        typePlugin: getTypePlugin(fieldKey, type),
      }) !== "number"
      || typeof node.definition?.default !== "number"
    ) {
      return null
    }

    if (!raw.includes(".") || String(node.definition.default) === raw) {
      return null
    }

    return {
      display: raw,
      expectedValue: node.definition.default,
    }
  }

  function getVarDisplayValue(
    id: string,
    node: AimdVarNode,
    type: string | undefined,
    value: unknown,
    kind: VarInputKind,
    fieldKey: string,
  ): string | number {
    const override = varInputDisplayOverrides[id]
    const normalized = unwrapStructuredValue(value)
    const typePlugin = getTypePlugin(fieldKey, type)

    if (override) {
      if (kind === "number" && Object.is(normalized, override.expectedValue)) {
        return override.display
      }
      delete varInputDisplayOverrides[id]
    }

    if (typePlugin?.getDisplayValue) {
      return typePlugin.getDisplayValue(
        buildTypePluginValueContext(node, type, fieldKey, value, kind),
      )
    }

    return getVarInputDisplayValue(value, kind, { type, typePlugin })
  }

  function clearVarInputDisplayOverride(id: string) {
    if (id in varInputDisplayOverrides) {
      delete varInputDisplayOverrides[id]
    }
  }

  function setVarInputDisplayOverride(id: string, override: VarInputDisplayOverride) {
    varInputDisplayOverrides[id] = override
  }

  // ── Var initial value ──────────────────────────────────────────────────

  function getVarInitialValue(node: AimdVarNode, type: string | undefined, fieldKey: string): unknown {
    const typePlugin = getTypePlugin(fieldKey, type)
    if (typePlugin?.getInitialValue) {
      return typePlugin.getInitialValue(buildTypePluginInitContext(node, type, fieldKey))
    }

    const normalizedType = normalizeVarTypeName(type)
    if (node.definition && Object.prototype.hasOwnProperty.call(node.definition, "default")) {
      if (normalizedType === "dnasequence") {
        return normalizeDnaSequenceValue(node.definition.default)
      }
      return node.definition.default
    }
    const inputKind = getVarInputKind(type, {
      inputType: options.fieldMeta()?.[fieldKey]?.inputType,
      codeLanguage: options.fieldMeta()?.[fieldKey]?.codeLanguage,
      typePlugin,
    })
    if (inputKind === "checkbox") return false
    if (inputKind === "dna") return normalizeDnaSequenceValue(undefined)
    if (normalizedType === "currenttime") return formatDateTimeWithTimezone(resolveNowDate())
    if (normalizedType === "username" && typeof options.currentUserName() === "string") return options.currentUserName()
    return ""
  }

  function normalizeVarValue(
    node: AimdVarNode,
    type: string | undefined,
    fieldKey: string,
    value: unknown,
    inputKind: VarInputKind,
  ): unknown {
    const typePlugin = getTypePlugin(fieldKey, type)
    if (typePlugin?.normalizeValue) {
      return typePlugin.normalizeValue(
        buildTypePluginValueContext(node, type, fieldKey, value, inputKind),
      )
    }

    const normalizedType = normalizeVarTypeName(type)
    if (inputKind === "dna" || normalizedType === "dnasequence") {
      return normalizeDnaSequenceValue(value)
    }

    return value
  }

  function getVarPlaceholder(node: AimdVarNode, meta?: AimdFieldMeta): string | undefined {
    const placeholder = node.definition?.kwargs?.placeholder
    if (typeof placeholder === "string" && placeholder.trim()) {
      return placeholder.trim()
    }

    const metaExamples = getFieldMetaExamples(meta)
    const [example] = metaExamples.length > 0 ? metaExamples : getAimdFieldExamples(node.definition)
    if (example !== undefined && example !== null && typeof example !== "object") {
      return formatAimdExampleValue(example)
    }

    return undefined
  }

  // ── ID helpers ─────────────────────────────────────────────────────────

  function getAimdId(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null
    }

    const obj = value as Record<string, unknown>
    if (typeof obj.id === "string" && obj.id.trim()) {
      return obj.id
    }
    return null
  }

  return {
    varInputDisplayOverrides,
    maybeWrap,
    fieldStateClasses,
    isFieldDisabled,
    resolveNowDate,
    getTypePlugin,
    getVarInitialDisplayOverride,
    getVarDisplayValue,
    clearVarInputDisplayOverride,
    setVarInputDisplayOverride,
    getVarInitialValue,
    normalizeVarValue,
    getVarPlaceholder,
    getAimdId,
  }
}
