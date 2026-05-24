<script lang="ts">
import { Transition, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNode } from "vue"
import type { AimdVarTableNode } from "@airalogy/aimd-core/types"
import type { AimdFieldMeta, AimdFieldState } from "../types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import { getVarTableColumns, getVarTableRowKey } from "../composables/useVarTableDragDrop"

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

function estimateDisplayWidth(value: unknown): number {
  const text = String(value ?? "")
  let width = 0
  for (const char of text) {
    width += (char.codePointAt(0) ?? 0) > 0xFF ? 2 : 1
  }
  return width
}

type ColumnSizingKind = "compact" | "default" | "wide"

function resolveColumnSizingKind(column: string): ColumnSizingKind {
  const normalizedColumn = column.trim().toLowerCase()

  if (
    /^(id|no|num|qty|amount|count|index|step|day|time|min|max|ph|temp|volume|mass|weight|age)$/.test(normalizedColumn)
    || /^(编号|数量|序号|步数|天数|时间|分钟|最大|最小|温度|体积|质量|重量|年龄)$/.test(column.trim())
  ) {
    return "compact"
  }

  if (
    /note|remark|comment|description|summary|title|name|result|detail|observation/.test(normalizedColumn)
    || /备注|说明|描述|总结|标题|名称|结果|详情|观察/.test(column)
  ) {
    return "wide"
  }

  return "default"
}

export default defineComponent({
  name: "AimdVarTableField",
  props: {
    node: { type: Object as PropType<AimdVarTableNode>, required: true },
    rows: { type: Array as PropType<Record<string, string>[]>, required: true },
    columns: { type: Array as PropType<string[]>, required: true },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    settlingRowKey: { type: String as PropType<string | null>, default: null },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
    fieldMeta: { type: Object as PropType<Record<string, AimdFieldMeta> | undefined>, default: undefined },
    fieldState: { type: Object as PropType<Record<string, AimdFieldState> | undefined>, default: undefined },
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

    function estimateColumnWidthCh(column: string, rows: Record<string, string>[]): number {
      const contentWidth = rows.reduce((maxWidth, row) => {
        return Math.max(maxWidth, estimateDisplayWidth(row[column]))
      }, estimateDisplayWidth(column))

      const kind = resolveColumnSizingKind(column)

      if (kind === "compact") {
        return Math.max(7, Math.min(12, contentWidth + 2))
      }

      if (kind === "wide") {
        return Math.max(16, Math.min(42, contentWidth + 5))
      }

      return Math.max(10, Math.min(22, contentWidth + 4))
    }

    function estimateTableWidthPx(columns: string[], rows: Record<string, string>[]): number {
      const CHARACTER_PX = 8.2
      const CELL_HORIZONTAL_PADDING_PX = 24
      const dragColumnPx = 44
      const actionColumnPx = 64

      const contentColumnsPx = columns.reduce((total, column) => {
        return total + estimateColumnWidthCh(column, rows) * CHARACTER_PX + CELL_HORIZONTAL_PADDING_PX
      }, 0)

      return dragColumnPx + actionColumnPx + contentColumnsPx
    }

    function estimateColumnWidthStyle(column: string, rows: Record<string, string>[]): string {
      return `${estimateColumnWidthCh(column, rows)}ch`
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

      const estimatedWidth = estimateTableWidthPx(props.columns, props.rows)
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
                h("span", { class: "aimd-rec-card__label" }, titleColumn),
                h("input", {
                  "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${titleColumn}`,
                  class: "aimd-rec-card__input",
                  disabled: isColumnDisabled(titleColumn),
                  placeholder: titleColumn,
                  value: row[titleColumn] ?? "",
                  onInput: (event: Event) => {
                    emit("cell-input", {
                      tableName,
                      column: titleColumn,
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
                      column: titleColumn,
                      rowIndex,
                      text,
                    })
                  },
                  onBlur: () => emit("cell-blur", { tableName, column: titleColumn }),
                }),
              ])
            : null,
          h("div", { class: "aimd-rec-card__body" }, detailColumns.map((column) => {
            const colState = props.fieldState?.[`var_table:${tableName}:${column}`]
            const inputClass = colState?.validationError
              ? "aimd-rec-card__input aimd-rec-card__input--error"
              : "aimd-rec-card__input"

            return h("div", {
              key: `${tableName}-${rowKey}-${column}`,
              class: "aimd-rec-card__field",
            }, [
              h("span", { class: "aimd-rec-card__label" }, column),
              h("input", {
                "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${column}`,
                class: inputClass,
                disabled: isColumnDisabled(column),
                placeholder: column,
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
                onBlur: () => emit("cell-blur", { tableName, column }),
              }),
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

      return h("div", {
        ref: wrapperRef,
        class: "aimd-field aimd-field--var-table aimd-rec-inline-table",
        "data-aimd-table-name": tableName,
        "data-aimd-table-layout": layoutReady.value && isOverflow.value ? "cards" : "table",
      }, [
        h("div", { class: "aimd-field__header" }, [
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("var_table", messages)),
          h("span", { class: "aimd-field__name" }, tableName),
        ]),
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
                    h("th", { class: "aimd-rec-inline-table__drag-head" }, ""),
                    ...columns.map(column => h("th", {
                      class: [
                        "aimd-rec-inline-table__column-head",
                        `aimd-rec-inline-table__column-head--${resolveColumnSizingKind(column)}`,
                      ],
                      scope: "col",
                      "data-column-kind": resolveColumnSizingKind(column),
                    }, column)),
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
                    ...columns.map(column => h("td", {
                      key: `${tableName}-${rowIndex}-${column}`,
                      class: [
                        "aimd-rec-inline-table__value-cell",
                        `aimd-rec-inline-table__value-cell--${resolveColumnSizingKind(column)}`,
                      ],
                      "data-column-label": column,
                      "data-column-kind": resolveColumnSizingKind(column),
                    }, [
                      (() => {
                        const colState = props.fieldState?.[`var_table:${tableName}:${column}`]
                        const sizingKind = resolveColumnSizingKind(column)
                        const cellClass = colState?.validationError
                          ? [
                              "aimd-rec-table-cell-input",
                              `aimd-rec-table-cell-input--${sizingKind}`,
                              "aimd-rec-table-cell-input--error",
                            ]
                          : [
                              "aimd-rec-table-cell-input",
                              `aimd-rec-table-cell-input--${sizingKind}`,
                            ]
                        return h("input", {
                          "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${column}`,
                          class: cellClass,
                          disabled: isColumnDisabled(column),
                          placeholder: column,
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
                          onBlur: () => emit("cell-blur", { tableName, column }),
                        })
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
