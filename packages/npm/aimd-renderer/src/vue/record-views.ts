import type {
  AimdRecordViewCell,
  AimdRecordViewColumn,
} from '@airalogy/aimd-core/utils'
import type { Component, PropType, VNodeChild } from 'vue'
import type { AimdMarkdownPreviewRenderOptions, AimdMarkdownPreviewUrlResolver } from './markdown-preview'
import type { ReadonlyRecordAssetResolver, ReadonlyRecordVueRendererOptions } from './readonly-record-renderer'
import {
  createAimdRecordViewColumns,
  formatAimdExampleValue,
  getAimdFileDisplayName,
  getAimdRecordViewCell,
  getDefaultAimdRecordViewFieldKeys,
  isAimdPlainRecord,
  toAimdBooleanValue,
} from '@airalogy/aimd-core/utils'
import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, Teleport, useId, watch } from 'vue'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { parseAndExtract } from '../common/processor'
import {
  createAimdRendererMessages,
  type AimdRendererMessages,
  type AimdRendererMessagesInput,
} from '../locales'
import { AimdMarkdownPreview } from './markdown-preview'

export type AimdRecordViewKey = string | number

export interface AimdRecordMetadataColumn {
  key: string
  label: string
  getValue: (record: unknown, index: number) => VNodeChild
  class?: string
}

export type AimdRecordViewRecordKeyResolver = (record: unknown, index: number) => AimdRecordViewKey
export type AimdRecordViewRecordLabelResolver = (record: unknown, index: number) => string

const unknownPropType = null as unknown as PropType<unknown>

function getRecordMetadata(record: unknown): Record<string, unknown> | undefined {
  if (!isAimdPlainRecord(record) || !isAimdPlainRecord(record.metadata)) {
    return undefined
  }
  return record.metadata
}

function firstRecordKey(record: unknown, keys: readonly string[]): AimdRecordViewKey | undefined {
  if (!isAimdPlainRecord(record)) {
    return undefined
  }
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' || typeof value === 'number') {
      return value
    }
  }
  return undefined
}

export function getDefaultAimdRecordViewKey(record: unknown, index: number): AimdRecordViewKey {
  return firstRecordKey(record, ['record_id', 'airalogy_record_id', 'id']) ?? index
}

export function getDefaultAimdRecordViewLabel(record: unknown, index: number): string {
  const metadata = getRecordMetadata(record)
  const recordNumber = metadata?.record_num
  if (typeof recordNumber === 'number' || typeof recordNumber === 'string') {
    return `#${recordNumber}`
  }
  const key = getDefaultAimdRecordViewKey(record, index)
  return typeof key === 'number' ? `#${key + 1}` : String(key)
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function collectMarkdownText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return ''
  }
  const item = node as { type?: string, value?: unknown, alt?: unknown, children?: unknown[] }
  if (item.type === 'text' || item.type === 'inlineCode' || item.type === 'code') {
    return typeof item.value === 'string' ? item.value : ''
  }
  if (item.type === 'image') {
    return typeof item.alt === 'string' ? item.alt : ''
  }
  if (!Array.isArray(item.children)) {
    return ''
  }
  return item.children.map(collectMarkdownText).filter(Boolean).join(' ')
}

function markdownToCompactText(value: string): string {
  try {
    return normalizeWhitespace(collectMarkdownText(unified().use(remarkParse).parse(value)))
  }
  catch {
    return normalizeWhitespace(value)
  }
}

function truncateText(value: string, maxLength: number): { text: string, truncated: boolean } {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= maxLength) {
    return { text: normalized, truncated: false }
  }
  return {
    text: `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`,
    truncated: true,
  }
}

function compactCellText(cell: AimdRecordViewCell): string {
  if (cell.field.valueKind === 'markdown' && typeof cell.value === 'string') {
    return markdownToCompactText(cell.value)
  }
  if ((cell.field.valueKind === 'step' || cell.field.valueKind === 'check') && cell.annotation) {
    return cell.annotation
  }
  return cell.text
}

