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
    changeCurrent: string
    hideList: string
    exampleBadge: string
    caseBadge: string
    protocolBadge: string
  }
  pages: {
    core: {
      desc: string
    }
    editor: {
      title: string
      templatePickerTitle: string
      changeTemplate: string
      loadTemplate: string
      blankTemplateHint: string
      templateLoaded: string
      draftRestored: string
      draftSaveFailed: string
      sourceTitle: string
      previewTitle: string
      emptyPreview: string
      renderFailed: string
      insertFigureTitle: string
      localFigureMode: string
      remoteFigureMode: string
      chooseLocalFigure: string
      changeLocalFigure: string
      localFigureHint: string
      insertLocalFigure: string
      insertRemoteFigure: string
      remoteFigureUrl: string
      figureTitle: string
      figureLegend: string
      closePanel: string
      invalidRemoteFigureUrl: string
      selectLocalFigureFirst: string
      figureInserted: string
      clearContent: string
      contentCleared: string
      importPackage: string
      importPackageHint: string
      importingPackage: string
      packageImported: string
      packageImportFailed: string
      packageImportNoAimd: string
      packageImportUnsupportedAira: string
      downloadAimd: string
      downloadAira: string
      packagingDownload: string
      fileCount: string
      removeFile: string
      ready: string
      uploadSkipped: string
      downloadCompleteAimd: string
      downloadCompleteAira: string
      downloadFailed: string
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
      panelLabel: string
      stats: {
        var: string
        table: string
        step: string
        check: string
        refs: string
      }
      tabs: {
        workbench: string
        preview: string
        fields: string
      }
      quiz: {
        score: string
        review: string
        explanations: string
        submitted: string
        explanationModes: {
          hidden: string
          selected: string
          submitted: string
          graded: string
        }
      }
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
      core: 'Core Parser',
      editor: 'Online Editor',
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
      changeCurrent: 'Change Example',
      hideList: 'Hide Examples',
      exampleBadge: 'Example',
      caseBadge: 'Case',
      protocolBadge: 'Protocol',
    },
    pages: {
      core: {
        desc: 'AIMD core parser that converts AIMD source into AST and extracted field metadata',
      },
      editor: {
        title: 'AIMD Online Editor',
        templatePickerTitle: 'Example Template',
        changeTemplate: 'Choose Template',
        loadTemplate: 'Load Template',
        blankTemplateHint: 'Start from a blank AIMD document, or load an example template as a base for editing.',
        templateLoaded: 'Template loaded',
        draftRestored: 'Local draft restored',
        draftSaveFailed: 'Local draft could not be saved',
        sourceTitle: 'Editor',
        previewTitle: 'Live Preview',
        emptyPreview: 'Preview will appear here after you add AIMD content.',
        renderFailed: 'Preview failed',
        insertFigureTitle: 'Insert figure',
        localFigureMode: 'Local image',
        remoteFigureMode: 'Image URL',
        chooseLocalFigure: 'Choose local image',
        changeLocalFigure: 'Change local image',
        localFigureHint: 'Package an image file into the downloaded .aira archive.',
        insertLocalFigure: 'Insert local figure',
        insertRemoteFigure: 'Insert URL figure',
        remoteFigureUrl: 'Image URL',
        figureTitle: 'Title (optional)',
        figureLegend: 'Legend (optional)',
        closePanel: 'Close',
        invalidRemoteFigureUrl: 'Enter an http:// or https:// image URL.',
        selectLocalFigureFirst: 'Choose a local image first.',
        figureInserted: 'Figure inserted',
        clearContent: 'Clear',
        contentCleared: 'Content cleared',
        importPackage: 'Import package',
        importPackageHint: 'Import a .zip folder bundle or a single-protocol .aira.\n\nRecommended ZIP structure:\nmy-protocol/\n├─ protocol.aimd\n└─ files/\n   ├─ workflow.png\n   └─ chart.svg\n\nThe outer folder is optional. The editor looks for protocol.aimd first, then index.aimd, then the first .aimd file. Figure src paths must match the files inside the package, for example src: files/workflow.png.',
        importingPackage: 'Importing...',
        packageImported: 'Package imported',
        packageImportFailed: 'Package import failed',
        packageImportNoAimd: 'No .aimd file was found in the package.',
        packageImportUnsupportedAira: 'Only single-protocol .aira archives can be imported into this editor.',
        downloadAimd: 'Download .aimd',
        downloadAira: 'Download .aira',
        packagingDownload: 'Packaging...',
        fileCount: 'Protocol files',
        removeFile: 'Remove',
        ready: 'Ready',
        uploadSkipped: 'No image file was selected.',
        downloadCompleteAimd: 'Downloaded .aimd',
        downloadCompleteAira: 'Downloaded .aira',
        downloadFailed: 'Download failed',
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
        desc: 'Load repository AIMD cases, official protocol AIMD sources, and demo examples into one workbench for source editing, rendered preview, recorder entry, extracted fields, and collected record data.',
        workbenchTitle: 'Case Workbench',
        panelLabel: 'Example view',
        stats: {
          var: 'Vars',
          table: 'Tables',
          step: 'Steps',
          check: 'Checks',
          refs: 'Refs',
        },
        tabs: {
          workbench: 'Workbench',
          preview: 'Render Preview',
          fields: 'Extracted Fields',
        },
        quiz: {
          score: 'Score',
          review: 'Review',
          explanations: 'Explanations',
          submitted: 'Submitted',
          explanationModes: {
            hidden: 'Hidden',
            selected: 'Selected',
            submitted: 'Submitted',
            graded: 'Graded',
          },
        },
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
      core: 'Core 解析器',
      editor: '在线编辑',
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
      changeCurrent: '切换示例',
      hideList: '收起示例',
      exampleBadge: '示例',
      caseBadge: '案例',
      protocolBadge: '协议',
    },
    pages: {
      core: {
        desc: 'AIMD 核心解析器 — 将 AIMD 源码解析为 AST 并提取字段信息',
      },
      editor: {
        title: 'AIMD 在线编辑器',
        templatePickerTitle: '案例模板',
        changeTemplate: '选择模板',
        loadTemplate: '加载模板',
        blankTemplateHint: '默认从空白 AIMD 开始，也可以加载一个案例模板作为基础再修改。',
        templateLoaded: '已加载模板',
        draftRestored: '已恢复本地草稿',
        draftSaveFailed: '本地草稿保存失败',
        sourceTitle: '编辑器',
        previewTitle: '实时预览',
        emptyPreview: '添加 AIMD 内容后，这里会显示实时预览。',
        renderFailed: '预览失败',
        insertFigureTitle: '插入图片',
        localFigureMode: '本地图片',
        remoteFigureMode: '网络图片',
        chooseLocalFigure: '选择本地图片',
        changeLocalFigure: '更换本地图片',
        localFigureHint: '把图片文件打包进下载的 .aira 归档。',
        insertLocalFigure: '插入本地图片',
        insertRemoteFigure: '插入网络图片',
        remoteFigureUrl: '图片 URL',
        figureTitle: '标题（可选）',
        figureLegend: '图注（可选）',
        closePanel: '关闭',
        invalidRemoteFigureUrl: '请输入 http:// 或 https:// 图片 URL。',
        selectLocalFigureFirst: '请先选择一张本地图片。',
        figureInserted: '已插入图片',
        clearContent: '清空',
        contentCleared: '已清空',
        importPackage: '导入包',
        importPackageHint: '导入 .zip 文件夹包，或单 Protocol 的 .aira。\n\n推荐 ZIP 结构：\nmy-protocol/\n├─ protocol.aimd\n└─ files/\n   ├─ workflow.png\n   └─ chart.svg\n\n外层文件夹可以省略。编辑器会优先读取 protocol.aimd，其次读取 index.aimd，再其次读取第一个 .aimd 文件。图片的 fig.src 要和包内文件路径一致，例如 src: files/workflow.png。',
        importingPackage: '正在导入...',
        packageImported: '已导入包',
        packageImportFailed: '导入包失败',
        packageImportNoAimd: '压缩包中没有找到 .aimd 文件。',
        packageImportUnsupportedAira: '当前编辑器只支持导入单 Protocol 的 .aira 归档。',
        downloadAimd: '下载 .aimd',
        downloadAira: '下载 .aira',
        packagingDownload: '正在打包...',
        fileCount: 'Protocol 文件',
        removeFile: '移除',
        ready: '就绪',
        uploadSkipped: '未选择图片文件。',
        downloadCompleteAimd: '已下载 .aimd',
        downloadCompleteAira: '已下载 .aira',
        downloadFailed: '下载失败',
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
        desc: '把仓库中的 AIMD 案例、官方协议 AIMD 源码和 demo 示例载入一个工作台，统一完成源码编辑、渲染预览、数据填写、字段查看和 Record 数据收集。',
        workbenchTitle: '案例工作台',
        panelLabel: '案例视图',
        stats: {
          var: '变量',
          table: '变量表',
          step: '步骤',
          check: '检查',
          refs: '引用',
        },
        tabs: {
          workbench: '工作台',
          preview: '渲染预览',
          fields: '提取字段',
        },
        quiz: {
          score: '得分',
          review: '需复核',
          explanations: '解析',
          submitted: '已提交',
          explanationModes: {
            hidden: '隐藏',
            selected: '选中项',
            submitted: '提交后',
            graded: '评分后',
          },
        },
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
