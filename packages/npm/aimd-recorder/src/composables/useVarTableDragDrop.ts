import type { AimdProtocolRecordData } from "../types"
import { normalizeVarTableRows, createEmptyVarTableRow } from "./useRecordState"
import type { AimdVarTableNode } from "@airalogy/aimd-core/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VarTableDragState {
  tableName: string
  rowIndex: number
}

// ---------------------------------------------------------------------------
// Row key management
// ---------------------------------------------------------------------------

const varTableRowKeyMap = new WeakMap<object, string>()
let nextVarTableRowKeyId = 0

export function getVarTableRowKey(row: Record<string, string>): string {
  const existing = varTableRowKeyMap.get(row)
  if (existing) {
    return existing
  }

  const key = `vt-row-${nextVarTableRowKeyId}`
  nextVarTableRowKeyId += 1
  varTableRowKeyMap.set(row, key)
  return key
}

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------

export function getVarTableColumns(node: AimdVarTableNode): string[] {
  if (Array.isArray(node.columns) && node.columns.length > 0) return node.columns
  const subvars = node.definition?.subvars
  if (subvars && typeof subvars === "object") return Object.keys(subvars)
  return []
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface VarTableDragDropOptions {
  readonly: () => boolean
  localRecord: AimdProtocolRecordData
  markRecordChanged: (options?: { rebuild?: boolean, runClientAssigners?: boolean }) => void
  scheduleInlineRebuild: () => void
  emitTableAddRow: (payload: { tableName: string, columns: string[] }) => void
  emitTableRemoveRow: (payload: { tableName: string, rowIndex: number, columns: string[] }) => void
}

export function useVarTableDragDrop(options: VarTableDragDropOptions) {
  const {
    readonly: isReadonly,
    localRecord,
    markRecordChanged,
    scheduleInlineRebuild,
    emitTableAddRow,
    emitTableRemoveRow,
  } = options

  // ── Drag state ──────────────────────────────────────────────────────────
  let draggingVarTableRow: VarTableDragState | null = null
  let dragOverVarTableRowElement: HTMLTableRowElement | null = null
  let draggingVarTableHandleElement: HTMLElement | null = null
  let draggingVarTableRowElement: HTMLTableRowElement | null = null
  let draggingVarTableTableElement: HTMLTableElement | null = null
  let settlingVarTableRowKey: string | null = null
  let varTableDropAnimationTimer: ReturnType<typeof setTimeout> | null = null

  // ── Table row helpers ───────────────────────────────────────────────────

  function ensureVarTableRows(tableName: string, columns: string[]): Record<string, string>[] {
    const normalized = normalizeVarTableRows(localRecord.var[tableName], columns)
    localRecord.var[tableName] = normalized
    return normalized
  }

  function addVarTableRow(tableName: string, columns: string[]) {
    const rows = ensureVarTableRows(tableName, columns)
    rows.push(createEmptyVarTableRow(columns))
    markRecordChanged({ rebuild: true, runClientAssigners: true })
    emitTableAddRow({ tableName, columns })
  }

  function moveVarTableRow(tableName: string, fromIndex: number, toIndex: number, columns: string[]) {
    const rows = ensureVarTableRows(tableName, columns)
    if (
      fromIndex === toIndex
      || fromIndex < 0
      || toIndex < 0
      || fromIndex >= rows.length
      || toIndex >= rows.length
    ) {
      return
    }

    const moved = rows.splice(fromIndex, 1)[0]
    rows.splice(toIndex, 0, moved)
    settlingVarTableRowKey = getVarTableRowKey(moved)
    if (varTableDropAnimationTimer) {
      clearTimeout(varTableDropAnimationTimer)
    }
    varTableDropAnimationTimer = setTimeout(() => {
      settlingVarTableRowKey = null
      varTableDropAnimationTimer = null
      scheduleInlineRebuild()
    }, 520)
    markRecordChanged({ rebuild: true, runClientAssigners: true })
  }

  function removeVarTableRow(tableName: string, rowIndex: number, columns: string[]) {
    const rows = ensureVarTableRows(tableName, columns)
    if (rows.length <= 1) return
    rows.splice(rowIndex, 1)
    markRecordChanged({ rebuild: true, runClientAssigners: true })
    emitTableRemoveRow({ tableName, rowIndex, columns })
  }

  // ── Drag preview ────────────────────────────────────────────────────────

  function clearVarTableDragPreview() {
    if (dragOverVarTableRowElement) {
      dragOverVarTableRowElement.classList.remove("aimd-rec-inline-table__row--drag-over")
      dragOverVarTableRowElement = null
    }

    if (draggingVarTableHandleElement) {
      draggingVarTableHandleElement.classList.remove("aimd-rec-inline-table__drag-handle--dragging")
      draggingVarTableHandleElement = null
    }

    if (draggingVarTableRowElement) {
      draggingVarTableRowElement.classList.remove("aimd-rec-inline-table__row--dragging-source")
      draggingVarTableRowElement = null
    }

    if (draggingVarTableTableElement) {
      draggingVarTableTableElement.classList.remove("aimd-rec-inline-table__table--dragging")
      draggingVarTableTableElement = null
    }
  }

  function updateVarTableDragPreview(target: EventTarget | null) {
    const nextElement = target instanceof HTMLTableRowElement ? target : null
    if (dragOverVarTableRowElement === nextElement) {
      return
    }

    if (dragOverVarTableRowElement) {
      dragOverVarTableRowElement.classList.remove("aimd-rec-inline-table__row--drag-over")
    }

    dragOverVarTableRowElement = nextElement
    dragOverVarTableRowElement?.classList.add("aimd-rec-inline-table__row--drag-over")
  }

  // ── Drag event handlers ─────────────────────────────────────────────────

  function startVarTableRowDrag(tableName: string, rowIndex: number, event: DragEvent) {
    if (isReadonly()) {
      return
    }

    draggingVarTableRow = { tableName, rowIndex }
    draggingVarTableHandleElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    draggingVarTableRowElement = draggingVarTableHandleElement?.closest("tr") as HTMLTableRowElement | null
    draggingVarTableTableElement = draggingVarTableHandleElement?.closest("table") as HTMLTableElement | null
    draggingVarTableHandleElement?.classList.add("aimd-rec-inline-table__drag-handle--dragging")
    draggingVarTableRowElement?.classList.add("aimd-rec-inline-table__row--dragging-source")
    draggingVarTableTableElement?.classList.add("aimd-rec-inline-table__table--dragging")

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", `${tableName}:${rowIndex}`)
    }
  }

  function handleVarTableRowDragOver(tableName: string, rowIndex: number, event: DragEvent) {
    if (!draggingVarTableRow || draggingVarTableRow.tableName !== tableName) {
      return
    }

    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move"
    }

    if (draggingVarTableRow.rowIndex === rowIndex) {
      updateVarTableDragPreview(null)
      return
    }

    updateVarTableDragPreview(event.currentTarget)
  }

  function handleVarTableRowDrop(tableName: string, rowIndex: number, columns: string[], event: DragEvent) {
    if (!draggingVarTableRow || draggingVarTableRow.tableName !== tableName) {
      clearVarTableDragPreview()
      draggingVarTableRow = null
      return
    }

    event.preventDefault()
    const { rowIndex: fromIndex } = draggingVarTableRow
    clearVarTableDragPreview()
    draggingVarTableRow = null
    moveVarTableRow(tableName, fromIndex, rowIndex, columns)
  }

  function endVarTableRowDrag() {
    clearVarTableDragPreview()
    draggingVarTableRow = null
  }

  function getSettlingVarTableRowKey(): string | null {
    return settlingVarTableRowKey
  }

  return {
    ensureVarTableRows,
    addVarTableRow,
    moveVarTableRow,
    removeVarTableRow,
    startVarTableRowDrag,
    handleVarTableRowDragOver,
    handleVarTableRowDrop,
    endVarTableRowDrag,
    getSettlingVarTableRowKey,
  }
}
