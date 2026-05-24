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
  title: 'Airalogy Engine',
  lang: 'en-US',
  description: 'Airalogy protocol execution sandbox documentation',
  base,
  themeConfig: {
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Python Package', link: 'https://github.com/airalogy/airalogy/tree/main/packages/pypi/airalogy-engine' },
      { text: 'Node.js Package', link: 'https://github.com/airalogy/airalogy/tree/main/packages/npm/airalogy-engine' },
    ],
    sidebar: [
      {
        text: 'Airalogy Engine',
        items: [
          { text: 'Overview', link: '/' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: githubLink },
    ],
  },
  markdown: {
    lineNumbers: false,
  },
})
