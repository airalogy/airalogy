import type { ExtractedAimdFields } from '@airalogy/aimd-core'
import type { DemoLocale } from './demoI18n'

type LocalizedText = Record<DemoLocale, string>

function lt(enUS: string, zhCN: string): LocalizedText {
  return {
    'en-US': enUS,
    'zh-CN': zhCN,
  }
}

function lines(parts: string[]): string {
  return parts.join('\n')
}

function resolveText(value: string | LocalizedText, locale: DemoLocale): string {
  return typeof value === 'string' ? value : value[locale]
}

function findVarTable(fields: ExtractedAimdFields | null, id: string) {
  return fields?.var_table.find(table => table.id === id)
}

function findVarDefinition(fields: ExtractedAimdFields | null, id: string) {
  return fields?.var_definitions?.find(field => field.id === id)
}

function findQuiz(fields: ExtractedAimdFields | null, id: string) {
  return fields?.quiz.find(quiz => quiz.id === id)
}

function findStepField(fields: ExtractedAimdFields | null, id: string) {
  return fields?.step_hierarchy?.find(step => step.id === id)
}

function findClientAssigner(fields: ExtractedAimdFields | null, id: string) {
  return fields?.client_assigner.find(assigner => assigner.id === id)
}

function hasHeading(content: string, level: number): boolean {
  const marker = '#'.repeat(level)
  const pattern = new RegExp(`(^|\\n)${marker}\\s+\\S+`)
  return pattern.test(content)
}

function hasBulletItem(content: string): boolean {
  return /(^|\n)-\s+\S+/.test(content)
}

export interface TutorialEvaluationState {
  content: string
  normalizedContent: string
  fields: ExtractedAimdFields | null
  html: string
  parseError: string
  renderError: string
}

interface TutorialLessonCheckDefinition {
  id: string
  label: LocalizedText
  evaluate: (state: TutorialEvaluationState) => boolean
}

interface TutorialLessonDefinition {
  id: string
  title: LocalizedText
  summary: LocalizedText
  intro: LocalizedText
  focus: LocalizedText[]
  pattern: string | LocalizedText
  starter: string | LocalizedText
  solution: string | LocalizedText
  hints: LocalizedText[]
  checks: TutorialLessonCheckDefinition[]
}

export interface TutorialLessonCheck {
  id: string
  label: string
  evaluate: (state: TutorialEvaluationState) => boolean
}

export interface TutorialLesson {
  id: string
  title: string
  summary: string
  intro: string
  focus: string[]
  pattern: string
  starter: string
  solution: string
  hints: string[]
  checks: TutorialLessonCheck[]
}

const QUIZ_PATTERN = lines([
  '```quiz',
  'id: quiz_id',
  'type: choice',
  'mode: single',
  'stem: Question text',
  'options:',
  '  - key: A',
  '    text: First option',
  '  - key: B',
  '    text: Second option',
  'answer: B',
  '```',
])

const FIELD_METADATA_PATTERN = lines([
  '{{var|field_id: type, title = "Readable label", description = "Help text", examples = ["Example"]}}',
  '{{var|notes: AiralogyMarkdown}}',
  '{{var|sequence: DNASequence}}',
])

const STEP_TIMER_PATTERN = lines([
  '{{step|step_id, check=True, duration="2m"}} Step text.',
  '{{step|timed_step, duration="30s", timer="countdown"}} Finish within the time window.',
  '{{check|checkpoint_id}}',
])

const QUIZ_VARIANTS_PATTERN = lines([
  '```quiz',
  'id: quiz_id',
  'type: true_false | blank | scale',
  'stem: Question text',
  '```',
])

const REVIEW_MARKS_PATTERN = lines([
  '{++added text++}',
  '{--deleted text--}',
  '{~~old wording~>new wording~~}',
  '{>>review note<<}',
  '{==highlighted text==}',
])

const CLIENT_ASSIGNER_PATTERN = lines([
  '```assigner runtime=client',
  'assigner(',
  '  {',
  '    mode: "auto",',
  '    dependent_fields: ["field_a", "field_b"],',
  '    assigned_fields: ["result_field"],',
  '  },',
  '  function calculate_result({ field_a, field_b }) {',
  '    return {',
  '      result_field: field_a + field_b,',
  '    };',
  '  }',
  ');',
  '```',
])

