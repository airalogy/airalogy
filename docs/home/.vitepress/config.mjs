import { defineConfig } from 'vitepress'

const normalizeBasePath = (basePath) => {
  if (!basePath || basePath === '/') return '/'

  let normalized = basePath
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`

  return normalized.replace(/\/{2,}/g, '/')
}

const inferBasePathFromGitHub = () => {
  const repository = process.env.GITHUB_REPOSITORY
  const owner = process.env.GITHUB_REPOSITORY_OWNER
  if (!repository || !owner) return '/'

  const [, repoName] = repository.split('/')
  if (!repoName) return '/'

  return repoName === `${owner}.github.io` ? '/' : `/${repoName}/`
}

const base = normalizeBasePath(process.env.BASE_PATH || inferBasePathFromGitHub())
const githubLink = 'https://github.com/airalogy/airalogy'

export default defineConfig({
  title: 'Airalogy Docs',
  lang: 'en-US',
  description: 'Documentation hub for the Airalogy ecosystem',
  base,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Airalogy Docs',
      description: 'Documentation hub for the Airalogy ecosystem',
      themeConfig: {
        nav: [
          { text: 'Airalogy', link: '/airalogy/en/' },
          { text: 'AIMD', link: '/aimd/en/' },
          { text: 'Engine', link: '/airalogy-engine/' },
        ],
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Airalogy 文档',
      description: 'Airalogy 生态系统文档入口',
      themeConfig: {
        nav: [
          { text: 'Airalogy', link: '/airalogy/zh/' },
          { text: 'AIMD', link: '/aimd/zh/' },
          { text: 'Engine', link: '/airalogy-engine/' },
        ],
      },
    },
  },
  themeConfig: {
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Airalogy', link: '/airalogy/en/' },
      { text: 'AIMD', link: '/aimd/en/' },
      { text: 'Engine', link: '/airalogy-engine/' },
    ],
    socialLinks: [
      { icon: 'github', link: githubLink },
    ],
  },
  markdown: {
    lineNumbers: false,
  },
})
