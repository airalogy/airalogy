/**
 * Focus snapshot / restore utilities for AIMD inline editing.
 *
 * When the VNode tree is rebuilt (e.g. after a content change),
 * we capture the currently focused element's key and selection state,
 * then restore it after the new tree is mounted.
 */

export interface FocusSnapshot {
  key: string
  selectionStart?: number | null
  selectionEnd?: number | null
  selectionDirection?: HTMLInputElement["selectionDirection"]
  scrollTargets?: Array<{
    element: HTMLElement
    top: number
    left: number
  }>
  windowScrollX?: number
  windowScrollY?: number
}

function isScrollableElement(element: HTMLElement): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const style = window.getComputedStyle(element)
  const overflowY = style.overflowY || style.overflow
  const overflowX = style.overflowX || style.overflow
  const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight
  const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && element.scrollWidth > element.clientWidth
  return canScrollY || canScrollX
}

function collectScrollTargets(contentRoot: HTMLElement, activeElement: HTMLElement): FocusSnapshot["scrollTargets"] {
  const targets: FocusSnapshot["scrollTargets"] = []
  const seen = new Set<HTMLElement>()

  const collectFrom = (start: HTMLElement | null) => {
    let current = start
    while (current && current !== document.body) {
      if (!seen.has(current) && isScrollableElement(current)) {
        seen.add(current)
        targets.push({
          element: current,
          top: current.scrollTop,
          left: current.scrollLeft,
        })
      }
      current = current.parentElement
    }
  }

  collectFrom(activeElement)
  collectFrom(contentRoot)

  return targets.length ? targets : undefined
}

/**
 * Capture the focus state of the currently active element inside `contentRoot`.
 * Returns `null` if nothing relevant is focused.
 */
export function captureFocusSnapshot(contentRoot: HTMLElement | null): FocusSnapshot | null {
  if (typeof document === "undefined" || !contentRoot) {
    return null
  }

  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement) || !contentRoot.contains(activeElement)) {
    return null
  }

  const key = activeElement.dataset.recFocusKey
  if (!key) {
    return null
  }

  const snapshot: FocusSnapshot = { key }
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    snapshot.selectionStart = activeElement.selectionStart
    snapshot.selectionEnd = activeElement.selectionEnd
    snapshot.selectionDirection = activeElement.selectionDirection
  }
  snapshot.scrollTargets = collectScrollTargets(contentRoot, activeElement)
  snapshot.windowScrollX = window.scrollX
  snapshot.windowScrollY = window.scrollY

  return snapshot
}

/**
 * Restore focus (and optionally selection) to the element matching the snapshot key.
 */
export function restoreFocusSnapshot(contentRoot: HTMLElement | null, snapshot: FocusSnapshot | null) {
  if (!snapshot || !contentRoot) {
    return
  }

  const candidates = contentRoot.querySelectorAll<HTMLElement>("[data-rec-focus-key]")
  let target: HTMLElement | null = null
  for (let index = 0; index < candidates.length; index += 1) {
    if (candidates[index].dataset.recFocusKey === snapshot.key) {
      target = candidates[index]
      break
    }
  }

  if (!target) {
    return
  }

  try {
    target.focus({ preventScroll: true })
  } catch {
    target.focus()
  }

  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart != null &&
    snapshot.selectionEnd != null
  ) {
    try {
      target.setSelectionRange(
        snapshot.selectionStart,
        snapshot.selectionEnd,
        snapshot.selectionDirection ?? undefined,
      )
    } catch {
      // Some input types (e.g. number, date) don't support setSelectionRange
    }
  }

  for (const scrollTarget of snapshot.scrollTargets ?? []) {
    scrollTarget.element.scrollTop = scrollTarget.top
    scrollTarget.element.scrollLeft = scrollTarget.left
  }

  if (typeof window !== "undefined") {
    window.scrollTo(snapshot.windowScrollX ?? window.scrollX, snapshot.windowScrollY ?? window.scrollY)
  }
}
