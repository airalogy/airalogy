import { getAimdRendererQuizTypeLabel as getSharedRendererQuizTypeLabel } from "@airalogy/aimd-renderer"

export type AimdRecorderLocale = "en-US" | "zh-CN"

export const DEFAULT_AIMD_RECORDER_LOCALE: AimdRecorderLocale = "en-US"

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K]
}

export interface AimdRecorderMessages {
  scope: {
    var: string
    quiz: string
    step: string
    check: string
    table: string
  }
  quiz: {
    types: {
      choice: string
      singleChoice: string
      multipleChoice: string
      trueFalse: string
      blank: string
      open: string
      scale: string
    }
    score: (score: string | number) => string
    answer: (value: string) => string
    rubric: (value: string) => string
    gradedScore: (earned: string | number, max: string | number) => string
    feedback: string
    classification: string
    interpretation: string
    reviewRequired: string
    status: {
      correct: string
      incorrect: string
      partial: string
      scored: string
      needsReview: string
      error: string
      ungraded: string
    }
    openPlaceholder: string
  }
  step: {
    annotationPlaceholder: string
    annotationToggle: string
    estimatedDuration: (value: string) => string
    estimatedBadge: (value: string) => string
    remainingDuration: (value: string) => string
    remainingBadge: (value: string) => string
    overtimeDuration: (value: string) => string
    overtimeBadge: (value: string) => string
    recordedDuration: (value: string) => string
    recordedBadge: (value: string) => string
    protocolEstimatedTotal: (value: string) => string
    protocolRecordedTotal: (value: string) => string
    timerToggle: string
    startTimer: string
    pauseTimer: string
    resumeTimer: string
    resetTimer: string
  }
  check: {
    annotationPlaceholder: string
  }
  table: {
    actionColumn: string
    dragDisabled: string
    dragReorder: string
    deleteRow: string
    addRow: string
  }
  assigner: {
    run: string
    running: string
    cancel: string
  }
  file: {
    choose: string
    selected: string
    clear: string
    open: string
    download: string
    preview: string
    replace: string
    uploadFailed: string
  }
  scalarList: {
    itemsMode: string
    jsonMode: string
    itemPlaceholder: string
    itemIndex: (index: number) => string
    addItem: string
    removeItem: string
    dragItem: string
    jsonInvalidSyntax: string
    jsonInvalidArray: string
    jsonInvalidItem: string
  }
  boolean: {
    unset: string
    true: string
    false: string
  }
  search: {
    label: string
    fieldLabel: string
    placeholder: string
    allFields: string
    previous: string
    next: string
    clear: string
    collapse: string
    noMatches: string
    matchCount: (current: number, total: number) => string
  }
  dna: {
    editMode: string
    interactiveMode: string
    rawMode: string
    topology: string
    linear: string
    circular: string
    sequence: string
    sequenceName: string
    sequenceNamePlaceholder: string
    sequencePlaceholder: string
    viewer: string
    viewerHint: string
    viewerRequiresSequence: string
    onboardingPasteLabel: string
    onboardingApplySequence: string
    onboardingImportFile: string
    onboardingImportHint: string
    onboardingNoSequenceDetected: string
    onboardingImportReadError: string
    importReplaceConfirm: string
    selection: string
    selectionEmpty: string
    selectionClear: string
    selectionRange: (value: string) => string
    selectionTarget: (value: string) => string
    selectionModeSequence: string
    createFromSelection: string
    applySelectionToSegment: string
    annotations: string
    addAnnotation: string
    exportGenBank: string
    removeAnnotation: string
    editAnnotation: string
    focusAnnotation: string
    noAnnotations: string
    interactiveDetails: string
    interactiveDetailsHint: string
    interactiveDetailsEmpty: string
    advancedEditor: string
    advancedEditorHint: string
    advancedEditorEmpty: string
    selectedAnnotation: (value: string) => string
    annotationName: string
    annotationType: string
    segments: string
    addSegment: string
    removeSegment: string
    start: string
    end: string
    partialStart: string
    partialEnd: string
    strand: string
    forward: string
    reverse: string
    qualifiers: string
    addQualifier: string
    removeQualifier: string
    noQualifiers: string
    qualifierKey: string
    qualifierValue: string
    color: string
    iupacHint: string
    invalidCharacters: (chars: string) => string
    length: (count: number) => string
    gc: (value: string) => string
    gcUnavailable: string
    segmentRequiresSequence: string
    segmentRangeError: string
    segmentOutOfBounds: (end: number, length: number) => string
  }
  common: {
    emptyValue?: string
    emptyContent: string
  }
}

