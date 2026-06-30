import { computed, ref, watch } from 'vue'

export type DemoLocale = 'en-US' | 'zh-CN'

const DEMO_LOCALE_STORAGE_KEY = 'airalogy-protocol-demo-locale'

function isDemoLocale(value: unknown): value is DemoLocale {
  return value === 'en-US' || value === 'zh-CN'
}

export function normalizeDemoLocale(value: unknown): DemoLocale {
  return typeof value === 'string' && value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

function detectRuntimeLocale(): DemoLocale {
  if (typeof window !== 'undefined') {
    const storedLocale = window.localStorage.getItem(DEMO_LOCALE_STORAGE_KEY)
    if (isDemoLocale(storedLocale)) {
      return storedLocale
    }
  }

  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang?.toLowerCase().startsWith('zh')) return 'zh-CN'
    if (htmlLang?.toLowerCase().startsWith('en')) return 'en-US'
  }

  if (typeof navigator !== 'undefined') {
    const runtimeLocale = navigator.language || navigator.languages?.[0]
    if (runtimeLocale?.toLowerCase().startsWith('zh')) return 'zh-CN'
  }

  return 'en-US'
}

export interface ProtocolDemoMessages {
  app: {
    title: string
    subtitle: string
    languageLabel: string
    protocolLanguageLabel: string
    localeNames: Record<DemoLocale, string>
  }
  runtime: {
    checking: string
    unavailable: string
    sandboxNotConfigured: string
    localRootfs: string
    image: string
    engine: string
    static: string
  }
  sourceKinds: Record<string, string>
  categories: Record<string, string>
  common: {
    protocols: string
    protocolDir: string
    assigner: string
    sampleFiles: string
    none: string
    optional: string
    varFieldName: string
  }
  tabs: {
    record: string
    source: string
    graph: string
    engine: string
  }
  graph: {
    title: string
    zoomIn: string
    zoomOut: string
    fitView: string
    fullscreen: string
    close: string
    showTitle: string
    showName: string
    dependentField: string
    assigner: string
    assignedField: string
    empty: string
    loading: string
  }
  source: {
    files: string
    empty: string
    loading: string
    draftHint: string
    draftActive: string
    resetDraft: string
  }
  record: {
    reset: string
    validateVars: string
    recorderTitle: string
    recordDataTitle: string
  }
  engine: {
    actions: {
      parse: string
      assign: string
      validate: string
      workflow: string
    }
    labels: {
      assignerTarget: string
      assignerRuntime: string
      sandboxMode: string
      timeout: string
      maxPasses: string
      transitionIds: string
      rootfsPath: string
      image: string
      envVarsJson: string
      currentVars: string
      workflowRecords: string
      engineResult: string
    }
    modes: {
      auto: string
      rootfs: string
      image: string
    }
    assignerRuntimes: {
      sandbox: string
      local: string
    }
    status: {
      running: string
      complete: string
      selectAssignerTarget: string
    }
  }
  workflow: {
    title: string
    emptyDefinition: string
    metadata: {
      assigners: string
      records: string
    }
    metrics: {
      nodes: string
      transitions: string
      assigners: string
      records: string
      initial: string
      executed: string
      updated: string
    }
    sections: {
      nodes: string
      transitions: string
      result: string
      executed: string
      skipped: string
      attempts: string
      nodeRuns: string
      records: string
      initialData: string
      rawResult: string
      nodeRecorder: string
      advancedRecords: string
      pathSteps: string
    }
    labels: {
      run: string
      when: string
      assignments: string
      targets: string
      nodeRuns: string
      node: string
      protocolIndex: string
      transition: string
      mode: string
      pathStatus: string
    }
    stepLabels: {
      recordProtocol: string
      addNextProtocol: string
      addInitialValues: string
      addResearchGoal: string
      addResearchStrategy: string
      addPhasedConclusion: string
      addFinalConclusion: string
    }
    status: {
      latestRun: string
      ready: string
      running: string
      succeeded: string
      failed: string
      parseError: string
      noResult: string
      pending: string
      available: string
      none: string
      executed: string
      skipped: string
      directAssign: string
      always: string
      notRun: string
    }
    nodeRecorder: {
      autoSync: string
      missingSource: string
      recorderTitle: string
      recordDataTitle: string
    }
  }
  loading: {
    registry: string
  }
  errors: {
    requestFailed: string
    envVarsInvalidJson: string
    envVarsObject: string
    invalidValue: string
    noProtocolSelected: string
    rootfsNotFound: string
    varNameRequired: string
    bodyTooLarge: string
    unknownProtocol: string
    unsupportedLocale: string
    missingProtocolDir: string
    workflowRecordsInvalidJson: string
    workflowRecordsObject: string
    workflowTransitionIdsInvalidJson: string
    workflowTransitionIdsArray: string
  }
}

