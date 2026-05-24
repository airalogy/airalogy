const DEFAULT_RETENTION_MS = 1000

export interface ProgrammaticMarkdownSyncGuard {
  track(markdown: string): void
  consume(markdown: string): boolean
  clear(): void
}

export function createProgrammaticMarkdownSyncGuard(
  retentionMs = DEFAULT_RETENTION_MS,
): ProgrammaticMarkdownSyncGuard {
  const pendingCounts = new Map<string, number>()
  const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearTimer(markdown: string) {
    const timer = cleanupTimers.get(markdown)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    cleanupTimers.delete(markdown)
  }

  function drop(markdown: string) {
    pendingCounts.delete(markdown)
    clearTimer(markdown)
  }

  function scheduleCleanup(markdown: string) {
    clearTimer(markdown)
    cleanupTimers.set(markdown, setTimeout(() => {
      drop(markdown)
    }, retentionMs))
  }

  return {
    track(markdown: string) {
      pendingCounts.set(markdown, (pendingCounts.get(markdown) ?? 0) + 1)
      scheduleCleanup(markdown)
    },
    consume(markdown: string) {
      const count = pendingCounts.get(markdown) ?? 0
      if (count <= 0) {
        return false
      }

      if (count === 1) {
        drop(markdown)
      } else {
        pendingCounts.set(markdown, count - 1)
        scheduleCleanup(markdown)
      }

      return true
    },
    clear() {
      for (const timer of cleanupTimers.values()) {
        clearTimeout(timer)
      }

      cleanupTimers.clear()
      pendingCounts.clear()
    },
  }
}
