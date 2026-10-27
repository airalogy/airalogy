/** A single transaction stores the template, values, and attachment blobs together. */
export function createEditorDraftStorage<T extends { id: string }>(
  factory: IDBFactory,
  databaseName = 'airalogy-aimd-demo-editor',
) {
  let queue: Promise<unknown> = Promise.resolve()
  function run<R>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const request = factory.open(databaseName, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('drafts')) request.result.createObjectStore('drafts', { keyPath: 'id' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('drafts', mode)
        let result: IDBRequest<R>
        try { result = operation(transaction.objectStore('drafts')) }
        catch (error) { db.close(); reject(error); return }
        transaction.oncomplete = () => { db.close(); resolve(result.result) }
        transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? result.error) }
      }
    })
  }
  function enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const next = queue.then(operation)
    queue = next.catch(() => undefined)
    return next
  }
  return {
    read: (id = 'current') => enqueue(() => run<T | undefined>('readonly', store => store.get(id))),
    write: (draft: T) => enqueue(() => run('readwrite', store => store.put(draft))),
    clear: (id = 'current') => enqueue(() => run('readwrite', store => store.delete(id))),
  }
}
