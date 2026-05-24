<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type { AimdRecorderMessages } from "../locales"
import type {
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
} from "../types"
import {
  calculateDnaSequenceGcPercent,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  createEmptyDnaSequenceQualifier,
  createEmptyDnaSequenceSegment,
  getNextDnaSequenceAnnotationId,
  normalizeDnaSequenceValue,
} from "../composables/useDnaSequence"
import {
  buildViewerAnnotationId,
  buildViewerAnnotations,
  createExternalSelectionFromSegment,
  createExternalSelectionFromSelection,
  createSegmentsFromSelection,
  detectImportedName,
  detectImportedTopology,
  downloadGenBankFile,
  formatSegment,
  normalizeImportedSequenceText,
  normalizeViewerSelection,
  parseViewerAnnotationId,
  stripFileExtension,
} from "../composables/useDnaSequenceField"
import type {
  DnaEditorMode,
  ViewerExternalSelection,
  ViewerSelection,
} from "../composables/useDnaSequenceField"

import DnaSequenceToolbar from "./DnaSequenceToolbar.vue"
import DnaSequenceViewer from "./DnaSequenceViewer.vue"
import DnaSequenceEditor from "./DnaSequenceEditor.vue"
import DnaAnnotationEditor from "./DnaAnnotationEditor.vue"

// ---- Props & Emits (public API — unchanged) ----

const props = withDefaults(defineProps<{
  modelValue?: unknown
  varId: string
  disabled?: boolean
  placeholder?: string
  messages: Pick<AimdRecorderMessages, "scope" | "dna">
}>(), {
  modelValue: undefined,
  disabled: false,
  placeholder: undefined,
})

const emit = defineEmits<{
  (e: "update:modelValue", value: AimdDnaSequenceValue): void
  (e: "blur"): void
}>()

// ---- Core reactive state ----

const value = computed(() => normalizeDnaSequenceValue(props.modelValue))
const sequenceLength = computed(() => value.value.sequence.length)
const gcPercent = computed(() => calculateDnaSequenceGcPercent(value.value.sequence))
const invalidCharacters = computed(() => collectInvalidDnaSequenceCharacters(value.value.sequence))

const editorMode = ref<DnaEditorMode>("interactive")
const activeAnnotationId = ref<string | null>(null)
const activeSegmentIndex = ref(0)
const selection = ref<ViewerSelection | null>(null)
const viewerSelection = ref<ViewerExternalSelection | null>(null)
const interactiveSequenceDraft = ref("")
const importFileInputRef = ref<HTMLInputElement | null>(null)
const importErrorMessage = ref<string | null>(null)
const annotationEditorRef = ref<InstanceType<typeof DnaAnnotationEditor> | null>(null)

const isInteractiveMode = computed(() => editorMode.value === "interactive")
const hasInteractiveSequenceDraft = computed(() => interactiveSequenceDraft.value.trim().length > 0)

const activeAnnotationIndex = computed(() =>
  value.value.annotations.findIndex(a => a.id === activeAnnotationId.value))

const activeAnnotation = computed(() =>
  activeAnnotationIndex.value >= 0 ? value.value.annotations[activeAnnotationIndex.value] : null)

const viewerAnnotations = computed(() =>
  buildViewerAnnotations(value.value.annotations, sequenceLength.value))

const selectionSegments = computed(() =>
  createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value))

const selectionRangeLabel = computed(() => {
  if (selectionSegments.value.length === 0) return ""
  return props.messages.dna.selectionRange(selectionSegments.value.map(formatSegment).join(", "))
})

const selectionTargetLabel = computed(() => {
  if (!selection.value) return ""
  if (selection.value.type === "ANNOTATION" && selection.value.name) {
    return props.messages.dna.selectionTarget(selection.value.name)
  }
  return props.messages.dna.selectionTarget(props.messages.dna.selectionModeSequence)
})

// ---- Value mutation helpers ----

function commit(nextValue: unknown) {
  emit("update:modelValue", normalizeDnaSequenceValue(nextValue))
}

function patchValue(patch: Partial<AimdDnaSequenceValue>) {
  commit({ ...value.value, ...patch })
}

