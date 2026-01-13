import DefaultTheme from 'vitepress/theme'
import { nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import './style.css'

// Auto-wrap indent: compute per-line indent and expose as CSS variable.
const CODE_LINE_SELECTOR = ".vp-doc div[class*='language-'] pre code .line"
const WRAP_CLASS = 'code-line'

function getTabSize(element) {
  const styles = window.getComputedStyle(element)
  const value = styles.tabSize || styles.getPropertyValue('tab-size')
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4
}

function computeIndentColumns(indent, tabSize) {
  let columns = 0

  for (let i = 0; i < indent.length; i += 1) {
    const ch = indent[i]
    if (ch === '\t') {
      const remaining = columns % tabSize
      columns += remaining === 0 ? tabSize : tabSize - remaining
    } else {
      columns += 1
    }
  }

  return columns
}

function ensureWrapContainer(line) {
  const firstElement = line.firstElementChild
  if (firstElement && firstElement.classList.contains(WRAP_CLASS)) {
    return firstElement
  }

  const wrapper = document.createElement('span')
  wrapper.className = WRAP_CLASS

  while (line.firstChild) {
    wrapper.appendChild(line.firstChild)
  }

  line.appendChild(wrapper)
  return wrapper
}

function applyWrapIndent() {
  if (typeof document === 'undefined') {
    return
  }

  const lines = document.querySelectorAll(CODE_LINE_SELECTOR)
  if (!lines.length) {
    return
  }

  lines.forEach((line) => {
    // Wrap line content so padding/text-indent only affects the code text.
    const wrapper = ensureWrapContainer(line)
    const text = wrapper.textContent || ''
    const match = text.match(/^[\t \u00a0]+/)

    if (!match) {
      line.style.removeProperty('--vp-code-wrap-indent')
      return
    }

    const indentText = match[0].replace(/\u00a0/g, ' ')
    const tabSize = getTabSize(line)
    const columns = computeIndentColumns(indentText, tabSize)

    // Expose indent in ch so CSS can align wrapped visual lines.
    line.style.setProperty('--vp-code-wrap-indent', `${columns}ch`)
  })
}

export default {
  ...DefaultTheme,
  setup() {
    const route = useRoute()
    const schedule = () => nextTick(() => applyWrapIndent())

    DefaultTheme.setup?.()
    onMounted(() => schedule())
    watch(() => route.path, () => schedule())
  }
}
