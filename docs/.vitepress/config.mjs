import { defineConfig } from 'vitepress'

import enApisSidebar from './sidebars/en/apis.mjs'
import enSyntaxSidebar from './sidebars/en/syntax.mjs'
import enDataStructureSidebar from './sidebars/en/data-structure.mjs'
import zhApisSidebar from './sidebars/zh/apis.mjs'
import zhSyntaxSidebar from './sidebars/zh/syntax.mjs'
import zhDataStructureSidebar from './sidebars/zh/data-structure.mjs'

const base = process.env.BASE_PATH || '/'
const githubLink = 'https://github.com/airalogy/airalogy'

const enRootSidebar = [
  {
    text: 'Syntax',
    link: '/en/syntax/',
    collapsed: true,
    items: enSyntaxSidebar[0]?.items ?? []
  },
  {
    text: 'APIs',
    link: '/en/apis/markdown',
    collapsed: true,
    items: enApisSidebar[0]?.items ?? []
  },
  {
    text: 'Data Structure',
    link: '/en/data-structure/',
    collapsed: true,
    items: enDataStructureSidebar[0]?.items ?? []
  }
]

const zhRootSidebar = [
  {
    text: '语法',
    link: '/zh/syntax/',
    collapsed: true,
    items: zhSyntaxSidebar[0]?.items ?? []
  },
  {
    text: 'API 文档',
    link: '/zh/apis/markdown',
    collapsed: true,
    items: zhApisSidebar[0]?.items ?? []
  },
  {
    text: '数据结构',
    link: '/zh/data-structure/',
    collapsed: true,
    items: zhDataStructureSidebar[0]?.items ?? []
  }
]

const enSidebar = {
  '/en/': enRootSidebar,
  '/en/apis/': enApisSidebar,
  '/en/syntax/': enSyntaxSidebar,
  '/en/data-structure/': enDataStructureSidebar
}

const zhSidebar = {
  '/zh/': zhRootSidebar,
  '/zh/apis/': zhApisSidebar,
  '/zh/syntax/': zhSyntaxSidebar,
  '/zh/data-structure/': zhDataStructureSidebar
}

export default defineConfig({
  title: 'Airalogy',
  lang: 'en-US',
  description: 'Universal framework for standardized data digitization',
  base,
  locales: {
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Syntax', link: '/en/syntax/' },
          { text: 'APIs', link: '/en/apis/' },
          { text: 'Data Structure', link: '/en/data-structure/' }
        ],
        sidebar: enSidebar
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '语法', link: '/zh/syntax/' },
          { text: 'API', link: '/zh/apis/' },
          { text: '数据结构', link: '/zh/data-structure/' }
        ],
        sidebar: zhSidebar
      }
    }
  },
  themeConfig: {
    search: {
      provider: 'local'
    },
    siteTitle: false,
    logo: {
      light: '/logo-light.svg',
      dark: '/logo-dark.svg'
    },
    socialLinks: [
      { icon: 'github', link: githubLink }
    ]
  },
  /*
    说明：VitePress 会将 Markdown 编译为 Vue 组件渲染，因此 Vue 的插值语法 `{{ ... }}` 可能在页面中被解析执行。
    当我们在“行内代码”（反引号包裹的 `code`）里展示包含 `{{` / `}}` 的示例时，Vue 会把它当作插值表达式，
    从而导致渲染异常、内容缺失，甚至构建时报错。
  
    围栏代码块（```）默认带 v-pre，不会触发 Vue 解析；但行内 code 默认不会。
    所以下面通过重写 markdown-it 的 code_inline 渲染规则，为所有行内 <code> 自动添加 v-pre，
    让行内代码中的 `{{ ... }}`、以及类似模板符号都能按原样文本正确显示。
  */
  markdown: {
    config(md) {
      const defaultRender =
        md.renderer.rules.code_inline ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        const html = defaultRender(tokens, idx, options, env, self)
        return html.replace('<code', '<code v-pre')
      }
    }
  }

})