function patchAnnotation(index: number, patch: Partial<AimdDnaSequenceAnnotation>) {
  const annotations = value.value.annotations.map((annotation, i) =>
    i === index ? { ...annotation, ...patch } : annotation)
  patchValue({ annotations })
}

function patchSegment(
  annotationIndex: number,
  segmentIndex: number,
  patch: Partial<AimdDnaSequenceSegment>,
) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return
  const segments = annotation.segments.map((s, i) =>
    i === segmentIndex ? { ...s, ...patch } : s)
  patchAnnotation(annotationIndex, { segments })
}

function patchQualifier(
  annotationIndex: number,
  qualifierIndex: number,
  patch: Partial<AimdDnaSequenceQualifier>,
) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return
  const qualifiers = annotation.qualifiers.map((q, i) =>
    i === qualifierIndex ? { ...q, ...patch } : q)
  patchAnnotation(annotationIndex, { qualifiers })
}

// ---- Selection helpers ----

function clearSelection() {
  selection.value = null
  viewerSelection.value = null
}

function selectAnnotation(annotationId: string, segmentIndex = 0) {
  const annotation = value.value.annotations.find(a => a.id === annotationId)
  const segment = annotation?.segments[segmentIndex]
  if (!annotation || !segment) return

  activeAnnotationId.value = annotationId
  activeSegmentIndex.value = segmentIndex
  selection.value = {
    type: "ANNOTATION",
    id: buildViewerAnnotationId(annotationId, segmentIndex),
    name: annotation.name,
    start: Math.max(segment.start - 1, 0),
    end: segment.end,
    length: Math.max(segment.end - segment.start + 1, 0),
    direction: annotation.strand,
    viewer: value.value.topology === "circular" ? "CIRCULAR" : "LINEAR",
  }
  viewerSelection.value = createExternalSelectionFromSegment(segment)
}

// ---- Editor mode helpers ----

function openRawEditor() {
  editorMode.value = "raw"
}

function openInteractiveEditor() {
  editorMode.value = "interactive"
}

// ---- Annotation CRUD ----

function createAnnotationFromSelection() {
  const segments = createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value)
  if (segments.length === 0) return

  const nextId = getNextDnaSequenceAnnotationId(value.value.annotations)
  const annotation = createEmptyDnaSequenceAnnotation(nextId)
  annotation.strand = selection.value?.direction === -1 ? -1 : 1
  annotation.segments = segments

  patchValue({ annotations: [...value.value.annotations, annotation] })
  activeAnnotationId.value = annotation.id
  activeSegmentIndex.value = 0
}

function addAnnotation() {
  if (isInteractiveMode.value && selectionSegments.value.length > 0) {
    createAnnotationFromSelection()
    return
  }

  const nextId = getNextDnaSequenceAnnotationId(value.value.annotations)
  const annotation = createEmptyDnaSequenceAnnotation(nextId)

  if (sequenceLength.value > 0) {
    annotation.segments = [{
      start: 1,
      end: Math.min(sequenceLength.value, 1),
      partial_start: false,
      partial_end: false,
    }]
  }

  patchValue({ annotations: [...value.value.annotations, annotation] })
  activeAnnotationId.value = annotation.id
  activeSegmentIndex.value = 0
}

function removeAnnotation(index: number) {
  const removed = value.value.annotations[index]
  patchValue({
    annotations: value.value.annotations.filter((_, i) => i !== index),
  })

  if (removed && activeAnnotationId.value === removed.id) {
    activeAnnotationId.value = null
    activeSegmentIndex.value = 0
    selection.value = null
    viewerSelection.value = null
  }
}

function addSegment(annotationIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return
  patchAnnotation(annotationIndex, {
    segments: [...annotation.segments, createEmptyDnaSequenceSegment()],
  })
}

function removeSegment(annotationIndex: number, segmentIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  const nextSegments = annotation.segments.length <= 1
    ? [createEmptyDnaSequenceSegment()]
    : annotation.segments.filter((_, i) => i !== segmentIndex)

  patchAnnotation(annotationIndex, { segments: nextSegments })

  if (annotation.id === activeAnnotationId.value) {
    activeSegmentIndex.value = Math.min(activeSegmentIndex.value, nextSegments.length - 1)
  }
}

