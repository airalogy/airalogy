<template>
  <section class="docs-home-section">
    <div class="docs-home-heading">
      <p class="docs-home-eyebrow">{{ content.map.eyebrow }}</p>
      <h2>{{ content.map.title }}</h2>
      <p>
        {{ content.map.description }}
      </p>
    </div>

    <div class="docs-grid">
      <article
        v-for="card in content.cards"
        :key="card.title"
        class="docs-card"
      >
        <div>
          <span class="docs-card-kicker">{{ card.kicker }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
        </div>
        <a
          class="docs-card-footer"
          :href="withBase(card.href)"
        >{{ card.linkText }}</a>
      </article>
    </div>
  </section>

  <section class="docs-home-section">
    <div class="docs-home-heading">
      <p class="docs-home-eyebrow">{{ content.install.eyebrow }}</p>
      <h2>{{ content.install.title }}</h2>
      <p>
        {{ content.install.description }}
      </p>
    </div>

    <div class="docs-command-grid">
      <div
        v-for="command in content.commands"
        :key="command.label"
        class="docs-command"
      >
        <span>{{ command.label }}</span>
        <code>{{ command.command }}</code>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps({
  locale: {
    type: String,
    default: 'en',
  },
})

const copy = {
  en: {
    map: {
      eyebrow: 'Documentation Map',
      title: 'Choose the surface you are working on',
      description:
        'The monorepo keeps implementation details separate, but the published documentation should feel like one product. Start from the package family closest to your current workflow.',
    },
    cards: [
      {
        kicker: 'Python package',
        title: 'Airalogy',
        description:
          'Use the core Python APIs for AIMD parsing, structured records, conversion, archive handling, and standardized data digitization.',
        href: '/airalogy/en/',
        linkText: 'Open Python docs',
      },
      {
        kicker: 'npm packages',
        title: 'AIMD',
        description:
          'Work with the parser, renderer, editor integrations, recorder UI, examples, and interactive demo for authoring AIMD protocols.',
        href: '/aimd/en/',
        linkText: 'Open AIMD docs',
      },
      {
        kicker: 'Python and npm engine',
        title: 'Airalogy Engine',
        description:
          'Run protocol packages in the shared sandbox image through either the Python API or the Node.js API.',
        href: '/airalogy-engine/',
        linkText: 'Open engine docs',
      },
    ],
    install: {
      eyebrow: 'Install',
      title: 'Package entry points',
      description:
        'These commands point at the public package surfaces. Detailed setup, examples, and integration notes live in the package-family docs above.',
    },
    commands: [
      { label: 'Airalogy Python', command: 'pip install airalogy' },
      { label: 'Airalogy Engine Python', command: 'pip install airalogy-engine' },
      { label: 'AIMD renderer', command: 'pnpm add @airalogy/aimd-renderer' },
      { label: 'Airalogy Engine Node.js', command: 'pnpm add @airalogy/airalogy-engine' },
    ],
  },
  zh: {
    map: {
      eyebrow: '文档地图',
      title: '选择你正在使用的模块',
      description:
        'monorepo 让实现边界保持清晰，但发布后的文档入口应该像一个产品。请从最接近当前工作的包族开始阅读。',
    },
    cards: [
      {
        kicker: 'Python 包',
        title: 'Airalogy',
        description:
          '使用核心 Python API 处理 AIMD 解析、结构化记录、格式转换、归档管理和标准化数据数字化。',
        href: '/airalogy/zh/',
        linkText: '打开 Python 文档',
      },
      {
        kicker: 'npm 包',
        title: 'AIMD',
        description:
          '阅读 parser、renderer、editor 集成、recorder UI、示例和交互式 demo 的 AIMD 协议编写文档。',
        href: '/aimd/zh/',
        linkText: '打开 AIMD 文档',
      },
      {
        kicker: 'Python 与 npm 引擎',
        title: 'Airalogy Engine',
        description:
          '通过 Python API 或 Node.js API，在共享 sandbox image 中运行 protocol package。',
        href: '/airalogy-engine/',
        linkText: '打开 Engine 文档',
      },
    ],
    install: {
      eyebrow: '安装',
      title: '包入口',
      description:
        '这些命令对应公开发布的包入口。更完整的安装、示例和集成说明请进入上方对应文档。',
    },
    commands: [
      { label: 'Airalogy Python', command: 'pip install airalogy' },
      { label: 'Airalogy Engine Python', command: 'pip install airalogy-engine' },
      { label: 'AIMD renderer', command: 'pnpm add @airalogy/aimd-renderer' },
      { label: 'Airalogy Engine Node.js', command: 'pnpm add @airalogy/airalogy-engine' },
    ],
  },
}

const content = computed(() => copy[props.locale] ?? copy.en)
</script>