const PROTOCOL_DEMO_MESSAGES: Record<DemoLocale, ProtocolDemoMessages> = {
  'en-US': {
    app: {
      title: 'Airalogy Protocol Demo',
      subtitle: 'Official protocol examples and AIMD cases',
      languageLabel: 'Language',
      protocolLanguageLabel: 'Example language',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
    },
    runtime: {
      checking: 'Checking',
      unavailable: 'Engine unavailable',
      sandboxNotConfigured: 'sandbox not configured',
      localRootfs: 'local rootfs',
      image: 'image',
      engine: 'Engine',
      static: 'Static',
    },
    sourceKinds: {
      protocol: 'Protocol',
      aimd: 'AIMD case',
      workflow: 'Workflow',
    },
    categories: {
      productivity: 'Productivity',
      chemistry: 'Chemistry',
      biomedicine: 'Biomedicine',
      clinical: 'Clinical',
      environment: 'Environment',
      finance: 'Finance',
      general: 'General',
      photonics: 'Photonics',
      personal: 'Personal',
      research: 'Research',
      workflow: 'Workflow',
    },
    common: {
      protocols: 'Examples',
      protocolDir: 'Source dir',
      assigner: 'Assigner',
      sampleFiles: 'Sample files',
      none: 'none',
      optional: 'optional',
      varFieldName: 'var field name',
    },
    tabs: {
      record: 'Record',
      source: 'Source',
      graph: 'Topology',
      engine: 'Engine',
    },
    graph: {
      title: 'Assigner topology',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitView: 'Fit view',
      fullscreen: 'Fullscreen',
      close: 'Close',
      showTitle: 'Show title',
      showName: 'Show name',
      dependentField: 'Dependent field',
      assigner: 'Assigner',
      assignedField: 'Assigned field',
      empty: 'No assigner graph available. Parse the protocol first, or choose an example with assigners.',
      loading: 'Loading assigner graph',
    },
    source: {
      files: 'Source files',
      empty: 'No source files',
      loading: 'Loading source viewer',
      draftHint: 'Edits are temporary and run only in this demo.',
      draftActive: 'Running with temporary source edits',
      resetDraft: 'Reset source',
    },
    record: {
      reset: 'Reset',
      validateVars: 'Validate Vars',
      recorderTitle: 'Record',
      recordDataTitle: 'Record JSON',
    },
    engine: {
      actions: {
        parse: 'Parse Protocol',
        assign: 'Run Assigner',
        validate: 'Validate Vars',
        workflow: 'Run Workflow',
      },
      labels: {
        assignerTarget: 'Assigner target',
        assignerRuntime: 'Workflow assigner runtime',
        sandboxMode: 'Sandbox mode',
        timeout: 'Timeout',
        maxPasses: 'Max passes',
        transitionIds: 'Transition IDs JSON',
        rootfsPath: 'Rootfs path',
        image: 'Image',
        envVarsJson: 'Env vars JSON',
        currentVars: 'Current vars',
        workflowRecords: 'Workflow Record snapshot',
        engineResult: 'Engine result',
      },
      modes: {
        auto: 'auto',
        rootfs: 'rootfs',
        image: 'image',
      },
      assignerRuntimes: {
        sandbox: 'sandbox',
        local: 'local Python',
      },
      status: {
        running: '{action} running',
        complete: '{action} complete',
        selectAssignerTarget: 'Select an assigner target',
      },
    },
    workflow: {
      title: 'Workflow run',
      emptyDefinition: 'No workflow definition was parsed from the current workflow.aimd source.',
      metadata: {
        assigners: 'Workflow assigners',
        records: 'Initial records',
      },
      metrics: {
        nodes: 'Nodes',
        transitions: 'Transitions',
        assigners: 'Assigners',
        records: 'Records',
        initial: 'initial',
        executed: 'executed',
        updated: 'updated',
      },
      sections: {
        nodes: 'Protocol nodes',
        transitions: 'Transitions',
        result: 'Run result',
        executed: 'Executed transitions',
        skipped: 'Skipped transitions',
        attempts: 'Assigner attempts',
        nodeRuns: 'Node runs',
        records: 'Current Record snapshot',
        initialData: 'Editable input',
        rawResult: 'Raw engine result',
        nodeRecorder: 'Protocol node recorder',
        advancedRecords: 'Advanced Record snapshot JSON',
        pathSteps: 'Path steps',
      },
      labels: {
        run: 'Run',
        when: 'When',
        assignments: 'Assign',
        targets: 'targets',
        nodeRuns: 'runs',
        node: 'Node',
        protocolIndex: 'Protocol index',
        transition: 'Transition',
        mode: 'Mode',
        pathStatus: 'Path status',
      },
      stepLabels: {
        recordProtocol: 'Record protocol',
        addNextProtocol: 'Select next protocol',
        addInitialValues: 'Prepare initial values',
        addResearchGoal: 'Add research goal',
        addResearchStrategy: 'Add research strategy',
        addPhasedConclusion: 'Add phased conclusion',
        addFinalConclusion: 'Add final conclusion',
      },
      status: {
        latestRun: 'Status',
        ready: 'Ready to run the workflow with the current records.',
        running: 'Workflow is running.',
        succeeded: 'Completed: {executed} executed, {skipped} skipped.',
        failed: 'Workflow failed.',
        parseError: 'Workflow parse error',
        noResult: 'Run the workflow to see Path steps, executed transitions, skipped branches, assigner outputs, and the current Record snapshot.',
        pending: 'not run',
        available: 'available',
        none: 'none',
        executed: 'executed',
        skipped: 'skipped',
        directAssign: 'direct assign',
        always: 'always',
        notRun: 'not run',
      },
      nodeRecorder: {
        autoSync: 'Edits sync into the workflow Record snapshot automatically.',
        missingSource: 'Protocol source not found',
        recorderTitle: 'Node record',
        recordDataTitle: 'Node Record snapshot JSON',
      },
    },
    loading: {
      registry: 'Loading protocol registry',
    },
    errors: {
      requestFailed: 'Request failed: {status}',
      envVarsInvalidJson: 'Env vars JSON is invalid',
      envVarsObject: 'Env vars must be a JSON object',
      invalidValue: 'Invalid value',
      noProtocolSelected: 'No protocol selected',
      rootfsNotFound: 'Local Airalogy Engine rootfs was not found. Run "pnpm build:engine-rootfs", set ROOTFS_PATH, or use image mode.',
      varNameRequired: 'Assigner target is required',
      bodyTooLarge: 'Request body is too large',
      unknownProtocol: 'Unknown protocol example',
      unsupportedLocale: 'This protocol example does not provide the selected locale',
      missingProtocolDir: 'This protocol example has no protocol directory for the selected locale',
      workflowRecordsInvalidJson: 'Workflow records JSON is invalid',
      workflowRecordsObject: 'Workflow records must be a JSON object',
      workflowTransitionIdsInvalidJson: 'Transition IDs JSON is invalid',
      workflowTransitionIdsArray: 'Transition IDs must be a JSON array',
    },
  },
  'zh-CN': {
    app: {
      title: 'Airalogy Protocol Demo',
      subtitle: '官方 Protocol 示例与 AIMD 案例',
      languageLabel: '界面语言',
      protocolLanguageLabel: '示例语言',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
    },
    runtime: {
      checking: '检查中',
      unavailable: '引擎不可用',
      sandboxNotConfigured: 'sandbox 尚未配置',
      localRootfs: '本地 rootfs',
      image: '镜像',
      engine: '引擎',
      static: '静态',
    },
    sourceKinds: {
      protocol: 'Protocol',
      aimd: 'AIMD 案例',
      workflow: 'Workflow',
    },
    categories: {
      productivity: '生产力',
      chemistry: '化学',
      biomedicine: '生物医学',
      clinical: '临床',
      environment: '环境',
      finance: '金融',
      general: '通用',
      photonics: '光子学',
      personal: '个人',
      research: '研究',
      workflow: 'Workflow',
    },
    common: {
      protocols: '示例',
      protocolDir: '源目录',
      assigner: '赋值器',
      sampleFiles: '示例文件',
      none: '无',
      optional: '可选',
      varFieldName: 'var 字段名',
    },
    tabs: {
      record: '记录',
      source: '源码',
      graph: '拓扑',
      engine: '引擎',
    },
    graph: {
      title: '赋值器拓扑',
      zoomIn: '放大',
      zoomOut: '缩小',
      fitView: '适应视图',
      fullscreen: '全屏',
      close: '关闭',
      showTitle: '显示标题',
      showName: '显示名称',
      dependentField: '依赖字段',
      assigner: '赋值器',
      assignedField: '赋值字段',
      empty: '暂无赋值器拓扑。请先解析协议，或选择包含赋值器的示例。',
      loading: '正在加载赋值器拓扑',
    },
    source: {
      files: '源文件',
      empty: '没有源码文件',
      loading: '正在加载源码视图',
      draftHint: '源码修改仅保存在当前页面，用于本次试运行。',
      draftActive: '正在使用临时源码草稿',
      resetDraft: '恢复示例源码',
    },
    record: {
      reset: '重置',
      validateVars: '校验变量',
      recorderTitle: '记录',
      recordDataTitle: '记录 JSON',
    },
    engine: {
      actions: {
        parse: '解析协议',
        assign: '运行赋值器',
        validate: '校验变量',
        workflow: '运行 Workflow',
      },
      labels: {
        assignerTarget: '赋值器目标',
        assignerRuntime: 'Workflow 赋值器运行方式',
        sandboxMode: 'Sandbox 模式',
        timeout: '超时时间',
        maxPasses: '最大轮次',
        transitionIds: 'Transition IDs JSON',
        rootfsPath: 'Rootfs 路径',
        image: '镜像',
        envVarsJson: '环境变量 JSON',
        currentVars: '当前变量',
        workflowRecords: 'Workflow Record 快照',
        engineResult: '引擎结果',
      },
      modes: {
        auto: '自动',
        rootfs: 'rootfs',
        image: '镜像',
      },
      assignerRuntimes: {
        sandbox: 'sandbox',
        local: '本机 Python',
      },
      status: {
        running: '{action}运行中',
        complete: '{action}完成',
        selectAssignerTarget: '请选择赋值器目标',
      },
    },
    workflow: {
      title: 'Workflow 运行',
      emptyDefinition: '当前 workflow.aimd 源码中没有解析到 Workflow 定义。',
      metadata: {
        assigners: 'Workflow 赋值器',
        records: '初始 Records',
      },
      metrics: {
        nodes: '节点',
        transitions: '转换',
        assigners: '赋值器',
        records: 'Records',
        initial: '初始',
        executed: '已执行',
        updated: '已更新',
      },
      sections: {
        nodes: 'Protocol 节点',
        transitions: 'Transitions',
        result: '运行结果',
        executed: '已执行转换',
        skipped: '已跳过转换',
        attempts: '赋值器调用',
        nodeRuns: '节点运行次数',
        records: '当前 Record 快照',
        initialData: '可编辑输入',
        rawResult: '原始引擎结果',
        nodeRecorder: 'Protocol 节点 Recorder',
        advancedRecords: '高级 Record 快照 JSON',
        pathSteps: 'Path 步骤',
      },
      labels: {
        run: '运行',
        when: '条件',
        assignments: '赋值',
        targets: '目标',
        nodeRuns: '次',
        node: '节点',
        protocolIndex: 'Protocol 索引',
        transition: '转换',
        mode: '模式',
        pathStatus: 'Path 状态',
      },
      stepLabels: {
        recordProtocol: '记录 Protocol',
        addNextProtocol: '选择下一个 Protocol',
        addInitialValues: '生成初始字段值',
        addResearchGoal: '添加研究目的',
        addResearchStrategy: '添加研究策略',
        addPhasedConclusion: '添加阶段结论',
        addFinalConclusion: '添加最终结论',
      },
      status: {
        latestRun: '状态',
        ready: '可使用当前 Records 运行 Workflow。',
        running: 'Workflow 正在运行。',
        succeeded: '完成：{executed} 条已执行，{skipped} 条已跳过。',
        failed: 'Workflow 运行失败。',
        parseError: 'Workflow 解析错误',
        noResult: '运行 Workflow 后，这里会显示 Path 步骤、执行的转换、跳过的分支、赋值器输出和当前 Record 快照。',
        pending: '未运行',
        available: '可查看',
        none: '无',
        executed: '已执行',
        skipped: '已跳过',
        directAssign: '直接赋值',
        always: '总是执行',
        notRun: '未运行',
      },
      nodeRecorder: {
        autoSync: '在此编辑会自动同步到 Workflow Record 快照。',
        missingSource: '未找到 Protocol 源码',
        recorderTitle: '节点记录',
        recordDataTitle: '节点 Record 快照 JSON',
      },
    },
    loading: {
      registry: '正在加载协议示例',
    },
    errors: {
      requestFailed: '请求失败：{status}',
      envVarsInvalidJson: '环境变量 JSON 格式不正确',
      envVarsObject: '环境变量必须是 JSON 对象',
      invalidValue: '无效值',
      noProtocolSelected: '未选择协议',
      rootfsNotFound: '未找到本地 Airalogy 引擎 rootfs。请运行 "pnpm build:engine-rootfs"，或设置 ROOTFS_PATH，或使用镜像模式。',
      varNameRequired: '需要指定赋值器目标',
      bodyTooLarge: '请求体过大',
      unknownProtocol: '未知协议示例',
      unsupportedLocale: '该协议示例不支持所选语言',
      missingProtocolDir: '该协议示例没有所选语言的协议目录',
      workflowRecordsInvalidJson: 'Workflow records JSON 格式不正确',
      workflowRecordsObject: 'Workflow records 必须是 JSON 对象',
      workflowTransitionIdsInvalidJson: 'Transition IDs JSON 格式不正确',
      workflowTransitionIdsArray: 'Transition IDs 必须是 JSON 数组',
    },
  },
}

const locale = ref<DemoLocale>(detectRuntimeLocale())

watch(locale, (value) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_LOCALE_STORAGE_KEY, value)
  }
}, { immediate: true })

export function useDemoLocale() {
  return {
    locale,
  }
}

export function useDemoMessages() {
  return computed(() => PROTOCOL_DEMO_MESSAGES[locale.value])
}