function addQualifier(annotationIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return
  patchAnnotation(annotationIndex, {
    qualifiers: [
      ...annotation.qualifiers,
      createEmptyDnaSequenceQualifier(annotation.qualifiers.length === 0 ? "note" : "qualifier"),
    ],
  })
}

function removeQualifier(annotationIndex: number, qualifierIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return
  patchAnnotation(annotationIndex, {
    qualifiers: annotation.qualifiers.filter((_, i) => i !== qualifierIndex),
  })
}

function applySelectionToActiveSegment() {
  const annotationIndex = value.value.annotations.findIndex(a => a.id === activeAnnotationId.value)
  if (annotationIndex < 0) return

  const annotation = value.value.annotations[annotationIndex]
  const segments = createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value)
  if (!annotation || segments.length === 0) return

  const currentIndex = Math.min(activeSegmentIndex.value, annotation.segments.length - 1)
  const nextSegments = annotation.segments.flatMap((s, i) =>
    i === currentIndex ? segments : [s])

  patchAnnotation(annotationIndex, { segments: nextSegments })
  activeSegmentIndex.value = currentIndex
}

function focusAnnotationInInteractive(annotationId: string, segmentIndex = 0) {
  selectAnnotation(annotationId, segmentIndex)
  openInteractiveEditor()
}

function handleAnnotationPrimaryAction(annotationId: string) {
  if (editorMode.value === "interactive") {
    focusAnnotationInInteractive(annotationId)
    return
  }
  selectAnnotation(annotationId)
}

// ---- Viewer selection handler ----

function onViewerSelection(nextSelection: ViewerSelection) {
  const normalized = normalizeViewerSelection(nextSelection)
  selection.value = normalized
  viewerSelection.value = createExternalSelectionFromSelection(normalized)

  const parsedId = parseViewerAnnotationId(normalized?.id)
  if (parsedId) {
    activeAnnotationId.value = parsedId.annotationId
    activeSegmentIndex.value = parsedId.segmentIndex
  }
}

// ---- Import / export ----

function confirmImportReplacement(): boolean {
  if (sequenceLength.value <= 0 && value.value.annotations.length === 0) return true
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true
  return window.confirm(props.messages.dna.importReplaceConfirm)
}

function applyImportedSequenceText(rawText: string, fallbackName = ""): boolean {
  const nextSequence = normalizeImportedSequenceText(rawText)
  if (!nextSequence) {
    importErrorMessage.value = props.messages.dna.onboardingNoSequenceDetected
    return false
  }

  const invalid = collectInvalidDnaSequenceCharacters(nextSequence)
  if (invalid.length > 0) {
    importErrorMessage.value = props.messages.dna.invalidCharacters(invalid.join(", "))
    return false
  }

  if (!confirmImportReplacement()) return false

  const nextName = detectImportedName(rawText, fallbackName) || value.value.name
  commit({
    ...value.value,
    name: nextName,
    sequence: nextSequence,
    topology: detectImportedTopology(rawText) ?? value.value.topology,
    annotations: [],
  })
  interactiveSequenceDraft.value = ""
  importErrorMessage.value = null
  activeAnnotationId.value = null
  activeSegmentIndex.value = 0
  clearSelection()
  return true
}

function openImportPicker() {
  importFileInputRef.value?.click()
}

async function onImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return

  try {
    const text = await file.text()
    applyImportedSequenceText(text, stripFileExtension(file.name))
  } catch {
    importErrorMessage.value = props.messages.dna.onboardingImportReadError
  }
}

function downloadGenBank() {
  downloadGenBankFile(value.value, props.varId)
}

// ---- Toolbar event handlers ----

function onEditorModeChange(mode: DnaEditorMode) {
  editorMode.value = mode
}

function onTopologyChange(topology: "linear" | "circular") {
  patchValue({ topology })
}

// ---- Viewer event handlers ----

function onSequenceDraftInput(draft: string) {
  interactiveSequenceDraft.value = draft
  importErrorMessage.value = null
}