const LESSON_DEFINITIONS: TutorialLessonDefinition[] = [
  {
    id: 'markdown-basics',
    title: lt('Markdown Basics', 'Markdown 基础'),
    summary: lt(
      'Start with ordinary Markdown before adding AIMD tags.',
      '先从普通 Markdown 开始，再加入 AIMD 语法。',
    ),
    intro: lt(
      'Add one level-2 heading and one bullet item. AIMD keeps normal Markdown, so the preview should update immediately.',
      '先写一个二级标题和一个无序列表项。AIMD 保留普通 Markdown，所以右侧预览会立即更新。',
    ),
    focus: [
      lt('Markdown', 'Markdown'),
      lt('Headings', '标题'),
      lt('Lists', '列表'),
    ],
    pattern: lines([
      '## Heading',
      '',
      '- List item',
    ]),
    starter: lt(
      'Write a short Markdown fragment here.',
      '在这里写一段 Markdown。',
    ),
    solution: lt(
      lines([
        '## Experiment Overview',
        '',
        '- Prepare sample',
      ]),
      lines([
        '## 实验概览',
        '',
        '- 准备样本',
      ]),
    ),
    hints: [
      lt('Headings use one or more # symbols. This lesson wants exactly two.', '标题用一个或多个 # 开头，这一关要用两个。'),
      lt('A bullet item starts with "- " on its own line.', '无序列表项需要单独一行，并以 "- " 开头。'),
      lt('If both checks are right, the preview tab should show a heading and a list.', '如果两项都写对，Preview 标签里会出现标题和列表。'),
    ],
    checks: [
      {
        id: 'has-heading',
        label: lt('Add a level-2 heading', '添加一个二级标题'),
        evaluate: state => hasHeading(state.normalizedContent, 2),
      },
      {
        id: 'has-bullet',
        label: lt('Add at least one bullet item', '添加至少一个无序列表项'),
        evaluate: state => hasBulletItem(state.normalizedContent),
      },
      {
        id: 'preview-updates',
        label: lt('Render both the heading and the list in preview', '在预览中渲染出标题和列表'),
        evaluate: state => state.html.includes('<h2') && state.html.includes('<li>'),
      },
    ],
  },
  {
    id: 'variables',
    title: lt('Variables', '变量'),
    summary: lt(
      'Use {{var|...}} to define structured fields.',
      '用 {{var|...}} 定义结构化字段。',
    ),
    intro: lt(
      'Create two variables: sample_name as str, and temperature as float with default 25.',
      '创建两个变量：`sample_name` 类型为 `str`，`temperature` 类型为 `float` 且默认值为 `25`。',
    ),
    focus: [
      lt('Variables', '变量'),
      lt('Types', '类型'),
      lt('Defaults', '默认值'),
    ],
    pattern: lines([
      '{{var|field_id: type}}',
      '{{var|field_id: type = default}}',
    ]),
    starter: lt(
      lines([
        '## Sample Metadata',
        '',
        'Sample name:',
        'Temperature:',
      ]),
      lines([
        '## 样本信息',
        '',
        '样本名称：',
        '温度：',
      ]),
    ),
    solution: lt(
      lines([
        '## Sample Metadata',
        '',
        'Sample name: {{var|sample_name: str}}',
        'Temperature: {{var|temperature: float = 25}}',
      ]),
      lines([
        '## 样本信息',
        '',
        '样本名称：{{var|sample_name: str}}',
        '温度：{{var|temperature: float = 25}}',
      ]),
    ),
    hints: [
      lt('The parser extracts var ids into fields.var.', '解析器会把变量 id 提取到 `fields.var`。'),
      lt('The field id should stay machine-friendly, for example sample_name.', '字段 id 建议保持机器友好，比如 `sample_name`。'),
      lt('Defaults are written after "=" inside the same template.', '默认值写在同一个模板里的 "=" 后面。'),
    ],
    checks: [
      {
        id: 'sample-name-var',
        label: lt('Define sample_name as a var field', '定义 `sample_name` 变量'),
        evaluate: state => state.fields?.var.includes('sample_name') ?? false,
      },
      {
        id: 'temperature-var',
        label: lt('Define temperature as a var field', '定义 `temperature` 变量'),
        evaluate: state => state.fields?.var.includes('temperature') ?? false,
      },
      {
        id: 'temperature-default',
        label: lt('Give temperature a float default value of 25', '给 `temperature` 设置 `float` 类型默认值 `25`'),
        evaluate: state => /\{\{var\|temperature:\s*float\s*=\s*25(?:\.0+)?\s*\}\}/.test(state.normalizedContent),
      },
    ],
  },
  {
    id: 'field-metadata-types',
    title: lt('Field Metadata and Built-in Types', '字段元数据与内置类型'),
    summary: lt(
      'Use title, description, examples, and built-in AIMD field types to make recorder forms clearer.',
      '用 `title`、`description`、`examples` 和内置 AIMD 字段类型，让 recorder 表单更清晰。',
    ),
    intro: lt(
      'Add readable metadata to operator, then define AiralogyMarkdown, DNASequence, and PyStr fields.',
      '给 `operator` 添加可读元数据，然后定义 `AiralogyMarkdown`、`DNASequence` 和 `PyStr` 字段。',
    ),
    focus: [
      lt('Field metadata', '字段元数据'),
      lt('Built-in types', '内置类型'),
      lt('Recorder labels', 'Recorder 标签'),
    ],
    pattern: FIELD_METADATA_PATTERN,
    starter: lt(
      lines([
        '## Rich Field Types',
        '',
        'Operator:',
        'Experiment note:',
        'Plasmid sequence:',
        'Analysis script:',
      ]),
      lines([
        '## 丰富字段类型',
        '',
        '操作者：',
        '实验记录：',
        '质粒序列：',
        '分析脚本：',
      ]),
    ),
    solution: lt(
      lines([
        '## Rich Field Types',
        '',
        'Operator: {{var|operator: UserName, title = "Operator", description = "Person responsible for this record", examples = ["Dr. Chen"]}}',
        'Experiment note: {{var|experiment_note: AiralogyMarkdown, title = "Experiment Note", description = "Markdown note with review comments"}}',
        'Plasmid sequence: {{var|plasmid_sequence: DNASequence, title = "Plasmid Sequence"}}',
        'Analysis script: {{var|analysis_script: PyStr, title = "Analysis Script"}}',
      ]),
      lines([
        '## 丰富字段类型',
        '',
        '操作者：{{var|operator: UserName, title = "Operator", description = "Person responsible for this record", examples = ["Dr. Chen"]}}',
        '实验记录：{{var|experiment_note: AiralogyMarkdown, title = "Experiment Note", description = "Markdown note with review comments"}}',
        '质粒序列：{{var|plasmid_sequence: DNASequence, title = "Plasmid Sequence"}}',
        '分析脚本：{{var|analysis_script: PyStr, title = "Analysis Script"}}',
      ]),
    ),
    hints: [
      lt('title, description, and examples are kwargs inside the var template.', '`title`、`description` 和 `examples` 都是 `var` 模板里的 kwargs。'),
      lt('AiralogyMarkdown renders as a Markdown field in recorder contexts.', '`AiralogyMarkdown` 在 recorder 中会渲染为 Markdown 字段。'),
      lt('DNASequence and PyStr are type annotations; they do not need quotes.', '`DNASequence` 和 `PyStr` 是类型标注，不需要加引号。'),
    ],
    checks: [
      {
        id: 'operator-type',
        label: lt('Define operator as UserName', '把 `operator` 定义为 `UserName`'),
        evaluate: state => findVarDefinition(state.fields, 'operator')?.type === 'UserName',
      },
      {
        id: 'operator-metadata',
        label: lt('Give operator a title, description, and examples', '给 `operator` 添加 title、description 和 examples'),
        evaluate: (state) => {
          const field = findVarDefinition(state.fields, 'operator')
          return Boolean(field?.title && field.description && field.examples?.length)
        },
      },
      {
        id: 'markdown-type',
        label: lt('Define experiment_note as AiralogyMarkdown', '把 `experiment_note` 定义为 `AiralogyMarkdown`'),
        evaluate: state => findVarDefinition(state.fields, 'experiment_note')?.type === 'AiralogyMarkdown',
      },
      {
        id: 'dna-type',
        label: lt('Define plasmid_sequence as DNASequence', '把 `plasmid_sequence` 定义为 `DNASequence`'),
        evaluate: state => findVarDefinition(state.fields, 'plasmid_sequence')?.type === 'DNASequence',
      },
      {
        id: 'code-type',
        label: lt('Define analysis_script as PyStr', '把 `analysis_script` 定义为 `PyStr`'),
        evaluate: state => findVarDefinition(state.fields, 'analysis_script')?.type === 'PyStr',
      },
    ],
  },
  {
    id: 'steps-and-refs',
    title: lt('Steps and References', '步骤与引用'),
    summary: lt(
      'Connect procedural text with step and reference tags.',
      '用步骤和引用标签把流程文本连接起来。',
    ),
    intro: lt(
      'Add two steps, then reference both the sample_name variable and the prepare_sample step.',
      '添加两个步骤，并分别引用 `sample_name` 变量和 `prepare_sample` 步骤。',
    ),
    focus: [
      lt('Steps', '步骤'),
      lt('References', '引用'),
      lt('Workflow', '流程'),
    ],
    pattern: lines([
      '{{step|step_id}} Step text {{ref_var|field_id}}.',
      '{{ref_step|step_id}}',
    ]),
    starter: lt(
      lines([
        '{{var|sample_name: str}}',
        '',
        '## Workflow',
      ]),
      lines([
        '{{var|sample_name: str}}',
        '',
        '## 实验流程',
      ]),
    ),
    solution: lt(
      lines([
        '{{var|sample_name: str}}',
        '',
        '## Workflow',
        '',
        '{{step|prepare_sample}} Confirm {{ref_var|sample_name}} before mixing.',
        '{{step|analyze_sample}} If needed, repeat {{ref_step|prepare_sample}}.',
      ]),
      lines([
        '{{var|sample_name: str}}',
        '',
        '## 实验流程',
        '',
        '{{step|prepare_sample}} 混合前先确认 {{ref_var|sample_name}}。',
        '{{step|analyze_sample}} 如有需要，重复 {{ref_step|prepare_sample}}。',
      ]),
    ),
    hints: [
      lt('step ids are extracted into fields.step.', '`step` 的 id 会被提取到 `fields.step`。'),
      lt('Use ref_var for variables and ref_step for previous steps.', '变量引用用 `ref_var`，步骤引用用 `ref_step`。'),
      lt('The referenced id should exactly match an existing field or step id.', '被引用的 id 必须和已有字段或步骤 id 完全一致。'),
    ],
    checks: [
      {
        id: 'prepare-step',
        label: lt('Create a step with id prepare_sample', '创建 id 为 `prepare_sample` 的步骤'),
        evaluate: state => state.fields?.step.includes('prepare_sample') ?? false,
      },
      {
        id: 'analyze-step',
        label: lt('Create a second step with id analyze_sample', '创建第二个步骤 `analyze_sample`'),
        evaluate: state => state.fields?.step.includes('analyze_sample') ?? false,
      },
      {
        id: 'var-ref',
        label: lt('Reference sample_name with ref_var', '用 `ref_var` 引用 `sample_name`'),
        evaluate: state => state.fields?.ref_var.includes('sample_name') ?? false,
      },
      {
        id: 'step-ref',
        label: lt('Reference prepare_sample with ref_step', '用 `ref_step` 引用 `prepare_sample`'),
        evaluate: state => state.fields?.ref_step.includes('prepare_sample') ?? false,
      },
    ],
  },
  {
    id: 'step-checks-timers',
    title: lt('Checks and Timers', '检查点与计时'),
    summary: lt(
      'Add checkboxes and timing metadata to procedural steps.',
      '给流程步骤添加检查框和计时元数据。',
    ),
    intro: lt(
      'Create one checked preparation step, one countdown step, and one standalone check.',
      '创建一个带检查框的准备步骤、一个倒计时步骤，以及一个独立检查点。',
    ),
    focus: [
      lt('check=True', 'check=True'),
      lt('duration', 'duration'),
      lt('timer', 'timer'),
    ],
    pattern: STEP_TIMER_PATTERN,
    starter: lt(
      lines([
        '## Timed Workflow',
      ]),
      lines([
        '## 计时流程',
      ]),
    ),
    solution: lt(
      lines([
        '## Timed Workflow',
        '',
        '{{step|prepare_sample, check=True, duration="2m"}} Prepare the sample and confirm the label.',
        '{{step|wash_window, duration="30s", timer="countdown"}} Complete the wash within the time window.',
        '{{step|transfer_sample, check=True, duration="90s", timer="both"}} Transfer the sample and track overtime if needed.',
        '',
        '{{check|review_record}} Confirm all timed steps have been recorded.',
      ]),
      lines([
        '## 计时流程',
        '',
        '{{step|prepare_sample, check=True, duration="2m"}} 准备样本并确认标签。',
        '{{step|wash_window, duration="30s", timer="countdown"}} 在时间窗口内完成清洗。',
        '{{step|transfer_sample, check=True, duration="90s", timer="both"}} 转移样本，并在需要时继续记录超时。',
        '',
        '{{check|review_record}} 确认所有计时步骤都已记录。',
      ]),
    ),
    hints: [
      lt('check=True makes a step render with a completion checkbox in recorder contexts.', '`check=True` 会让步骤在 recorder 中显示完成检查框。'),
      lt('duration accepts compact strings such as 30s, 2m, and 1h.', '`duration` 支持 `30s`、`2m`、`1h` 这类紧凑写法。'),
      lt('timer can be elapsed, countdown, or both.', '`timer` 可以是 `elapsed`、`countdown` 或 `both`。'),
    ],
    checks: [
      {
        id: 'checked-step',
        label: lt('Create prepare_sample as a checked step', '创建带检查框的 `prepare_sample` 步骤'),
        evaluate: state => findStepField(state.fields, 'prepare_sample')?.has_check === true,
      },
      {
        id: 'prepare-duration',
        label: lt('Give prepare_sample a two-minute duration', '给 `prepare_sample` 设置两分钟时长'),
        evaluate: state => findStepField(state.fields, 'prepare_sample')?.estimated_duration_ms === 120000,
      },
      {
        id: 'countdown-step',
        label: lt('Create wash_window with countdown timer mode', '创建 `timer=countdown` 的 `wash_window` 步骤'),
        evaluate: state => findStepField(state.fields, 'wash_window')?.timer_mode === 'countdown',
      },
      {
        id: 'both-timer-step',
        label: lt('Create transfer_sample with timer both', '创建 `timer=both` 的 `transfer_sample` 步骤'),
        evaluate: state => findStepField(state.fields, 'transfer_sample')?.timer_mode === 'both',
      },
      {
        id: 'standalone-check',
        label: lt('Add a standalone check named review_record', '添加名为 `review_record` 的独立检查点'),
        evaluate: state => state.fields?.check.includes('review_record') ?? false,
      },
    ],
  },
  {
    id: 'var-table',
    title: lt('Variable Tables', '变量表'),
    summary: lt(
      'Use var_table for repeated structured rows.',
      '用 `var_table` 表达重复的结构化行数据。',
    ),
    intro: lt(
      'Create a var_table named samples with subvars sample_id, concentration, and volume.',
      '创建一个名为 `samples` 的 `var_table`，并包含 `sample_id`、`concentration`、`volume` 三个子字段。',
    ),
    focus: [
      lt('var_table', 'var_table'),
      lt('Subvars', '子字段'),
      lt('Repeated Data', '重复数据'),
    ],
    pattern: '{{var_table|table_id, subvars=[col_a, col_b, col_c]}}',
    starter: lt(
      lines([
        '## Batch Input',
      ]),
      lines([
        '## 批量输入',
      ]),
    ),
    solution: lt(
      lines([
        '## Batch Input',
        '',
        '{{var_table|samples, subvars=[sample_id, concentration, volume]}}',
      ]),
      lines([
        '## 批量输入',
        '',
        '{{var_table|samples, subvars=[sample_id, concentration, volume]}}',
      ]),
    ),
    hints: [
      lt('var_table uses one table id plus a subvars array.', '`var_table` 由一个表 id 和一个 `subvars` 数组组成。'),
      lt('The extracted object lives in fields.var_table.', '解析后的结果会出现在 `fields.var_table`。'),
      lt('Subvars should be simple ids for this lesson; types are optional here.', '这一关里 `subvars` 先写简单 id 即可，类型不是必填。'),
    ],
    checks: [
      {
        id: 'var-table-id',
        label: lt('Declare a var_table named samples', '声明名为 `samples` 的 `var_table`'),
        evaluate: state => Boolean(findVarTable(state.fields, 'samples')),
      },
      {
        id: 'var-table-subvars',
        label: lt('Add subvars sample_id, concentration, and volume', '添加 `sample_id`、`concentration`、`volume` 三个子字段'),
        evaluate: (state) => {
          const table = findVarTable(state.fields, 'samples')
          if (!table) return false
          const subvars = new Set(table.subvars.map(subvar => subvar.id))
          return ['sample_id', 'concentration', 'volume'].every(id => subvars.has(id))
        },
      },
    ],
  },
  {
    id: 'quiz-block',
    title: lt('Quiz Blocks', '测验块'),
    summary: lt(
      'Create interactive questions with fenced quiz blocks.',
      '用 fenced `quiz` 代码块创建交互式题目。',
    ),
    intro: lt(
      'Create a single-choice quiz named storage_temp with options A/B and answer B.',
      '创建一个名为 `storage_temp` 的单选题，提供 A/B 选项，并把答案设为 B。',
    ),
    focus: [
      lt('Quiz', '测验'),
      lt('YAML', 'YAML'),
      lt('Validation', '校验'),
    ],
    pattern: QUIZ_PATTERN,
    starter: lt(
      lines([
        '## Knowledge Check',
      ]),
      lines([
        '## 知识检查',
      ]),
    ),
    solution: lt(
      lines([
        '## Knowledge Check',
        '',
        '```quiz',
        'id: storage_temp',
        'type: choice',
        'mode: single',
        'stem: Which storage temperature should be used first?',
        'options:',
        '  - key: A',
        '    text: -20°C',
        '  - key: B',
        '    text: 4°C',
        'answer: B',
        '```',
      ]),
      lines([
        '## 知识检查',
        '',
        '```quiz',
        'id: storage_temp',
        'type: choice',
        'mode: single',
        'stem: 第一步应该使用什么储存温度？',
        'options:',
        '  - key: A',
        '    text: -20°C',
        '  - key: B',
        '    text: 4°C',
        'answer: B',
        '```',
      ]),
    ),
    hints: [
      lt('Quiz blocks start with ```quiz and use YAML-style fields inside.', '测验块以 ` ```quiz ` 开头，内部使用类似 YAML 的字段结构。'),
      lt('Single-choice quizzes need type: choice and mode: single.', '单选题需要 `type: choice` 和 `mode: single`。'),
      lt('The extracted quiz definition will appear in fields.quiz.', '解析后的测验定义会出现在 `fields.quiz`。'),
    ],
    checks: [
      {
        id: 'quiz-id',
        label: lt('Create a quiz with id storage_temp', '创建 id 为 `storage_temp` 的测验'),
        evaluate: state => Boolean(findQuiz(state.fields, 'storage_temp')),
      },
      {
        id: 'quiz-mode',
        label: lt('Use type choice with mode single', '使用 `type: choice` 且 `mode: single`'),
        evaluate: (state) => {
          const quiz = findQuiz(state.fields, 'storage_temp')
          return quiz?.type === 'choice' && quiz.mode === 'single'
        },
      },
      {
        id: 'quiz-answer',
        label: lt('Set the answer to B', '把答案设置为 B'),
        evaluate: (state) => {
          const quiz = findQuiz(state.fields, 'storage_temp')
          return quiz?.answer === 'B'
        },
      },
    ],
  },
  {
    id: 'quiz-variants',
    title: lt('Quiz Variants', '题目类型扩展'),
    summary: lt(
      'Use true/false, blank, and scale quizzes for richer structured checks.',
      '使用判断题、填空题和量表题表达更丰富的结构化检查。',
    ),
    intro: lt(
      'Create one true/false quiz, one blank quiz, and one scale quiz.',
      '创建一个判断题、一个填空题和一个量表题。',
    ),
    focus: [
      lt('true_false', 'true_false'),
      lt('blank', 'blank'),
      lt('scale', 'scale'),
    ],
    pattern: QUIZ_VARIANTS_PATTERN,
    starter: lt(
      lines([
        '## Quiz Variants',
      ]),
      lines([
        '## 题目类型扩展',
      ]),
    ),
    solution: lt(
      lines([
        '## Quiz Variants',
        '',
        '```quiz',
        'id: cold_chain_ok',
        'type: true_false',
        'stem: The sample stayed at 4°C before transfer.',
        'answer: true',
        '```',
        '',
        '```quiz',
        'id: target_concentration',
        'type: blank',
        'stem: The target NaCl concentration is [[c1]].',
        'blanks:',
        '  - key: c1',
        '    answer: 0.9%',
        '```',
        '',
        '```quiz',
        'id: handling_score',
        'type: scale',
        'stem: Rate the handling quality.',
        'display: matrix',
        'items:',
        '  - key: labeling',
        '    stem: Labeling was clear',
        '  - key: timing',
        '    stem: Timing stayed within protocol',
        'options:',
        '  - key: no',
        '    text: No',
        '    points: 0',
        '  - key: yes',
        '    text: Yes',
        '    points: 1',
        'grading:',
        '  strategy: sum',
        '```',
      ]),
      lines([
        '## 题目类型扩展',
        '',
        '```quiz',
        'id: cold_chain_ok',
        'type: true_false',
        'stem: 转移前样本一直保持在 4°C。',
        'answer: true',
        '```',
        '',
        '```quiz',
        'id: target_concentration',
        'type: blank',
        'stem: 目标 NaCl 浓度是 [[c1]]。',
        'blanks:',
        '  - key: c1',
        '    answer: 0.9%',
        '```',
        '',
        '```quiz',
        'id: handling_score',
        'type: scale',
        'stem: 评价样本处理质量。',
        'display: matrix',
        'items:',
        '  - key: labeling',
        '    stem: 标签清晰',
        '  - key: timing',
        '    stem: 时间控制符合 protocol',
        'options:',
        '  - key: no',
        '    text: 否',
        '    points: 0',
        '  - key: yes',
        '    text: 是',
        '    points: 1',
        'grading:',
        '  strategy: sum',
        '```',
      ]),
    ),
    hints: [
      lt('true_false quizzes use type: true_false and usually store a boolean answer.', '`true_false` 题通常用布尔值存储答案。'),
      lt('blank quizzes need placeholders in stem, such as [[c1]], and matching entries under blanks.', '`blank` 题需要在 `stem` 中写 `[[c1]]`，并在 `blanks` 下提供同名条目。'),
      lt('scale quizzes combine items, options, and a grading strategy.', '`scale` 题由 `items`、`options` 和 `grading` 策略组合而成。'),
    ],
    checks: [
      {
        id: 'true-false-quiz',
        label: lt('Create cold_chain_ok as a true_false quiz', '创建 `true_false` 类型的 `cold_chain_ok` 题'),
        evaluate: state => findQuiz(state.fields, 'cold_chain_ok')?.type === 'true_false',
      },
      {
        id: 'blank-quiz',
        label: lt('Create target_concentration as a blank quiz with c1', '创建带 `c1` 空位的 `target_concentration` 填空题'),
        evaluate: (state) => {
          const quiz = findQuiz(state.fields, 'target_concentration')
          return quiz?.type === 'blank' && Boolean(quiz.blanks?.some(blank => blank.key === 'c1'))
        },
      },
      {
        id: 'scale-quiz',
        label: lt('Create handling_score as a matrix scale quiz', '创建 matrix 显示的 `handling_score` 量表题'),
        evaluate: (state) => {
          const quiz = findQuiz(state.fields, 'handling_score')
          return quiz?.type === 'scale' && quiz.display === 'matrix'
        },
      },
      {
        id: 'scale-items-options',
        label: lt('Give the scale quiz at least two items and two options', '给量表题设置至少两个 items 和两个 options'),
        evaluate: (state) => {
          const quiz = findQuiz(state.fields, 'handling_score')
          return (quiz?.items?.length ?? 0) >= 2 && (quiz?.options?.length ?? 0) >= 2
        },
      },
    ],
  },
  {
    id: 'inline-vars-table',
    title: lt('Inline Vars in Markdown Tables', 'Markdown 表格中的行内变量'),
    summary: lt(
      'AIMD templates can live inside ordinary Markdown tables.',
      'AIMD 模板可以直接出现在普通 Markdown 表格里。',
    ),
    intro: lt(
      'Insert water_volume_ml and buffer_volume_ml into the Amount column of a Markdown table.',
      '在 Markdown 表格的用量列里插入 `water_volume_ml` 和 `buffer_volume_ml` 两个变量。',
    ),
    focus: [
      lt('Markdown Tables', 'Markdown 表格'),
      lt('Inline Vars', '行内变量'),
      lt('Preview', '预览'),
    ],
    pattern: lines([
      '| Reagent | Amount |',
      '| --- | --- |',
      '| Water | {{var|water_volume_ml: float}} mL |',
    ]),
    starter: lt(
      lines([
        '| Reagent | Amount |',
        '| --- | --- |',
        '| Water |  |',
        '| Buffer |  |',
      ]),
      lines([
        '| 试剂 | 用量 |',
        '| --- | --- |',
        '| 水 |  |',
        '| 缓冲液 |  |',
      ]),
    ),
    solution: lt(
      lines([
        '| Reagent | Amount |',
        '| --- | --- |',
        '| Water | {{var|water_volume_ml: float}} mL |',
        '| Buffer | {{var|buffer_volume_ml: float}} mL |',
      ]),
      lines([
        '| 试剂 | 用量 |',
        '| --- | --- |',
        '| 水 | {{var|water_volume_ml: float}} mL |',
        '| 缓冲液 | {{var|buffer_volume_ml: float}} mL |',
      ]),
    ),
    hints: [
      lt('The table syntax stays standard Markdown.', '表格语法本身仍然是标准 Markdown。'),
      lt('The AIMD template goes directly inside the table cell.', 'AIMD 模板直接写在表格单元格里。'),
      lt('The preview should still render a normal HTML table after parsing.', '解析后预览仍然应该渲染成普通 HTML 表格。'),
    ],
    checks: [
      {
        id: 'table-preview',
        label: lt('Keep a valid Markdown table that renders in preview', '保持一个可在预览中渲染的 Markdown 表格'),
        evaluate: state => state.html.includes('<table'),
      },
      {
        id: 'water-inline-var',
        label: lt('Add water_volume_ml as an inline var', '把 `water_volume_ml` 加成行内变量'),
        evaluate: state => state.fields?.var.includes('water_volume_ml') ?? false,
      },
      {
        id: 'buffer-inline-var',
        label: lt('Add buffer_volume_ml as an inline var', '把 `buffer_volume_ml` 加成行内变量'),
        evaluate: state => state.fields?.var.includes('buffer_volume_ml') ?? false,
      },
    ],
  },
  {
    id: 'review-marks',
    title: lt('Review Marks', '审阅标记'),
    summary: lt(
      'Use CriticMarkup-style marks for additions, deletions, substitutions, comments, and highlights.',
      '用 CriticMarkup 风格标记表达添加、删除、替换、注释和高亮。',
    ),
    intro: lt(
      'Revise the sentence with all five review mark forms. These marks render in preview but do not create AIMD fields.',
      '用五种审阅标记修订句子。这些标记会在预览中渲染，但不会生成 AIMD 字段。',
    ),
    focus: [
      lt('CriticMarkup', 'CriticMarkup'),
      lt('Review display', '审阅展示'),
      lt('Markdown layer', 'Markdown 层'),
    ],
    pattern: REVIEW_MARKS_PATTERN,
    starter: lt(
      lines([
        'The sample is usually stable. Add a reviewer note and highlight the risky wording.',
      ]),
      lines([
        '样本通常稳定。请添加审阅备注，并高亮需要注意的表述。',
      ]),
    ),
    solution: lt(
      lines([
        'The sample is {~~usually~>always~~} stable {++after pre-chilling++}. {--Skip this sentence if the run is exploratory.--} {>>Confirm the storage window.<<} Mark {==risky wording==} for review.',
      ]),
      lines([
        '样本{~~通常~>始终~~}稳定{++，前提是已经预冷++}。{--探索性实验可以删除这句话。--}{>>确认储存时间窗口。<<}请高亮{==需要注意的表述==}。',
      ]),
    ),
    hints: [
      lt('Additions use {++...++}; deletions use {--...--}.', '添加用 `{++...++}`，删除用 `{--...--}`。'),
      lt('Substitutions use {~~old~>new~~}; the arrow separates old and new text.', '替换用 `{~~旧文字~>新文字~~}`，箭头左旧右新。'),
      lt('Comments and highlights render visually, but extracted fields should stay empty.', '注释和高亮会被渲染出来，但字段提取结果应保持为空。'),
    ],
    checks: [
      {
        id: 'addition-mark',
        label: lt('Render an addition mark', '渲染添加标记'),
        evaluate: state => state.html.includes('aimd-critic--addition'),
      },
      {
        id: 'deletion-mark',
        label: lt('Render a deletion mark', '渲染删除标记'),
        evaluate: state => state.html.includes('aimd-critic--deletion'),
      },
      {
        id: 'substitution-mark',
        label: lt('Render a substitution mark', '渲染替换标记'),
        evaluate: state => state.html.includes('aimd-critic--substitution'),
      },
      {
        id: 'comment-mark',
        label: lt('Render a comment mark', '渲染注释标记'),
        evaluate: state => state.html.includes('aimd-critic--comment'),
      },
      {
        id: 'highlight-mark',
        label: lt('Render a highlight mark', '渲染高亮标记'),
        evaluate: state => state.html.includes('aimd-critic--highlight'),
      },
      {
        id: 'no-fields',
        label: lt('Keep review marks out of extracted AIMD fields', '审阅标记不进入 AIMD 字段提取结果'),
        evaluate: state => Boolean(state.fields)
          && state.fields!.var.length === 0
          && state.fields!.step.length === 0
          && state.fields!.quiz.length === 0,
      },
    ],
  },
  {
    id: 'client-assigner',
    title: lt('Client Assigners', 'Client Assigner'),
    summary: lt(
      'Use assigner runtime=client for browser-side derived values.',
      '用 `assigner runtime=client` 定义浏览器端派生字段。',
    ),
    intro: lt(
      'Auto-calculate total_volume_ml from water_volume_ml and buffer_volume_ml.',
      '让 `total_volume_ml` 由 `water_volume_ml` 和 `buffer_volume_ml` 自动计算得到。',
    ),
    focus: [
      lt('Assigner', 'Assigner'),
      lt('Automation', '自动化'),
      lt('Derived Fields', '派生字段'),
    ],
    pattern: CLIENT_ASSIGNER_PATTERN,
    starter: lt(
      lines([
        '{{var|water_volume_ml: float}}',
        '{{var|buffer_volume_ml: float}}',
        '{{var|total_volume_ml: float}}',
        '',
        'Add a client assigner below.',
      ]),
      lines([
        '{{var|water_volume_ml: float}}',
        '{{var|buffer_volume_ml: float}}',
        '{{var|total_volume_ml: float}}',
        '',
        '在下方补上一个 client assigner。',
      ]),
    ),
    solution: lt(
      lines([
        '{{var|water_volume_ml: float}}',
        '{{var|buffer_volume_ml: float}}',
        '{{var|total_volume_ml: float}}',
        '',
        '```assigner runtime=client',
        'assigner(',
        '  {',
        '    mode: "auto",',
        '    dependent_fields: ["water_volume_ml", "buffer_volume_ml"],',
        '    assigned_fields: ["total_volume_ml"],',
        '  },',
        '  function calculate_total_volume({ water_volume_ml, buffer_volume_ml }) {',
        '    return {',
        '      total_volume_ml: water_volume_ml + buffer_volume_ml,',
        '    };',
        '  }',
        ');',
        '```',
      ]),
      lines([
        '{{var|water_volume_ml: float}}',
        '{{var|buffer_volume_ml: float}}',
        '{{var|total_volume_ml: float}}',
        '',
        '```assigner runtime=client',
        'assigner(',
        '  {',
        '    mode: "auto",',
        '    dependent_fields: ["water_volume_ml", "buffer_volume_ml"],',
        '    assigned_fields: ["total_volume_ml"],',
        '  },',
        '  function calculate_total_volume({ water_volume_ml, buffer_volume_ml }) {',
        '    return {',
        '      total_volume_ml: water_volume_ml + buffer_volume_ml,',
        '    };',
        '  }',
        ');',
        '```',
      ]),
    ),
    hints: [
      lt('A client assigner is a fenced code block with runtime=client.', '`client assigner` 是一个带 `runtime=client` 的 fenced 代码块。'),
      lt('The config object defines mode, dependent_fields, and assigned_fields.', '配置对象里需要定义 `mode`、`dependent_fields`、`assigned_fields`。'),
      lt('The second argument must be a named function with exactly one parameter.', '第二个参数必须是具名函数，并且只能接收一个参数。'),
    ],
    checks: [
      {
        id: 'assigner-id',
        label: lt('Create a client assigner named calculate_total_volume', '创建名为 `calculate_total_volume` 的 client assigner'),
        evaluate: state => Boolean(findClientAssigner(state.fields, 'calculate_total_volume')),
      },
      {
        id: 'assigner-mode',
        label: lt('Set the assigner mode to auto', '把 assigner 模式设为 `auto`'),
        evaluate: (state) => {
          const assigner = findClientAssigner(state.fields, 'calculate_total_volume')
          return assigner?.mode === 'auto'
        },
      },
      {
        id: 'assigner-inputs',
        label: lt('Read water_volume_ml and buffer_volume_ml', '读取 `water_volume_ml` 和 `buffer_volume_ml`'),
        evaluate: (state) => {
          const assigner = findClientAssigner(state.fields, 'calculate_total_volume')
          if (!assigner) return false
          const dependencies = new Set(assigner.dependent_fields)
          return dependencies.has('water_volume_ml') && dependencies.has('buffer_volume_ml')
        },
      },
      {
        id: 'assigner-output',
        label: lt('Write total_volume_ml', '写入 `total_volume_ml`'),
        evaluate: (state) => {
          const assigner = findClientAssigner(state.fields, 'calculate_total_volume')
          return assigner?.assigned_fields.includes('total_volume_ml') ?? false
        },
      },
    ],
  },
]

export function getTutorialLessons(locale: DemoLocale): TutorialLesson[] {
  return LESSON_DEFINITIONS.map(lesson => ({
    id: lesson.id,
    title: resolveText(lesson.title, locale),
    summary: resolveText(lesson.summary, locale),
    intro: resolveText(lesson.intro, locale),
    focus: lesson.focus.map(item => resolveText(item, locale)),
    pattern: resolveText(lesson.pattern, locale),
    starter: resolveText(lesson.starter, locale),
    solution: resolveText(lesson.solution, locale),
    hints: lesson.hints.map(item => resolveText(item, locale)),
    checks: lesson.checks.map(check => ({
      id: check.id,
      label: resolveText(check.label, locale),
      evaluate: check.evaluate,
    })),
  }))
}
