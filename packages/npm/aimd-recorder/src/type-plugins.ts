import { defineAsyncComponent, h } from 'vue'
import { BUILT_IN_CODE_STR_TYPES } from './code-types'
import { normalizeDnaSequenceValue } from './composables/useDnaSequence'
import { normalizeAimdTypeName } from './type-utils'
import type { AimdTypePlugin } from './types'

const AimdDnaSequenceField = defineAsyncComponent(() => import('./components/AimdDnaSequenceField.vue'))
const AimdMarkdownField = defineAsyncComponent(() => import('./components/AimdMarkdownField.vue'))
const BUILT_IN_CODE_STR_TYPE_PLUGINS: AimdTypePlugin[] = BUILT_IN_CODE_STR_TYPES.map(type => ({
  type,
  inputKind: 'code' as const,
}))

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatTimezoneOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  return `${sign}${pad2(hours)}:${pad2(minutes)}`
}

function formatDateTimeWithTimezone(date: Date): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hour}:${minute}${formatTimezoneOffset(date)}`
}

function resolveNowDate(now: Date | string | number | undefined): Date {
  if (now instanceof Date) {
    return Number.isNaN(now.getTime()) ? new Date() : now
  }

  if (typeof now === 'string' || typeof now === 'number') {
    const parsed = new Date(now)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

export const BUILT_IN_AIMD_TYPE_PLUGINS: AimdTypePlugin[] = [
  ...BUILT_IN_CODE_STR_TYPE_PLUGINS,
  {
    type: 'CurrentTime',
    inputKind: 'datetime',
    getInitialValue: ({ now }) => formatDateTimeWithTimezone(resolveNowDate(now)),
  },
  {
    type: 'UserName',
    getInitialValue: ({ currentUserName }) => currentUserName ?? '',
  },
  {
    type: 'AiralogyMarkdown',
    inputKind: 'textarea',
    renderField: ({
      node,
      value,
      disabled,
      locale,
      messages,
      extraClasses,
      emitChange,
      emitBlur,
    }) => h(AimdMarkdownField, {
      class: extraClasses,
      varId: node.id,
      modelValue: value,
      disabled,
      locale,
      messages,
      'onUpdate:modelValue': (nextValue: string) => emitChange(nextValue),
      onBlur: emitBlur,
    }),
  },
  {
    type: 'DNASequence',
    inputKind: 'dna',
    getInitialValue: () => normalizeDnaSequenceValue(undefined),
    normalizeValue: ({ value }) => normalizeDnaSequenceValue(value),
    renderField: ({
      node,
      value,
      disabled,
      placeholder,
      messages,
      extraClasses,
      emitChange,
      emitBlur,
    }) => h(AimdDnaSequenceField, {
      class: extraClasses,
      varId: node.id,
      modelValue: value,
      disabled,
      placeholder,
      messages,
      'onUpdate:modelValue': (nextValue: unknown) => emitChange(nextValue),
      onBlur: emitBlur,
    }),
  },
]

export function resolveAimdTypePlugin(
  type: string | undefined,
  typePlugins: AimdTypePlugin[] | undefined,
): AimdTypePlugin | undefined {
  if (!typePlugins?.length) {
    return undefined
  }

  const normalizedType = normalizeAimdTypeName(type)
  return typePlugins.find((plugin) => {
    if (normalizeAimdTypeName(plugin.type) === normalizedType) {
      return true
    }

    return (plugin.aliases ?? []).some(alias => normalizeAimdTypeName(alias) === normalizedType)
  })
}

export function createAimdTypePlugins(typePlugins?: AimdTypePlugin[]): AimdTypePlugin[] {
  return [...(typePlugins ?? []), ...BUILT_IN_AIMD_TYPE_PLUGINS]
}
