<script lang="ts">
import { defineAsyncComponent, defineComponent, h, ref, type PropType, type VNode } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import {
  formatAimdExampleValue,
  getAimdFieldDescription,
  getAimdFieldDisplayLabel,
  getAimdFieldExamples,
  getAimdFieldTitle,
} from "@airalogy/aimd-core/utils"
import type { AimdFieldMeta, AimdFileUploadHandler, AimdTypePlugin, AimdVarInputKind } from "../types"
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
  getFileDisplayName,
  getFileInputConfig,
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
  },
  emits: ["change", "blur"],
  setup(props, { emit }) {
    const fileUploadError = ref("")

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
          emit("change", {
            id,
            value: uploadedValue ?? createSelectedFileValue(file),
            type,
            inputKind,
          })
        } catch {
          fileUploadError.value = props.messages.file.uploadFailed
        }
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
            value: props.value,
            onChange: (e: Event) => onVarChange((e.target as HTMLSelectElement).value),
            onBlur: onVarBlur,
          }, enumOptions.map(opt => h("option", { key: String(opt.value), value: opt.value }, opt.label)))),
          renderAssignerError(),
        ])
      }

      // Default stacked widget
      const renderStackedVar = (control: VNode, variantClass?: string | string[]): VNode =>
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
          renderControlRow(control),
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
        )
      }

      if (inputKind === "file") {
        const fileConfig = getFileInputConfig(type, node.definition?.kwargs, meta)
        const fileName = getFileDisplayName(props.value)
        const displayName = fileName || placeholder || props.messages.file.choose
        const resolvedUrl = typeof props.value === "string" && props.resolveFile
          ? props.resolveFile(props.value)
          : null

        return renderStackedVar(
          h("span", {
            class: "aimd-rec-inline__value-control aimd-rec-inline__file-control",
            "data-file-kind": fileConfig.kind,
            onVnodeMounted: (vnode: any) => syncFileControlLayout(vnode.el as HTMLElement),
            onVnodeUpdated: (vnode: any) => syncFileControlLayout(vnode.el as HTMLElement),
          }, [
            h("label", {
              class: [
                "aimd-rec-file-field__trigger",
                disabled ? "aimd-rec-file-field__trigger--disabled" : undefined,
              ],
              title: displayName,
            }, [
              h("input", {
                "data-rec-focus-key": `var:${id}`,
                class: "aimd-rec-file-field__input",
                type: "file",
                accept: fileConfig.accept,
                disabled,
                onChange: onFileChange,
                onBlur: onVarBlur,
              }),
              h("span", {
                class: [
                  "aimd-rec-file-field__badge",
                  `aimd-rec-file-field__badge--${fileConfig.kind}`,
                ],
                "aria-hidden": "true",
              }, fileConfig.badge),
              h("span", {
                class: [
                  "aimd-rec-file-field__name",
                  fileName ? undefined : "aimd-rec-file-field__name--placeholder",
                ],
              }, displayName),
            ]),
            resolvedUrl
              ? h("a", {
                class: "aimd-rec-file-field__link",
                href: resolvedUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                title: props.messages.file.open,
                onClick: (event: Event) => event.stopPropagation(),
              }, props.messages.file.open)
              : null,
            fileName && !disabled
              ? h("button", {
                type: "button",
                class: "aimd-rec-file-field__clear",
                "aria-label": props.messages.file.clear,
                title: props.messages.file.clear,
                onClick: (event: Event) => {
                  event.stopPropagation()
                  fileUploadError.value = ""
                  emit("change", { id, value: "", type, inputKind })
                },
              }, "×")
              : null,
            fileUploadError.value
              ? h("span", { class: "aimd-rec-file-field__error" }, fileUploadError.value)
              : null,
          ]),
          "aimd-rec-inline--var-stacked--file",
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
