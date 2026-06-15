const INTERNAL_REF_SELECTOR = '.aimd-ref[data-aimd-ref-target], .aimd-ref[data-aimd-ref]'
const INTERNAL_REF_ROOT_SELECTOR = '.examples-workbench, .examples-panel, .tab-content, .render-preview, .examples-render-preview'

function getRefElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(INTERNAL_REF_SELECTOR)
    : null
}

function getTargetElementId(refElement: HTMLElement): string | null {
  const target = refElement.dataset.aimdRefTarget || refElement.dataset.aimdRef
  if (!target) {
    return null
  }

  switch (refElement.dataset.aimdRefKind || refElement.dataset.aimdType) {
    case 'step':
    case 'ref_step':
      return `step-${target}`
    case 'var':
    case 'ref_var':
      return `var-${target}`
    case 'fig':
    case 'ref_fig':
      return `fig-${target}`
    default:
      return null
  }
}

function findElementById(root: ParentNode, id: string): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('[id]'))
  return candidates.find(element => element.id === id) ?? null
}

function canScroll(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const overflowY = style.overflowY
  return (
    element.scrollHeight > element.clientHeight
    && (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
  )
}

function findScrollContainer(target: HTMLElement, root: HTMLElement): HTMLElement {
  let current: HTMLElement | null = target.parentElement

  while (current && current !== root) {
    if (canScroll(current)) {
      return current
    }
    current = current.parentElement
  }

  return canScroll(root) ? root : (root.closest<HTMLElement>('.aimd-recorder-workbench__panel-body--recorder, .examples-panel') ?? root)
}

function scrollTargetIntoContainer(target: HTMLElement, container: HTMLElement): void {
  const targetRect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const targetCenter = targetRect.top - containerRect.top + container.scrollTop + targetRect.height / 2
  const nextScrollTop = Math.max(0, targetCenter - container.clientHeight / 2)

  container.scrollTo({
    top: nextScrollTop,
    behavior: 'smooth',
  })
}

function scrollToInternalRefTarget(refElement: HTMLElement): boolean {
  const targetId = getTargetElementId(refElement)
  if (!targetId) {
    return false
  }

  const root = refElement.closest<HTMLElement>(INTERNAL_REF_ROOT_SELECTOR)
  const target = (root ? findElementById(root, targetId) : null) ?? document.getElementById(targetId)
  if (!target) {
    return false
  }

  const scrollRoot = root ?? document.documentElement
  const scrollContainer = findScrollContainer(target, scrollRoot)
  scrollTargetIntoContainer(target, scrollContainer)
  target.classList.add('aimd-internal-ref-target--active')
  window.setTimeout(() => {
    target.classList.remove('aimd-internal-ref-target--active')
  }, 1200)
  return true
}

export function handleAimdInternalRefClick(event: MouseEvent): void {
  const refElement = getRefElement(event.target)
  if (!refElement) {
    return
  }

  if (scrollToInternalRefTarget(refElement)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

export function handleAimdInternalRefKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  const refElement = getRefElement(event.target)
  if (!refElement) {
    return
  }

  if (scrollToInternalRefTarget(refElement)) {
    event.preventDefault()
    event.stopPropagation()
  }
}
