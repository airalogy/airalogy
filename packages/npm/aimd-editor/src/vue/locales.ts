export type AimdEditorLocale = 'en-US' | 'zh-CN'

export const DEFAULT_AIMD_EDITOR_LOCALE: AimdEditorLocale = 'en-US'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K]
}

export interface AimdEditorMessages {
  mode: {
    source: string
    sourceTitle: string
    wysiwyg: string
    wysiwygTitle: string
  }
  common: {
    loadingEditor: string
    preview: string
    cancel: string
    insert: string
    remove: string
    none: string
    available: string
  }
  fieldTypes: {
    var: { label: string, desc: string }
    var_table: { label: string, desc: string }
    quiz: { label: string, desc: string }
    step: { label: string, desc: string }
    check: { label: string, desc: string }
    ref_step: { label: string, desc: string }
    ref_var: { label: string, desc: string }
    ref_fig: { label: string, desc: string }
    cite: { label: string, desc: string }
  }
  varTypePresets: {
    str: { label: string, desc: string }
    int: { label: string, desc: string }
    float: { label: string, desc: string }
    bool: { label: string, desc: string }
    date: { label: string, desc: string }
    datetime: { label: string, desc: string }
    time: { label: string, desc: string }
    codeStr: { label: string, desc: string }
    pyStr: { label: string, desc: string }
    jsStr: { label: string, desc: string }
    tsStr: { label: string, desc: string }
    jsonStr: { label: string, desc: string }
    tomlStr: { label: string, desc: string }
    yamlStr: { label: string, desc: string }
    dnaSequence: { label: string, desc: string }
    currentTime: { label: string, desc: string }
    userName: { label: string, desc: string }
    airalogyMarkdown: { label: string, desc: string }
  }
  mdToolbar: {
    h1: string
    h2: string
    h3: string
    bold: string
    italic: string
    strikethrough: string
    ul: string
    ol: string
    blockquote: string
    code: string
    codeblock: string
    link: string
    image: string
    table: string
    hr: string
    math: string
  }
  dialog: {
    title: (label: string) => string
    variableId: string
    typePresetLabel: string
    typeHint: string
    customType: string
    type: string
    defaultValue: string
    titleLabel: string
    tableId: string
    subVariableColumns: string
    subVariableColumnsHint: string
    stepId: string
    level: string
    level1: string
    level2: string
    level3: string
    quizId: string
    questionType: string
    score: string
    stem: string
    blankStemHint: string
    mode: string
    options: string
    dragToReorder: string
    answer: string
    correct: string
    correctAnswer: string
    optionsHint: string
    blanks: string
    blanksHint: string
    rubric: string
    checkpointId: string
    referencedStepId: string
    referencedVariableId: string
    referencedFigureId: string
    citationId: string
    citationHint: string
    customTypeHint: string
  }
  placeholders: {
    variableId: string
    type: string
    defaultValue: string
    title: string
    tableId: string
    subVariableColumns: string
    stepId: string
    quizId: string
    score: string
    stem: string
    optionKey: string
    optionText: string
    blankKey: string
    blankAnswer: string
    rubric: string
    checkpointId: string
    citationIds: string
  }
  quiz: {
    types: {
      choice: string
      blank: string
      open: string
    }
    modes: {
      single: string
      multiple: string
    }
  }
  actions: {
    addOption: string
    addBlank: string
  }
  errors: {
    blankQuizRequiresBlankKey: string
    blankKeysMustBeUnique: (keys: string[]) => string
    blankStemRequiresPlaceholders: string
    duplicatePlaceholders: (keys: string[]) => string
    undefinedPlaceholders: (keys: string[]) => string
    missingPlaceholders: (keys: string[]) => string
  }
  defaults: {
    questionStem: string
    fillQuestionStem: string
    optionText: (key: string) => string
  }
  snippets: {
    heading: string
    boldText: string
    italicText: string
    strikethrough: string
    listItem: string
    quote: string
    code: string
    codeBlock: string
    linkText: string
    altText: string
    mathFormula: string
    tableColumnA: string
    tableColumnB: string
    tableColumnC: string
  }
  blockMenu: {
    addBlockTitle: string
    placeholder: string
    groups: {
      text: string
      list: string
      advanced: string
      aimd: string
    }
    items: {
      text: string
      heading1: string
      heading2: string
      heading3: string
      quote: string
      divider: string
      bulletList: string
      orderedList: string
      codeBlock: string
      table: string
    }
  }
  completions: {
    insertAimdField: (keyword: string) => string
    quizBlockLabel: string
    quizBlock: string
  }
}

