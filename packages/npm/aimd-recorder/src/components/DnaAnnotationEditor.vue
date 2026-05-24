<script setup lang="ts">
import { computed, ref } from "vue"
import type { AimdRecorderMessages } from "../locales"
import type {
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceSegment,
  AimdDnaSequenceQualifier,
} from "../types"
import {
  annotationSegmentsLabel,
} from "../composables/useDnaSequenceField"
import {
  getDnaSequenceSegmentIssue,
} from "../composables/useDnaSequence"

const props = defineProps<{
  annotations: AimdDnaSequenceAnnotation[]
  activeAnnotationId: string | null
  activeAnnotationIndex: number
  activeAnnotation: AimdDnaSequenceAnnotation | null
  activeSegmentIndex: number
  sequenceLength: number
  isInteractiveMode: boolean
  selectionHasSegments: boolean
  disabled: boolean
  messages: Pick<AimdRecorderMessages, "dna">
}>()

const emit = defineEmits<{
  (e: "addAnnotation"): void
  (e: "removeAnnotation", index: number): void
  (e: "patchAnnotation", index: number, patch: Partial<AimdDnaSequenceAnnotation>): void
  (e: "patchSegment", annotationIndex: number, segmentIndex: number, patch: Partial<AimdDnaSequenceSegment>): void
  (e: "patchQualifier", annotationIndex: number, qualifierIndex: number, patch: Partial<AimdDnaSequenceQualifier>): void
  (e: "addSegment", annotationIndex: number): void
  (e: "removeSegment", annotationIndex: number, segmentIndex: number): void
  (e: "addQualifier", annotationIndex: number): void
  (e: "removeQualifier", annotationIndex: number, qualifierIndex: number): void
  (e: "handleAnnotationPrimaryAction", annotationId: string): void
  (e: "focusAnnotationInInteractive", annotationId: string, segmentIndex: number): void
  (e: "openRawEditor"): void
  (e: "blur"): void
}>()

const interactiveNameInputRef = ref<HTMLInputElement | null>(null)

defineExpose({
  focusNameInput() {
    interactiveNameInputRef.value?.scrollIntoView({ block: "nearest" })
    interactiveNameInputRef.value?.focus()
    interactiveNameInputRef.value?.select()
  },
})

const annotationPrimaryActionLabel = computed(() =>
  props.isInteractiveMode
    ? props.messages.dna.focusAnnotation
    : props.messages.dna.editAnnotation)

function onSegmentIntInput(
  annotationIndex: number,
  segmentIndex: number,
  key: "start" | "end",
  event: Event,
) {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    emit("patchSegment", annotationIndex, segmentIndex, { [key]: parsed } as Partial<AimdDnaSequenceSegment>)
  }
}

function segmentIssueLabel(segment: AimdDnaSequenceSegment): string | null {
  const issue = getDnaSequenceSegmentIssue(segment, props.sequenceLength)
  if (issue === "requires_sequence") {
    return props.messages.dna.segmentRequiresSequence
  }
  if (issue === "range") {
    return props.messages.dna.segmentRangeError
  }
  if (issue === "out_of_bounds") {
    return props.messages.dna.segmentOutOfBounds(segment.end, props.sequenceLength)
  }
  return null
}
</script>

