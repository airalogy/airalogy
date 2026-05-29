<script lang="ts">
import { defineAsyncComponent, defineComponent, h, ref, watch, type PropType, type VNode } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import {
  formatAimdExampleValue,
  getAimdFieldDescription,
  getAimdFieldDisplayLabel,
  getAimdFieldExamples,
  getAimdFieldTitle,
} from "@airalogy/aimd-core/utils"
import type {
  AimdFieldMeta,
  AimdFileInfoResolver,
  AimdFileResolveContext,
  AimdFileUploadHandler,
  AimdResolvedFileInfo,
  AimdTypePlugin,
  AimdVarInputKind,
} from "../types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import { resolveAimdCodeEditorLanguage } from "../code-types"
import {
  normalizeVarTypeName,
  parseVarInputValue,
  applyVarStackWidth,
  getNumericConstraintViolation,
  getNumericInputAttributes,
  syncAutoWrapTextareaHeight,
  toBooleanValue,
  createSelectedFileValue,
  getFileValueId,
  getFileDisplayName,
  getFileInputConfig,
  getVarEnumSelectValue,
  getVarEnumValueFromSelectValue,
  type NumericInputAttributes,
} from "../composables/useVarHelpers"

const AimdCodeField = defineAsyncComponent(() => import("./AimdCodeField.vue"))

function normalizeMetaString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function getFieldMetaExamples(meta?: AimdFieldMeta): unknown[] {
  if (!meta) return []
  if (Array.isArray(meta.examples)) {
    return meta.examples.filter(value => value !== undefined && value !== null)
  }
  const singleExample = (meta as { example?: unknown }).example
  return singleExample === undefined || singleExample === null ? [] : [singleExample]
}

interface FieldMetadataHelp {
  tooltip: string
  description?: string
  examples: string[]
}

interface CsvPreviewState {
  url: string
  rows: string[][]
}

interface FileDisplayInfo {
  id?: string
  name?: string
  url?: string
  thumbnailUrl?: string
  type?: string
  size?: number
}

function parseCsvPreviewLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function parseCsvPreviewRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(parseCsvPreviewLine)
}

function getFileRecordString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const item = record[key]
    if (typeof item === "string" && item.trim()) {
      return item.trim()
    }
  }
  return undefined
}

function getFileRecordNumber(value: unknown, keys: string[]): number | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const item = record[key]
    if (typeof item === "number" && Number.isFinite(item)) {
      return item
    }
  }
  return undefined
}

function normalizeResolvedFileInfo(
  value: AimdResolvedFileInfo | string | null | undefined,
  fallback: FileDisplayInfo = {},
): FileDisplayInfo {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return /^(https?:|blob:|data:|\/)/i.test(trimmed)
      ? { ...fallback, url: trimmed || fallback.url }
      : fallback
  }
  if (!value || typeof value !== "object") {
    return fallback
  }
  return {
    id: getFileRecordString(value, ["id", "file_id", "fileId", "src"]) ?? fallback.id,
    name: getFileRecordString(value, ["name", "fileName", "file_name", "filename", "originalName", "original_name"]) ?? fallback.name,
    url: getFileRecordString(value, ["url", "downloadUrl", "src"]) ?? fallback.url,
    thumbnailUrl: getFileRecordString(value, ["thumbnailUrl", "thumbnail_url"]) ?? fallback.thumbnailUrl,
    type: getFileRecordString(value, ["type", "contentType", "content_type", "mimeType"]) ?? fallback.type,
    size: getFileRecordNumber(value, ["size", "byteSize", "byte_size"]) ?? fallback.size,
  }
}

