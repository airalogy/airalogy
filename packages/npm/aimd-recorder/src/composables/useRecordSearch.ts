import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import {
  collectAimdRecordFieldRefs,
  searchAimdRecordFields,
  type AimdRecordFieldRef,
  type AimdRecordSearchMatch,
} from "@airalogy/aimd-core/utils"
import type { AimdRecorderMessages } from "../locales"
import type { AimdProtocolRecordData } from "../types"

interface UseRecordSearchOptions {
  contentRoot: Ref<HTMLElement | null>
  defaultExpanded: boolean
  fields: Ref<ExtractedAimdFields>
  messages: Ref<AimdRecorderMessages>
  onVisualStateChange: () => void
  record: AimdProtocolRecordData
}

function getMatchFieldKeys(match: AimdRecordSearchMatch): string[] {
  return match.field.parentKey ? [match.field.key, match.field.parentKey] : [match.field.key]
}

function isTextControl(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  return (
    (typeof HTMLInputElement !== "undefined" && element instanceof HTMLInputElement)
    || (typeof HTMLTextAreaElement !== "undefined" && element instanceof HTMLTextAreaElement)
  )
}

function getFocusableElement(target: HTMLElement): HTMLElement {
  if (target.matches("input, textarea, select, button, [tabindex]:not([tabindex='-1'])")) {
    return target
  }
  return target.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]:not([tabindex='-1'])") ?? target
}

function getTextControl(target: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (isTextControl(target)) {
    return target
  }
  return target.querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea, input")
}