export type AimdRecorderMessagesInput = DeepPartial<AimdRecorderMessages>

export interface AimdRecorderI18nOptions {
  locale?: AimdRecorderLocale | string
  messages?: AimdRecorderMessagesInput
}

function detectRuntimeLocale(): string | undefined {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang) {
      return htmlLang
    }
  }

  if (typeof navigator !== "undefined") {
    if (navigator.language) {
      return navigator.language
    }
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      return navigator.languages[0]
    }
  }

  return undefined
}

const EN_US_MESSAGES: AimdRecorderMessages = {
  scope: {
    var: "var",
    quiz: "quiz",
    step: "step",
    check: "check",
    table: "table",
  },
  quiz: {
    types: {
      choice: "choice",
      singleChoice: "Single choice",
      multipleChoice: "Multiple choice",
      trueFalse: "True/false",
      blank: "blank",
      open: "open",
      scale: "scale",
    },
    score: score => `${score} pt`,
    answer: value => `Answer: ${value}`,
    rubric: value => `Rubric: ${value}`,
    gradedScore: (earned, max) => `Score: ${earned} / ${max}`,
    feedback: "Feedback",
    classification: "Classification",
    interpretation: "Interpretation",
    reviewRequired: "Review required",
    status: {
      correct: "Correct",
      incorrect: "Incorrect",
      partial: "Partial",
      scored: "Scored",
      needsReview: "Needs review",
      error: "Error",
      ungraded: "Ungraded",
    },
    openPlaceholder: "Input your answer...",
  },
  step: {
    annotationPlaceholder: "Notes",
    annotationToggle: "Notes",
    estimatedDuration: value => `Estimated: ${value}`,
    estimatedBadge: value => `ETA ${value}`,
    remainingDuration: value => `Remaining: ${value}`,
    remainingBadge: value => `Remain ${value}`,
    overtimeDuration: value => `Overtime: ${value}`,
    overtimeBadge: value => `Overtime ${value}`,
    recordedDuration: value => `Recorded: ${value}`,
    recordedBadge: value => `Timer ${value}`,
    protocolEstimatedTotal: value => `Estimated total ${value}`,
    protocolRecordedTotal: value => `Recorded total ${value}`,
    timerToggle: "Timer",
    startTimer: "Start",
    pauseTimer: "Pause",
    resumeTimer: "Resume",
    resetTimer: "Reset",
  },
  check: {
    annotationPlaceholder: "Notes",
  },
  table: {
    actionColumn: "Actions",
    dragDisabled: "Drag is disabled in read-only mode",
    dragReorder: "Drag to reorder rows",
    deleteRow: "Delete",
    addRow: "Add row",
  },
  assigner: {
    run: "Run Assigner",
    running: "Running",
    cancel: "Cancel",
  },
  file: {
    choose: "Choose file",
    selected: "Selected file",
    clear: "Clear file",
    open: "Open file",
    download: "Download",
    preview: "Preview",
    replace: "Replace file",
    uploadFailed: "File upload failed.",
  },
  scalarList: {
    itemsMode: "Items",
    jsonMode: "JSON",
    itemPlaceholder: "List item",
    itemIndex: index => `Item ${index}`,
    addItem: "Add item",
    removeItem: "Remove item",
    dragItem: "Drag to reorder",
    jsonInvalidSyntax: "Invalid JSON.",
    jsonInvalidArray: "JSON value must be an array.",
    jsonInvalidItem: "JSON array items do not match this list type.",
  },
  boolean: {
    unset: "Not set",
    true: "True",
    false: "False",
  },
  search: {
    label: "Search record",
    fieldLabel: "Search field",
    placeholder: "Search this record",
    allFields: "All fields",
    previous: "Previous match",
    next: "Next match",
    clear: "Clear search",
    collapse: "Hide",
    noMatches: "No matches",
    matchCount: (current, total) => `${current} / ${total}`,
  },
  dna: {
    editMode: "Edit mode",
    interactiveMode: "Interactive",
    rawMode: "Raw structure",
    topology: "Topology",
    linear: "Linear",
    circular: "Circular",
    sequence: "Sequence",
    sequenceName: "Sequence name",
    sequenceNamePlaceholder: "Optional plasmid or sequence name",
    sequencePlaceholder: "Paste or type DNA sequence using IUPAC DNA letters",
    viewer: "Sequence viewer",
    viewerHint: "Drag across the sequence to select a range. Click a feature to edit it in the selected annotation panel.",
    viewerRequiresSequence: "Start by pasting a DNA sequence, or use Import file in the toolbar.",
    onboardingPasteLabel: "Paste sequence",
    onboardingApplySequence: "Use sequence",
    onboardingImportFile: "Import file",
    onboardingImportHint: "Supports plain DNA text, FASTA, and GenBank sequence imports. Use the toolbar Import file action for files; raw structure mode remains available for advanced cleanup.",
    onboardingNoSequenceDetected: "No DNA sequence was detected in the pasted content or imported file.",
    onboardingImportReadError: "The selected file could not be read.",
    importReplaceConfirm: "Importing a file or pasted sequence will replace the current DNA sequence and clear existing annotations. Continue?",
    selection: "Current selection",
    selectionEmpty: "Drag across the sequence to create or update an annotation.",
    selectionClear: "Clear selection",
    selectionRange: value => `Range: ${value}`,
    selectionTarget: value => `Target: ${value}`,
    selectionModeSequence: "Sequence range",
    createFromSelection: "Create annotation",
    applySelectionToSegment: "Apply to active segment",
    annotations: "Annotations",
    addAnnotation: "Add annotation",
    exportGenBank: "Export GenBank",
    removeAnnotation: "Remove annotation",
    editAnnotation: "Edit",
    focusAnnotation: "Focus in viewer",
    noAnnotations: "No annotations yet.",
    interactiveDetails: "Selected annotation",
    interactiveDetailsHint: "Use interactive mode for selection and quick annotation edits. Switch to raw structure mode for segments, qualifiers, and bulk annotation management.",
    interactiveDetailsEmpty: "Click a feature in the viewer to edit it, or drag a range above to create one.",
    advancedEditor: "Raw structure editor",
    advancedEditorHint: "Use raw structure mode for sequence text, multi-segment locations, qualifiers, and precise coordinate cleanup.",
    advancedEditorEmpty: "Select or create an annotation to edit its structured fields.",
    selectedAnnotation: value => `Selected: ${value}`,
    annotationName: "Name",
    annotationType: "Type",
    segments: "Segments",
    addSegment: "Add segment",
    removeSegment: "Remove segment",
    start: "Start",
    end: "End",
    partialStart: "Partial start",
    partialEnd: "Partial end",
    strand: "Strand",
    forward: "Forward",
    reverse: "Reverse",
    qualifiers: "Qualifiers",
    addQualifier: "Add qualifier",
    removeQualifier: "Remove qualifier",
    noQualifiers: "No qualifiers yet.",
    qualifierKey: "Key",
    qualifierValue: "Value",
    color: "Color",
    iupacHint: "Supports IUPAC DNA letters: A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N.",
    invalidCharacters: chars => `Unsupported sequence characters: ${chars}`,
    length: count => `Length: ${count} bp`,
    gc: value => `GC: ${value}`,
    gcUnavailable: "GC: -",
    segmentRequiresSequence: "Enter a sequence before positioning feature segments.",
    segmentRangeError: "Segment end must be greater than or equal to start.",
    segmentOutOfBounds: (end, length) => `Segment end ${end} exceeds sequence length ${length}.`,
  },
  common: {
    emptyValue: "Not set",
    emptyContent: "No renderable protocol content.",
  },
}