function formatFileSize(size: number | undefined): string {
  if (!Number.isFinite(size) || size === undefined || size < 0) {
    return ""
  }
  if (size < 1024) {
    return `${size} B`
  }
  const units = ["KB", "MB", "GB"]
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function renderUtilityIcon(kind: "download" | "open" | "clear" | "replace" | "preview"): VNode {
  const common = {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }
  if (kind === "download") {
    return h("svg", common, [
      h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
      h("path", { d: "M7 10l5 5 5-5" }),
      h("path", { d: "M12 15V3" }),
    ])
  }
  if (kind === "open") {
    return h("svg", common, [
      h("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
      h("path", { d: "M15 3h6v6" }),
      h("path", { d: "M10 14L21 3" }),
    ])
  }
  if (kind === "replace") {
    return h("svg", common, [
      h("path", { d: "M21 12a9 9 0 0 1-15.5 6.2" }),
      h("path", { d: "M3 12A9 9 0 0 1 18.5 5.8" }),
      h("path", { d: "M18 2v4h-4" }),
      h("path", { d: "M6 22v-4h4" }),
    ])
  }
  if (kind === "preview") {
    return h("svg", common, [
      h("path", { d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" }),
      h("circle", { cx: "12", cy: "12", r: "3" }),
    ])
  }
  return h("svg", common, [
    h("path", { d: "M3 6h18" }),
    h("path", { d: "M8 6V4h8v2" }),
    h("path", { d: "M19 6l-1 14H6L5 6" }),
    h("path", { d: "M10 11v5" }),
    h("path", { d: "M14 11v5" }),
  ])
}

function createFieldMetadataHelp(description: string | undefined, examples: unknown[]): FieldMetadataHelp {
  const formattedExamples = examples
    .map(formatAimdExampleValue)
    .map(example => example.trim())
    .filter(Boolean)
  const exampleText = formattedExamples.length > 0 ? `e.g. ${formattedExamples.join(", ")}` : undefined
  const tooltipLines = [description, exampleText].filter((value): value is string => Boolean(value))
  return {
    tooltip: tooltipLines.join("\n"),
    description,
    examples: formattedExamples,
  }
}

function renderFieldMetadataPopover(help: FieldMetadataHelp): VNode | null {
  if (!help.description && help.examples.length === 0) {
    return null
  }
  const children: VNode[] = []
  if (help.description) {
    children.push(h("span", {
      class: "aimd-field__metadata-popover-line",
    }, help.description))
  }
  if (help.examples.length > 0) {
    children.push(h("span", { class: "aimd-field__metadata-examples" }, [
      h("span", { class: "aimd-field__metadata-examples-label" }, "e.g."),
      ...help.examples.map((example, index) => h("span", {
        key: `${index}-${example}`,
        class: "aimd-field__metadata-example",
      }, example)),
    ]))
  }
  return h("span", {
    class: "aimd-field__metadata-popover",
    role: "tooltip",
  }, children)
}

export default defineComponent({
  name: "AimdVarField",
  props: {
    node: { type: Object as PropType<AimdVarNode>, required: true },
    value: { type: undefined as unknown as PropType<unknown>, default: undefined },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
    fieldMeta: { type: Object as PropType<AimdFieldMeta | undefined>, default: undefined },
    displayValue: { type: [String, Number] as PropType<string | number>, default: "" },
    inputKind: { type: String as PropType<AimdVarInputKind>, required: true },
    typePlugin: { type: Object as PropType<AimdTypePlugin | undefined>, default: undefined },
    initialized: { type: Boolean, default: false },
    assignerControl: { type: Object as PropType<VNode | undefined>, default: undefined },
    assignerStatus: { type: Object as PropType<VNode | undefined>, default: undefined },
    assignerError: { type: String, default: undefined },
    uploadFile: { type: Function as PropType<AimdFileUploadHandler | undefined>, default: undefined },
    resolveFile: { type: Function as PropType<((src: string) => string | null) | undefined>, default: undefined },
    resolveFileInfo: { type: Function as PropType<AimdFileInfoResolver | undefined>, default: undefined },
  },
  emits: ["change", "blur"],
  setup(props, { emit }) {
    const fileUploadError = ref("")
    const csvPreview = ref<CsvPreviewState | null>(null)
    const resolvedFileInfo = ref<FileDisplayInfo | null>(null)
    const lastSelectedFileInfo = ref<FileDisplayInfo | null>(null)
    let csvPreviewRequestId = 0

    watch(
      () => {
        const type = props.node.definition?.type || "str"
        const normalizedType = normalizeVarTypeName(type)
        const fileConfig = getFileInputConfig(type, props.node.definition?.kwargs, props.fieldMeta)
        const fileId = getFileValueId(props.value)
        const resolvedUrl = resolvedFileInfo.value?.url || (fileId && props.resolveFile ? props.resolveFile(fileId) : null)
        return fileConfig.kind === "csv" && resolvedUrl
          ? `${normalizedType}\n${resolvedUrl}`
          : ""
      },
      (key) => {
        const requestId = ++csvPreviewRequestId
        const [, resolvedUrl] = key.split("\n")
        csvPreview.value = null
        if (!resolvedUrl || typeof fetch !== "function") {
          return
        }

        void fetch(resolvedUrl)
          .then(response => (response.ok ? response.text() : ""))
          .then((text) => {
            if (requestId !== csvPreviewRequestId || !text) return
            const rows = parseCsvPreviewRows(text)
            if (rows.length > 0) {
              csvPreview.value = { url: resolvedUrl, rows }
            }
          })
          .catch(() => undefined)
      },
      { immediate: true },
    )

    watch(
      () => {
        const type = props.node.definition?.type || "str"
        const normalizedType = normalizeVarTypeName(type)
        const fileConfig = getFileInputConfig(type, props.node.definition?.kwargs, props.fieldMeta)
        const fileId = getFileValueId(props.value)
        const fallbackUrl = fileId && props.resolveFile ? props.resolveFile(fileId) : null
        return {
          fileId: fileId ?? "",
          fallbackUrl: fallbackUrl ?? "",
          kind: fileConfig.kind,
          type,
          normalizedType,
        }
      },
      async ({ fileId, fallbackUrl, kind, type, normalizedType }) => {
        if (!fileId) {
          resolvedFileInfo.value = null
          return
        }

        const localInfo = lastSelectedFileInfo.value?.id === fileId
          ? lastSelectedFileInfo.value
          : null
        const baseInfo: FileDisplayInfo = {
          id: fileId,
          name: getFileDisplayName(props.value) || localInfo?.name,
          url: fallbackUrl || localInfo?.url,
          thumbnailUrl: localInfo?.thumbnailUrl,
          type: getFileRecordString(props.value, ["type", "contentType", "content_type", "mimeType"]) ?? localInfo?.type,
          size: getFileRecordNumber(props.value, ["size", "byteSize", "byte_size"]) ?? localInfo?.size,
        }
        resolvedFileInfo.value = normalizeResolvedFileInfo(
          props.value as AimdResolvedFileInfo | string | null | undefined,
          baseInfo,
        )

        if (!props.resolveFileInfo) {
          return
        }

        const requestContext: AimdFileResolveContext = {
          type,
          normalizedType,
          fieldKey: `var:${props.node.id}`,
          node: props.node,
          fieldMeta: props.fieldMeta,
          kind,
        }
        try {
          const resolved = await props.resolveFileInfo(fileId, requestContext)
          if (getFileValueId(props.value) !== fileId) {
            return
          }
          resolvedFileInfo.value = normalizeResolvedFileInfo(resolved, resolvedFileInfo.value ?? baseInfo)
        } catch {
          // Keep the URL-only fallback. Hosts may choose to surface resolver errors elsewhere.
        }
      },
      { immediate: true },
    )

    return () => {
      const node = props.node
      const id = node.id
      const type = node.definition?.type || "str"
      const normalizedType = normalizeVarTypeName(type)
      const inputKind = props.inputKind
      const isIntegerInput = normalizedType === "int" || normalizedType === "integer"
      const usesDecimalTextInput = inputKind === "number" && !isIntegerInput
      const meta = props.fieldMeta
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const placeholder = meta?.placeholder ?? getVarPlaceholder(node, meta)
      const displayValue = props.displayValue
      const codeLanguage = resolveAimdCodeEditorLanguage(type, meta) ?? "plaintext"
      const numericInputAttributes: NumericInputAttributes = inputKind === "number"
        ? getNumericInputAttributes(type, node.definition?.kwargs)
        : {}
      const numericConstraintViolation = inputKind === "number"
        ? getNumericConstraintViolation(displayValue, type, node.definition?.kwargs)
        : null

      function onVarChange(rawValue: string) {
        const parsed = parseVarInputValue(rawValue, type, inputKind, {
          typePlugin: props.typePlugin,
        })
        emit("change", { id, value: parsed, type, inputKind })
      }

      function onVarBlur() {
        emit("blur", { id })
      }

      function syncCompactControlLayout(control: HTMLInputElement | HTMLTextAreaElement) {
        applyVarStackWidth(control, inputKind)
        if (typeof HTMLTextAreaElement !== "undefined" && control instanceof HTMLTextAreaElement) {
          syncAutoWrapTextareaHeight(control)
        }
      }

      function syncFileControlLayout(control: HTMLElement) {
        applyVarStackWidth(control, inputKind)
      }

      async function onFileChange(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ""
        if (!file) {
          return
        }

        fileUploadError.value = ""
        const fileConfig = getFileInputConfig(type, node.definition?.kwargs, meta)
        try {
          const uploadedValue = props.uploadFile
            ? await props.uploadFile(file, {
              type,
              normalizedType,
              fieldKey: `var:${id}`,
              node,
              fieldMeta: meta,
              accept: fileConfig.accept,
            })
            : undefined
          const nextValue = uploadedValue ?? createSelectedFileValue(file)
          const uploadedId = getFileValueId(nextValue)
          lastSelectedFileInfo.value = {
            id: uploadedId,
            name: file.name,
            url: uploadedId && props.resolveFile ? props.resolveFile(uploadedId) ?? undefined : undefined,
            type: file.type,
            size: file.size,
          }
          emit("change", {
            id,
            value: nextValue,
            type,
            inputKind,
          })
        } catch {
          fileUploadError.value = props.messages.file.uploadFailed
        }
      }

      const renderHeaderAssignerActions = (): VNode | null => {
        if (!["file", "code"].includes(inputKind) || (!props.assignerControl && !props.assignerStatus)) {
          return null
        }

        return h("span", { class: "aimd-rec-inline__header-assigner-actions" }, [
          props.assignerControl
            ? h("span", { class: "aimd-rec-inline__header-assigner-action" }, [props.assignerControl])
            : null,
          props.assignerStatus
            ? h("span", { class: "aimd-rec-inline__header-assigner-state" }, [props.assignerStatus])
            : null,
        ])
      }

      const renderVarLabel = (): VNode => {
        const metaTitle = normalizeMetaString(meta?.title)
        const definitionTitle = getAimdFieldTitle(node.definition)
        const displayTitle = metaTitle ?? getAimdFieldDisplayLabel(id, node.definition)
        const hasCustomTitle = (metaTitle ?? definitionTitle) !== undefined && displayTitle !== id
        const description = normalizeMetaString(meta?.description) ?? getAimdFieldDescription(node.definition)
        const metaExamples = getFieldMetaExamples(meta)
        const examples = metaExamples.length > 0 ? metaExamples : getAimdFieldExamples(node.definition)
        const help = createFieldMetadataHelp(description, examples)
        const hasHelp = Boolean(help.description) || help.examples.length > 0

        return h("span", {
          class: [
            "aimd-field",
            "aimd-field--no-style",
            "aimd-field__label",
            hasHelp ? "aimd-field__label--has-metadata" : undefined,
          ],
        }, [
          h("span", { class: "aimd-field__scope aimd-field__scope--var" }, getAimdRecorderScopeLabel("var", props.messages)),
          h("span", {
            class: [
              "aimd-field__name",
              (hasCustomTitle || hasHelp) ? "aimd-field__name--with-metadata" : undefined,
              hasHelp ? "aimd-field__metadata-host" : undefined,
            ],
            tabindex: hasHelp ? 0 : undefined,
            "aria-label": help.tooltip || undefined,
          }, [
            h("span", { class: "aimd-field__title" }, displayTitle),
            hasCustomTitle ? h("span", { class: "aimd-field__key" }, id) : null,
            renderFieldMetadataPopover(help),
          ]),
          renderHeaderAssignerActions(),
        ])
      }

      const renderControlRow = (control: VNode): VNode => {
        if (!props.assignerControl && !props.assignerStatus) {
          return control
        }

        return h("span", { class: "aimd-rec-inline__control-row" }, [
          props.assignerControl
            ? h("span", { class: "aimd-rec-inline__assigner-prefix" }, [props.assignerControl])
            : null,
          h("span", { class: "aimd-rec-inline__control-main" }, [control]),
          props.assignerStatus
            ? h("span", { class: "aimd-rec-inline__assigner-status" }, [props.assignerStatus])
            : null,
        ])
      }

      const renderAssignerError = (): VNode | null => (
        props.assignerError
          ? h("span", { class: "aimd-rec-inline__assigner-error" }, props.assignerError)
          : null
      )

      // Enum select (from fieldMeta override)
      const enumOptions = meta?.enumOptions ?? []
      if (enumOptions.length) {
        const selectedEnumValue = getVarEnumSelectValue(enumOptions, props.value)
        return h("span", {
          class: [
            "aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper",
            (props.assignerControl || props.assignerStatus) ? "aimd-rec-inline--has-assigner-control" : undefined,
            ...extraClasses,
          ],
        }, [
          renderVarLabel(),
          renderControlRow(h("select", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__value-control aimd-rec-inline__input aimd-rec-inline__input--stacked aimd-rec-inline__select",
            disabled,
            value: selectedEnumValue,
            onChange: (e: Event) => {
              const value = getVarEnumValueFromSelectValue(enumOptions, (e.target as HTMLSelectElement).value)
              emit("change", { id, value, type, inputKind })
            },
            onBlur: onVarBlur,
          }, [
            selectedEnumValue === ""
              ? h("option", { value: "" }, placeholder ?? "")
              : null,
            ...enumOptions.map((opt, index) => h("option", { key: `${index}:${String(opt.value)}`, value: String(index) }, opt.label)),
          ])),
          renderAssignerError(),
        ])
      }

      // Default stacked widget
      const renderStackedVar = (
        control: VNode,
        variantClass?: string | string[],
        options: { controlRow?: boolean } = {},
      ): VNode =>
        h("span", {
          class: [
            "aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper aimd-field-wrapper--inline",
            (props.assignerControl || props.assignerStatus) ? "aimd-rec-inline--has-assigner-control" : undefined,
            variantClass,
            numericConstraintViolation ? "aimd-rec-inline--error" : undefined,
            ...extraClasses,
          ],
        }, [
          renderVarLabel(),
          options.controlRow === false ? control : renderControlRow(control),
          renderAssignerError(),
        ])

      if (inputKind === "checkbox") {
        return renderStackedVar(
          h("span", { class: "aimd-rec-inline__checkbox-row" }, [
            h("input", {
              "data-rec-focus-key": `var:${id}`,
              type: "checkbox",
              disabled,
              checked: toBooleanValue(props.value),
              onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
              onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
              onChange: (event: Event) => {
                const val = (event.target as HTMLInputElement).checked
                emit("change", { id, value: val, type, inputKind })
              },
              onBlur: onVarBlur,
            }),
          ]),
          "aimd-rec-inline--var-stacked--checkbox",
        )
      }

      if (inputKind === "textarea" || inputKind === "dna") {
        return renderStackedVar(
          h("textarea", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__value-control aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked",
            disabled,
            placeholder,
            value: displayValue,
            onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
            onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
            onInput: (event: Event) => onVarChange((event.target as HTMLTextAreaElement).value),
            onBlur: onVarBlur,
          }),
          inputKind === "dna" ? "aimd-rec-inline--var-stacked--dna" : "aimd-rec-inline--var-stacked--textarea",
        )
      }

      if (inputKind === "code") {
        return renderStackedVar(
          h(AimdCodeField, {
            modelValue: typeof displayValue === "number" ? String(displayValue) : displayValue,
            language: codeLanguage,
            disabled,
            "onUpdate:modelValue": (nextValue: string) => onVarChange(nextValue),
            onBlur: onVarBlur,
          }),
          "aimd-rec-inline--var-stacked--code",
          { controlRow: false },
        )
      }

      if (inputKind === "file") {
        const fileConfig = getFileInputConfig(type, node.definition?.kwargs, meta)
        const fileId = getFileValueId(props.value)
        const displayInfo = resolvedFileInfo.value
        const fileName = displayInfo?.name || getFileDisplayName(props.value)
        const hasFileValue = Boolean(fileId || fileName)
        const displayName = fileName || (hasFileValue ? props.messages.file.selected : placeholder || props.messages.file.choose)
        const resolvedUrl = displayInfo?.url || (fileId && props.resolveFile
          ? props.resolveFile(fileId)
          : null)
        const previewUrl = displayInfo?.thumbnailUrl || resolvedUrl
        const fileSizeLabel = formatFileSize(displayInfo?.size)
        const fileMetaLabel = [fileConfig.badge, fileSizeLabel].filter(Boolean).join(" · ")
        const fileInput = h("input", {
          "data-rec-focus-key": `var:${id}`,
          class: "aimd-rec-file-field__input",
          type: "file",
          accept: fileConfig.accept,
          disabled,
          onChange: onFileChange,
          onBlur: onVarBlur,
        })
        const fileBadge = h("span", {
          class: [
            "aimd-rec-file-field__badge",
            `aimd-rec-file-field__badge--${fileConfig.kind}`,
          ],
          "aria-hidden": "true",
        }, fileConfig.badge)
        const fileTitle = h("span", {
          class: [
            "aimd-rec-file-field__name",
            fileName ? undefined : "aimd-rec-file-field__name--placeholder",
          ],
        }, displayName)
        const clearFile = (event: Event) => {
          event.stopPropagation()
          fileUploadError.value = ""
          lastSelectedFileInfo.value = null
          resolvedFileInfo.value = null
          emit("change", { id, value: "", type, inputKind })
        }
        const actionButton = (
          kind: "download" | "open" | "clear" | "replace" | "preview",
          label: string,
          attrs: Record<string, unknown> = {},
        ) => h("button", {
          type: "button",
          class: [
            "aimd-rec-file-card__action",
            kind === "clear" ? "aimd-rec-file-card__action--danger" : undefined,
          ],
          "aria-label": label,
          title: label,
          ...attrs,
        }, [renderUtilityIcon(kind), h("span", { class: "aimd-rec-file-card__action-label" }, label)])

        return renderStackedVar(
          h("span", {
            class: "aimd-rec-inline__value-control aimd-rec-inline__file-control",
            "data-file-kind": fileConfig.kind,
            onVnodeMounted: (vnode: any) => syncFileControlLayout(vnode.el as HTMLElement),
            onVnodeUpdated: (vnode: any) => syncFileControlLayout(vnode.el as HTMLElement),
          }, [
            hasFileValue
              ? h("span", { class: "aimd-rec-file-card" }, [
                h("span", { class: "aimd-rec-file-card__header" }, [
                  h("span", { class: "aimd-rec-file-card__identity", title: displayName }, [
                    fileBadge,
                    h("span", { class: "aimd-rec-file-card__text" }, [
                      fileTitle,
                      fileMetaLabel
                        ? h("span", { class: "aimd-rec-file-card__meta" }, fileMetaLabel)
                        : null,
                    ]),
                  ]),
                  h("span", { class: "aimd-rec-file-card__actions" }, [
                    !disabled
                      ? h("label", {
                        class: "aimd-rec-file-card__action aimd-rec-file-card__replace",
                        title: props.messages.file.replace,
                      }, [
                        fileInput,
                        renderUtilityIcon("replace"),
                        h("span", { class: "aimd-rec-file-card__action-label" }, props.messages.file.replace),
                      ])
                      : null,
                    resolvedUrl
                      ? h("a", {
                        class: "aimd-rec-file-card__action",
                        href: resolvedUrl,
                        download: displayName,
                        title: props.messages.file.download,
                        "aria-label": props.messages.file.download,
                        onClick: (event: Event) => event.stopPropagation(),
                      }, [
                        renderUtilityIcon("download"),
                        h("span", { class: "aimd-rec-file-card__action-label" }, props.messages.file.download),
                      ])
                      : null,
                    resolvedUrl
                      ? h("a", {
                        class: "aimd-rec-file-card__action",
                        href: resolvedUrl,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        title: props.messages.file.open,
                        "aria-label": props.messages.file.open,
                        onClick: (event: Event) => event.stopPropagation(),
                      }, [
                        renderUtilityIcon("open"),
                        h("span", { class: "aimd-rec-file-card__action-label" }, props.messages.file.open),
                      ])
                      : null,
                    !disabled
                      ? actionButton("clear", props.messages.file.clear, { onClick: clearFile })
                      : null,
                  ]),
                ]),
                previewUrl && fileConfig.kind === "image"
                  ? h("a", {
                    class: "aimd-rec-file-field__preview",
                    href: resolvedUrl ?? previewUrl,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    title: props.messages.file.preview,
                    onClick: (event: Event) => event.stopPropagation(),
                  }, [
                    h("img", {
                      src: previewUrl,
                      alt: displayName,
                      loading: "lazy",
                    }),
                  ])
                  : null,
                resolvedUrl
                  && fileConfig.kind === "csv"
                  && csvPreview.value?.url === resolvedUrl
                  ? h("span", { class: "aimd-rec-file-field__csv-preview" }, [
                    h("span", { class: "aimd-rec-file-field__csv-grid" }, csvPreview.value.rows.map((row, rowIndex) => (
                      h("span", {
                        key: rowIndex,
                        class: [
                          "aimd-rec-file-field__csv-row",
                          rowIndex === 0 ? "aimd-rec-file-field__csv-row--head" : undefined,
                        ],
                      }, row.slice(0, 4).map((cell, cellIndex) => h("span", {
                        key: `${rowIndex}-${cellIndex}`,
                        class: "aimd-rec-file-field__csv-cell",
                      }, cell || " ")))
                    ))),
                  ])
                  : null,
              ])
              : h("label", {
                class: [
                  "aimd-rec-file-field__trigger",
                  disabled ? "aimd-rec-file-field__trigger--disabled" : undefined,
                ],
                title: displayName,
              }, [
                fileInput,
                fileBadge,
                fileTitle,
              ]),
            fileUploadError.value
              ? h("span", { class: "aimd-rec-file-field__error" }, fileUploadError.value)
              : null,
          ]),
          "aimd-rec-inline--var-stacked--file",
          { controlRow: false },
        )
      }

      if (inputKind === "text") {
        return renderStackedVar(
          h("textarea", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__value-control aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked aimd-rec-inline__textarea--stacked-text",
            rows: 1,
            disabled,
            placeholder,
            value: displayValue,
            onVnodeMounted: (vnode: any) => {
              const el = vnode.el as HTMLTextAreaElement
              syncCompactControlLayout(el)
            },
            onVnodeUpdated: (vnode: any) => {
              const el = vnode.el as HTMLTextAreaElement
              syncCompactControlLayout(el)
            },
            onInput: (event: Event) => {
              const el = event.target as HTMLTextAreaElement
              syncCompactControlLayout(el)
              onVarChange(el.value)
            },
            onBlur: onVarBlur,
          }),
        )
      }

      // number / date / datetime / time
      const htmlInputType = inputKind === "datetime"
        ? "datetime-local"
        : (usesDecimalTextInput ? "text" : inputKind)
      const nativeNumericAttrs: NumericInputAttributes = inputKind === "number" && htmlInputType === "number"
        ? numericInputAttributes
        : {}

      function syncNumberValidity(control: HTMLInputElement) {
        if (inputKind !== "number") {
          return
        }
        const violation = getNumericConstraintViolation(control.value, type, node.definition?.kwargs)
        control.setCustomValidity(violation ?? "")
      }

      return renderStackedVar(
        h("input", {
          "data-rec-focus-key": `var:${id}`,
          class: "aimd-rec-inline__value-control aimd-rec-inline__input aimd-rec-inline__input--stacked",
          type: htmlInputType,
          inputmode: inputKind === "number" ? (isIntegerInput ? "numeric" : "decimal") : undefined,
          min: nativeNumericAttrs.min,
          max: nativeNumericAttrs.max,
          disabled,
          placeholder,
          step: inputKind === "number"
            ? (nativeNumericAttrs.step ?? (isIntegerInput ? "1" : undefined))
            : (inputKind === "time" ? "1" : undefined),
          title: numericConstraintViolation ?? undefined,
          "aria-invalid": numericConstraintViolation ? "true" : undefined,
          value: displayValue,
          onVnodeMounted: (vnode: any) => {
            const el = vnode.el as HTMLInputElement
            syncCompactControlLayout(el)
            syncNumberValidity(el)
          },
          onVnodeUpdated: (vnode: any) => {
            const el = vnode.el as HTMLInputElement
            syncCompactControlLayout(el)
            syncNumberValidity(el)
          },
          onInput: (event: Event) => {
            const el = event.target as HTMLInputElement
            syncCompactControlLayout(el)
            syncNumberValidity(el)
            onVarChange(el.value)
          },
          onBlur: onVarBlur,
        }),
      )
    }
  },
})

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
</script>