export const AimdRecordValue = defineComponent({
  name: 'AimdRecordValue',
  props: {
    record: {
      type: unknownPropType,
      required: true,
    },
    field: {
      type: Object as PropType<AimdRecordViewColumn>,
      required: true,
    },
    maxLength: {
      type: Number,
      default: 96,
    },
    locale: {
      type: String,
      default: undefined,
    },
    messages: {
      type: Object as PropType<AimdRendererMessagesInput>,
      default: undefined,
    },
  },
  setup(props) {
    const cell = computed(() => getAimdRecordViewCell(props.record, props.field))
    const rendererMessages = computed(() => createAimdRendererMessages(props.locale, props.messages))

    return () => {
      const current = cell.value
      const classes = [
        'aimd-record-value',
        `aimd-record-value--${current.field.valueKind}`,
        current.empty ? 'aimd-record-value--empty' : null,
      ]

      if (current.empty) {
        return h('span', {
          class: classes,
          title: rendererMessages.value.recordView.missing,
        }, rendererMessages.value.recordView.emptyValue)
      }

      if (current.field.valueKind === 'boolean') {
        const checked = toAimdBooleanValue(current.value)
        return h('span', {
          class: classes,
          'data-state': checked ? 'true' : 'false',
        }, [
          h('span', { class: 'aimd-record-value__status', 'aria-hidden': 'true' }),
          h('span', checked ? rendererMessages.value.recordView.yes : rendererMessages.value.recordView.no),
        ])
      }

      if (current.field.valueKind === 'step' || current.field.valueKind === 'check') {
        return h('span', {
          class: classes,
          'data-state': current.checked === undefined ? 'unknown' : current.checked ? 'true' : 'false',
        }, [
          h('span', { class: 'aimd-record-value__status', 'aria-hidden': 'true' }),
          h('span', { class: 'aimd-record-value__structured-text' }, current.annotation
            ?? (current.checked === undefined
              ? rendererMessages.value.recordView.notRecorded
              : current.checked
                ? rendererMessages.value.recordView.completed
                : rendererMessages.value.recordView.incomplete)),
        ])
      }

      if (current.field.valueKind === 'table') {
        const rowCount = current.count ?? 0
        return h('span', { class: classes }, rendererMessages.value.recordView.rows(rowCount))
      }

      if (current.field.valueKind === 'file') {
        const filename = getAimdFileDisplayName(current.value, null, { hideAiralogyFileIds: true })
          || rendererMessages.value.recordView.file
        return h('span', { class: classes, title: filename }, [
          h('span', { class: 'aimd-record-value__file-badge' }, 'FILE'),
          h('span', { class: 'aimd-record-value__file-name' }, filename),
        ])
      }

      const fullText = compactCellText(current)
      const { text, truncated } = truncateText(fullText, props.maxLength)
      return h('span', {
        class: classes,
        title: truncated ? fullText : undefined,
      }, text)
    }
  },
})

function getRecordFieldDisplayId(field: AimdRecordViewColumn): string {
  return field.tableId && field.columnId
    ? `${field.tableId}.${field.columnId}`
    : field.id
}

function formatRecordFieldValues(values: readonly unknown[] | undefined): string[] {
  return (values ?? [])
    .map(formatAimdExampleValue)
    .map(value => value.trim())
    .filter(Boolean)
}

