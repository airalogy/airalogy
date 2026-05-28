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
    engine: string
  }
  sourceTabs: {
    sampleData: string
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
    }
    labels: {
      assignerTarget: string
      sandboxMode: string
      timeout: string
      rootfsPath: string
      image: string
      envVarsJson: string
      currentVars: string
      engineResult: string
    }
    modes: {
      auto: string
      rootfs: string
      image: string
    }
    status: {
      running: string
      complete: string
      selectAssignerTarget: string
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
  }
}

const PROTOCOL_DEMO_MESSAGES: Record<DemoLocale, ProtocolDemoMessages> = {
  'en-US': {
    app: {
      title: 'Airalogy Protocol Demo',
      subtitle: '@airalogy/airalogy-engine + official protocol examples',
      languageLabel: 'Language',
      protocolLanguageLabel: 'Protocol language',
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
    categories: {
      productivity: 'Productivity',
      chemistry: 'Chemistry',
      biomedicine: 'Biomedicine',
      personal: 'Personal',
    },
    common: {
      protocols: 'Protocols',
      protocolDir: 'Protocol dir',
      assigner: 'Assigner',
      sampleFiles: 'Sample files',
      none: 'none',
      optional: 'optional',
      varFieldName: 'var field name',
    },
    tabs: {
      record: 'Record',
      source: 'Source',
      engine: 'Engine',
    },
    sourceTabs: {
      sampleData: 'sample data',
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
      },
      labels: {
        assignerTarget: 'Assigner target',
        sandboxMode: 'Sandbox mode',
        timeout: 'Timeout',
        rootfsPath: 'Rootfs path',
        image: 'Image',
        envVarsJson: 'Env vars JSON',
        currentVars: 'Current vars',
        engineResult: 'Engine result',
      },
      modes: {
        auto: 'auto',
        rootfs: 'rootfs',
        image: 'image',
      },
      status: {
        running: '{action} running',
        complete: '{action} complete',
        selectAssignerTarget: 'Select an assigner target',
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
    },
  },
  'zh-CN': {
    app: {
      title: 'Airalogy Protocol Demo',
      subtitle: '@airalogy/airalogy-engine + 官方协议示例',
      languageLabel: '界面语言',
      protocolLanguageLabel: '协议语言',
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
    categories: {
      productivity: '生产力',
      chemistry: '化学',
      biomedicine: '生物医学',
      personal: '个人',
    },
    common: {
      protocols: '协议示例',
      protocolDir: '协议目录',
      assigner: '赋值器',
      sampleFiles: '示例文件',
      none: '无',
      optional: '可选',
      varFieldName: 'var 字段名',
    },
    tabs: {
      record: '记录',
      source: '源码',
      engine: '引擎',
    },
    sourceTabs: {
      sampleData: '示例数据',
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
      },
      labels: {
        assignerTarget: '赋值器目标',
        sandboxMode: 'Sandbox 模式',
        timeout: '超时时间',
        rootfsPath: 'Rootfs 路径',
        image: '镜像',
        envVarsJson: '环境变量 JSON',
        currentVars: '当前变量',
        engineResult: '引擎结果',
      },
      modes: {
        auto: '自动',
        rootfs: 'rootfs',
        image: '镜像',
      },
      status: {
        running: '{action}运行中',
        complete: '{action}完成',
        selectAssignerTarget: '请选择赋值器目标',
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
