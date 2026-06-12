import { ref, type Ref } from 'vue'
import aimdRegistry from '../../../../examples/aimd/index.json'
import protocolRegistry from '../../../../examples/protocols/index.json'
import type { DemoLocale } from './demoI18n'

export const DEFAULT_DEMO_EXAMPLE_ID = 'aimd-syntax-tour'

type LocalizedDemoValue<T> = Partial<Record<DemoLocale, T>>
type RegistryLocalizedValue<T> = Partial<Record<string, T>>

interface DemoRegistryExample {
  id: string
  kind?: 'example' | 'case' | 'protocol'
  languages: string[]
  title: RegistryLocalizedValue<string>
  description: RegistryLocalizedValue<string>
  entry: RegistryLocalizedValue<string>
  tags?: string[]
}

export interface DemoExample {
  id: string
  kind: 'example' | 'case' | 'protocol'
  source: LocalizedDemoValue<string>
  title: LocalizedDemoValue<string>
  description: LocalizedDemoValue<string>
  content: LocalizedDemoValue<string>
  locales: DemoLocale[]
  tags: string[]
}

const AIMD_RAW_MODULES = import.meta.glob<string>('../../../../examples/aimd/**/*.aimd', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const PROTOCOL_RAW_MODULES = import.meta.glob<string>('../../../../examples/protocols/**/*.aimd', {
  eager: true,
  import: 'default',
  query: '?raw',
})

function isDemoLocale(value: string): value is DemoLocale {
  return value === 'en-US' || value === 'zh-CN'
}

function normalizeRegistryLocales(languages: string[]): DemoLocale[] {
  const locales = languages.filter(isDemoLocale)
  return locales.length > 0 ? locales : ['en-US']
}

function normalizeRegistryValue(
  value: RegistryLocalizedValue<string>,
  locales: DemoLocale[],
): LocalizedDemoValue<string> {
  const normalized: LocalizedDemoValue<string> = {}
  for (const locale of locales) {
    const text = value[locale]
    if (text !== undefined) {
      normalized[locale] = text
    }
  }
  return normalized
}

function loadRegistryContent(
  item: DemoRegistryExample,
  rootPrefix: string,
  rawModules: Record<string, string>,
  locales: DemoLocale[],
): LocalizedDemoValue<string> {
  const content: LocalizedDemoValue<string> = {}

  for (const locale of locales) {
    const entry = item.entry[locale]
    if (!entry) continue

    const rawContent = rawModules[`${rootPrefix}${entry}`]
    if (rawContent !== undefined) {
      content[locale] = rawContent
    }
  }

  return content
}

function createRegistryDemoExample(
  item: DemoRegistryExample,
  fallbackKind: 'case' | 'protocol',
  rootPrefix: string,
  rawModules: Record<string, string>,
): DemoExample {
  const locales = normalizeRegistryLocales(item.languages)
  return {
    id: item.id,
    kind: item.kind ?? fallbackKind,
    source: normalizeRegistryValue(item.entry, locales),
    title: normalizeRegistryValue(item.title, locales),
    description: normalizeRegistryValue(item.description, locales),
    content: loadRegistryContent(item, rootPrefix, rawModules, locales),
    locales,
    tags: item.tags ?? [],
  }
}

export const DEMO_EXAMPLES: DemoExample[] = [
  ...(aimdRegistry.examples as DemoRegistryExample[])
    .map(item => createRegistryDemoExample(item, 'case', '../../../../examples/aimd/', AIMD_RAW_MODULES)),
  ...(protocolRegistry.examples as DemoRegistryExample[])
    .map(item => createRegistryDemoExample(item, 'protocol', '../../../../examples/protocols/', PROTOCOL_RAW_MODULES)),
]

export function resolveDemoExampleText(text: LocalizedDemoValue<string>, locale: DemoLocale): string {
  return text[locale] || text['zh-CN'] || text['en-US'] || ''
}

export function resolveDemoExampleValue<T>(value: LocalizedDemoValue<T>, locale: DemoLocale): T {
  const resolved = value[locale] ?? value['en-US'] ?? value['zh-CN'] ?? Object.values(value)[0]
  if (resolved === undefined) {
    throw new Error(`Missing localized demo example value for ${locale}`)
  }
  return resolved as T
}

function getLocaleValue(locale?: DemoLocale | Ref<DemoLocale>): DemoLocale {
  return typeof locale === 'string' ? locale : locale?.value ?? 'en-US'
}

export function getDemoExample(id: string): DemoExample {
  return DEMO_EXAMPLES.find(example => example.id === id) ?? DEMO_EXAMPLES[0]
}

export function getDemoExampleContent(example: DemoExample, locale: DemoLocale): string {
  return resolveDemoExampleValue(example.content, locale)
}

export const SAMPLE_AIMD = getDemoExampleContent(getDemoExample(DEFAULT_DEMO_EXAMPLE_ID), 'en-US')

export function getDemoExampleSource(example: DemoExample, locale: DemoLocale): string {
  return resolveDemoExampleValue(example.source, locale)
}

export function useDemoExampleContent(initialId = DEFAULT_DEMO_EXAMPLE_ID, locale?: DemoLocale | Ref<DemoLocale>) {
  const initialLocale = getLocaleValue(locale)
  const initialExample = getDemoExample(initialId)
  const selectedExampleId = ref(initialExample.id)
  const content = ref(getDemoExampleContent(initialExample, initialLocale))

  function loadExample(id: string, targetLocale = getLocaleValue(locale)) {
    const example = getDemoExample(id)
    selectedExampleId.value = example.id
    content.value = getDemoExampleContent(example, targetLocale)
    return example
  }

  function resetToSelectedExample(targetLocale = getLocaleValue(locale)) {
    return loadExample(selectedExampleId.value, targetLocale)
  }

  return {
    content,
    selectedExampleId,
    examples: DEMO_EXAMPLES,
    loadExample,
    resetToSelectedExample,
  }
}

export function useSampleContent() {
  return ref(SAMPLE_AIMD)
}
