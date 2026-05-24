import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pluginPath = resolve(__dirname, '../src/vue/milkdown-aimd-plugin.ts')
const editorPath = resolve(__dirname, '../src/vue/AimdEditor.vue')
const toolbarPath = resolve(__dirname, '../src/vue/AimdEditorToolbar.vue')
const sourceEditorPath = resolve(__dirname, '../src/vue/AimdSourceEditor.vue')
const wysiwygPath = resolve(__dirname, '../src/vue/AimdWysiwygEditor.vue')
const embeddedEntryPath = resolve(__dirname, '../src/embedded.ts')
const wysiwygEntryPath = resolve(__dirname, '../src/wysiwyg.ts')
const editorContentPath = resolve(__dirname, '../src/vue/useEditorContent.ts')
const dialogPath = resolve(__dirname, '../src/vue/AimdFieldDialog.vue')
const typesPath = resolve(__dirname, '../src/vue/types.ts')
const source = readFileSync(pluginPath, 'utf8')
const editorSource = readFileSync(editorPath, 'utf8')
const toolbarSource = readFileSync(toolbarPath, 'utf8')
const sourceEditorSource = readFileSync(sourceEditorPath, 'utf8')
const wysiwygSource = readFileSync(wysiwygPath, 'utf8')
const embeddedEntrySource = readFileSync(embeddedEntryPath, 'utf8')
const wysiwygEntrySource = readFileSync(wysiwygEntryPath, 'utf8')
const editorContentSource = readFileSync(editorContentPath, 'utf8')
const dialogSource = readFileSync(dialogPath, 'utf8')
const typesSource = readFileSync(typesPath, 'utf8')

function getToMarkdownBlock(content) {
  const match = content.match(/toMarkdown:\s*\{[\s\S]*?\n\s*}\s*,\n\s*}\s*as NodeSchema\)\)/)
  if (!match) {
    throw new Error('Unable to find aimd_field toMarkdown block')
  }
  return match[0]
}

function getPluginListBlock(content) {
  const match = content.match(/export const aimdMilkdownPlugins:[\s\S]*?=\s*\[[\s\S]*?\]\.flat\(\)/)
  if (!match) {
    throw new Error('Unable to find aimdMilkdownPlugins block')
  }
  return match[0]
}

test('aimd_field markdown serializer writes raw AIMD syntax as text so it round-trips through markdown instead of leaking html wrappers', () => {
  const toMarkdownBlock = getToMarkdownBlock(source)
  assert.match(
    toMarkdownBlock,
    /state\.addNode\('text',\s*undefined,\s*`\{\{\$\{node\.attrs\.fieldType\}\|\$\{node\.attrs\.fieldContent\}\}\}`\)/,
  )
})

