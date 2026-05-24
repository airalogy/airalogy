import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const contributionLoaders: Record<string, () => Promise<unknown>> = {
  css: () => import('monaco-editor/esm/vs/language/css/monaco.contribution.js'),
  scss: () => import('monaco-editor/esm/vs/language/css/monaco.contribution.js'),
  less: () => import('monaco-editor/esm/vs/language/css/monaco.contribution.js'),
  html: () => import('monaco-editor/esm/vs/language/html/monaco.contribution.js'),
  javascript: () => import('monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  typescript: () => import('monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  json: () => import('monaco-editor/esm/vs/language/json/monaco.contribution.js'),
  ini: () => import('monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js'),
  markdown: () => import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js'),
  python: () => import('monaco-editor/esm/vs/basic-languages/python/python.contribution.js'),
  shell: () => import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'),
  sql: () => import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'),
  xml: () => import('monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js'),
  yaml: () => import('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js'),
}

const loadedContributionPromises = new Map<string, Promise<void>>()

export function ensureMonacoEnvironment() {
  if (typeof globalThis === 'undefined') {
    return
  }

  const existing = (globalThis as { MonacoEnvironment?: { getWorker?: (moduleId: string, label: string) => Worker } }).MonacoEnvironment
  if (typeof existing?.getWorker === 'function') {
    return
  }

  ;(globalThis as {
    MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker }
  }).MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }

      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }

      return new editorWorker()
    },
  }
}

export async function ensureMonacoLanguageContribution(language: string): Promise<void> {
  const loader = contributionLoaders[language]
  if (!loader) {
    return
  }

  const existingPromise = loadedContributionPromises.get(language)
  if (existingPromise) {
    return existingPromise
  }

  const loadingPromise = Promise.resolve(loader()).then(() => undefined)
  loadedContributionPromises.set(language, loadingPromise)
  return loadingPromise
}
