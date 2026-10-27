import { ref, watch } from 'vue'

export const EDITOR_FIELD_DISPLAY_KEY = 'airalogy-aimd-demo-field-display'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>
interface DisplayPreferenceOptions {
  defaultDisplay?: 'detailed' | 'compact'
  storage?: PreferenceStorage
}

function browserStorage(): PreferenceStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage }
  catch { return undefined }
}

/** Display preferences stay separate from template and record drafts. */
export function useEditorDisplayPreferences({ defaultDisplay = 'detailed', storage = browserStorage() }: DisplayPreferenceOptions = {}) {
  const showFieldDetails = ref(defaultDisplay === 'detailed')
  try {
    const saved = storage?.getItem(EDITOR_FIELD_DISPLAY_KEY)
    if (saved === 'detailed' || saved === 'compact') showFieldDetails.value = saved === 'detailed'
  }
  catch { /* Storage may be blocked; the current session remains usable. */ }

  watch(showFieldDetails, value => {
    try { storage?.setItem(EDITOR_FIELD_DISPLAY_KEY, value ? 'detailed' : 'compact') }
    catch { /* A display preference must not prevent editing or saving records. */ }
  }, { flush: 'sync' })

  return { showFieldDetails }
}
