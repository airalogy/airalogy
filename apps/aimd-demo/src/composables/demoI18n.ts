import { computed, ref, watch } from 'vue'

export type DemoLocale = 'en-US' | 'zh-CN'

const DEMO_LOCALE_STORAGE_KEY = 'aimd-demo-locale'

function isDemoLocale(value: unknown): value is DemoLocale {
  return value === 'en-US' || value === 'zh-CN'
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
    if (htmlLang?.toLowerCase().startsWith('zh')) {
      return 'zh-CN'
    }
    if (htmlLang?.toLowerCase().startsWith('en')) {
      return 'en-US'
    }
  }

  if (typeof navigator !== 'undefined') {
    const runtimeLocale = navigator.language || navigator.languages?.[0]
    if (runtimeLocale?.toLowerCase().startsWith('zh')) {
      return 'zh-CN'
    }
  }

  return 'zh-CN'
}

export interface DemoMessages {
  app: {
    title: string
    languageLabel: string
    localeNames: Record<DemoLocale, string>
    links: {
      docs: string
      github: string
    }
  }
  nav: {
    tutorial: string
    examples: string
    full: string
    core: string
    editor: string
    renderer: string
    recorder: string
  }
  common: {
    aimdSource: string
    extractedFields: string
    htmlSource: string
    astOutput: string
    reset: string
    resetForm: string
    loadingEditor: string
    renderPreview: string
    collectedData: string
  }
  examples: {
    title: string
    resetCurrent: string
    exampleBadge: string
    caseBadge: string
  }
  pages: {
    full: {
      title: string
      desc: string
      stats: {
        var: string
        table: string
        step: string
        check: string
        refs: string
      }
      tabs: {
        preview: string
        form: string
        data: string
      }
    }
    core: {
      desc: string
    }
    editor: {
      desc: string
    }
    renderer: {
      desc: string
      tabs: {
        html: string
        vue: string
        fields: string
      }
    }
    recorder: {
      desc: string
      inlineFormTitle: string
    }
    examples: {
      title: string
      desc: string
      workbenchTitle: string
    }
    tutorial: {
      title: string
      desc: string
      progressLabel: string
      lessonLabel: string
      focusLabel: string
      syntaxLabel: string
      checklistLabel: string
      hintsLabel: string
      hintLabel: string
      solutionLabel: string
      feedbackLabel: string
      parseErrorLabel: string
      renderErrorLabel: string
      tabs: {
        guide: string
        preview: string
        fields: string
      }
      actions: {
        restoreStarter: string
        loadSolution: string
        showSolution: string
        hideSolution: string
        previous: string
        next: string
      }
      status: {
        completedTitle: string
        completedBody: string
        inProgressTitle: string
        inProgressBody: string
        finishedTitle: string
        finishedBody: string
      }
    }
  }
}