const ZH_CN_MESSAGES: AimdRecorderMessages = {
  scope: {
    var: "变量",
    quiz: "题目",
    step: "步骤",
    check: "检查点",
    table: "表格",
  },
  quiz: {
    types: {
      choice: "选择",
      singleChoice: "单选",
      multipleChoice: "多选",
      trueFalse: "判断",
      blank: "填空",
      open: "开放",
      scale: "量表",
    },
    score: score => `${score} 分`,
    answer: value => `答案：${value}`,
    rubric: value => `评分标准：${value}`,
    gradedScore: (earned, max) => `得分：${earned} / ${max}`,
    feedback: "反馈",
    classification: "分组",
    interpretation: "解读",
    reviewRequired: "需要复核",
    status: {
      correct: "正确",
      incorrect: "错误",
      partial: "部分得分",
      scored: "已评分",
      needsReview: "待复核",
      error: "异常",
      ungraded: "未评分",
    },
    openPlaceholder: "请输入答案...",
  },
  step: {
    annotationPlaceholder: "备注",
    annotationToggle: "备注",
    estimatedDuration: value => `预计：${value}`,
    estimatedBadge: value => `预计 ${value}`,
    remainingDuration: value => `剩余：${value}`,
    remainingBadge: value => `剩余 ${value}`,
    overtimeDuration: value => `超时：${value}`,
    overtimeBadge: value => `超时 ${value}`,
    recordedDuration: value => `已记录：${value}`,
    recordedBadge: value => `计时 ${value}`,
    protocolEstimatedTotal: value => `协议预计总时长 ${value}`,
    protocolRecordedTotal: value => `协议已记录时长 ${value}`,
    timerToggle: "计时",
    startTimer: "开始",
    pauseTimer: "暂停",
    resumeTimer: "继续",
    resetTimer: "重置",
  },
  check: {
    annotationPlaceholder: "备注",
  },
  table: {
    actionColumn: "操作",
    dragDisabled: "只读模式下无法拖拽",
    dragReorder: "拖拽调整行顺序",
    deleteRow: "删除",
    addRow: "添加行",
  },
  assigner: {
    run: "运行赋值器",
    running: "运行中",
    cancel: "取消",
  },
  file: {
    choose: "选择文件",
    selected: "已选择文件",
    clear: "清除文件",
    open: "打开文件",
    download: "下载",
    preview: "预览",
    replace: "替换文件",
    uploadFailed: "文件上传失败。",
  },
  scalarList: {
    itemsMode: "逐项",
    jsonMode: "JSON",
    itemPlaceholder: "列表项",
    itemIndex: index => `第 ${index} 项`,
    addItem: "添加项",
    removeItem: "删除项",
    dragItem: "拖拽排序",
    jsonInvalidSyntax: "JSON 格式无效。",
    jsonInvalidArray: "JSON 值必须是数组。",
    jsonInvalidItem: "JSON 数组项与当前列表类型不匹配。",
  },
  boolean: {
    unset: "未填写",
    true: "是",
    false: "否",
  },
  search: {
    label: "搜索记录",
    fieldLabel: "搜索字段",
    placeholder: "搜索当前记录",
    allFields: "全部字段",
    previous: "上一个匹配",
    next: "下一个匹配",
    clear: "清除搜索",
    collapse: "收起",
    noMatches: "无匹配",
    matchCount: (current, total) => `${current} / ${total}`,
  },
  dna: {
    editMode: "编辑模式",
    interactiveMode: "交互式",
    rawMode: "原始结构",
    topology: "拓扑",
    linear: "线性",
    circular: "环状",
    sequence: "序列",
    sequenceName: "序列名称",
    sequenceNamePlaceholder: "可选的质粒或序列名称",
    sequencePlaceholder: "粘贴或输入 DNA 序列，支持 IUPAC DNA 字母",
    viewer: "序列视图",
    viewerHint: "直接在序列上拖拽选择范围，点击已有特征可在当前注释面板中编辑。",
    viewerRequiresSequence: "先粘贴一段 DNA 序列，或使用工具栏中的“导入文件”。",
    onboardingPasteLabel: "粘贴序列",
    onboardingApplySequence: "使用这段序列",
    onboardingImportFile: "导入文件",
    onboardingImportHint: "目前支持纯 DNA 文本、FASTA 和 GenBank 序列导入；文件请使用工具栏中的“导入文件”，原始结构模式仍可用于高级修整。",
    onboardingNoSequenceDetected: "在粘贴内容或导入文件中没有识别到 DNA 序列。",
    onboardingImportReadError: "无法读取所选文件。",
    importReplaceConfirm: "导入文件或粘贴新序列会替换当前 DNA 序列，并清空现有注释。是否继续？",
    selection: "当前选择",
    selectionEmpty: "请先在序列上拖拽选择范围，再创建或更新注释。",
    selectionClear: "清除选择",
    selectionRange: value => `范围：${value}`,
    selectionTarget: value => `目标：${value}`,
    selectionModeSequence: "序列范围",
    createFromSelection: "创建注释",
    applySelectionToSegment: "应用到当前片段",
    annotations: "注释",
    addAnnotation: "添加注释",
    exportGenBank: "导出 GenBank",
    removeAnnotation: "删除注释",
    editAnnotation: "编辑",
    focusAnnotation: "在视图中定位",
    noAnnotations: "还没有注释。",
    interactiveDetails: "当前注释",
    interactiveDetailsHint: "交互式模式适合拖拽选区和快速修改基础属性；多段位置、限定词和批量管理请切到原始结构模式。",
    interactiveDetailsEmpty: "请先在视图中点击一个特征，或先拖拽选择范围创建注释。",
    advancedEditor: "原始结构编辑",
    advancedEditorHint: "原始结构模式用于序列原文、多段位置、限定词和精确坐标修正。",
    advancedEditorEmpty: "请选择或创建一个注释后再编辑结构化字段。",
    selectedAnnotation: value => `当前注释：${value}`,
    annotationName: "名称",
    annotationType: "类型",
    segments: "位置片段",
    addSegment: "添加片段",
    removeSegment: "删除片段",
    start: "起点",
    end: "终点",
    partialStart: "起点不完整",
    partialEnd: "终点不完整",
    strand: "链方向",
    forward: "正链",
    reverse: "反链",
    qualifiers: "限定词",
    addQualifier: "添加限定词",
    removeQualifier: "删除限定词",
    noQualifiers: "还没有限定词。",
    qualifierKey: "键",
    qualifierValue: "值",
    color: "颜色",
    iupacHint: "支持 IUPAC DNA 字母：A、C、G、T、R、Y、S、W、K、M、B、D、H、V、N。",
    invalidCharacters: chars => `存在不支持的序列字符：${chars}`,
    length: count => `长度：${count} bp`,
    gc: value => `GC：${value}`,
    gcUnavailable: "GC：-",
    segmentRequiresSequence: "请先输入序列，再设置特征位置片段。",
    segmentRangeError: "片段终点必须大于或等于起点。",
    segmentOutOfBounds: (end, length) => `片段终点 ${end} 超出了序列长度 ${length}。`,
  },
  common: {
    emptyValue: "未填写",
    emptyContent: "没有可渲染的协议内容。",
  },
}

