import { ref, type Ref } from 'vue'
import sampleContentDefault from './sampleContent.aimd?raw'
import clinicalInformationRecordEn from '../../../../examples/aimd/clinical-information-record/protocol.en-US.aimd?raw'
import clinicalInformationRecordZh from '../../../../examples/aimd/clinical-information-record/protocol.zh-CN.aimd?raw'
import meetingNotesEn from '../../../../examples/protocols/meeting-notes/en-US/protocol.aimd?raw'
import meetingNotesZh from '../../../../examples/protocols/meeting-notes/zh-CN/protocol.aimd?raw'
import cuaacKineticsEn from '../../../../examples/protocols/cuaac-kinetics/en-US/protocol.aimd?raw'
import cuaacKineticsZh from '../../../../examples/protocols/cuaac-kinetics/zh-CN/protocol.aimd?raw'
import fieldWaterSampleObservationZh from '../../../../examples/protocols/field-water-sample-observation/zh-CN/protocol.aimd?raw'
import drugResponseIc50En from '../../../../examples/protocols/drug-response-ic50/en-US/protocol.aimd?raw'
import drugResponseIc50Zh from '../../../../examples/protocols/drug-response-ic50/zh-CN/protocol.aimd?raw'
import diaryEn from '../../../../examples/protocols/diary/en-US/protocol.aimd?raw'
import diaryZh from '../../../../examples/protocols/diary/zh-CN/protocol.aimd?raw'
import type { DemoLocale } from './demoI18n'

export const SAMPLE_AIMD = sampleContentDefault
export const DEFAULT_DEMO_EXAMPLE_ID = 'airalogy-protocol-example'

type LocalizedDemoValue<T> = Partial<Record<DemoLocale, T>>

export interface DemoExample {
  id: string
  kind: 'example' | 'case' | 'protocol'
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
  {
    id: 'meeting-notes',
    kind: 'protocol',
    source: {
      'en-US': 'examples/protocols/meeting-notes/en-US/protocol.aimd',
      'zh-CN': 'examples/protocols/meeting-notes/zh-CN/protocol.aimd',
    },
    title: {
      'en-US': 'Meeting Notes',
      'zh-CN': '会议记录',
    },
    description: {
      'en-US': 'Official Airalogy Protocol for everyday meeting notes across teams and projects.',
      'zh-CN': '适用于团队和项目日常会议记录的官方 Airalogy Protocol。',
    },
    content: {
      'en-US': meetingNotesEn,
      'zh-CN': meetingNotesZh,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['protocol', 'meeting', 'notes'],
  },
  {
    id: 'cuaac-kinetics',
    kind: 'protocol',
    source: {
      'en-US': 'examples/protocols/cuaac-kinetics/en-US/protocol.aimd',
      'zh-CN': 'examples/protocols/cuaac-kinetics/zh-CN/protocol.aimd',
    },
    title: {
      'en-US': 'Click Reaction Kinetics (CuAAC)',
      'zh-CN': '点击化学反应动力学（CuAAC）',
    },
    description: {
      'en-US': 'Official protocol for kinetic data upload, parameter calculation, plotting, and report drafting.',
      'zh-CN': '用于动力学数据上传、参数计算、绘图和报告生成的官方协议。',
    },
    content: {
      'en-US': cuaacKineticsEn,
      'zh-CN': cuaacKineticsZh,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['protocol', 'chemistry', 'kinetics', 'assigner'],
  },
  {
    id: 'field-water-sample-observation',
    kind: 'protocol',
    source: {
      'zh-CN': 'examples/protocols/field-water-sample-observation/zh-CN/protocol.aimd',
    },
    title: {
      'en-US': 'Field water sample observation',
      'zh-CN': '野外水样观测与环境扰动分析',
    },
    description: {
      'en-US': 'Protocol for field water sampling, weather and site records, biogeochemical interpretation, monsoon and extreme rainfall disturbance analysis.',
      'zh-CN': '用于野外水样采集、当天气象场地记录、水化学与生化环境判读、季风和极端降雨扰动分析。',
    },
    content: {
      'zh-CN': fieldWaterSampleObservationZh,
    },
    locales: ['zh-CN'],
    tags: ['protocol', 'environment', 'water-quality', 'monsoon', 'rainfall'],
  },
  {
    id: 'drug-response-ic50',
    kind: 'protocol',
    source: {
      'en-US': 'examples/protocols/drug-response-ic50/en-US/protocol.aimd',
      'zh-CN': 'examples/protocols/drug-response-ic50/zh-CN/protocol.aimd',
    },
    title: {
      'en-US': 'Drug Response IC50 Analysis',
      'zh-CN': '抗肿瘤候选药物细胞活性剂量-反应分析',
    },
    description: {
      'en-US': 'Official protocol for dose-response upload, IC50 estimation, QC, curve plotting, and report generation.',
      'zh-CN': '用于剂量-反应数据上传、IC50 估算、质控、曲线绘制和报告生成的官方协议。',
    },
    content: {
      'en-US': drugResponseIc50En,
      'zh-CN': drugResponseIc50Zh,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['protocol', 'biomedicine', 'IC50', 'assigner'],
  },
  {
    id: 'diary',
    kind: 'protocol',
    source: {
      'en-US': 'examples/protocols/diary/en-US/protocol.aimd',
      'zh-CN': 'examples/protocols/diary/zh-CN/protocol.aimd',
    },
    title: {
      'en-US': 'Diary',
      'zh-CN': '日记',
    },
    description: {
      'en-US': 'Official compact protocol for keeping a structured diary.',
      'zh-CN': '用于结构化记录日记的轻量官方协议。',
    },
    content: {
      'en-US': diaryEn,
      'zh-CN': diaryZh,
    },
    locales: ['en-US', 'zh-CN'],
    tags: ['protocol', 'diary', 'notes'],
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