const AimdRecordFieldHelp = defineComponent({
  name: 'AimdRecordFieldHelp',
  props: {
    field: {
      type: Object as PropType<AimdRecordViewColumn>,
      required: true,
    },
    messages: {
      type: Object as PropType<AimdRendererMessages>,
      required: true,
    },
    showKind: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const tooltipId = useId()
    const hostElement = ref<HTMLElement>()
    const popoverElement = ref<HTMLElement>()
    const open = ref(false)
    const position = ref({ top: 0, left: 0 })
    let hovered = false
    let focused = false

    function updatePosition() {
      if (!open.value || !hostElement.value || typeof window === 'undefined') {
        return
      }

      const margin = 8
      const gap = 8
      const hostRect = hostElement.value.getBoundingClientRect()
      const popoverWidth = popoverElement.value?.offsetWidth || Math.min(360, window.innerWidth - (margin * 2))
      const popoverHeight = popoverElement.value?.offsetHeight || 0
      const maxLeft = Math.max(margin, window.innerWidth - popoverWidth - margin)
      const left = Math.min(Math.max(hostRect.left, margin), maxLeft)
      const spaceBelow = window.innerHeight - hostRect.bottom - margin
      const preferredTop = popoverHeight > 0 && popoverHeight > spaceBelow
        ? hostRect.top - popoverHeight - gap
        : hostRect.bottom + gap
      const maxTop = Math.max(margin, window.innerHeight - popoverHeight - margin)
      const top = Math.min(Math.max(preferredTop, margin), maxTop)

      position.value = { top, left }
    }

    function addPositionListeners() {
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    }

    function removePositionListeners() {
      if (typeof window === 'undefined') {
        return
      }
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }

    function syncOpenState() {
      open.value = hovered || focused
      if (open.value) {
        void nextTick(updatePosition)
      }
    }

    watch(open, (visible) => {
      if (typeof window === 'undefined') {
        return
      }
      removePositionListeners()
      if (visible) {
        addPositionListeners()
      }
    })

    onBeforeUnmount(removePositionListeners)

    return () => {
      const fieldId = getRecordFieldDisplayId(props.field)
      const type = props.field.type ?? props.field.valueKind
      const examples = formatRecordFieldValues(props.field.examples)
      const options = formatRecordFieldValues(props.field.enum)
      const heading = props.field.title ?? props.field.label
      const messages = props.messages.recordView

      const popover = open.value && typeof document !== 'undefined'
        ? h(Teleport, { to: 'body' }, [h('div', {
            id: tooltipId,
            ref: popoverElement,
            class: 'aimd-record-field-help__popover',
            role: 'tooltip',
            style: {
              left: `${position.value.left}px`,
              top: `${position.value.top}px`,
            },
          }, [
            h('strong', { class: 'aimd-record-field-help__heading' }, heading),
            h('dl', { class: 'aimd-record-field-help__facts' }, [
              h('div', { class: 'aimd-record-field-help__fact' }, [
                h('dt', messages.fieldId),
                h('dd', fieldId),
              ]),
              h('div', { class: 'aimd-record-field-help__fact' }, [
                h('dt', messages.type),
                h('dd', type),
              ]),
            ]),
            props.field.description
              ? h('div', { class: 'aimd-record-field-help__section' }, [
                  h('span', { class: 'aimd-record-field-help__section-label' }, messages.description),
                  h('span', props.field.description),
                ])
              : null,
            examples.length > 0
              ? h('div', { class: 'aimd-record-field-help__section' }, [
                  h('span', { class: 'aimd-record-field-help__section-label' }, messages.examples),
                  h('span', { class: 'aimd-field__metadata-examples' }, examples.map((example, index) => h('span', {
                    key: `${index}-${example}`,
                    class: 'aimd-field__metadata-example',
                  }, example))),
                ])
              : null,
            options.length > 0
              ? h('div', { class: 'aimd-record-field-help__section' }, [
                  h('span', { class: 'aimd-record-field-help__section-label' }, messages.options),
                  h('span', { class: 'aimd-field__metadata-examples' }, options.map((option, index) => h('span', {
                    key: `${index}-${option}`,
                    class: 'aimd-field__metadata-example',
                  }, option))),
                ])
              : null,
          ])])
        : null

      return h('span', {
        ref: hostElement,
        class: [
          'aimd-record-field-help',
          props.showKind ? 'aimd-record-field-help--stacked' : null,
        ],
        tabindex: 0,
        'aria-label': messages.fieldDetails(props.field.label),
        'aria-describedby': open.value ? tooltipId : undefined,
        onMouseenter: () => {
          hovered = true
          syncOpenState()
        },
        onMouseleave: () => {
          hovered = false
          syncOpenState()
        },
        onFocus: () => {
          focused = true
          syncOpenState()
        },
        onBlur: () => {
          focused = false
          syncOpenState()
        },
      }, [
        h('span', { class: [
          'aimd-record-field-help__label',
          props.showKind ? 'aimd-record-compare__field-label' : null,
        ] }, props.field.label),
        props.showKind
          ? h('span', { class: ['aimd-record-field-help__kind', 'aimd-record-compare__field-kind'] }, props.field.valueKind)
          : null,
        popover,
      ])
    }
  },
})

