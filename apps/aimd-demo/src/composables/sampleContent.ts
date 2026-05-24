import { ref, type Ref } from 'vue'
import sampleContentDefault from './sampleContent.aimd?raw'
import clinicalInformationRecordEn from '../../../../examples/aimd/clinical-information-record/protocol.en-US.aimd?raw'
import clinicalInformationRecordZh from '../../../../examples/aimd/clinical-information-record/protocol.zh-CN.aimd?raw'
import type { DemoLocale } from './demoI18n'

export const SAMPLE_AIMD = sampleContentDefault
export const DEFAULT_DEMO_EXAMPLE_ID = 'airalogy-protocol-example'

type LocalizedDemoValue<T> = Partial<Record<DemoLocale, T>>

export interface DemoExample {
  id: string
  kind: 'example' | 'case'
  source: LocalizedDemoValue<string>
  title: Record<DemoLocale, string>
  description: Record<DemoLocale, string>
  content: LocalizedDemoValue<string>
  locales: DemoLocale[]
  tags: string[]
}

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: DEFAULT_DEMO_EXAMPLE_ID,
    kind: 'example',
    source: {
      'en-US': 'apps/aimd-demo/src/composables/sampleContent.aimd',
      'zh-CN': 'apps/aimd-demo/src/composables/sampleContent.aimd',
    },
    title: {
      'en-US': 'Airalogy protocol example',
      'zh-CN': 'Airalogy 协议综合示例',
    },
    description: {
      'en-US': 'Covers common AIMD variables, tables, steps, checks, quizzes, references, and client assigners.',
      'zh-CN': '覆盖常用 AIMD 变量、表格、步骤、检查点、题目、引用和前端 assigner。',
    },
    content: {
      'en-US': sampleContentDefault,
      'zh-CN': sampleContentDefault,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['general', 'demo', 'workflow'],
  },
  {
    id: 'clinical-information-record',
    kind: 'case',
    source: {
      'en-US': 'examples/aimd/clinical-information-record/protocol.en-US.aimd',
      'zh-CN': 'examples/aimd/clinical-information-record/protocol.zh-CN.aimd',
    },
    title: {
      'en-US': 'Clinical information record',
      'zh-CN': '临床信息记录案例',
    },
    description: {
      'en-US': 'Bilingual case showing structured clinical encounter, assessment, plan, review checkpoints, and BMI auto calculation.',
      'zh-CN': '用于结构化记录临床就诊、评估、诊疗计划、审核检查点，并包含 BMI 自动计算。',
    },
    content: {
      'en-US': clinicalInformationRecordEn,
      'zh-CN': clinicalInformationRecordZh,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['clinical', 'case', 'record'],
  },
]

export function resolveDemoExampleText(text: Record<DemoLocale, string>, locale: DemoLocale): string {
  return text[locale] || text['zh-CN'] || text['en-US']
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
