<script lang="ts">
import { Transition, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNode } from "vue"
import type { AimdVarDefinition, AimdVarTableNode } from "@airalogy/aimd-core/types"
import {
  formatAimdExampleValue,
  getAimdFieldDescription,
  getAimdFieldDisplayLabel,
  getAimdFieldEnumValues,
  getAimdFieldExamples,
  getAimdFieldTitle,
} from "@airalogy/aimd-core/utils"
import type { AimdFieldMeta, AimdFieldState } from "../types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderEmptyValueLabel, getAimdRecorderScopeLabel } from "../locales"
import { getVarTableColumns, getVarTableRowKey } from "../composables/useVarTableDragDrop"
import { getVarEnumSelectValue, getVarEnumValueFromSelectValue, isNullableVarType } from "../composables/useVarHelpers"

function renderTrashIcon(): VNode {
  return h("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.9",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }, [
    h("path", { d: "M3 6h18" }),
    h("path", { d: "M8 6V4.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V6" }),
    h("path", { d: "M18 6l-1 13.1c-.1.8-.7 1.4-1.5 1.4H8.5c-.8 0-1.4-.6-1.5-1.4L6 6" }),
    h("path", { d: "M10 10.5v6" }),
    h("path", { d: "M14 10.5v6" }),
  ])
}

function renderRowNumber(rowIndex: number): VNode {
  return h("span", {
    class: "aimd-rec-inline-table__row-number",
  }, String(rowIndex + 1))
}

function estimateDisplayWidth(value: unknown): number {
  const text = String(value ?? "")
  let width = 0
  for (const char of text) {
    width += (char.codePointAt(0) ?? 0) > 0xFF ? 2 : 1
  }
  return width
}

type ColumnSizingKind = "compact" | "default" | "wide"

function resolveColumnSizingKind(column: string, displayLabel = column): ColumnSizingKind {
  const normalizedColumn = `${column} ${displayLabel}`.trim().toLowerCase()

  if (
    /^(id|no|num|qty|amount|count|index|step|day|time|min|max|ph|temp|volume|mass|weight|age)$/.test(normalizedColumn)
    || /^(编号|数量|序号|步数|天数|时间|分钟|最大|最小|温度|体积|质量|重量|年龄)$/.test(displayLabel.trim())
  ) {
    return "compact"
  }

  if (
    /note|remark|comment|description|summary|title|name|result|detail|observation/.test(normalizedColumn)
    || /备注|说明|描述|总结|标题|名称|结果|详情|观察/.test(`${column} ${displayLabel}`)
  ) {
    return "wide"
  }

  return "default"
}