const BASE_DEMO_MESSAGES: Record<DemoLocale, DemoMessages> = {
  'en-US': {
    app: {
      title: 'Airalogy Markdown Demo',
      languageLabel: 'Language',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
      links: {
        docs: 'Docs',
        github: 'GitHub',
      },
    },
    nav: {
      tutorial: 'Interactive Tutorial',
      examples: 'Examples',
      full: 'Full Workflow',
      core: 'Core Parser',
      editor: 'Editor',
      renderer: 'Renderer',
      recorder: 'Recorder',
    },
    common: {
      aimdSource: 'AIMD Source',
      extractedFields: 'Extracted Fields (ExtractedAimdFields)',
      htmlSource: 'HTML Source',
      astOutput: 'AST Output (MDAST)',
      reset: 'Reset',
      resetForm: 'Reset Form',
      loadingEditor: 'Loading editor...',
      renderPreview: 'Render Preview',
      collectedData: 'Collected Data (Record Data)',
    },
    examples: {
      title: 'Cases and Examples',
      resetCurrent: 'Reset Current',
      exampleBadge: 'Example',
      caseBadge: 'Case',
    },
    pages: {
      full: {
        title: 'AIMD Full Workflow',
        desc: 'Edit AIMD -> live preview -> fill field values -> collect record data',
        stats: {
          var: 'Vars',
          table: 'Tables',
          step: 'Steps',
          check: 'Checks',
          refs: 'Refs',
        },
        tabs: {
          preview: 'Preview',
          form: 'Fill Data',
          data: 'Collected Result',
        },
      },
      core: {
        desc: 'AIMD core parser that converts AIMD source into AST and extracted field metadata',
      },
      editor: {
        desc: 'AIMD Editor with source mode, WYSIWYG mode, and localized built-in UI',
      },
      renderer: {
        desc: 'AIMD rendering engine that renders AIMD source into HTML and Vue VNodes',
        tabs: {
          html: 'HTML Render',
          vue: 'Vue VNodes',
          fields: 'Extracted Fields',
        },
      },
      recorder: {
        desc: 'AIMD protocol recorder with inline data entry, source-linked recorder editing, and recorder-side visual field editing',
        inlineFormTitle: 'Inline Record Form',
      },
      examples: {
        title: 'AIMD Examples',
        desc: 'Load repository cases and demo examples into the recorder to inspect their structure, form UI, and collected record data.',
        workbenchTitle: 'Case Workbench',
      },
      tutorial: {
        title: 'Interactive AIMD Tutorial',
        desc: 'Learn AIMD syntax by editing short exercises with live checks, rendered preview, and extracted fields.',
        progressLabel: 'Progress',
        lessonLabel: 'Lesson',
        focusLabel: 'Focus',
        syntaxLabel: 'Syntax Pattern',
        checklistLabel: 'Pass Checks',
        hintsLabel: 'Hints',
        hintLabel: 'Hint',
        solutionLabel: 'Solution',
        feedbackLabel: 'Feedback',
        parseErrorLabel: 'Parser Feedback',
        renderErrorLabel: 'Renderer Feedback',
        tabs: {
          guide: 'Guide',
          preview: 'Preview',
          fields: 'Fields',
        },
        actions: {
          restoreStarter: 'Restore Starter',
          loadSolution: 'Load Solution',
          showSolution: 'Show Solution',
          hideSolution: 'Hide Solution',
          previous: 'Previous',
          next: 'Next Lesson',
        },
        status: {
          completedTitle: 'Lesson complete',
          completedBody: 'All checks are passing. Move on when you are ready.',
          inProgressTitle: 'Keep editing',
          inProgressBody: 'Work through the checks on the right. The preview and extracted fields update as you type.',
          finishedTitle: 'Tutorial complete',
          finishedBody: 'You finished every lesson. Revisit any step, tweak the snippets, or continue into the package demos.',
        },
      },
    },
  },
  'zh-CN': {
    app: {
      title: 'Airalogy Markdown Demo',
      languageLabel: '语言',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
      links: {
        docs: '文档站',
        github: 'GitHub',
      },
    },
    nav: {
      tutorial: '交互式教程',
      examples: '案例',
      full: '完整工作流',
      core: 'Core 解析器',
      editor: 'Editor 编辑器',
      renderer: 'Renderer 渲染器',
      recorder: 'Recorder 记录器',
    },
    common: {
      aimdSource: 'AIMD 源码',
      extractedFields: '提取的字段 (ExtractedAimdFields)',
      htmlSource: 'HTML 源码',
      astOutput: 'AST 输出 (MDAST)',
      reset: '重置',
      resetForm: '重置表单',
      loadingEditor: '加载编辑器...',
      renderPreview: '渲染预览',
      collectedData: '收集到的数据 (Record Data)',
    },
    examples: {
      title: '案例和示例',
      resetCurrent: '重置当前示例',
      exampleBadge: '示例',
      caseBadge: '案例',
    },
    pages: {
      full: {
        title: 'AIMD 完整工作流',
        desc: '编辑 AIMD -> 实时预览 -> 填写字段值 -> 收集数据',
        stats: {
          var: '变量',
          table: '变量表',
          step: '步骤',
          check: '检查',
          refs: '引用',
        },
        tabs: {
          preview: '渲染预览',
          form: '填写数据',
          data: '收集结果',
        },
      },
      core: {
        desc: 'AIMD 核心解析器 — 将 AIMD 源码解析为 AST 并提取字段信息',
      },
      editor: {
        desc: 'AIMD Editor — 支持 Source mode / WYSIWYG mode 与内建 UI 双语切换',
      },
      renderer: {
        desc: 'AIMD 渲染引擎 — 将 AIMD 源码渲染为 HTML 和 Vue VNodes',
        tabs: {
          html: 'HTML 渲染',
          vue: 'Vue VNodes',
          fields: '提取字段',
        },
      },
      recorder: {
        desc: 'AIMD 数据记录器 — 支持协议内联录入、源码联动编辑器，以及 recorder 内可视化 field 编辑',
        inlineFormTitle: '数据记录表单（内联）',
      },
      examples: {
        title: 'AIMD 案例',
        desc: '把仓库中的案例和 demo 示例直接载入记录器，快速查看结构、表单界面和收集到的数据。',
        workbenchTitle: '案例工作台',
      },
      tutorial: {
        title: 'AIMD 交互式教程',
        desc: '通过短练习、实时校验、渲染预览和字段提取，快速学会 AIMD 语法。',
        progressLabel: '进度',
        lessonLabel: '课程',
        focusLabel: '重点',
        syntaxLabel: '语法模式',
        checklistLabel: '通过条件',
        hintsLabel: '提示',
        hintLabel: '提示',
        solutionLabel: '参考答案',
        feedbackLabel: '反馈',
        parseErrorLabel: '解析反馈',
        renderErrorLabel: '渲染反馈',
        tabs: {
          guide: '指南',
          preview: '预览',
          fields: '字段',
        },
        actions: {
          restoreStarter: '恢复起始内容',
          loadSolution: '载入答案',
          showSolution: '显示答案',
          hideSolution: '隐藏答案',
          previous: '上一课',
          next: '下一课',
        },
        status: {
          completedTitle: '本课完成',
          completedBody: '所有检查都通过了，可以继续下一课。',
          inProgressTitle: '继续编辑',
          inProgressBody: '根据右侧检查项逐步完成，预览和字段结果会实时更新。',
          finishedTitle: '教程完成',
          finishedBody: '你已经完成全部课程。可以回看任意一课继续修改，也可以继续浏览其他 demo。',
        },
      },
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
  return computed(() => BASE_DEMO_MESSAGES[locale.value])
}
