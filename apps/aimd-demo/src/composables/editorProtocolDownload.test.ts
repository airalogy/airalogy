import { describe, expect, it, vi } from 'vitest'
import { createEditorProtocolDownload } from './editorProtocolDownload'

const missingIdFigure = [
  '# Figure protocol',
  '',
  '```fig',
  'src: images/lab-team.jpeg',
  'title: Lab team',
  '```',
].join('\n')

const protocol = {
  protocol_id: 'figure-protocol',
  protocol_name: 'Figure protocol',
}

describe('createEditorProtocolDownload', () => {
  it('normalizes figure ids before plain AIMD downloads', async () => {
    const archiveFactory = vi.fn()
    const result = await createEditorProtocolDownload({
      aimd: missingIdFigure,
      filenameStem: 'figure-protocol',
      protocol,
      files: [],
    }, archiveFactory)

    expect(result.kind).toBe('aimd')
    expect(result.filename).toBe('figure-protocol.aimd')
    expect(result.changed).toBe(true)
    expect(result.generatedFigureIds).toEqual(['lab_team'])
    expect(result.aimd).toContain('id: lab_team')
    expect(result.data).toBe(result.aimd)
    expect(archiveFactory).not.toHaveBeenCalled()
  })

  it('passes normalized AIMD into AIRA packaging', async () => {
    const archiveBytes = new Uint8Array([1, 2, 3])
    const archiveFactory = vi.fn(async () => archiveBytes)
    const result = await createEditorProtocolDownload({
      aimd: missingIdFigure,
      filenameStem: 'figure-protocol',
      protocol,
      files: [{ path: 'images/lab-team.jpeg', data: new Uint8Array([4, 5]) }],
    }, archiveFactory)

    expect(result.kind).toBe('aira')
    expect(result.filename).toBe('figure-protocol.aira')
    expect(result.data).toBe(archiveBytes)
    expect(result.generatedFigureIds).toEqual(['lab_team'])
    expect(archiveFactory).toHaveBeenCalledOnce()
    expect(archiveFactory.mock.calls[0][0].aimd).toContain('id: lab_team')
  })
})
