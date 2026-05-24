import { ref, shallowRef, computed, watch, nextTick } from 'vue'
import { protectAimdInlineTemplates, restoreAimdInlineTemplates } from '@airalogy/aimd-core'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import type { Editor } from '@milkdown/kit/core'
import { replaceAll, getMarkdown, insert } from '@milkdown/kit/utils'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { callCommand } from '@milkdown/kit/utils'
import type { AimdEditorMessages } from './locales'
import { normalizeAimdInlineTemplateMarkdownEscapes } from './aimdInlineMarkdownNormalization'

export interface UseEditorContentOptions {
  initialContent: string
  initialMode: 'source' | 'wysiwyg'
  resolvedMessages: { value: AimdEditorMessages }
  emitModelValue: (value: string) => void
  emitMode: (mode: 'source' | 'wysiwyg') => void
}

export function useEditorContent(options: UseEditorContentOptions) {
  const { initialContent, initialMode, resolvedMessages, emitModelValue, emitMode } = options

  const editorMode = ref<'source' | 'wysiwyg'>(initialMode)
  const content = ref(initialContent)
  const monacoEditor = shallowRef<any>(null)
  const monacoInstance = shallowRef<any>(null)
  const monacoLoading = ref(true)
  const milkdownEditorRef = shallowRef<Editor | null>(null)

  let isSyncing = false

  function commitUserContent(nextContent: string) {
    if (nextContent === content.value) {
      return
    }

    content.value = nextContent
    emitModelValue(nextContent)
  }

  function toMilkdownMarkdown(markdown: string): string {
    return protectAimdInlineTemplates(markdown).content
  }

  function isLikelyCorruptedMilkdownMarkdown(markdown: string): boolean {
    return /class="ProseMirror milkdown-editor-content editor"/.test(markdown)
      || /<div class="milkdown">/.test(markdown)
      || (/<\/?[a-z][^>]*>/i.test(markdown) && /AIMDINLINETEMPLATE[0-9a-f]+TOKEN/.test(markdown))
  }

  function normalizeMilkdownMarkdown(markdown: string, fallback: string): string {
    const restored = normalizeAimdInlineTemplateMarkdownEscapes(restoreAimdInlineTemplates(markdown))
    if (isLikelyCorruptedMilkdownMarkdown(restored)) {
      return fallback
    }

    return restored
  }

  function shouldReparseInsertedText(text: string): boolean {
    return /\{\{(?:var_table|var|quiz|step|check|ref_step|ref_var|ref_fig|cite|fig)\|/.test(text)
      || /```(?:quiz|fig|assigner)\b/.test(text)
  }

  function reparseMilkdownMarkdown() {
    if (!milkdownEditorRef.value) {
      return
    }

    try {
      const markdown = milkdownEditorRef.value.action(getMarkdown())
      if (typeof markdown !== 'string') {
        return
      }

      const normalizedMarkdown = normalizeMilkdownMarkdown(markdown, content.value)
      milkdownEditorRef.value.action(replaceAll(toMilkdownMarkdown(normalizedMarkdown)))
    } catch {}
  }

  // --- Extracted fields for reference suggestions ---
  const extractedFields = computed(() => {
    try { return parseAndExtract(content.value) } catch { return null }
  })

  // --- Mode switching ---
  async function switchMode(mode: 'source' | 'wysiwyg') {
    if (mode === editorMode.value) return

    if (editorMode.value === 'source' && monacoEditor.value) {
      content.value = monacoEditor.value.getValue()
    }

    if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
      try {
        const md = milkdownEditorRef.value.action(getMarkdown())
        if (typeof md === 'string') {
          content.value = normalizeMilkdownMarkdown(md, content.value)
        }
      } catch {}
    }

    editorMode.value = mode
    emitMode(mode)

    if (mode === 'source') {
      await nextTick()
      if (monacoEditor.value) {
        isSyncing = true
        monacoEditor.value.setValue(content.value)
        isSyncing = false
      }
    } else if (mode === 'wysiwyg') {
      await nextTick()
      if (milkdownEditorRef.value) {
        try {
          isSyncing = true
          milkdownEditorRef.value.action(replaceAll(toMilkdownMarkdown(content.value)))
          isSyncing = false
        } catch { isSyncing = false }
      }
    }
  }

  // Sync external modelValue changes
  function syncFromProp(val: string) {
    if (val !== content.value) {
      isSyncing = true
      content.value = val
      if (editorMode.value === 'source' && monacoEditor.value) {
        monacoEditor.value.setValue(val)
      } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
        try { milkdownEditorRef.value.action(replaceAll(toMilkdownMarkdown(val))) } catch {}
      }
      isSyncing = false
    }
  }

  // --- Markdown toolbar actions ---
  function insertTextIntoActiveEditor(text: string) {
    if (editorMode.value === 'source' && monacoEditor.value) {
      const selection = monacoEditor.value.getSelection()
      const model = monacoEditor.value.getModel()
      const position = monacoEditor.value.getPosition()
      const lineContent = model.getLineContent(position.lineNumber)
      const beforeCursor = lineContent.substring(0, position.column - 1)
      const needsLeadingNewline = beforeCursor.trim() !== '' && !text.startsWith('\n')
      const finalText = needsLeadingNewline ? '\n' + text : text
      monacoEditor.value.executeEdits('toolbar', [{
        range: selection,
        text: finalText,
        forceMoveMarkers: true,
      }])
      monacoEditor.value.focus()
    } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
      try {
        milkdownEditorRef.value.action(insert(text))
        if (shouldReparseInsertedText(text)) {
          reparseMilkdownMarkdown()
        }
      } catch {}
    }
  }

  function insertAtCursor(before: string, after: string = '', placeholder: string = '') {
    if (editorMode.value === 'source' && monacoEditor.value) {
      const selection = monacoEditor.value.getSelection()
      const selectedText = monacoEditor.value.getModel().getValueInRange(selection) || placeholder
      const text = before + selectedText + after
      monacoEditor.value.executeEdits('toolbar', [{
        range: selection,
        text,
        forceMoveMarkers: true,
      }])
      monacoEditor.value.focus()
    } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
      try { milkdownEditorRef.value.action(insert(before + placeholder + after)) } catch {}
    }
  }

  function insertLine(prefix: string, placeholder: string = '') {
    if (editorMode.value === 'source' && monacoEditor.value) {
      const position = monacoEditor.value.getPosition()
      const model = monacoEditor.value.getModel()
      const lineContent = model.getLineContent(position.lineNumber)
      if (lineContent.trim() === '') {
        const range = { startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: lineContent.length + 1 }
        monacoEditor.value.executeEdits('toolbar', [{ range, text: prefix + placeholder, forceMoveMarkers: true }])
      } else {
        const range = { startLineNumber: position.lineNumber, startColumn: lineContent.length + 1, endLineNumber: position.lineNumber, endColumn: lineContent.length + 1 }
        monacoEditor.value.executeEdits('toolbar', [{ range, text: '\n' + prefix + placeholder, forceMoveMarkers: true }])
      }
      monacoEditor.value.focus()
    } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
      try { milkdownEditorRef.value.action(insert('\n' + prefix + placeholder)) } catch {}
    }
  }

  function handleMdAction(action: string) {
    const snippets = resolvedMessages.value.snippets
    switch (action) {
      case 'h1': insertLine('# ', snippets.heading); break
      case 'h2': insertLine('## ', snippets.heading); break
      case 'h3': insertLine('### ', snippets.heading); break
      case 'bold': insertAtCursor('**', '**', snippets.boldText); break
      case 'italic': insertAtCursor('*', '*', snippets.italicText); break
      case 'strikethrough': insertAtCursor('~~', '~~', snippets.strikethrough); break
      case 'ul': insertLine('- ', snippets.listItem); break
      case 'ol': insertLine('1. ', snippets.listItem); break
      case 'blockquote': insertLine('> ', snippets.quote); break
      case 'code': insertAtCursor('`', '`', snippets.code); break
      case 'codeblock': insertAtCursor('```\n', '\n```', snippets.codeBlock); break
      case 'link': insertAtCursor('[', '](url)', snippets.linkText); break
      case 'image': insertAtCursor('![', '](url)', snippets.altText); break
      case 'hr': insertLine('---'); break
      case 'math': insertAtCursor('$', '$', snippets.mathFormula); break
      case 'table':
        if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
          try { milkdownEditorRef.value.action(callCommand(insertTableCommand.key, { row: 3, col: 3 })) } catch {}
        } else {
          insertLine(
            `| ${snippets.tableColumnA} | ${snippets.tableColumnB} | ${snippets.tableColumnC} |\n|-------|-------|-------|\n| `,
            ' |  |  |',
          )
        }
        break
    }
  }

  function onMilkdownMarkdownUpdated(_ctx: any, markdown: string, _prev: string) {
    if (isSyncing) {
      return
    }

    commitUserContent(normalizeMilkdownMarkdown(markdown, content.value))
  }

  function onMilkdownReady(editor: Editor) {
    milkdownEditorRef.value = editor
  }

  return {
    editorMode,
    content,
    commitUserContent,
    monacoEditor,
    monacoInstance,
    monacoLoading,
    milkdownEditorRef,
    extractedFields,
    toMilkdownMarkdown,
    switchMode,
    syncFromProp,
    insertTextIntoActiveEditor,
    handleMdAction,
    onMilkdownMarkdownUpdated,
    onMilkdownReady,
  }
}