function applyInteractiveSequenceDraft() {
  applyImportedSequenceText(interactiveSequenceDraft.value)
}

async function focusActiveAnnotationEditor() {
  if (!activeAnnotation.value) return
  await nextTick()
  annotationEditorRef.value?.focusNameInput()
}

// ---- Raw editor handler ----

function onSequenceUpdate(seq: string) {
  patchValue({ sequence: seq })
}

// ---- Watchers ----

watch(() => value.value.annotations, annotations => {
  if (annotations.length === 0) {
    activeAnnotationId.value = null
    activeSegmentIndex.value = 0
    return
  }

  const found = annotations.find(a => a.id === activeAnnotationId.value)
  if (!found) {
    activeAnnotationId.value = annotations[0].id
    activeSegmentIndex.value = 0
    return
  }

  activeSegmentIndex.value = Math.min(activeSegmentIndex.value, found.segments.length - 1)
}, { deep: true, immediate: true })

watch(() => value.value.sequence, seq => {
  if (seq.length > 0) {
    interactiveSequenceDraft.value = ""
    importErrorMessage.value = null
  }
})
</script>

<template>
  <span class="aimd-rec-inline aimd-rec-inline--var-dna aimd-field-wrapper aimd-field-wrapper--dna">
    <span class="aimd-field aimd-field--no-style aimd-field__label">
      <span class="aimd-field__scope aimd-field__scope--var">{{ props.messages.scope.var }}</span>
      <span class="aimd-field__id">{{ props.varId }}</span>
    </span>

    <span class="aimd-dna-field">
      <DnaSequenceToolbar
        :editor-mode="editorMode"
        :topology="value.topology"
        :sequence-length="sequenceLength"
        :gc-percent="gcPercent"
        :disabled="props.disabled"
        :import-error-message="importErrorMessage"
        :is-interactive-mode="isInteractiveMode"
        :messages="props.messages"
        @update:editor-mode="onEditorModeChange"
        @update:topology="onTopologyChange"
        @import-file="openImportPicker"
        @export-gen-bank="downloadGenBank"
        @blur="emit('blur')"
      />

      <input
        ref="importFileInputRef"
        class="aimd-dna-field__hidden-file"
        type="file"
        accept=".txt,.seq,.fa,.fna,.fasta,.gb,.gbk,text/plain"
        @change="onImportChange"
      >

      <span class="aimd-dna-field__metadata-grid">
        <label class="aimd-dna-field__annotation-field aimd-dna-field__annotation-field--metadata">
          <span>{{ props.messages.dna.sequenceName }}</span>
          <input
            class="aimd-dna-field__input"
            :disabled="props.disabled"
            :placeholder="props.messages.dna.sequenceNamePlaceholder"
            :value="value.name"
            @input="patchValue({ name: ($event.target as HTMLInputElement).value })"
            @blur="emit('blur')"
          />
        </label>
      </span>

      <DnaSequenceViewer
        v-if="isInteractiveMode"
        :name="value.name || props.varId"
        :sequence="value.sequence"
        :topology="value.topology"
        :sequence-length="sequenceLength"
        :viewer-annotations="viewerAnnotations"
        :viewer-selection="viewerSelection"
        :selection-segments="selectionSegments"
        :selection-range-label="selectionRangeLabel"
        :selection-target-label="selectionTargetLabel"
        :has-active-annotation="!!activeAnnotation"
        :is-annotation-selection="selection?.type === 'ANNOTATION'"
        :interactive-sequence-draft="interactiveSequenceDraft"
        :has-interactive-sequence-draft="hasInteractiveSequenceDraft"
        :import-error-message="importErrorMessage"
        :disabled="props.disabled"
        :placeholder="props.placeholder"
        :messages="props.messages"
        @viewer-selection="onViewerSelection"
        @create-from-selection="createAnnotationFromSelection"
        @apply-selection-to-segment="applySelectionToActiveSegment"
        @edit-annotation="focusActiveAnnotationEditor"
        @clear-selection="clearSelection"
        @sequence-draft-input="onSequenceDraftInput"
        @apply-sequence-draft="applyInteractiveSequenceDraft"
        @open-raw-editor="openRawEditor"
        @blur="emit('blur')"
      />

      <DnaSequenceEditor
        v-else
        :sequence="value.sequence"
        :invalid-characters="invalidCharacters"
        :disabled="props.disabled"
        :placeholder="props.placeholder"
        :messages="props.messages"
        @update:sequence="onSequenceUpdate"
        @blur="emit('blur')"
      />

      <DnaAnnotationEditor
        ref="annotationEditorRef"
        :annotations="value.annotations"
        :active-annotation-id="activeAnnotationId"
        :active-annotation-index="activeAnnotationIndex"
        :active-annotation="activeAnnotation"
        :active-segment-index="activeSegmentIndex"
        :sequence-length="sequenceLength"
        :is-interactive-mode="isInteractiveMode"
        :selection-has-segments="selectionSegments.length > 0"
        :disabled="props.disabled"
        :messages="props.messages"
        @add-annotation="addAnnotation"
        @remove-annotation="removeAnnotation"
        @patch-annotation="patchAnnotation"
        @patch-segment="patchSegment"
        @patch-qualifier="patchQualifier"
        @add-segment="addSegment"
        @remove-segment="removeSegment"
        @add-qualifier="addQualifier"
        @remove-qualifier="removeQualifier"
        @handle-annotation-primary-action="handleAnnotationPrimaryAction"
        @focus-annotation-in-interactive="focusAnnotationInInteractive"
        @open-raw-editor="openRawEditor"
        @blur="emit('blur')"
      />
    </span>
  </span>
