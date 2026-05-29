import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import {
  createCodeBlockRenderer,
  loadShikiHighlighter,
  type ElementRenderer,
  type ShikiHighlighter,
} from '@airalogy/aimd-renderer'

export function createChainedElementRenderer(...renderers: ElementRenderer[]): ElementRenderer {
  return (node, children, ctx) => {
    for (const renderer of renderers) {
      const rendered = renderer(node, children, ctx)
      if (rendered !== null && rendered !== undefined) {
        return rendered
      }
    }
    return null
  }
}

export function useCodeBlockRendering(onHighlighterReady?: () => void) {
  const highlighter = shallowRef<ShikiHighlighter | null>(null)
  let cancelled = false
  const preRenderer = createCodeBlockRenderer(() => highlighter.value, {
    theme: 'github-light',
    lineNumbers: true,
    wrap: true,
  })

  onMounted(() => {
    void loadShikiHighlighter()
      .then((loadedHighlighter) => {
        if (cancelled) {
          return
        }
        highlighter.value = loadedHighlighter
        onHighlighterReady?.()
      })
      .catch(() => {
        // Keep the non-highlighted renderer. Line numbers and wrapping still work.
      })
  })

  onBeforeUnmount(() => {
    cancelled = true
  })

  return {
    preRenderer,
  }
}
