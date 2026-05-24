<script setup lang="ts">
import type { AimdRecorderMessages } from "../locales"
import type {
  ViewerAnnotation,
  ViewerExternalSelection,
  ViewerSelection,
} from "../composables/useDnaSequenceField"
import type { AimdDnaSequenceSegment } from "../types"
import AimdSeqVizViewer from "./AimdSeqVizViewer.vue"

const props = defineProps<{
  name: string
  sequence: string
  topology: "linear" | "circular"
  sequenceLength: number
  viewerAnnotations: ViewerAnnotation[]
  viewerSelection: ViewerExternalSelection | null
  selectionSegments: AimdDnaSequenceSegment[]
  selectionRangeLabel: string
  selectionTargetLabel: string
  hasActiveAnnotation: boolean
  isAnnotationSelection: boolean
  interactiveSequenceDraft: string
  hasInteractiveSequenceDraft: boolean
  importErrorMessage: string | null
  disabled: boolean
  placeholder?: string
  messages: Pick<AimdRecorderMessages, "dna">
}>()

const emit = defineEmits<{
  (e: "viewerSelection", value: ViewerSelection): void
  (e: "createFromSelection"): void
  (e: "applySelectionToSegment"): void
  (e: "editAnnotation"): void
  (e: "clearSelection"): void
  (e: "sequenceDraftInput", value: string): void
  (e: "applySequenceDraft"): void
  (e: "openRawEditor"): void
  (e: "blur"): void
}>()

function onSequenceDraftInput(event: Event) {
  emit("sequenceDraftInput", (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <span class="aimd-dna-field__section">
    <span class="aimd-dna-field__section-title">{{ props.messages.dna.viewer }}</span>

    <span v-if="props.sequenceLength <= 0" class="aimd-dna-field__empty">
      <span class="aimd-dna-field__selection-title">{{ props.messages.dna.viewerRequiresSequence }}</span>
      <label class="aimd-dna-field__annotation-field">
        <span>{{ props.messages.dna.onboardingPasteLabel }}</span>
        <textarea
          class="aimd-dna-field__sequence aimd-dna-field__sequence--onboarding"
          :disabled="props.disabled"
          :placeholder="props.placeholder || props.messages.dna.sequencePlaceholder"
          :value="props.interactiveSequenceDraft"
          spellcheck="false"
          @input="onSequenceDraftInput"
        />
      </label>
      <span class="aimd-dna-field__hint">
        {{ props.messages.dna.onboardingImportHint }}
      </span>
      <span
        v-if="props.importErrorMessage"
        class="aimd-dna-field__hint aimd-dna-field__hint--error"
      >
        {{ props.importErrorMessage }}
      </span>
      <span class="aimd-dna-field__empty-actions">
        <button
          type="button"
          class="aimd-dna-field__action"
          :disabled="props.disabled || !props.hasInteractiveSequenceDraft"
          @click="emit('applySequenceDraft')"
        >
          {{ props.messages.dna.onboardingApplySequence }}
        </button>
        <button
          type="button"
          class="aimd-dna-field__action"
          :disabled="props.disabled"
          @click="emit('openRawEditor')"
        >
          {{ props.messages.dna.rawMode }}
        </button>
      </span>
    </span>

    <template v-else>
      <span class="aimd-dna-field__viewer-shell">
        <AimdSeqVizViewer
          :name="props.name"
          :sequence="props.sequence"
          :topology="props.topology"
          :annotations="props.viewerAnnotations"
          :selection="props.viewerSelection"
          @selection="emit('viewerSelection', $event)"
        />
      </span>

      <span class="aimd-dna-field__hint">
        {{ props.messages.dna.viewerHint }}
      </span>

      <span
        class="aimd-dna-field__selection-card"
        :class="{ 'aimd-dna-field__selection-card--muted': props.selectionSegments.length === 0 }"
      >
        <span class="aimd-dna-field__selection-title">{{ props.messages.dna.selection }}</span>

        <template v-if="props.selectionSegments.length > 0">
          <span class="aimd-dna-field__selection-meta">{{ props.selectionRangeLabel }}</span>
          <span class="aimd-dna-field__selection-meta">{{ props.selectionTargetLabel }}</span>
          <span class="aimd-dna-field__selection-actions">
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('createFromSelection')"
            >
              {{ props.messages.dna.createFromSelection }}
            </button>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled || !props.hasActiveAnnotation"
              @click="emit('applySelectionToSegment')"
            >
              {{ props.messages.dna.applySelectionToSegment }}
            </button>
            <button
              v-if="props.isAnnotationSelection && props.hasActiveAnnotation"
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('editAnnotation')"
            >
              {{ props.messages.dna.editAnnotation }}
            </button>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('clearSelection')"
            >
              {{ props.messages.dna.selectionClear }}
            </button>
          </span>
        </template>

        <span v-else class="aimd-dna-field__selection-meta">
          {{ props.messages.dna.selectionEmpty }}
        </span>
      </span>
    </template>
  </span>
</template>