</template>

<style>
.aimd-rec-inline--var-dna {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  width: min(100%, 920px);
  min-width: min(100%, 340px);
  margin: 8px 4px;
  vertical-align: top;
  border: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.aimd-rec-inline--var-dna:focus-within {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.14);
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label {
  align-self: stretch;
  width: calc(100% + 2px);
  border: none;
  border-bottom: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 10px 10px 0 0;
  min-height: 30px;
  background: var(--aimd-var-bg, #e3f2fd);
  margin: -1px -1px 0 -1px;
  box-sizing: border-box;
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label .aimd-field__scope {
  align-self: center;
  height: 22px;
  margin-left: 3px;
  padding: 0 7px;
  border-radius: 6px;
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label .aimd-field__id {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding: 0 10px 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--aimd-var-text, #1565c0);
  white-space: nowrap;
}

.aimd-dna-field {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  gap: 14px;
  padding: 12px;
  background: #fff;
}

.aimd-dna-field__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.aimd-dna-field__hint--toolbar {
  margin-top: -4px;
}

.aimd-dna-field__metadata-grid {
  display: grid;
  grid-template-columns: minmax(220px, 420px);
}

.aimd-dna-field__toolbar-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.aimd-dna-field__toolbar-spacer {
  flex: 1 1 auto;
}

.aimd-dna-field__toolbar-item--mode {
  margin-right: 8px;
}

.aimd-dna-field__toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: #3b5b86;
}

.aimd-dna-field__mode-switch {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: #edf4ff;
  border: 1px solid #cdddf6;
}

.aimd-dna-field__mode-button {
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #476788;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.aimd-dna-field__mode-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.aimd-dna-field__mode-button--active {
  background: #fff;
  color: #245eb0;
  box-shadow: 0 1px 2px rgba(37, 94, 176, 0.18);
}

.aimd-dna-field__stat,
.aimd-dna-field__meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #edf4ff;
  color: #35517c;
  font-size: 12px;
  font-weight: 600;
}

.aimd-dna-field__section,
.aimd-dna-field__subsection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aimd-dna-field__section-header,
.aimd-dna-field__subsection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.aimd-dna-field__section-title {
  font-size: 13px;
  font-weight: 700;
  color: #25466c;
}

.aimd-dna-field__section-meta,
.aimd-dna-field__subsection-title {
  font-size: 12px;
  font-weight: 700;
  color: #41618b;
}

.aimd-dna-field__sequence {
  min-height: 124px;
  padding: 10px 12px;
  border: 1px solid #c8d7eb;
  border-radius: 8px;
  background: #fdfefe;
  color: #19324d;
  font: 600 13px/1.6 "SFMono-Regular", Menlo, Consolas, monospace;
  resize: vertical;
}

.aimd-dna-field__sequence--onboarding {
  min-height: 96px;
}

.aimd-dna-field__viewer-shell {
  overflow: hidden;
  border: 1px solid #d7e4f4;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(180deg, #fcfdff 0%, #f5f9ff 100%);
}

.aimd-dna-field__selection-card,
.aimd-dna-field__annotation-card,
.aimd-dna-field__row-card,
.aimd-dna-field__empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #d7e4f4;
  background: #fbfdff;
}

.aimd-dna-field__selection-card--muted {
  background: #fcfdff;
}

.aimd-dna-field__selection-title {
  font-size: 12px;
  font-weight: 700;
  color: #35517c;
}

.aimd-dna-field__selection-meta,
.aimd-dna-field__advanced-copy,
.aimd-dna-field__hint {
  font-size: 12px;
  color: #4c6b8c;
}

.aimd-dna-field__selection-actions,
.aimd-dna-field__annotation-actions,
.aimd-dna-field__row-actions,
.aimd-dna-field__empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.aimd-dna-field__annotation-list {
  display: grid;
  gap: 10px;
}

.aimd-dna-field__annotation-card {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.aimd-dna-field__annotation-card--active,
.aimd-dna-field__row-card--active {
  border-color: #97bbff;
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.08);
}

.aimd-dna-field__annotation-card-main {
  display: flex;
  min-width: 0;
  gap: 10px;
}

.aimd-dna-field__annotation-swatch {
  width: 10px;
  min-width: 10px;
  align-self: stretch;
  border-radius: 999px;
}

.aimd-dna-field__annotation-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.aimd-dna-field__annotation-name {
  font-size: 13px;
  font-weight: 700;
  color: #1f3d63;
}

.aimd-dna-field__annotation-meta {
  font-size: 12px;
  color: #5e7897;
}

.aimd-dna-field__annotation-grid,
.aimd-dna-field__segment-grid,
.aimd-dna-field__qualifier-grid {
  display: grid;
  gap: 10px;
}

.aimd-dna-field__annotation-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.aimd-dna-field__segment-grid {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.aimd-dna-field__qualifier-grid {
  grid-template-columns: minmax(140px, 220px) minmax(180px, 1fr);
}

.aimd-dna-field__annotation-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #486683;
  font-weight: 600;
}

.aimd-dna-field__annotation-field--wide {
  min-width: 0;
}

.aimd-dna-field__annotation-field--metadata {
  min-width: 0;
}

.aimd-dna-field__input,
.aimd-dna-field__select {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #c8d7eb;
  border-radius: 8px;
  background: #fff;
  color: #1e3854;
  font-size: 13px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.aimd-dna-field__input--color {
  padding: 4px;
}

.aimd-dna-field__sequence:focus,
.aimd-dna-field__input:focus,
.aimd-dna-field__select:focus {
  outline: none;
  border-color: #5d92f8;
  box-shadow: 0 0 0 2px rgba(93, 146, 248, 0.14);
}

.aimd-dna-field__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #eef5ff;
  color: #35517c;
  font-size: 12px;
  font-weight: 600;
}

.aimd-dna-field__toggle input {
  margin: 0;
}

.aimd-dna-field__hint--error {
  color: #c0392b;
}

.aimd-dna-field__hidden-file {
  display: none;
}

.aimd-dna-field__meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.aimd-dna-field__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #b6cdf5;
  border-radius: 999px;
  background: #edf4ff;
  color: #2b61b7;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.aimd-dna-field__action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.aimd-dna-field__action--danger {
  border-color: #efc4c4;
  background: #fff5f5;
  color: #c0392b;
}

.aimd-dna-field__action--toolbar {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .aimd-rec-inline--var-dna {
    min-width: 100%;
    width: 100%;
  }

  .aimd-dna-field__toolbar {
    align-items: flex-start;
  }

  .aimd-dna-field__annotation-card {
    flex-direction: column;
  }

  .aimd-dna-field__qualifier-grid {
    grid-template-columns: 1fr;
  }
}
</style>
