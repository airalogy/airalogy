import { type Ref } from "vue"
import type { AimdClientAssignerField } from "@airalogy/aimd-core/types"
import { applyClientAssigners } from "../client-assigner"
import type { ClientAssignerFieldDefinitions } from "../client-assigner"
import type { AimdProtocolRecordData } from "../types"

export interface ClientAssignerRunnerOptions {
  readonly: () => boolean
  clientAssigners: Ref<AimdClientAssignerField[]>
  fieldDefinitions?: () => ClientAssignerFieldDefinitions
  localRecord: AimdProtocolRecordData
  onError: (message: string) => void
  emitRecordUpdate: () => void
  scheduleInlineRebuild: () => void
}

export function useClientAssignerRunner(options: ClientAssignerRunnerOptions) {
  const {
    readonly: isReadonly,
    clientAssigners,
    fieldDefinitions,
    localRecord,
    onError,
    emitRecordUpdate,
    scheduleInlineRebuild,
  } = options

  function runClientAssigners(opts?: { triggerIds?: string[] }): boolean {
    if (isReadonly() || clientAssigners.value.length === 0) {
      return false
    }

    try {
      return applyClientAssigners(clientAssigners.value, localRecord.var, {
        ...opts,
        fieldDefinitions: fieldDefinitions?.(),
      }).changed
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      onError(`Client assigner error: ${message}`)
      return false
    }
  }

  function applyCurrentClientAssigners(): boolean {
    return runClientAssigners()
  }

  function triggerClientAssigner(id: string): boolean {
    const changed = runClientAssigners({ triggerIds: [id] })
    if (changed) {
      emitRecordUpdate()
      scheduleInlineRebuild()
    }
    return changed
  }

  function triggerManualClientAssigners(ids?: string[]): boolean {
    const manualIds = ids?.length
      ? ids
      : clientAssigners.value.filter(assigner => assigner.mode === "manual").map(assigner => assigner.id)
    if (manualIds.length === 0) {
      return false
    }
    const changed = runClientAssigners({ triggerIds: manualIds })
    if (changed) {
      emitRecordUpdate()
      scheduleInlineRebuild()
    }
    return changed
  }

  return {
    runClientAssigners,
    applyCurrentClientAssigners,
    triggerClientAssigner,
    triggerManualClientAssigners,
  }
}
