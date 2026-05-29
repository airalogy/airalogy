import { nextTick, ref, type Ref } from 'vue'

export type MonacoAutoHeightEditor = {
  getContentHeight?: () => number
  layout?: (dimension?: { width: number; height: number }) => void
  onDidContentSizeChange?: (listener: (event: { contentHeight: number }) => void) => { dispose: () => void }
}

export type MonacoAutoHeightOptions = {
  getInitialValue: () => string
  getLayoutElement: () => HTMLElement | null
  lineHeight?: number
  verticalPadding?: number
  minHeight?: number
  maxHeight?: number
  estimatedCharsPerLine?: number
}

export type MonacoAutoHeightController = {
  editorHeight: Ref<number>
  lineHeight: number
  minHeight: number
  maxHeight: number
  attachEditor: (editor: MonacoAutoHeightEditor) => void
  dispose: () => void
  estimateEditorHeight: (value: string) => number
  layoutEditor: () => void
  setEditorHeight: (height: number) => void
  syncEstimatedEditorHeight: (value?: string) => void
  syncMeasuredEditorHeight: () => void
}

const DEFAULT_LINE_HEIGHT = 21
const DEFAULT_VERTICAL_PADDING = 24
const DEFAULT_ESTIMATED_CHARS_PER_LINE = 96

export function estimateMonacoVisualLineCount(value: string, estimatedCharsPerLine = DEFAULT_ESTIMATED_CHARS_PER_LINE): number {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  return lines.reduce((total, line) => {
    const length = Array.from(line).length
    return total + Math.max(1, Math.ceil(length / estimatedCharsPerLine))
  }, 0)
}

export function createMonacoAutoHeight(options: MonacoAutoHeightOptions): MonacoAutoHeightController {
  const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT
  const verticalPadding = options.verticalPadding ?? DEFAULT_VERTICAL_PADDING
  const minHeight = options.minHeight ?? lineHeight + verticalPadding
  const maxHeight = options.maxHeight ?? 560
  const estimatedCharsPerLine = options.estimatedCharsPerLine ?? DEFAULT_ESTIMATED_CHARS_PER_LINE
  const editorHeight = ref(estimateEditorHeight(options.getInitialValue()))

  let editor: MonacoAutoHeightEditor | null = null
  let contentSizeDisposable: { dispose: () => void } | null = null

  function clampEditorHeight(height: number): number {
    return Math.max(minHeight, Math.min(maxHeight, Math.ceil(height)))
  }

  function estimateEditorHeight(value: string): number {
    return clampEditorHeight((estimateMonacoVisualLineCount(value, estimatedCharsPerLine) * lineHeight) + verticalPadding)
  }

  function layoutEditor() {
    if (!editor?.layout) {
      return
    }

    const width = options.getLayoutElement()?.clientWidth ?? 0
    if (width > 0) {
      editor.layout({ width, height: editorHeight.value })
      return
    }

    editor.layout()
  }

  function setEditorHeight(height: number) {
    const nextHeight = clampEditorHeight(height)
    if (nextHeight === editorHeight.value) {
      return
    }

    editorHeight.value = nextHeight
    void nextTick(layoutEditor)
  }

  function syncEstimatedEditorHeight(value = options.getInitialValue()) {
    setEditorHeight(estimateEditorHeight(value))
  }

  function syncMeasuredEditorHeight() {
    const contentHeight = editor?.getContentHeight?.()
    if (typeof contentHeight === 'number' && Number.isFinite(contentHeight)) {
      setEditorHeight(contentHeight)
    }
  }

  function attachEditor(nextEditor: MonacoAutoHeightEditor) {
    contentSizeDisposable?.dispose()
    editor = nextEditor
    contentSizeDisposable = editor.onDidContentSizeChange?.((event) => {
      setEditorHeight(event.contentHeight)
    }) ?? null
    syncMeasuredEditorHeight()
  }

  function dispose() {
    contentSizeDisposable?.dispose()
    contentSizeDisposable = null
    editor = null
  }

  return {
    editorHeight,
    lineHeight,
    minHeight,
    maxHeight,
    attachEditor,
    dispose,
    estimateEditorHeight,
    layoutEditor,
    setEditorHeight,
    syncEstimatedEditorHeight,
    syncMeasuredEditorHeight,
  }
}