export function useRecordSearch(options: UseRecordSearchOptions) {
  const query = ref("")
  const fieldKey = ref("")
  const activeMatchIndex = ref(0)
  const expanded = ref(options.defaultExpanded)
  const pulseFieldKeys = ref<Set<string>>(new Set())
  let pulseTimer: ReturnType<typeof setTimeout> | null = null

  const fieldRefs = computed<AimdRecordFieldRef[]>(() => collectAimdRecordFieldRefs(options.fields.value))
  const hasCriteria = computed(() => Boolean(query.value.trim() || fieldKey.value))
  const panelVisible = computed(() => expanded.value || hasCriteria.value)
  const matches = computed(() => searchAimdRecordFields(
    options.record,
    query.value,
    fieldRefs.value,
    {
      fieldKeys: fieldKey.value ? [fieldKey.value] : undefined,
      includeFieldLabels: true,
    },
  ))
  const activeMatch = computed(() => {
    if (matches.value.length === 0) {
      return null
    }
    const index = Math.min(Math.max(activeMatchIndex.value, 0), matches.value.length - 1)
    return matches.value[index] ?? null
  })
  const matchedFieldKeys = computed(() => {
    const keys = new Set<string>()
    for (const match of matches.value) {
      for (const key of getMatchFieldKeys(match)) {
        keys.add(key)
      }
    }
    return keys
  })
  const activeFieldKeys = computed(() => {
    const keys = new Set<string>()
    const match = activeMatch.value
    if (match) {
      for (const key of getMatchFieldKeys(match)) {
        keys.add(key)
      }
    }
    return keys
  })
  const resultLabel = computed(() => {
    const total = matches.value.length
    if (!query.value.trim()) {
      return ""
    }
    if (total === 0) {
      return options.messages.value.search.noMatches
    }
    return options.messages.value.search.matchCount(activeMatchIndex.value + 1, total)
  })

  function getFieldClasses(targetFieldKey: string): string[] {
    if (!query.value.trim()) {
      return []
    }

    const classes: string[] = []
    if (matchedFieldKeys.value.has(targetFieldKey)) {
      classes.push("aimd-field--record-search-match")
    }
    if (activeFieldKeys.value.has(targetFieldKey)) {
      classes.push("aimd-field--record-search-active")
    }
    if (pulseFieldKeys.value.has(targetFieldKey)) {
      classes.push("aimd-field--record-search-pulse")
    }
    return classes
  }

  function findFocusTarget(focusKey: string): HTMLElement | null {
    if (!options.contentRoot.value) {
      return null
    }
    const candidates = options.contentRoot.value.querySelectorAll<HTMLElement>("[data-rec-focus-key]")
    for (let index = 0; index < candidates.length; index += 1) {
      if (candidates[index].dataset.recFocusKey === focusKey) {
        return candidates[index]
      }
    }
    for (let index = 0; index < candidates.length; index += 1) {
      const candidateKey = candidates[index].dataset.recFocusKey
      if (candidateKey?.startsWith(`${focusKey}:`)) {
        return candidates[index]
      }
    }
    return null
  }

  function selectTextMatch(target: HTMLElement, match: AimdRecordSearchMatch) {
    const control = getTextControl(target)
    if (!control) {
      return
    }

    const needle = query.value.trim()
    if (!needle) {
      return
    }

    const sourceText = control.value || match.text
    const haystack = sourceText.toLocaleLowerCase()
    const start = haystack.indexOf(needle.toLocaleLowerCase())
    if (start < 0) {
      return
    }

    try {
      control.setSelectionRange(start, start + needle.length)
    }
    catch {
      // Some input types do not support text selection. Focusing the control is still useful.
    }
  }

  function pulseMatch(match: AimdRecordSearchMatch) {
    if (pulseTimer) {
      clearTimeout(pulseTimer)
      pulseTimer = null
    }

    pulseFieldKeys.value = new Set()
    void nextTick().then(() => {
      pulseFieldKeys.value = new Set(getMatchFieldKeys(match))
      pulseTimer = setTimeout(() => {
        pulseFieldKeys.value = new Set()
        pulseTimer = null
      }, 680)
    })
  }

  async function focusMatch(index: number) {
    if (matches.value.length === 0) {
      return
    }

    const total = matches.value.length
    activeMatchIndex.value = ((index % total) + total) % total
    await nextTick()

    const match = matches.value[activeMatchIndex.value]
    if (!match) {
      return
    }

    const target = findFocusTarget(match.field.focusKey)
    pulseMatch(match)
    if (!target) {
      return
    }

    target.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" })
    const focusTarget = getFocusableElement(target)
    try {
      focusTarget.focus({ preventScroll: true })
    }
    catch {
      focusTarget.focus()
    }
    selectTextMatch(focusTarget, match)
  }

  function expand() {
    expanded.value = true
  }

  function collapse() {
    if (hasCriteria.value) {
      return
    }
    expanded.value = false
  }

  function focusPreviousMatch() {
    void focusMatch(activeMatchIndex.value - 1)
  }

  function focusNextMatch() {
    void focusMatch(activeMatchIndex.value + 1)
  }

  function clear() {
    query.value = ""
    fieldKey.value = ""
    activeMatchIndex.value = 0
  }

  watch([query, fieldKey], () => {
    activeMatchIndex.value = 0
    options.onVisualStateChange()
  })

  watch(fieldRefs, (refs) => {
    if (fieldKey.value && !refs.some(ref => ref.key === fieldKey.value)) {
      fieldKey.value = ""
    }
  }, { deep: true })

  watch(matches, (nextMatches) => {
    if (nextMatches.length === 0) {
      activeMatchIndex.value = 0
      if (query.value.trim()) {
        options.onVisualStateChange()
      }
      return
    }
    if (activeMatchIndex.value >= nextMatches.length) {
      activeMatchIndex.value = nextMatches.length - 1
    }
    if (query.value.trim()) {
      options.onVisualStateChange()
    }
  }, { deep: true })

  watch(activeMatchIndex, () => {
    if (query.value.trim()) {
      options.onVisualStateChange()
    }
  })

  watch(pulseFieldKeys, () => {
    if (query.value.trim()) {
      options.onVisualStateChange()
    }
  }, { deep: true })

  onBeforeUnmount(() => {
    if (pulseTimer) {
      clearTimeout(pulseTimer)
      pulseTimer = null
    }
  })

  return {
    activeMatchIndex,
    clear,
    collapse,
    expand,
    fieldKey,
    fieldRefs,
    focusNextMatch,
    focusPreviousMatch,
    getFieldClasses,
    matches,
    panelVisible,
    query,
    resultLabel,
  }
}
