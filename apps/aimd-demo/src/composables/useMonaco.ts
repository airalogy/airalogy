import type * as Monaco from 'monaco-editor'
import { shallowRef } from 'vue'

// Monaco Editor workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

let monacoInstance: typeof Monaco | null = null
let initPromise: Promise<typeof Monaco> | null = null

const CLIENT_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*\bruntime\s*=\s*(?:"client"|'client'|client)\b.*)\s*$/
const SERVER_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*)?\s*$/
const QUIZ_FENCE = /^\s*(```|~~~)\s*quiz(?:\s+.*)?\s*$/
const FIG_FENCE = /^\s*(```|~~~)\s*fig(?:\s+.*)?\s*$/
const MEDIA_FENCE = /^\s*(```|~~~)\s*media(?:\s+.*)?\s*$/
const REFS_FENCE = /^\s*(```|~~~)\s*refs(?:\s+.*)?\s*$/
const GENERIC_CODE_FENCE = /^\s*(```|~~~)\s*((?:\w|[/#-])+)(?:\s+.*)?\s*$/
const EMPTY_CODE_FENCE = /^\s*(```|~~~)\s*$/

function setupWorkers() {
  // @ts-expect-error MonacoEnvironment
  globalThis.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    },
  }
}

/**
 * Register AIMD language in Monaco (based on original project's useLanguageClient.ts)
 */