function normalizeMetaString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function createEnumOptions(values: unknown[]): NonNullable<AimdFieldMeta["enumOptions"]> {
  return values.map(value => ({
    label: String(value),
    value,
  }))
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
  name: "AimdVarTableField",
  props: {
    node: { type: Object as PropType<AimdVarTableNode>, required: true },
    rows: { type: Array as PropType<Record<string, string>[]>, required: true },
    columns: { type: Array as PropType<string[]>, required: true },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    settlingRowKey: { type: String as PropType<string | null>, default: null },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
    fieldMeta: { type: Object as PropType<Record<string, AimdFieldMeta> | undefined>, default: undefined },
    fieldState: { type: Object as PropType<Record<string, AimdFieldState> | undefined>, default: undefined },
    assignerControl: { type: Object as PropType<VNode | undefined>, default: undefined },
    assignerStatus: { type: Object as PropType<VNode | undefined>, default: undefined },
    assignerError: { type: String, default: undefined },
  },
  emits: [
    "cell-input",
    "cell-paste",
    "cell-blur",
    "add-row",
    "remove-row",
    "drag-start",
    "drag-over",
    "drag-drop",
    "drag-end",
  ],
  setup(props, { emit }) {
    const wrapperRef = ref<HTMLElement | null>(null)
    const isOverflow = ref(false)
    const layoutReady = ref(false)

    let resizeObserver: ResizeObserver | null = null
    let rafId: number | null = null
    let pendingOverflow: boolean | null = null
    let pendingFrames = 0
    const HYSTERESIS_PX = 40

    function isColumnDisabled(col: string): boolean {
      if (props.disabled) return true
      return !!(props.fieldMeta?.[`var_table:${props.node.id}:${col}`]?.disabled)
    }

    function estimateColumnWidthCh(column: string, rows: Record<string, string>[], displayLabel = column): number {
      const contentWidth = rows.reduce((maxWidth, row) => {
        return Math.max(maxWidth, estimateDisplayWidth(row[column]))
      }, Math.max(estimateDisplayWidth(column), estimateDisplayWidth(displayLabel)))

      const kind = resolveColumnSizingKind(column, displayLabel)

      if (kind === "compact") {
        return Math.max(7, Math.min(12, contentWidth + 2))
      }

      if (kind === "wide") {
        return Math.max(16, Math.min(42, contentWidth + 5))
      }

      return Math.max(10, Math.min(22, contentWidth + 4))
    }

    function estimateTableWidthPx(columns: string[], rows: Record<string, string>[], getDisplayLabel: (column: string) => string): number {
      const CHARACTER_PX = 8.2
      const CELL_HORIZONTAL_PADDING_PX = 24
      const dragColumnPx = 58
      const actionColumnPx = 64

      const contentColumnsPx = columns.reduce((total, column) => {
        return total + estimateColumnWidthCh(column, rows, getDisplayLabel(column)) * CHARACTER_PX + CELL_HORIZONTAL_PADDING_PX
      }, 0)

      return dragColumnPx + actionColumnPx + contentColumnsPx
    }

    function estimateColumnWidthStyle(column: string, rows: Record<string, string>[]): string {
      return `${estimateColumnWidthCh(column, rows, getColumnDisplayLabel(column))}ch`
    }

    function resolveAvailableWidth(): number {
      if (!wrapperRef.value) return 0

      const recorderContent = wrapperRef.value.closest(".aimd-protocol-recorder__content") as HTMLElement | null
      if (recorderContent && recorderContent.clientWidth > 0) {
        return Math.max(0, recorderContent.clientWidth - 36)
      }

      return wrapperRef.value.clientWidth
    }

    function measureOverflow() {
      if (!wrapperRef.value) return

      const availableWidth = resolveAvailableWidth()
      if (availableWidth <= 0) return

      const estimatedWidth = estimateTableWidthPx(props.columns, props.rows, getColumnDisplayLabel)
      const nextOverflow = isOverflow.value
        ? estimatedWidth > availableWidth - HYSTERESIS_PX
        : estimatedWidth > availableWidth + HYSTERESIS_PX

      if (nextOverflow === isOverflow.value) {
        pendingOverflow = null
        pendingFrames = 0
        return
      }

      if (pendingOverflow === nextOverflow) {
        pendingFrames += 1
      } else {
        pendingOverflow = nextOverflow
        pendingFrames = 1
      }

      if (pendingFrames >= 2) {
        isOverflow.value = nextOverflow
        pendingOverflow = null
        pendingFrames = 0
      }
    }

    function scheduleMeasure() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        rafId = null
        measureOverflow()
      })
    }

    function settleInitialLayout() {
      let remainingFrames = 4

      const tick = () => {
        scheduleMeasure()
        remainingFrames -= 1

        if (remainingFrames > 0) {
          requestAnimationFrame(tick)
          return
        }

        layoutReady.value = true
        scheduleMeasure()
      }

      requestAnimationFrame(tick)
    }

    function getColumnDefinition(column: string): AimdVarDefinition | undefined {
      return props.node.definition?.subvars?.[column]
    }

    function getTableMeta(): AimdFieldMeta | undefined {
      return props.fieldMeta?.[`var_table:${props.node.id}`]
    }

    function getColumnMeta(column: string): AimdFieldMeta | undefined {
      const meta = props.fieldMeta?.[`var_table:${props.node.id}:${column}`]
      const enumValues = getAimdFieldEnumValues(getColumnDefinition(column))
      if (enumValues.length > 0 && !meta?.enumOptions) {
        return {
          ...(meta ?? {}),
          enumOptions: createEnumOptions(enumValues),
        }
      }
      return meta
    }

    function getMetadataHelp(definition?: AimdVarDefinition, meta?: AimdFieldMeta): FieldMetadataHelp {
      const description = normalizeMetaString(meta?.description) ?? getAimdFieldDescription(definition)
      const metaExamples = getFieldMetaExamples(meta)
      const examples = metaExamples.length > 0 ? metaExamples : getAimdFieldExamples(definition)
      return createFieldMetadataHelp(description, examples)
    }

    function getColumnDisplayLabel(column: string): string {
      return normalizeMetaString(getColumnMeta(column)?.title)
        ?? getAimdFieldDisplayLabel(column, getColumnDefinition(column))
    }

    function getColumnPlaceholder(column: string): string {
      const definition = getColumnDefinition(column)
      const meta = getColumnMeta(column)
      if (typeof meta?.placeholder === "string" && meta.placeholder.trim()) {
        return meta.placeholder.trim()
      }

      const placeholder = definition?.kwargs?.placeholder
      if (typeof placeholder === "string" && placeholder.trim()) {
        return placeholder.trim()
      }

      const metaExamples = getFieldMetaExamples(meta)
      const [example] = metaExamples.length > 0 ? metaExamples : getAimdFieldExamples(definition)
      if (example !== undefined && example !== null && typeof example !== "object") {
        return formatAimdExampleValue(example)
      }

      return ""
    }

    function renderCellControl(
      tableName: string,
      column: string,
      rowIndex: number,
      row: Record<string, string>,
      className: string | string[],
    ): VNode {
      const enumOptions = getColumnMeta(column)?.enumOptions ?? []
      const focusKey = `var_table:${tableName}:${rowIndex}:${column}`
      const disabled = isColumnDisabled(column)
      const placeholder = getColumnPlaceholder(column)

      if (enumOptions.length > 0) {
        const selectedEnumValue = getVarEnumSelectValue(enumOptions, row[column])
        const emptyEnumValue = isNullableVarType(getColumnDefinition(column)?.type) ? null : ""
        const showEmptyEnumOption = emptyEnumValue === null || selectedEnumValue === ""
        const emptyEnumLabel = emptyEnumValue === null
          ? getAimdRecorderEmptyValueLabel(props.messages)
          : placeholder
        return h("select", {
          "data-rec-focus-key": focusKey,
          class: [className, "aimd-rec-enum-select"],
          disabled,
          value: selectedEnumValue,
          onChange: (event: Event) => {
            emit("cell-input", {
              tableName,
              column,
              rowIndex,
              value: getVarEnumValueFromSelectValue(enumOptions, (event.target as HTMLSelectElement).value, emptyEnumValue),
              row,
            })
          },
          onBlur: () => emit("cell-blur", { tableName, column, rowIndex }),
        }, [
          showEmptyEnumOption
            ? h("option", { value: "" }, emptyEnumLabel)
            : null,
          ...enumOptions.map((option, optionIndex) => h("option", {
            key: `${optionIndex}:${String(option.value)}`,
            value: String(optionIndex),
          }, option.label)),
        ])
      }

      return h("input", {
        "data-rec-focus-key": focusKey,
        class: className,
        disabled,
        placeholder,
        value: row[column] ?? "",
        onInput: (event: Event) => {
          emit("cell-input", {
            tableName,
            column,
            rowIndex,
            value: (event.target as HTMLInputElement).value,
            row,
          })
        },
        onPaste: (event: ClipboardEvent) => {
          const text = event.clipboardData?.getData("text/plain") ?? ""
          if (!text || (!text.includes("\t") && !/[\r\n]/.test(text))) {
            return
          }
          event.preventDefault()
          emit("cell-paste", {
            tableName,
            column,
            rowIndex,
            text,
          })
        },
        onBlur: () => emit("cell-blur", { tableName, column, rowIndex }),
      })
    }

    function renderValidatedCellControl(
      tableName: string,
      column: string,
      rowIndex: number,
      row: Record<string, string>,
      className: string | string[],
    ): VNode {
      const fieldKey = `var_table:${tableName}:${rowIndex}:${column}`
      const validationError = props.fieldState?.[fieldKey]?.validationError
        ?? props.fieldState?.[`var_table:${tableName}:${column}`]?.validationError
      const inputClass = Array.isArray(className) ? [...className] : [className]
      if (validationError) inputClass.push("aimd-rec-table-cell-input--error")
      return h("div", {
        class: ["aimd-rec-table-cell-field", validationError ? "aimd-rec-table-cell-field--invalid" : undefined],
        "data-aimd-validation-field": fieldKey,
      }, [
        renderCellControl(
          tableName,
          column,
          rowIndex,
          row,
          inputClass,
        ),
        validationError
          ? h("span", { class: "aimd-rec-validation-message", role: "alert" }, validationError)
          : null,
      ])
    }

    function renderMetadataLabel(id: string, definition: AimdVarDefinition | undefined, className: string, meta?: AimdFieldMeta): VNode {
      const metaTitle = normalizeMetaString(meta?.title)
      const definitionTitle = getAimdFieldTitle(definition)
      const displayTitle = metaTitle ?? getAimdFieldDisplayLabel(id, definition)
      const hasCustomTitle = (metaTitle ?? definitionTitle) !== undefined && displayTitle !== id
      const help = getMetadataHelp(definition, meta)
      const hasHelp = Boolean(help.description) || help.examples.length > 0

      return h("span", {
        class: [
          className,
          (hasCustomTitle || hasHelp) ? `${className}--with-metadata` : undefined,
          hasHelp ? "aimd-field__metadata-host" : undefined,
        ],
        tabindex: hasHelp ? 0 : undefined,
        "aria-label": help.tooltip || undefined,
      }, [
        h("span", { class: "aimd-field__title" }, displayTitle),
        hasCustomTitle ? h("span", { class: "aimd-field__key" }, id) : null,
        renderFieldMetadataPopover(help),
      ])
    }

    function renderCardView(tableName: string, columns: string[], rows: Record<string, string>[], disabled: boolean, messages: AimdRecorderMessages) {
      return rows.map((row, rowIndex) => {
        const rowKey = getVarTableRowKey(row)
        const titleColumn = columns[0] ?? ""
        const detailColumns = columns.slice(titleColumn ? 1 : 0)

        return h("div", {
          key: `${tableName}-card-${rowKey}`,
          class: "aimd-rec-card",
          onDragover: (event: DragEvent) => emit("drag-over", { tableName, rowIndex, event }),
          onDrop: (event: DragEvent) => emit("drag-drop", { tableName, rowIndex, columns, event }),
        }, [
          h("div", { class: "aimd-rec-card__toolbar" }, [
            h("span", { class: "aimd-rec-card__row-meta" }, [
              renderRowNumber(rowIndex),
              h("span", {
                class: [
                  "aimd-rec-inline-table__drag-handle",
                  props.readonly ? "aimd-rec-inline-table__drag-handle--disabled" : "",
                ],
                title: props.readonly ? messages.table.dragDisabled : messages.table.dragReorder,
                draggable: !props.readonly,
                onDragstart: (event: DragEvent) => emit("drag-start", { tableName, rowIndex, event }),
                onDragend: () => emit("drag-end"),
              }, Array.from({ length: 6 }, (_, dotIndex) => h("span", {
                key: `${rowKey}-card-drag-dot-${dotIndex}`,
                class: "aimd-rec-inline-table__drag-dot",
              }))),
            ]),
            h("button", {
              type: "button",
              class: "aimd-rec-inline-table__icon-btn aimd-rec-inline-table__icon-btn--visible",
              disabled: disabled || rows.length <= 1,
              "aria-label": messages.table.deleteRow,
              title: messages.table.deleteRow,
              onClick: () => emit("remove-row", { tableName, rowIndex, columns }),
            }, [renderTrashIcon()]),
          ]),
          titleColumn
            ? h("div", { class: "aimd-rec-card__field aimd-rec-card__field--title" }, [
                renderMetadataLabel(titleColumn, getColumnDefinition(titleColumn), "aimd-rec-card__label", getColumnMeta(titleColumn)),
                renderValidatedCellControl(tableName, titleColumn, rowIndex, row, "aimd-rec-card__input"),
              ])
            : null,
          h("div", { class: "aimd-rec-card__body" }, detailColumns.map((column) => {
            return h("div", {
              key: `${tableName}-${rowKey}-${column}`,
              class: "aimd-rec-card__field",
            }, [
              renderMetadataLabel(column, getColumnDefinition(column), "aimd-rec-card__label", getColumnMeta(column)),
              renderValidatedCellControl(tableName, column, rowIndex, row, "aimd-rec-card__input"),
            ])
          })),
        ])
      })
    }

    onMounted(() => {
      if (!wrapperRef.value) return

      resizeObserver = new ResizeObserver(() => scheduleMeasure())
      resizeObserver.observe(wrapperRef.value)
      nextTick(() => settleInitialLayout())
    })

    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    })

    watch(() => props.columns, () => nextTick(() => scheduleMeasure()))
    watch(() => props.rows, () => nextTick(() => scheduleMeasure()), { deep: true })

    return () => {
      const tableName = props.node.id
      const columns = props.columns
      const rows = props.rows
      const disabled = props.disabled
      const messages = props.messages
      const tableMeta = getTableMeta()
      const tableMetaTitle = normalizeMetaString(tableMeta?.title)
      const tableDefinitionTitle = getAimdFieldTitle(props.node.definition)
      const tableHelp = getMetadataHelp(props.node.definition, tableMeta)
      const tableTitle = tableMetaTitle ?? getAimdFieldDisplayLabel(tableName, props.node.definition)
      const hasCustomTableTitle = (tableMetaTitle ?? tableDefinitionTitle) !== undefined && tableTitle !== tableName
      const hasTableHelp = Boolean(tableHelp.description) || tableHelp.examples.length > 0

      return h("div", {
        ref: wrapperRef,
        class: ["aimd-field aimd-field--var-table aimd-rec-inline-table", ...props.extraClasses],
        "data-aimd-table-name": tableName,
        "data-aimd-table-layout": layoutReady.value && isOverflow.value ? "cards" : "table",
      }, [
        h("div", { class: "aimd-field__header" }, [
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("var_table", messages)),
          h("span", {
            class: [
              "aimd-field__name",
              (hasCustomTableTitle || hasTableHelp) ? "aimd-field__name--with-metadata" : undefined,
              hasTableHelp ? "aimd-field__metadata-host" : undefined,
            ],
            tabindex: hasTableHelp ? 0 : undefined,
            "aria-label": tableHelp.tooltip || undefined,
          }, [
            h("span", { class: "aimd-field__title" }, tableTitle),
            hasCustomTableTitle ? h("span", { class: "aimd-field__key" }, tableName) : null,
            renderFieldMetadataPopover(tableHelp),
          ]),
          props.assignerControl || props.assignerStatus
            ? h("span", { class: "aimd-rec-inline-table__header-actions" }, [
                props.assignerControl
                  ? h("span", { class: "aimd-rec-inline-table__header-action" }, [props.assignerControl])
                  : null,
                props.assignerStatus
                  ? h("span", { class: "aimd-rec-inline-table__header-state" }, [props.assignerStatus])
                  : null,
              ])
            : null,
        ]),
        props.assignerError
          ? h("div", { class: "aimd-rec-inline__assigner-error aimd-rec-inline-table__assigner-error" }, props.assignerError)
          : null,
        h(Transition, {
          name: "aimd-table-layout-switch",
          mode: "out-in",
        }, {
          default: () => layoutReady.value && isOverflow.value
            ? h("div", {
                key: "cards",
                class: "aimd-rec-card-list",
              }, renderCardView(tableName, columns, rows, disabled, messages))
            : h("table", {
                key: "table",
                class: "aimd-field__table-preview aimd-rec-inline-table__table",
              }, [
                h("colgroup", [
                  h("col", { class: "aimd-rec-inline-table__drag-col" }),
                  ...columns.map(column => h("col", {
                    key: `${tableName}-col-${column}`,
                    style: { width: estimateColumnWidthStyle(column, rows) },
                  })),
                  h("col", { class: "aimd-rec-inline-table__action-col" }),
                ]),
                h("thead", [
                  h("tr", [
                    h("th", { class: "aimd-rec-inline-table__drag-head" }, [
                      h("span", { class: "aimd-rec-inline-table__row-head-label" }, "#"),
                    ]),
                    ...columns.map(column => h("th", {
                      class: [
                        "aimd-rec-inline-table__column-head",
                        `aimd-rec-inline-table__column-head--${resolveColumnSizingKind(column, getColumnDisplayLabel(column))}`,
                      ],
                      scope: "col",
                      "data-column-kind": resolveColumnSizingKind(column, getColumnDisplayLabel(column)),
                      "data-column-id": column,
                    }, [
                      renderMetadataLabel(column, getColumnDefinition(column), "aimd-rec-inline-table__column-label", getColumnMeta(column)),
                    ])),
                    h("th", { class: "aimd-rec-inline-table__action-head" }, messages.table.actionColumn),
                  ]),
                ]),
                h("tbody", rows.map((row, rowIndex) => {
                  const rowKey = getVarTableRowKey(row)
                  return h("tr", {
                    key: `${tableName}-${rowKey}`,
                    class: [
                      "aimd-rec-inline-table__row",
                      rowIndex % 2 === 1 ? "aimd-rec-inline-table__row--alt" : "",
                      props.settlingRowKey === rowKey ? "aimd-rec-inline-table__row--settling" : "",
                    ],
                    onDragover: (event: DragEvent) => emit("drag-over", { tableName, rowIndex, event }),
                    onDrop: (event: DragEvent) => emit("drag-drop", { tableName, rowIndex, columns, event }),
                  }, [
                    h("td", { class: "aimd-rec-inline-table__drag-cell" }, [
                      h("span", { class: "aimd-rec-inline-table__row-control" }, [
                        renderRowNumber(rowIndex),
                        h("span", {
                          class: [
                            "aimd-rec-inline-table__drag-handle",
                            props.readonly ? "aimd-rec-inline-table__drag-handle--disabled" : "",
                          ],
                          title: props.readonly ? messages.table.dragDisabled : messages.table.dragReorder,
                          draggable: !props.readonly,
                          onDragstart: (event: DragEvent) => emit("drag-start", { tableName, rowIndex, event }),
                          onDragend: () => emit("drag-end"),
                        }, Array.from({ length: 6 }, (_, dotIndex) => h("span", {
                          key: `${rowKey}-drag-dot-${dotIndex}`,
                          class: "aimd-rec-inline-table__drag-dot",
                        }))),
                      ]),
                    ]),
                    ...columns.map(column => h("td", {
                      key: `${tableName}-${rowIndex}-${column}`,
                      class: [
                        "aimd-rec-inline-table__value-cell",
                        `aimd-rec-inline-table__value-cell--${resolveColumnSizingKind(column, getColumnDisplayLabel(column))}`,
                      ],
                      "data-column-label": column,
                      "data-column-kind": resolveColumnSizingKind(column, getColumnDisplayLabel(column)),
                    }, [
                      (() => {
                        const sizingKind = resolveColumnSizingKind(column)
                        const cellClass = [
                          "aimd-rec-table-cell-input",
                          `aimd-rec-table-cell-input--${sizingKind}`,
                        ]
                        return renderValidatedCellControl(tableName, column, rowIndex, row, cellClass)
                      })(),
                    ])),
                    h("td", { class: "aimd-rec-inline-table__action-cell" }, [
                      h("button", {
                        type: "button",
                        class: "aimd-rec-inline-table__icon-btn",
                        disabled: disabled || rows.length <= 1,
                        "aria-label": messages.table.deleteRow,
                        title: messages.table.deleteRow,
                        onClick: () => emit("remove-row", { tableName, rowIndex, columns }),
                      }, [renderTrashIcon()]),
                    ]),
                  ])
                })),
              ]),
        }),
        h("div", { class: "aimd-rec-inline-table__actions" }, [
          h("button", {
            type: "button",
            class: "aimd-rec-inline-table__add-btn",
            disabled,
            onClick: () => emit("add-row", { tableName, columns }),
          }, `+ ${messages.table.addRow}`),
        ]),
      ])
    }
  },
})
</script>

<style>
.aimd-table-layout-switch-enter-active,
.aimd-table-layout-switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.2s ease;
}

.aimd-table-layout-switch-enter-from,
.aimd-table-layout-switch-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
  filter: blur(2px);
}
</style>