export type AimdEditorMessagesInput = DeepPartial<AimdEditorMessages>

function detectRuntimeLocale(): string | undefined {
  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang) return htmlLang
  }

  if (typeof navigator !== 'undefined') {
    if (navigator.language) return navigator.language
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      return navigator.languages[0]
    }
  }

  return undefined
}

const EN_US_MESSAGES: AimdEditorMessages = {
  mode: {
    source: 'Source',
    sourceTitle: 'Source Mode',
    wysiwyg: 'WYSIWYG',
    wysiwygTitle: 'WYSIWYG Mode',
  },
  common: {
    loadingEditor: 'Loading Editor...',
    preview: 'Preview',
    cancel: 'Cancel',
    insert: 'Insert',
    remove: 'Remove',
    none: 'None',
    available: 'Available',
  },
  fieldTypes: {
    var: { label: 'Variable', desc: 'Define a variable' },
    var_table: { label: 'Var Table', desc: 'Define a variable table' },
    quiz: { label: 'Quiz', desc: 'Define a quiz item' },
    step: { label: 'Step', desc: 'Define a step' },
    check: { label: 'Checkpoint', desc: 'Define a checkpoint' },
    ref_step: { label: 'Ref Step', desc: 'Reference a defined step' },
    ref_var: { label: 'Ref Var', desc: 'Reference a defined variable' },
    ref_fig: { label: 'Ref Fig', desc: 'Reference a defined figure' },
    cite: { label: 'Citation', desc: 'Insert a citation' },
  },
  varTypePresets: {
    str: { label: 'str', desc: 'Single-line text' },
    int: { label: 'int', desc: 'Whole number' },
    float: { label: 'float', desc: 'Decimal number' },
    bool: { label: 'bool', desc: 'Yes / no checkbox' },
    date: { label: 'date', desc: 'Calendar date picker' },
    datetime: { label: 'datetime', desc: 'Date and time picker' },
    time: { label: 'time', desc: 'Time-only picker' },
    codeStr: { label: 'CodeStr', desc: 'Plain code editor without language-specific highlighting' },
    pyStr: { label: 'PyStr', desc: 'Python code editor with syntax highlighting' },
    jsStr: { label: 'JsStr', desc: 'JavaScript code editor with syntax highlighting' },
    tsStr: { label: 'TsStr', desc: 'TypeScript code editor with syntax highlighting' },
    jsonStr: { label: 'JsonStr', desc: 'JSON editor with syntax highlighting' },
    tomlStr: { label: 'TomlStr', desc: 'TOML-like code editor with syntax highlighting' },
    yamlStr: { label: 'YamlStr', desc: 'YAML editor with syntax highlighting' },
    dnaSequence: { label: 'DNASequence', desc: 'Editable DNA sequence with annotations' },
    currentTime: { label: 'CurrentTime', desc: 'Auto-fill the current time' },
    userName: { label: 'UserName', desc: 'Auto-fill the current user name' },
    airalogyMarkdown: { label: 'AiralogyMarkdown', desc: 'Multi-line markdown notes' },
  },
  mdToolbar: {
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    bold: 'Bold',
    italic: 'Italic',
    strikethrough: 'Strikethrough',
    ul: 'Unordered List',
    ol: 'Ordered List',
    blockquote: 'Blockquote',
    code: 'Inline Code',
    codeblock: 'Code Block',
    link: 'Link',
    image: 'Image',
    table: 'Table',
    hr: 'Horizontal Rule',
    math: 'Math Formula',
  },
  dialog: {
    title: label => `Insert AIMD ${label}`,
    variableId: 'Variable ID',
    typePresetLabel: 'Common Types',
    typeHint: 'Pick the closest match for the field you want to collect.',
    customType: 'Custom / Advanced Type',
    type: 'Type',
    defaultValue: 'Default Value',
    titleLabel: 'Title',
    tableId: 'Table ID',
    subVariableColumns: 'Sub-variable Columns',
    subVariableColumnsHint: 'Comma-separated column names',
    stepId: 'Step ID',
    level: 'Level',
    level1: '1 (Top level)',
    level2: '2 (Sub-step)',
    level3: '3 (Sub-sub-step)',
    quizId: 'Quiz ID',
    questionType: 'Question Type',
    score: 'Score',
    stem: 'Stem',
    blankStemHint: 'Use placeholders in stem like [[b1]], [[b2]] and keep keys consistent with the blanks list.',
    mode: 'Mode',
    options: 'Options',
    dragToReorder: 'Drag to reorder',
    answer: 'Answer',
    correct: 'Correct',
    correctAnswer: 'Correct Answer',
    optionsHint: 'Use unique keys (A/B/C), then mark answer directly in each row.',
    blanks: 'Blanks',
    blanksHint: 'Use keys like b1, b2 and refer to them in stem as [[b1]], [[b2]].',
    rubric: 'Rubric',
    checkpointId: 'Checkpoint ID',
    referencedStepId: 'Referenced Step ID',
    referencedVariableId: 'Referenced Variable ID',
    referencedFigureId: 'Referenced Figure ID',
    citationId: 'Citation ID',
    citationHint: 'Comma-separated citation IDs',
    customTypeHint: 'Optional. Enter another AIMD type if you need something more specific, such as list or dict.',
  },
  placeholders: {
    variableId: 'sample_id',
    type: 'list / dict / CustomType',
    defaultValue: 'Optional',
    title: 'Display title (optional)',
    tableId: 'table_id',
    subVariableColumns: 'col1, col2, col3',
    stepId: 'step_id',
    quizId: 'quiz_choice_1',
    score: 'Optional, e.g. 5',
    stem: 'Question stem',
    optionKey: 'A',
    optionText: 'Option text',
    blankKey: 'b1',
    blankAnswer: 'Expected answer',
    rubric: 'Optional rubric',
    checkpointId: 'check_id',
    citationIds: 'ref1, ref2',
  },
  quiz: {
    types: {
      choice: 'choice',
      blank: 'blank',
      open: 'open',
    },
    modes: {
      single: 'single',
      multiple: 'multiple',
    },
  },
  actions: {
    addOption: '+ Add option',
    addBlank: '+ Add blank',
  },
  errors: {
    blankQuizRequiresBlankKey: 'Blank quiz requires at least one non-empty blank key.',
    blankKeysMustBeUnique: keys => `Blank keys must be unique: ${keys.join(', ')}`,
    blankStemRequiresPlaceholders: 'Blank quiz stem must contain placeholders like [[b1]].',
    duplicatePlaceholders: keys => `Stem contains duplicate placeholders: ${keys.join(', ')}`,
    undefinedPlaceholders: keys => `Stem contains undefined placeholders: ${keys.join(', ')}`,
    missingPlaceholders: keys => `Stem is missing placeholders for blank keys: ${keys.join(', ')}`,
  },
  defaults: {
    questionStem: 'Which option is correct?',
    fillQuestionStem: 'Please fill this question stem.',
    optionText: key => `Option ${key}`,
  },
  snippets: {
    heading: 'Heading',
    boldText: 'bold text',
    italicText: 'italic text',
    strikethrough: 'strikethrough',
    listItem: 'list item',
    quote: 'quote',
    code: 'code',
    codeBlock: 'code block',
    linkText: 'link text',
    altText: 'alt text',
    mathFormula: 'E = mc^2',
    tableColumnA: 'Col A',
    tableColumnB: 'Col B',
    tableColumnC: 'Col C',
  },
  blockMenu: {
    addBlockTitle: 'Click to add block',
    placeholder: 'Please enter...',
    groups: {
      text: 'Text',
      list: 'List',
      advanced: 'Advanced',
      aimd: 'AIMD',
    },
    items: {
      text: 'Text',
      heading1: 'Heading 1',
      heading2: 'Heading 2',
      heading3: 'Heading 3',
      quote: 'Quote',
      divider: 'Divider',
      bulletList: 'Bullet List',
      orderedList: 'Ordered List',
      codeBlock: 'Code Block',
      table: 'Table',
    },
  },
  completions: {
    insertAimdField: keyword => `Insert AIMD ${keyword} field`,
    quizBlockLabel: 'quiz block',
    quizBlock: 'Insert AIMD quiz code block',
  },
}