test('aimd_field markdown serializer no longer routes AIMD syntax through html nodes', () => {
  const toMarkdownBlock = getToMarkdownBlock(source)
  assert.doesNotMatch(toMarkdownBlock, /state\.addNode\('html'/)
})

test('inline hardbreak schema override renders line break as <br> in WYSIWYG', () => {
  assert.match(source, /export const inlineHardbreakSchema = hardbreakSchema\.extendSchema\(/)
  assert.match(source, /toDOM:\s*\(node:\s*ProsemirrorNode\)\s*=>\s*\['br',\s*ctx\.get\(hardbreakAttr\.key\)\(node\)\]/)
})

test('inline hardbreak schema override is included in aimd plugin chain', () => {
  const pluginList = getPluginListBlock(source)
  assert.match(pluginList, /inlineHardbreakSchema/)
})

test('milkdown remark plugin restores protected AIMD inline templates before matching', () => {
  assert.match(source, /import\s+\{\s*restoreAimdInlineTemplates\s*\}\s+from\s+'@airalogy\/aimd-core'/)
  assert.match(source, /node\.value\s*=\s*restoreAimdInlineTemplates\(node\.value\)/)
})

test('AimdEditor protects markdown before feeding content into Milkdown', () => {
  // After refactor, the protection logic lives in useEditorContent.ts and AimdWysiwygEditor.vue
  const contentSources = editorContentSource + '\n' + editorSource
  assert.match(editorContentSource, /import\s+\{\s*protectAimdInlineTemplates(?:,\s*restoreAimdInlineTemplates)?\s*\}\s+from\s+'@airalogy\/aimd-core'/)
  assert.match(editorContentSource, /function toMilkdownMarkdown\(markdown: string\): string \{\s*return protectAimdInlineTemplates\(markdown\)\.content\s*\}/)
})

test('AimdWysiwygEditor supports controlled content sync and readonly mode for embedded hosts', () => {
  assert.match(wysiwygSource, /active\?: boolean/)
  assert.match(wysiwygSource, /readonly\?: boolean/)
  assert.match(wysiwygSource, /milkdownPlugins\?: MilkdownPlugin\[\]/)
  assert.match(wysiwygSource, /\.use\(innerProps\.milkdownPlugins \?\? aimdMilkdownPlugins\)/)
  assert.match(wysiwygSource, /watch\(\(\) => props\.content, \(content\) => \{/)
  assert.match(wysiwygSource, /const comparableContent = normalizeComparableAimdMarkdown\(content\)/)
  assert.match(wysiwygSource, /if \(!props\.active \|\| !milkdownEditorRef\.value \|\| comparableContent === lastKnownMarkdown\)/)
  assert.match(wysiwygSource, /replaceAll\(toMilkdownMarkdown\(content\)\)/)
  assert.match(wysiwygSource, /watch\(\(\) => props\.active, async \(active\) => \{/)
  assert.match(wysiwygSource, /watch\(\(\) => props\.readonly, \(readonly\) => \{/)
  assert.match(wysiwygSource, /ctx\.get\(editorViewCtx\)\.setProps\(createEditorViewOptions\(!!readonly\)\)/)
})

test('AimdWysiwygEditor suppresses delayed markdownUpdated callbacks from programmatic replaceAll syncs', () => {
  assert.match(wysiwygSource, /createProgrammaticMarkdownSyncGuard/)
  assert.match(wysiwygSource, /const PROGRAMMATIC_MARKDOWN_SUPPRESSION_MS = 420/)
  assert.match(wysiwygSource, /let suppressProgrammaticMarkdownUpdatedUntil = 0/)
  assert.match(wysiwygSource, /normalizeComparableAimdMarkdown/)
  assert.match(wysiwygSource, /programmaticMarkdownSyncGuard\.track\(comparableContent\)/)
  assert.match(wysiwygSource, /suppressProgrammaticMarkdownUpdatedUntil = Date\.now\(\) \+ PROGRAMMATIC_MARKDOWN_SUPPRESSION_MS/)
  assert.match(wysiwygSource, /const isWithinProgrammaticSuppressionWindow = Date\.now\(\) < suppressProgrammaticMarkdownUpdatedUntil/)
  assert.match(wysiwygSource, /programmaticMarkdownSyncGuard\.consume\(comparableMarkdown\)/)
  assert.match(wysiwygSource, /normalizeComparableAimdMarkdown\(props\.content\)/)
  assert.match(wysiwygSource, /programmaticMarkdownSyncGuard\.clear\(\)/)
})

test('AimdWysiwygEditor hides empty block-menu groups for lightweight integrations', () => {
  assert.match(wysiwygSource, /\.filter\(group => group\.items\.length > 0\)\)/)
})

test('AimdSourceEditor supports controlled content sync and readonly mode for embedded hosts', () => {
  assert.match(sourceEditorSource, /watch\(\(\) => props\.content, \(content\) => \{/)
  assert.match(sourceEditorSource, /content === monacoEditorInstance\.getValue\(\)/)
  assert.match(sourceEditorSource, /monacoEditorInstance\.setValue\(content\)/)
  assert.match(sourceEditorSource, /watch\(\(\) => props\.readonly, \(readonly\) => \{/)
  assert.match(sourceEditorSource, /monacoEditorInstance\?\.updateOptions\(\{ readOnly: readonly \}\)/)
})

test('AimdFieldDialog var type section exposes explained presets and keeps custom input', () => {
  assert.match(dialogSource, /aimd-var-type-grid/)
  assert.match(dialogSource, /aimd-var-type-card/)
  assert.match(dialogSource, /createAimdVarTypePresets/)
  assert.match(dialogSource, /allowedTypes\?: string\[\]/)
  assert.match(dialogSource, /function resolveDialogType\(type\?: string\): string/)
  assert.match(dialogSource, /selectVarTypePreset/)
  assert.match(typesSource, /CurrentTime/)
  assert.match(typesSource, /UserName/)
  assert.match(typesSource, /AiralogyMarkdown/)
  assert.match(typesSource, /DNASequence/)
  assert.match(typesSource, /CodeStr/)
  assert.match(typesSource, /PyStr/)
  assert.match(typesSource, /JsonStr/)
  assert.match(typesSource, /YamlStr/)
  assert.doesNotMatch(dialogSource, /<select v-model="fields\.type"/)
  assert.doesNotMatch(dialogSource, /aimd-var-type-suggestions/)
})

test('AimdEditor forwards custom var type presets into the AIMD dialog', () => {
  assert.match(editorSource, /:var-type-plugins="varTypePlugins"/)
})

test('useEditorContent reparses inserted AIMD syntax in WYSIWYG mode so host-specific node views can hydrate immediately', () => {
  assert.match(editorContentSource, /function shouldReparseInsertedText\(text: string\): boolean/)
  assert.match(editorContentSource, /function reparseMilkdownMarkdown\(\)/)
  assert.match(editorContentSource, /if \(shouldReparseInsertedText\(text\)\) \{\s*reparseMilkdownMarkdown\(\)/)
})

test('useEditorContent restores protected AIMD templates and rejects leaked editor DOM before syncing WYSIWYG markdown back to app state', () => {
  assert.match(editorContentSource, /import\s+\{\s*protectAimdInlineTemplates,\s*restoreAimdInlineTemplates\s*\}\s+from\s+'@airalogy\/aimd-core'/)
  assert.match(editorContentSource, /function isLikelyCorruptedMilkdownMarkdown\(markdown: string\): boolean/)
  assert.match(editorContentSource, /class="ProseMirror milkdown-editor-content editor"/)
  assert.match(editorContentSource, /<div class="milkdown">/)
  assert.match(editorContentSource, /AIMDINLINETEMPLATE\[0-9a-f\]\+TOKEN/)
  assert.match(editorContentSource, /function normalizeMilkdownMarkdown\(markdown: string, fallback: string\): string/)
  assert.match(editorContentSource, /normalizeAimdInlineTemplateMarkdownEscapes/)
  assert.match(editorContentSource, /const restored = normalizeAimdInlineTemplateMarkdownEscapes\(restoreAimdInlineTemplates\(markdown\)\)/)
  assert.match(editorContentSource, /return fallback/)
  assert.match(editorContentSource, /commitUserContent\(normalizeMilkdownMarkdown\(markdown, content\.value\)\)/)
})

test('useEditorContent emits only from explicit user-edit entry points instead of a generic watch(content) echo path', () => {
  assert.match(editorContentSource, /function commitUserContent\(nextContent: string\)/)
  assert.match(editorContentSource, /emitModelValue\(nextContent\)/)
  assert.match(editorContentSource, /content\.value = val/)
  assert.match(editorContentSource, /commitUserContent\(normalizeMilkdownMarkdown\(markdown, content\.value\)\)/)
  assert.doesNotMatch(editorContentSource, /watch\(content,\s*\(val\)\s*=>/)
  assert.match(editorSource, /function onSourceContentChange\(val: string\) \{\s*commitUserContent\(val\)\s*\}/)
})

test('AimdEditor only treats the WYSIWYG editor as active while that mode is visible', () => {
  assert.match(editorSource, /:active="editorMode === 'wysiwyg'"/)
})

test('AimdEditor can unmount inactive editor panes for embedded recorder fields', () => {
  assert.match(typesSource, /keepInactiveEditorsMounted\?: boolean/)
  assert.match(editorSource, /keepInactiveEditorsMounted: true/)
  assert.match(editorSource, /const shouldMountSourceEditor = computed\(\(\) => props\.keepInactiveEditorsMounted \|\| editorMode\.value === 'source'\)/)
  assert.match(editorSource, /const shouldMountWysiwygEditor = computed\(\(\) => props\.keepInactiveEditorsMounted \|\| editorMode\.value === 'wysiwyg'\)/)
  assert.match(editorSource, /<div v-if="shouldMountSourceEditor" v-show="editorMode === 'source'">/)
  assert.match(editorSource, /<div v-if="shouldMountWysiwygEditor" v-show="editorMode === 'wysiwyg'">/)
})

test('AimdEditorToolbar uses non-submit buttons for host safety', () => {
  assert.match(toolbarSource, /type="button"/)
})

test('wysiwyg entry exports the lightweight embedded editor surface', () => {
  assert.match(wysiwygEntrySource, /export \{ default as AimdWysiwygEditor \} from '\.\/vue\/AimdWysiwygEditor\.vue'/)
  assert.match(wysiwygEntrySource, /createAimdEditorMessages/)
})

test('embedded entry exports source and wysiwyg editors for field-level integrations', () => {
  assert.match(embeddedEntrySource, /export \{ default as AimdSourceEditor \} from '\.\/vue\/AimdSourceEditor\.vue'/)
  assert.match(embeddedEntrySource, /export \{ default as AimdWysiwygEditor \} from '\.\/vue\/AimdWysiwygEditor\.vue'/)
})