function getVisibleColumns(
  columns: readonly AimdRecordViewColumn[],
  fieldKeys: readonly string[] | undefined,
): AimdRecordViewColumn[] {
  const keys = fieldKeys?.length ? new Set(fieldKeys) : new Set(getDefaultAimdRecordViewFieldKeys(columns))
  return columns.filter(column => keys.has(column.key))
}

const commonCollectionProps = {
  aimd: {
    type: String,
    required: true,
  },
  records: {
    type: Array as PropType<unknown[]>,
    default: () => [],
  },
  fieldKeys: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  maxDefaultColumns: {
    type: Number,
    default: 6,
  },
  recordKey: {
    type: Function as PropType<AimdRecordViewRecordKeyResolver>,
    default: getDefaultAimdRecordViewKey,
  },
  recordLabel: {
    type: Function as PropType<AimdRecordViewRecordLabelResolver>,
    default: getDefaultAimdRecordViewLabel,
  },
  locale: {
    type: String,
    default: undefined,
  },
  messages: {
    type: Object as PropType<AimdRendererMessagesInput>,
    default: undefined,
  },
}

export const AimdRecordTable = defineComponent({
  name: 'AimdRecordTable',
  props: {
    ...commonCollectionProps,
    selectedRecordKeys: {
      type: Array as PropType<AimdRecordViewKey[]>,
      default: () => [],
    },
    selectable: {
      type: Boolean,
      default: true,
    },
    selectionLimit: {
      type: Number,
      default: 4,
    },
    metadataColumns: {
      type: Array as PropType<AimdRecordMetadataColumn[]>,
      default: () => [],
    },
    metadataColumnKeys: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    showFieldPicker: {
      type: Boolean,
      default: true,
    },
  },
  emits: {
    'update:selectedRecordKeys': (_keys: AimdRecordViewKey[]) => true,
    'update:fieldKeys': (_keys: string[]) => true,
    'update:metadataColumnKeys': (_keys: string[]) => true,
    'open-record': (_record: unknown, _index: number) => true,
  },
  setup(props, { emit, expose, slots }) {
    const columns = computed(() => createAimdRecordViewColumns(parseAndExtract(props.aimd ?? ''), {
      defaultFieldKeys: props.fieldKeys,
      maxDefaultColumns: props.maxDefaultColumns,
    }))
    const internalFieldKeys = ref<string[]>([])
    const internalMetadataColumnKeys = ref<string[]>([])
    const rendererMessages = computed(() => createAimdRendererMessages(props.locale, props.messages))

    watch(columns, (nextColumns) => {
      const availableKeys = new Set(nextColumns.map(column => column.key))
      const requested = props.fieldKeys?.filter(key => availableKeys.has(key))
      internalFieldKeys.value = requested?.length
        ? requested
        : getDefaultAimdRecordViewFieldKeys(nextColumns)
    }, { immediate: true })

    watch(() => props.fieldKeys, (fieldKeys) => {
      if (fieldKeys?.length) {
        internalFieldKeys.value = fieldKeys.filter(key => columns.value.some(column => column.key === key))
      }
    }, { deep: true })

    watch(
      [() => props.metadataColumns, () => props.metadataColumnKeys],
      ([metadataColumns, metadataColumnKeys]) => {
        const availableKeys = new Set(metadataColumns.map(column => column.key))
        internalMetadataColumnKeys.value = metadataColumnKeys === undefined
          ? metadataColumns.map(column => column.key)
          : metadataColumnKeys.filter(key => availableKeys.has(key))
      },
      { immediate: true, deep: true },
    )

    const visibleColumns = computed(() => getVisibleColumns(columns.value, internalFieldKeys.value))
    const visibleMetadataColumns = computed(() => props.metadataColumns.filter(column => (
      internalMetadataColumnKeys.value.includes(column.key)
    )))
    const selectedKeySet = computed(() => new Set(props.selectedRecordKeys))
    const selectionLimitReached = computed(() => props.selectionLimit > 0 && props.selectedRecordKeys.length >= props.selectionLimit)

    function updateFieldSelection(key: string, checked: boolean) {
      if (!checked && internalFieldKeys.value.length <= 1) {
        return
      }
      const next = checked
        ? [...internalFieldKeys.value, key]
        : internalFieldKeys.value.filter(item => item !== key)
      internalFieldKeys.value = columns.value.map(column => column.key).filter(item => next.includes(item))
      emit('update:fieldKeys', [...internalFieldKeys.value])
    }

    function updateMetadataColumnSelection(key: string, checked: boolean) {
      const next = checked
        ? [...internalMetadataColumnKeys.value, key]
        : internalMetadataColumnKeys.value.filter(item => item !== key)
      internalMetadataColumnKeys.value = props.metadataColumns
        .map(column => column.key)
        .filter(item => next.includes(item))
      emit('update:metadataColumnKeys', [...internalMetadataColumnKeys.value])
    }

    function updateRecordSelection(record: unknown, index: number, checked: boolean) {
      const key = props.recordKey(record, index)
      const next = checked
        ? [...props.selectedRecordKeys.filter(item => item !== key), key]
        : props.selectedRecordKeys.filter(item => item !== key)
      emit('update:selectedRecordKeys', props.selectionLimit > 0 ? next.slice(0, props.selectionLimit) : next)
    }

    function toggleCurrentPageSelection(checked: boolean) {
      if (!checked) {
        const pageKeys = new Set(props.records.map((record, index) => props.recordKey(record, index)))
        emit('update:selectedRecordKeys', props.selectedRecordKeys.filter(key => !pageKeys.has(key)))
        return
      }
      const next = [...props.selectedRecordKeys]
      for (const [index, record] of props.records.entries()) {
        const key = props.recordKey(record, index)
        if (!next.includes(key)) {
          next.push(key)
        }
        if (props.selectionLimit > 0 && next.length >= props.selectionLimit) {
          break
        }
      }
      emit('update:selectedRecordKeys', next)
    }

    const allCurrentPageSelected = computed(() => props.records.length > 0 && props.records.every((record, index) => (
      selectedKeySet.value.has(props.recordKey(record, index))
    )))

    expose({ columns, visibleColumns, visibleMetadataColumns })

    return () => h('div', {
      class: [
        'aimd-record-table-view',
        props.selectable ? 'aimd-record-table-view--selectable' : null,
      ],
    }, [
      h('div', { class: 'aimd-record-table-view__toolbar' }, [
        h('div', { class: 'aimd-record-table-view__summary' }, rendererMessages.value.recordView.records(props.records.length)),
        props.selectable
          ? h('div', { class: 'aimd-record-table-view__selection-summary' }, rendererMessages.value.recordView.selected(
              props.selectedRecordKeys.length,
              props.selectionLimit,
            ))
          : null,
        slots.toolbar?.(),
        props.showFieldPicker
          ? h('details', { class: 'aimd-record-table-view__field-picker' }, [
              h('summary', rendererMessages.value.recordView.columns),
              h('div', { class: 'aimd-record-table-view__field-menu' }, [
                props.metadataColumns.length > 0
                  ? h('div', { class: 'aimd-record-table-view__field-group' }, [
                      h('div', { class: 'aimd-record-table-view__field-group-label' }, rendererMessages.value.recordView.metadataColumns),
                      ...props.metadataColumns.map(column => h('label', {
                        key: `metadata:${column.key}`,
                        class: 'aimd-record-table-view__field-option',
                      }, [
                        h('input', {
                          type: 'checkbox',
                          'data-metadata-column-key': column.key,
                          checked: internalMetadataColumnKeys.value.includes(column.key),
                          onChange: (event: Event) => updateMetadataColumnSelection(column.key, (event.target as HTMLInputElement).checked),
                        }),
                        h('span', column.label),
                      ])),
                    ])
                  : null,
                h('div', { class: 'aimd-record-table-view__field-group' }, [
                  h('div', { class: 'aimd-record-table-view__field-group-label' }, rendererMessages.value.recordView.protocolColumns),
                  ...columns.value.map(column => h('label', {
                    key: `field:${column.key}`,
                    class: 'aimd-record-table-view__field-option',
                  }, [
                    h('input', {
                      type: 'checkbox',
                      'data-field-key': column.key,
                      checked: internalFieldKeys.value.includes(column.key),
                      disabled: internalFieldKeys.value.length <= 1 && internalFieldKeys.value.includes(column.key),
                      onChange: (event: Event) => updateFieldSelection(column.key, (event.target as HTMLInputElement).checked),
                    }),
                    h('span', column.label),
                  ])),
                ]),
              ]),
            ])
          : null,
      ]),
      props.records.length === 0
        ? h('div', { class: 'aimd-record-table-view__empty' }, slots.empty?.() ?? rendererMessages.value.recordView.noRecords)
        : h('div', { class: 'aimd-record-table-view__scroller' }, [
            h('table', { class: 'aimd-record-table-view__table' }, [
              h('thead', [h('tr', [
                props.selectable
                  ? h('th', { class: 'aimd-record-table-view__select-column' }, [h('input', {
                      type: 'checkbox',
                      checked: allCurrentPageSelected.value,
                      'aria-label': rendererMessages.value.recordView.selectAll,
                      onChange: (event: Event) => toggleCurrentPageSelection((event.target as HTMLInputElement).checked),
                    })])
                  : null,
                h('th', { class: 'aimd-record-table-view__record-column' }, rendererMessages.value.recordView.record),
                ...visibleMetadataColumns.value.map(column => h('th', {
                  key: `metadata:${column.key}`,
                  class: column.class,
                  'data-metadata-column-key': column.key,
                }, column.label)),
                ...visibleColumns.value.map(column => h('th', {
                  key: column.key,
                  'data-field-key': column.key,
                }, [h(AimdRecordFieldHelp, {
                  field: column,
                  messages: rendererMessages.value,
                })])),
                slots.actions ? h('th', { class: 'aimd-record-table-view__actions-column' }, rendererMessages.value.recordView.actions) : null,
              ])]),
              h('tbody', props.records.map((record, index) => {
                const key = props.recordKey(record, index)
                const selected = selectedKeySet.value.has(key)
                return h('tr', { key, class: selected ? 'aimd-record-table-view__row--selected' : null }, [
                  props.selectable
                    ? h('td', { class: 'aimd-record-table-view__select-column' }, [h('input', {
                        type: 'checkbox',
                        checked: selected,
                        disabled: !selected && selectionLimitReached.value,
                        'aria-label': rendererMessages.value.recordView.selectRecord(props.recordLabel(record, index)),
                        onChange: (event: Event) => updateRecordSelection(record, index, (event.target as HTMLInputElement).checked),
                      })])
                    : null,
                  h('td', { class: 'aimd-record-table-view__record-column' }, [h('button', {
                    type: 'button',
                    class: 'aimd-record-table-view__record-link',
                    onClick: () => emit('open-record', record, index),
                  }, props.recordLabel(record, index))]),
                  ...visibleMetadataColumns.value.map(column => h('td', {
                    key: `metadata:${column.key}`,
                    class: column.class,
                    'data-metadata-column-key': column.key,
                  }, [column.getValue(record, index)])),
                  ...visibleColumns.value.map(column => h('td', { key: column.key, 'data-field-key': column.key }, [
                    h(AimdRecordValue, {
                      record,
                      field: column,
                      locale: props.locale,
                      messages: props.messages,
                    }),
                  ])),
                  slots.actions ? h('td', { class: 'aimd-record-table-view__actions-column' }, slots.actions({ record, index, key })) : null,
                ])
              })),
            ]),
          ]),
    ])
  },
})