function registerAimdLanguage(monaco: typeof Monaco) {
  monaco.languages.register({
    id: 'aimd',
    extensions: ['.aimd'],
    aliases: ['AIMD', 'aimd'],
    mimetypes: ['text/x-aimd'],
  })

  monaco.languages.setLanguageConfiguration('aimd', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
      { open: '{{', close: '}}' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
  })

  monaco.languages.setMonarchTokensProvider('aimd', {
    defaultToken: '',
    tokenPostfix: '.aimd',
    aimdKeywords: ['var', 'var_table', 'step', 'check', 'ref_step', 'ref_var', 'ref_fig', 'ref_media', 'cite'],
    aimdTypes: ['str', 'int', 'float', 'bool', 'list', 'dict', 'any', 'date', 'file', 'CurrentTime', 'UserName', 'AiralogyMarkdown', 'DNASequence', 'PyStr', 'JsStr', 'JsonStr', 'YamlStr', 'CodeStr'],
    tokenizer: {
      root: [
        [/\{\{/, { token: 'delimiter.bracket.aimd', next: '@aimdField' }],
        [/\{\+\+[^]*?\+\+\}/, 'markup.inserted.aimd'],
        [/\{--[^]*?--\}/, 'markup.deleted.aimd'],
        [/\{~~[^]*?~>[^]*?~~\}/, 'markup.changed.aimd'],
        [/\{>>[^]*?<<\}/, 'comment.aimd'],
        [/\{==[^]*?==\}/, 'markup.highlight.aimd'],
        [/^#{1,6}\s.*$/, 'keyword.md'],
        [QUIZ_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'yaml' }],
        [FIG_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'yaml' }],
        [MEDIA_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'yaml' }],
        [REFS_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'bibtex' }],
        [CLIENT_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'javascript' }],
        [SERVER_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'python' }],
        [GENERIC_CODE_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: '$2' }],
        [EMPTY_CODE_FENCE, { token: 'string.code', next: '@codeblock' }],
        [/`[^`]+`/, 'string.code'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/__[^_]+__/, 'strong'],
        [/\*[^*]+\*/, 'emphasis'],
        [/_[^_]+_/, 'emphasis'],
        [/\[[^\]]+\]\([^)]+\)/, 'string.link'],
        [/!\[[^\]]*\]\([^)]+\)/, 'string.link'],
        [/^>.*$/, 'comment.quote'],
        [/^\s*[-*+]\s/, 'keyword.list'],
        [/^\s*\d+\.\s/, 'keyword.list'],
        [/^[-*_]{3,}\s*$/, 'keyword.hr'],
        [/<\/?[\w-][^>]*>/, 'tag'],
      ],
      aimdField: [
        [/\}\}/, { token: 'delimiter.bracket.aimd', next: '@pop' }],
        [/\b(var_table|var|step|check|ref_step|ref_var|ref_fig|ref_media|cite)\b/, 'keyword.aimd'],
        [/\|/, 'delimiter.aimd'],
        [/:/, 'delimiter'],
        [/\b(str|int|float|bool|list|dict|any)\b/, 'type.aimd'],
        [/\b[A-Z][A-Za-z0-9_]*(?:\[[A-Za-z0-9_,\s]+\])?\b/, 'type.aimd'],
        [/[[\]()]/, 'delimiter.bracket'],
        [/=/, 'delimiter'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/-?\d+\.?\d*/, 'number'],
        [/\b(true|false|True|False|null|None)\b/, 'constant'],
        [/\bsubvars\b/, 'keyword'],
        [/,/, 'delimiter'],
        [/[A-Za-z_]\w*/, 'variable.aimd'],
        [/\s+/, ''],
      ],
      codeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop' }],
        [/.*$/, 'string.code'],
      ],
      embeddedCodeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/.*$/, ''],
      ],
    },
  } as any)

  monaco.languages.registerCompletionItemProvider('aimd', {
    provideCompletionItems: () => {
      const keywords = ['var', 'var_table', 'step', 'check', 'ref_step', 'ref_var', 'ref_fig', 'ref_media', 'cite']
      const suggestions = keywords.map(keyword => ({
        label: `{{${keyword}|}}`,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: `{{${keyword}|\${1:name}}}`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: `Insert AIMD ${keyword} field`,
      }))
      suggestions.push(
        {
          label: 'fig block',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '```fig\nid: ${1:fig_id}\nsrc: ${2:path-or-url}\ntitle: ${3:Figure title}\nlegend: ${4:Figure legend}\n```',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Insert an AIMD figure block',
        },
        {
          label: 'media block',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '```media\nid: ${1:media_id}\nkind: ${2:video}\nsrc: ${3:files/videos/demo.mp4}\ntitle: ${4:Media title}\nlegend: ${5:Media legend}\n```',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Insert an AIMD media block',
        },
        {
          label: 'refs block',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '```refs\n@article{${1:ref_id},\n  title = {${2:Title}},\n  author = {${3:Author}},\n  year = {${4:2026}}\n}\n```',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Insert an AIMD BibTeX references block',
        },
      )
      return { suggestions } as any
    },
  })

  monaco.editor.defineTheme('aimd-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '2563eb' },
      { token: 'keyword.aimd', foreground: '2563eb', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '6b7280' },
      { token: 'type.aimd', foreground: '7c3aed' },
      { token: 'variable.aimd', foreground: '059669' },
      { token: 'keyword.md', foreground: '1e40af' },
      { token: 'string.code', foreground: 'be185d' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '2563eb' },
      { token: 'comment.quote', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'markup.inserted.aimd', foreground: '166534' },
      { token: 'markup.deleted.aimd', foreground: '991b1b', fontStyle: 'strikethrough' },
      { token: 'markup.changed.aimd', foreground: '92400e' },
      { token: 'markup.highlight.aimd', foreground: '854d0e', background: 'fef3c7' },
    ],
    colors: {},
  })

  monaco.editor.defineTheme('aimd-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '60a5fa' },
      { token: 'keyword.aimd', foreground: '60a5fa', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '9ca3af' },
      { token: 'type.aimd', foreground: 'a78bfa' },
      { token: 'variable.aimd', foreground: '34d399' },
      { token: 'keyword.md', foreground: '93c5fd' },
      { token: 'string.code', foreground: 'f472b6' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '60a5fa' },
      { token: 'comment.quote', foreground: '9ca3af', fontStyle: 'italic' },
      { token: 'markup.inserted.aimd', foreground: '86efac' },
      { token: 'markup.deleted.aimd', foreground: 'fca5a5', fontStyle: 'strikethrough' },
      { token: 'markup.changed.aimd', foreground: 'fbbf24' },
      { token: 'markup.highlight.aimd', foreground: 'fde68a', background: '713f12' },
    ],
    colors: {},
  })
}

async function initMonaco(): Promise<typeof Monaco> {
  if (monacoInstance) return monacoInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    setupWorkers()
    const monaco: typeof Monaco = await import('monaco-editor')
    registerAimdLanguage(monaco)
    monacoInstance = monaco
    return monaco
  })()

  return initPromise
}

export function useMonaco() {
  const monaco = shallowRef<typeof Monaco | null>(null)
  const loading = shallowRef(true)

  async function init() {
    try {
      loading.value = true
      monaco.value = await initMonaco()
    } finally {
      loading.value = false
    }
  }

  return { monaco, loading, init }
}