<template>
  <!-- Interactive mode: annotation details for the active annotation -->
  <template v-if="props.isInteractiveMode && props.sequenceLength > 0">
    <span class="aimd-dna-field__section">
      <span class="aimd-dna-field__section-header">
        <span class="aimd-dna-field__section-title">{{ props.messages.dna.interactiveDetails }}</span>
        <span v-if="props.activeAnnotation" class="aimd-dna-field__section-meta">
          {{ props.messages.dna.selectedAnnotation(props.activeAnnotation.name) }}
        </span>
        <button
          type="button"
          class="aimd-dna-field__action"
          :disabled="props.disabled"
          @click="emit('openRawEditor')"
        >
          {{ props.messages.dna.rawMode }}
        </button>
      </span>

      <span class="aimd-dna-field__hint">
        {{ props.messages.dna.interactiveDetailsHint }}
      </span>

      <span v-if="!props.activeAnnotation" class="aimd-dna-field__empty">
        {{ props.messages.dna.interactiveDetailsEmpty }}
      </span>

      <template v-else>
        <span class="aimd-dna-field__annotation-grid">
          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.annotationName }}</span>
            <input
              ref="interactiveNameInputRef"
              class="aimd-dna-field__input"
              :disabled="props.disabled"
              :value="props.activeAnnotation.name"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { name: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.annotationType }}</span>
            <input
              class="aimd-dna-field__input"
              :disabled="props.disabled"
              :value="props.activeAnnotation.type"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { type: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.strand }}</span>
            <select
              class="aimd-dna-field__select"
              :disabled="props.disabled"
              :value="props.activeAnnotation.strand"
              @change="emit('patchAnnotation', props.activeAnnotationIndex, { strand: ($event.target as HTMLSelectElement).value === '-1' ? -1 : 1 })"
              @blur="emit('blur')"
            >
              <option :value="1">{{ props.messages.dna.forward }}</option>
              <option :value="-1">{{ props.messages.dna.reverse }}</option>
            </select>
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.color }}</span>
            <input
              class="aimd-dna-field__input aimd-dna-field__input--color"
              type="color"
              :disabled="props.disabled"
              :value="props.activeAnnotation.color || '#2563eb'"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { color: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>
        </span>

        <span class="aimd-dna-field__meta-pills">
          <span class="aimd-dna-field__meta-pill">
            {{ props.messages.dna.segments }}: {{ annotationSegmentsLabel(props.activeAnnotation) }}
          </span>
          <span class="aimd-dna-field__meta-pill">
            {{ props.messages.dna.qualifiers }}: {{ props.activeAnnotation.qualifiers.length }}
          </span>
        </span>

        <span class="aimd-dna-field__row-actions">
          <button
            type="button"
            class="aimd-dna-field__action aimd-dna-field__action--danger"
            :disabled="props.disabled"
            @click="emit('removeAnnotation', props.activeAnnotationIndex)"
          >
            {{ props.messages.dna.removeAnnotation }}
          </button>
        </span>
      </template>
    </span>
  </template>

  <!-- Raw mode: annotation list + advanced editor -->
  <template v-else>
    <span class="aimd-dna-field__section">
      <span class="aimd-dna-field__section-header">
        <span class="aimd-dna-field__section-title">{{ props.messages.dna.annotations }}</span>
        <button
          type="button"
          class="aimd-dna-field__action"
          :disabled="props.disabled"
          @click="emit('addAnnotation')"
        >
          {{ props.messages.dna.addAnnotation }}
        </button>
      </span>

      <span v-if="props.annotations.length === 0" class="aimd-dna-field__empty">
        {{ props.messages.dna.noAnnotations }}
      </span>

      <span v-else class="aimd-dna-field__annotation-list">
        <span
          v-for="(annotation, annotationIndex) in props.annotations"
          :key="annotation.id"
          class="aimd-dna-field__annotation-card"
          :class="{ 'aimd-dna-field__annotation-card--active': annotation.id === props.activeAnnotationId }"
        >
          <span class="aimd-dna-field__annotation-card-main">
            <span
              class="aimd-dna-field__annotation-swatch"
              :style="{ backgroundColor: annotation.color || '#2563eb' }"
            />
            <span class="aimd-dna-field__annotation-copy">
              <span class="aimd-dna-field__annotation-name">{{ annotation.name }}</span>
              <span class="aimd-dna-field__annotation-meta">{{ annotation.type }}</span>
              <span class="aimd-dna-field__annotation-meta">
                {{ props.messages.dna.segments }}: {{ annotationSegmentsLabel(annotation) }}
              </span>
            </span>
          </span>

          <span class="aimd-dna-field__annotation-actions">
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('handleAnnotationPrimaryAction', annotation.id)"
            >
              {{ annotationPrimaryActionLabel }}
            </button>
            <button
              type="button"
              class="aimd-dna-field__action aimd-dna-field__action--danger"
              :disabled="props.disabled"
              @click="emit('removeAnnotation', annotationIndex)"
            >
              {{ props.messages.dna.removeAnnotation }}
            </button>
          </span>
        </span>
      </span>
    </span>

    <span class="aimd-dna-field__section">
      <span class="aimd-dna-field__section-header">
        <span class="aimd-dna-field__section-title">{{ props.messages.dna.advancedEditor }}</span>
        <span v-if="props.activeAnnotation" class="aimd-dna-field__section-meta">
          {{ props.messages.dna.selectedAnnotation(props.activeAnnotation.name) }}
        </span>
      </span>

      <span class="aimd-dna-field__advanced-copy">
        {{ props.messages.dna.advancedEditorHint }}
      </span>

      <span v-if="!props.activeAnnotation" class="aimd-dna-field__empty">
        {{ props.messages.dna.advancedEditorEmpty }}
      </span>

      <template v-else>
        <span class="aimd-dna-field__annotation-grid">
          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.annotationName }}</span>
            <input
              class="aimd-dna-field__input"
              :disabled="props.disabled"
              :value="props.activeAnnotation.name"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { name: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.annotationType }}</span>
            <input
              class="aimd-dna-field__input"
              :disabled="props.disabled"
              :value="props.activeAnnotation.type"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { type: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.strand }}</span>
            <select
              class="aimd-dna-field__select"
              :disabled="props.disabled"
              :value="props.activeAnnotation.strand"
              @change="emit('patchAnnotation', props.activeAnnotationIndex, { strand: ($event.target as HTMLSelectElement).value === '-1' ? -1 : 1 })"
              @blur="emit('blur')"
            >
              <option :value="1">{{ props.messages.dna.forward }}</option>
              <option :value="-1">{{ props.messages.dna.reverse }}</option>
            </select>
          </label>

          <label class="aimd-dna-field__annotation-field">
            <span>{{ props.messages.dna.color }}</span>
            <input
              class="aimd-dna-field__input aimd-dna-field__input--color"
              type="color"
              :disabled="props.disabled"
              :value="props.activeAnnotation.color || '#2563eb'"
              @input="emit('patchAnnotation', props.activeAnnotationIndex, { color: ($event.target as HTMLInputElement).value })"
              @blur="emit('blur')"
            />
          </label>
        </span>

        <span class="aimd-dna-field__subsection">
          <span class="aimd-dna-field__subsection-header">
            <span class="aimd-dna-field__subsection-title">{{ props.messages.dna.segments }}</span>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('addSegment', props.activeAnnotationIndex)"
            >
              {{ props.messages.dna.addSegment }}
            </button>
          </span>

          <span
            v-for="(segment, segmentIndex) in props.activeAnnotation.segments"
            :key="`${props.activeAnnotation.id}-segment-${segmentIndex}`"
            class="aimd-dna-field__row-card"
            :class="{ 'aimd-dna-field__row-card--active': segmentIndex === props.activeSegmentIndex }"
          >
            <span class="aimd-dna-field__segment-grid">
              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.start }}</span>
                <input
                  class="aimd-dna-field__input"
                  type="number"
                  min="1"
                  :disabled="props.disabled"
                  :value="segment.start"
                  @input="onSegmentIntInput(props.activeAnnotationIndex, segmentIndex, 'start', $event)"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.end }}</span>
                <input
                  class="aimd-dna-field__input"
                  type="number"
                  min="1"
                  :disabled="props.disabled"
                  :value="segment.end"
                  @input="onSegmentIntInput(props.activeAnnotationIndex, segmentIndex, 'end', $event)"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__toggle">
                <input
                  type="checkbox"
                  :checked="!!segment.partial_start"
                  :disabled="props.disabled"
                  @change="emit('patchSegment', props.activeAnnotationIndex, segmentIndex, { partial_start: ($event.target as HTMLInputElement).checked })"
                  @blur="emit('blur')"
                />
                <span>{{ props.messages.dna.partialStart }}</span>
              </label>

              <label class="aimd-dna-field__toggle">
                <input
                  type="checkbox"
                  :checked="!!segment.partial_end"
                  :disabled="props.disabled"
                  @change="emit('patchSegment', props.activeAnnotationIndex, segmentIndex, { partial_end: ($event.target as HTMLInputElement).checked })"
                  @blur="emit('blur')"
                />
                <span>{{ props.messages.dna.partialEnd }}</span>
              </label>
            </span>

            <span
              v-if="segmentIssueLabel(segment)"
              class="aimd-dna-field__hint aimd-dna-field__hint--error"
            >
              {{ segmentIssueLabel(segment) }}
            </span>

            <span class="aimd-dna-field__row-actions">
              <button
                type="button"
                class="aimd-dna-field__action"
                :disabled="props.disabled"
                @click="emit('focusAnnotationInInteractive', props.activeAnnotation!.id, segmentIndex)"
              >
                {{ props.messages.dna.focusAnnotation }}
              </button>
              <button
                type="button"
                class="aimd-dna-field__action aimd-dna-field__action--danger"
                :disabled="props.disabled"
                @click="emit('removeSegment', props.activeAnnotationIndex, segmentIndex)"
              >
                {{ props.messages.dna.removeSegment }}
              </button>
            </span>
          </span>
        </span>

        <span class="aimd-dna-field__subsection">
          <span class="aimd-dna-field__subsection-header">
            <span class="aimd-dna-field__subsection-title">{{ props.messages.dna.qualifiers }}</span>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="emit('addQualifier', props.activeAnnotationIndex)"
            >
              {{ props.messages.dna.addQualifier }}
            </button>
          </span>

          <span v-if="props.activeAnnotation.qualifiers.length === 0" class="aimd-dna-field__empty">
            {{ props.messages.dna.noQualifiers }}
          </span>

          <span
            v-for="(qualifier, qualifierIndex) in props.activeAnnotation.qualifiers"
            :key="`${props.activeAnnotation.id}-qualifier-${qualifierIndex}`"
            class="aimd-dna-field__row-card"
          >
            <span class="aimd-dna-field__qualifier-grid">
              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.qualifierKey }}</span>
                <input
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="qualifier.key"
                  @input="emit('patchQualifier', props.activeAnnotationIndex, qualifierIndex, { key: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field aimd-dna-field__annotation-field--wide">
                <span>{{ props.messages.dna.qualifierValue }}</span>
                <input
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="qualifier.value"
                  @input="emit('patchQualifier', props.activeAnnotationIndex, qualifierIndex, { value: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>
            </span>

            <span class="aimd-dna-field__row-actions">
              <button
                type="button"
                class="aimd-dna-field__action aimd-dna-field__action--danger"
                :disabled="props.disabled"
                @click="emit('removeQualifier', props.activeAnnotationIndex, qualifierIndex)"
              >
                {{ props.messages.dna.removeQualifier }}
              </button>
            </span>
          </span>
        </span>
      </template>
    </span>
  </template>
</template>