export const AimdRecordCompare = defineComponent({
  name: 'AimdRecordCompare',
  props: {
    ...commonCollectionProps,
    maxRecords: {
      type: Number,
      default: 4,
    },
    showOnlyDifferences: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'update:showOnlyDifferences': (_value: boolean) => true,
    'open-record': (_record: unknown, _index: number) => true,
  },
  setup(props, { emit, expose, slots }) {
    const columns = computed(() => createAimdRecordViewColumns(parseAndExtract(props.aimd ?? ''), {
      defaultFieldKeys: props.fieldKeys,
      maxDefaultColumns: props.maxDefaultColumns,
    }))
    const visibleColumns = computed(() => props.fieldKeys?.length
      ? getVisibleColumns(columns.value, props.fieldKeys)
      : columns.value)
    const comparedRecords = computed(() => props.records.slice(0, Math.max(2, props.maxRecords)))
    const rendererMessages = computed(() => createAimdRendererMessages(props.locale, props.messages))

    function columnIsDifferent(column: AimdRecordViewColumn): boolean {
      return new Set(comparedRecords.value.map(record => getAimdRecordViewCell(record, column).compareKey)).size > 1
    }

    const comparedColumns = computed(() => visibleColumns.value.filter(column => (
      !props.showOnlyDifferences || columnIsDifferent(column)
    )))

    expose({ columns, visibleColumns, comparedColumns })

    return () => {
      if (comparedRecords.value.length < 2) {
        return h('div', { class: 'aimd-record-compare aimd-record-compare--empty' }, slots.empty?.()
          ?? rendererMessages.value.recordView.compareAtLeastTwo)
      }

      return h('div', { class: 'aimd-record-compare' }, [
        h('div', { class: 'aimd-record-compare__toolbar' }, [
          h('label', { class: 'aimd-record-compare__differences-toggle' }, [
            h('input', {
              type: 'checkbox',
              checked: props.showOnlyDifferences,
              onChange: (event: Event) => emit('update:showOnlyDifferences', (event.target as HTMLInputElement).checked),
            }),
            h('span', rendererMessages.value.recordView.showOnlyDifferences),
          ]),
          slots.toolbar?.(),
        ]),
        h('div', { class: 'aimd-record-compare__scroller' }, [
          h('table', { class: 'aimd-record-compare__table' }, [
            h('thead', [h('tr', [
              h('th', { class: 'aimd-record-compare__field-column' }, rendererMessages.value.recordView.field),
              ...comparedRecords.value.map((record, index) => h('th', {
                key: props.recordKey(record, index),
              }, [h('button', {
                type: 'button',
                class: 'aimd-record-compare__record-link',
                onClick: () => emit('open-record', record, index),
              }, props.recordLabel(record, index))])),
            ])]),
            h('tbody', comparedColumns.value.map((column) => {
              const different = columnIsDifferent(column)
              return h('tr', {
                key: column.key,
                class: different ? 'aimd-record-compare__row--different' : 'aimd-record-compare__row--same',
                'data-field-key': column.key,
                'data-different': String(different),
              }, [
                h('th', {
                  class: 'aimd-record-compare__field-column',
                }, [
                  h(AimdRecordFieldHelp, {
                    field: column,
                    messages: rendererMessages.value,
                    showKind: true,
                  }),
                ]),
                ...comparedRecords.value.map((record, index) => h('td', {
                  key: props.recordKey(record, index),
                }, [h(AimdRecordValue, {
                  record,
                  field: column,
                  maxLength: 240,
                  locale: props.locale,
                  messages: props.messages,
                })])),
              ])
            })),
          ]),
        ]),
      ])
    }
  },
})