const BASE_MESSAGES: Record<AimdRecorderLocale, AimdRecorderMessages> = {
  "en-US": EN_US_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return base
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key]
    if (overrideValue === undefined) {
      continue
    }

    const baseValue = base[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key as string] = deepMerge(baseValue, overrideValue as any)
      continue
    }

    result[key as string] = overrideValue as T[keyof T]
  }

  return result as T
}

export function resolveAimdRecorderLocale(locale?: string): AimdRecorderLocale {
  const runtimeLocale = locale || detectRuntimeLocale()

  if (runtimeLocale?.toLowerCase().startsWith("zh")) {
    return "zh-CN"
  }

  return DEFAULT_AIMD_RECORDER_LOCALE
}

export function createAimdRecorderMessages(
  locale: string | undefined,
  overrides?: AimdRecorderMessagesInput,
): AimdRecorderMessages {
  const resolvedLocale = resolveAimdRecorderLocale(locale)
  const merged = deepMerge(BASE_MESSAGES[resolvedLocale], overrides)
  const choiceOverride = overrides?.quiz?.types?.choice
  const hasSingleChoiceOverride = overrides?.quiz?.types?.singleChoice !== undefined
  const hasMultipleChoiceOverride = overrides?.quiz?.types?.multipleChoice !== undefined

  if (typeof choiceOverride === "string") {
    if (!hasSingleChoiceOverride) {
      merged.quiz.types.singleChoice = choiceOverride
    }
    if (!hasMultipleChoiceOverride) {
      merged.quiz.types.multipleChoice = choiceOverride
    }
  }

  return merged
}

export function getAimdRecorderScopeLabel(
  scope: string,
  messages: Pick<AimdRecorderMessages, "scope">,
): string {
  switch (scope) {
    case "var":
      return messages.scope.var
    case "quiz":
      return messages.scope.quiz
    case "step":
      return messages.scope.step
    case "check":
      return messages.scope.check
    case "var_table":
      return messages.scope.table
    default:
      return scope
  }
}

export function getAimdRecorderEmptyValueLabel(
  messages: Pick<AimdRecorderMessages, "common" | "boolean">,
): string {
  return messages.common.emptyValue ?? messages.boolean.unset
}

export function getAimdRecorderQuizTypeLabel(
  quizType: string | undefined,
  messages: Pick<AimdRecorderMessages, "quiz">,
  quizMode?: string,
): string {
  return getSharedRendererQuizTypeLabel(quizType, quizMode, messages)
}