const ZH_CN_MESSAGES: AimdEditorMessages = {
  mode: {
    source: '源码',
    sourceTitle: '源码模式',
    wysiwyg: '所见即所得',
    wysiwygTitle: '所见即所得模式',
  },
  common: {
    loadingEditor: '正在加载编辑器...',
    preview: '预览',
    cancel: '取消',
    insert: '插入',
    remove: '删除',
    none: '无',
    available: '可用项',
  },
  fieldTypes: {
    var: { label: '变量', desc: '定义一个变量' },
    var_table: { label: '变量表', desc: '定义一个变量表' },
    quiz: { label: '题目', desc: '定义一个题目块' },
    step: { label: '步骤', desc: '定义一个步骤' },
    check: { label: '检查点', desc: '定义一个检查点' },
    ref_step: { label: '引用步骤', desc: '引用已定义的步骤' },
    ref_var: { label: '引用变量', desc: '引用已定义的变量' },
    ref_fig: { label: '引用图片', desc: '引用已定义的图片' },
    cite: { label: '引用文献', desc: '插入文献引用' },
  },
  varTypePresets: {
    str: { label: 'str', desc: '单行文本' },
    int: { label: 'int', desc: '整数' },
    float: { label: 'float', desc: '小数' },
    bool: { label: 'bool', desc: '是 / 否复选框' },
    date: { label: 'date', desc: '日期选择器' },
    datetime: { label: 'datetime', desc: '日期时间选择器' },
    time: { label: 'time', desc: '时间选择器' },
    codeStr: { label: 'CodeStr', desc: '通用代码编辑器，不指定语言高亮' },
    pyStr: { label: 'PyStr', desc: '带 Python 语法高亮的代码编辑器' },
    jsStr: { label: 'JsStr', desc: '带 JavaScript 语法高亮的代码编辑器' },
    tsStr: { label: 'TsStr', desc: '带 TypeScript 语法高亮的代码编辑器' },
    jsonStr: { label: 'JsonStr', desc: '带 JSON 语法高亮的编辑器' },
    tomlStr: { label: 'TomlStr', desc: '带 TOML 风格语法高亮的编辑器' },
    yamlStr: { label: 'YamlStr', desc: '带 YAML 语法高亮的编辑器' },
    dnaSequence: { label: 'DNASequence', desc: '可编辑的 DNA 序列与注释' },
    currentTime: { label: 'CurrentTime', desc: '自动填入当前时间' },
    userName: { label: 'UserName', desc: '自动填入当前用户名' },
    airalogyMarkdown: { label: 'AiralogyMarkdown', desc: '多行 Markdown 备注' },
  },
  mdToolbar: {
    h1: '一级标题',
    h2: '二级标题',
    h3: '三级标题',
    bold: '加粗',
    italic: '斜体',
    strikethrough: '删除线',
    ul: '无序列表',
    ol: '有序列表',
    blockquote: '引用块',
    code: '行内代码',
    codeblock: '代码块',
    link: '链接',
    image: '图片',
    table: '表格',
    hr: '分割线',
    math: '数学公式',
  },
  dialog: {
    title: label => `插入 AIMD ${label}`,
    variableId: '变量 ID',
    typePresetLabel: '常用类型',
    typeHint: '先选一个最接近的输入方式，后面也可以再手动改。',
    customType: '自定义 / 高级类型',
    type: '类型',
    defaultValue: '默认值',
    titleLabel: '标题',
    tableId: '表格 ID',
    subVariableColumns: '子变量列',
    subVariableColumnsHint: '多个列名用逗号分隔',
    stepId: '步骤 ID',
    level: '层级',
    level1: '1（顶层）',
    level2: '2（子步骤）',
    level3: '3（子子步骤）',
    quizId: '题目 ID',
    questionType: '题目类型',
    score: '分值',
    stem: '题干',
    blankStemHint: '在题干中使用 [[b1]]、[[b2]] 这样的占位符，并与下方填空键保持一致。',
    mode: '模式',
    options: '选项',
    dragToReorder: '拖拽排序',
    answer: '答案',
    correct: '正确',
    correctAnswer: '正确答案',
    optionsHint: '请使用唯一键（A/B/C），并直接在每一行标记答案。',
    blanks: '填空项',
    blanksHint: '请使用 b1、b2 这样的键，并在题干中写成 [[b1]]、[[b2]]。',
    rubric: '评分说明',
    checkpointId: '检查点 ID',
    referencedStepId: '引用步骤 ID',
    referencedVariableId: '引用变量 ID',
    referencedFigureId: '引用图片 ID',
    citationId: '文献 ID',
    citationHint: '多个文献 ID 用逗号分隔',
    customTypeHint: '可选。如果需要更具体的 AIMD 类型，可以在这里输入，例如 list 或 dict。',
  },
  placeholders: {
    variableId: 'sample_id',
    type: 'list / dict / CustomType',
    defaultValue: '可选',
    title: '显示标题（可选）',
    tableId: 'table_id',
    subVariableColumns: 'col1, col2, col3',
    stepId: 'step_id',
    quizId: 'quiz_choice_1',
    score: '可选，例如 5',
    stem: '请输入题干',
    optionKey: 'A',
    optionText: '选项内容',
    blankKey: 'b1',
    blankAnswer: '预期答案',
    rubric: '可选的评分说明',
    checkpointId: 'check_id',
    citationIds: 'ref1, ref2',
  },
  quiz: {
    types: {
      choice: '选择题',
      blank: '填空题',
      open: '开放题',
    },
    modes: {
      single: '单选',
      multiple: '多选',
    },
  },
  actions: {
    addOption: '+ 添加选项',
    addBlank: '+ 添加填空项',
  },
  errors: {
    blankQuizRequiresBlankKey: '填空题至少需要一个非空的填空键。',
    blankKeysMustBeUnique: keys => `填空键必须唯一：${keys.join(', ')}`,
    blankStemRequiresPlaceholders: '填空题题干必须包含类似 [[b1]] 的占位符。',
    duplicatePlaceholders: keys => `题干中存在重复占位符：${keys.join(', ')}`,
    undefinedPlaceholders: keys => `题干中存在未定义的占位符：${keys.join(', ')}`,
    missingPlaceholders: keys => `这些填空键未在题干中使用：${keys.join(', ')}`,
  },
  defaults: {
    questionStem: '哪个选项是正确的？',
    fillQuestionStem: '请填写题干内容。',
    optionText: key => `选项 ${key}`,
  },
  snippets: {
    heading: '标题',
    boldText: '加粗文本',
    italicText: '斜体文本',
    strikethrough: '删除线文本',
    listItem: '列表项',
    quote: '引用内容',
    code: '代码',
    codeBlock: '代码块',
    linkText: '链接文字',
    altText: '图片说明',
    mathFormula: 'E = mc^2',
    tableColumnA: '列 A',
    tableColumnB: '列 B',
    tableColumnC: '列 C',
  },
  blockMenu: {
    addBlockTitle: '点击添加块',
    placeholder: '请输入内容...',
    groups: {
      text: '文本',
      list: '列表',
      advanced: '高级',
      aimd: 'AIMD',
    },
    items: {
      text: '正文',
      heading1: '一级标题',
      heading2: '二级标题',
      heading3: '三级标题',
      quote: '引用块',
      divider: '分割线',
      bulletList: '无序列表',
      orderedList: '有序列表',
      codeBlock: '代码块',
      table: '表格',
    },
  },
  completions: {
    insertAimdField: keyword => `插入 AIMD ${keyword} 字段`,
    quizBlockLabel: '题目代码块',
    quizBlock: '插入 AIMD 题目代码块',
  },
}

const BASE_MESSAGES: Record<AimdEditorLocale, AimdEditorMessages> = {
  'en-US': EN_US_MESSAGES,
  'zh-CN': ZH_CN_MESSAGES,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) return base

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key]
    if (overrideValue === undefined) continue

    const baseValue = base[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key as string] = deepMerge(baseValue, overrideValue as any)
      continue
    }

    result[key as string] = overrideValue as T[keyof T]
  }

  return result as T
}

export function resolveAimdEditorLocale(locale?: string): AimdEditorLocale {
  const runtimeLocale = locale || detectRuntimeLocale()

  if (runtimeLocale?.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }

  return DEFAULT_AIMD_EDITOR_LOCALE
}

export function createAimdEditorMessages(
  locale: string | undefined,
  overrides?: AimdEditorMessagesInput,
): AimdEditorMessages {
  const resolvedLocale = resolveAimdEditorLocale(locale)
  return deepMerge(BASE_MESSAGES[resolvedLocale], overrides)
}
