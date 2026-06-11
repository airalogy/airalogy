type TauriInternalsWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

type DesktopFilePayload = {
  name: string
  path: string
  bytes: number[]
}

export type DesktopBridge = {
  initialFilePaths: () => Promise<string[]>
  listenOpenFilePaths: (handler: (paths: string[]) => void) => Promise<void>
  readFilePath: (path: string) => Promise<File>
  dispose: () => void
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as TauriInternalsWindow).__TAURI_INTERNALS__)
}

function fallbackFileName(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  return normalized.split('/').filter(Boolean).at(-1) || 'archive.aira'
}

function fileFromPayload(payload: DesktopFilePayload): File {
  const bytes = new Uint8Array(payload.bytes)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new File([buffer], payload.name || fallbackFileName(payload.path), {
    type: 'application/zip',
  })
}

export async function createDesktopBridge(): Promise<DesktopBridge | null> {
  if (!isTauriRuntime()) {
    return null
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const unlistenFns: Array<() => void> = []

  async function readFilePath(path: string): Promise<File> {
    const payload = await invoke<DesktopFilePayload>('read_aira_file', { path })
    return fileFromPayload(payload)
  }

  return {
    async initialFilePaths(): Promise<string[]> {
      return invoke<string[]>('initial_file_paths')
    },
    async listenOpenFilePaths(handler: (paths: string[]) => void): Promise<void> {
      const unlisten = await listen<string[]>('aira-reader-open-files', event => {
        handler(event.payload)
      })
      unlistenFns.push(unlisten)
    },
    readFilePath,
    dispose(): void {
      for (const unlisten of unlistenFns.splice(0)) {
        unlisten()
      }
    },
  }
}