export const AimdRecordReport = defineComponent({
  name: 'AimdRecordReport',
  props: {
    aimd: {
      type: String,
      required: true,
    },
    record: {
      type: Object as PropType<object>,
      required: true,
    },
    renderOptions: {
      type: Object as PropType<AimdMarkdownPreviewRenderOptions>,
      default: () => ({}),
    },
    readonlyRecordRenderOptions: {
      type: Object as PropType<ReadonlyRecordVueRendererOptions>,
      default: () => ({}),
    },
    resolveAsset: {
      type: Function as PropType<ReadonlyRecordAssetResolver>,
      default: undefined,
    },
    resolveUrl: {
      type: Function as PropType<AimdMarkdownPreviewUrlResolver>,
      default: undefined,
    },
    mermaidComponent: {
      type: [Object, Function] as PropType<Component>,
      default: undefined,
    },
    bodyClass: {
      type: [String, Array, Object] as PropType<string | unknown[] | Record<string, boolean>>,
      default: undefined,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    return () => h(AimdMarkdownPreview, {
      content: props.aimd,
      mode: 'report',
      readonlyRecordData: props.record,
      renderOptions: props.renderOptions,
      readonlyRecordRenderOptions: props.readonlyRecordRenderOptions,
      resolveAsset: props.resolveAsset,
      resolveUrl: props.resolveUrl,
      mermaidComponent: props.mermaidComponent,
      bodyClass: props.bodyClass,
      loading: props.loading,
      class: 'aimd-record-report',
    }, slots)
  },
})
