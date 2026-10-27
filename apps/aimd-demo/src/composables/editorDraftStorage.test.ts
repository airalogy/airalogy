import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createEditorDraftStorage } from './editorDraftStorage'

describe('editor work drafts', () => {
  it('round-trips template, typed values, identity and blobs together', async () => {
    const factory = new IDBFactory()
    const storage = createEditorDraftStorage<any>(factory)
    await storage.write({ id: 'current', version: 2, content: '{{var|x: bool | None}}',
      recorderData: { var: { x: false, empty: null, values: [1, 'A'] }, step: { done: { checked: true } }, check: {}, quiz: {} },
      recordIdentity: { id: 'r1', version: 2 }, recordFiles: [{ id: 'f1', blob: new Blob(['abc']) }] })
    const restored = await createEditorDraftStorage<any>(factory).read()
    expect(restored.recorderData.var).toEqual({ x: false, empty: null, values: [1, 'A'] })
    expect(restored.recordIdentity).toEqual({ id: 'r1', version: 2 })
    expect(await restored.recordFiles[0].blob.text()).toBe('abc')
  })

  it('reads old template-only drafts and serializes rapid saves and clear', async () => {
    const storage = createEditorDraftStorage<any>(new IDBFactory())
    await storage.write({ id: 'current', content: 'old' })
    expect((await storage.read()).recorderData).toBeUndefined()
    const first = storage.write({ id: 'current', content: 'first' })
    const second = storage.write({ id: 'current', content: 'latest' })
    await first; await second
    expect((await storage.read()).content).toBe('latest')
    const pending = storage.write({ id: 'current', content: 'pending' })
    const clear = storage.clear()
    await pending; await clear
    expect(await storage.read()).toBeUndefined()
  })

  it('reports failed writes and allows a subsequent save', async () => {
    const storage = createEditorDraftStorage<any>(new IDBFactory())
    await expect(storage.write({ id: 'current', invalid: () => 1 })).rejects.toThrow()
    await storage.write({ id: 'current', content: 'recovered' })
    expect((await storage.read()).content).toBe('recovered')
  })

  it('retains independently edited imported records and the current selection', async () => {
    const storage = createEditorDraftStorage<any>(new IDBFactory())
    await storage.write({ id: 'current', selectedRecordId: 'second',
      recorderData: { var: { sample: 'second edit' } },
      importedRecords: [
        { id: 'first', recordData: { var: { sample: 'first edit' } }, recordIdentity: { id: 'r1', version: 2 } },
        { id: 'second', recordData: { var: { sample: 'second edit' } }, recordFiles: [{ id: 'f1', blob: new Blob(['second file']) }] },
      ],
    })
    const draft = await storage.read()
    expect(draft.selectedRecordId).toBe('second')
    expect(draft.importedRecords[0].recordData.var.sample).toBe('first edit')
    expect(draft.importedRecords[0].recordIdentity.version).toBe(2)
    expect(draft.importedRecords[1].recordData).toEqual(draft.recorderData)
    expect(await draft.importedRecords[1].recordFiles[0].blob.text()).toBe('second file')
  })
})
