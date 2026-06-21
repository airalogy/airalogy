import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './EditorDemo.vue'), 'utf8')

describe('EditorDemo archive export', () => {
  it('starts as a blank online editor and loads examples only as templates', () => {
    expect(source).toContain("content.value = ''")
    expect(source).toContain('activeTemplateExampleId')
    expect(source).toContain('activeTemplateLocale')
    expect(source).toContain('canClearContent')
    expect(source).toContain('clearEditorContent')
    expect(source).toContain('contentCleared')
    expect(source).toContain('handleExampleTemplateSelect')
    expect(source).toContain('loadSelectedExampleTemplate')
    expect(source).toContain('templatePickerTitle')
    expect(source).toContain('blankTemplateHint')
    expect(source).toContain('emptyPreview')
    expect(source).toContain('resolveDemoExampleAsset')
    expect(source).toContain('getDemoExample(activeTemplateExampleId.value)')
    expect(source).not.toContain("watch(locale, () => {\n  clearProtocolFiles()\n  resetToSelectedExample(locale.value)\n})")
  })

  it('packages uploaded images as protocol-local figure files', () => {
    expect(source).toContain('createProtocolAiraArchive')
    expect(source).toContain('```fig')
    expect(source).toContain('src: ${toAimdScalar(figure.src)}')
    expect(source).toContain('insertProtocolFigureBlock(figureFile, metadata)')
    expect(source).toContain('makeResourceBaseName(getFileStem(file.name), `uploaded-figure-${index}`)')
    expect(source).toContain('replace(/[^\\p{L}\\p{N}._-]+/gu, \'-\')')
    expect(source).toContain('files/${baseName}.${extension}')
    expect(source).not.toContain('airalogy.id.file')
  })

  it('uses the editor image toolbar as the figure insertion entrypoint', () => {
    expect(source).toContain('image-toolbar-action="custom"')
    expect(source).toContain('@request-image="openImageInsertPanel"')
    expect(source).toContain('<Teleport to="body">')
    expect(source).toContain('class="figure-insert-popover"')
    expect(source).toContain('buttonRect')
    expect(source).toContain('figureInsertSource')
    expect(source).toContain('localFigureMode')
    expect(source).toContain('remoteFigureMode')
    expect(source).toContain('insertRemoteFigure')
    expect(source).toContain('openFigureFilePicker')
  })

  it('downloads plain AIMD until protocol-local files require an archive', () => {
    expect(source).toContain('protocolFileCount.value === 0')
    expect(source).toContain('`${filenameStem}.aimd`')
    expect(source).toContain('`${filenameStem}.aira`')
    expect(source).toContain('workspace-panel__actions')
    expect(source).toContain('workspace-panel__download')
    expect(source).not.toContain('archive-toolbar')
  })

  it('keeps the live preview from adding a panel-level horizontal scrollbar', () => {
    expect(source).toMatch(/\.workspace-panel__body \{[\s\S]*?overflow-x: hidden;/)
    expect(source).toMatch(/\.workspace-panel__body \{[\s\S]*?overflow-y: auto;/)
    expect(source).toMatch(/\.render-preview \{[\s\S]*?overflow-wrap: anywhere;/)
    expect(source).toMatch(/\.render-preview :deep\(table\) \{[\s\S]*?overflow-x: auto;/)
    expect(source).toMatch(/\.render-preview :deep\(pre\) \{[\s\S]*?overflow-x: auto;/)
  })
})
