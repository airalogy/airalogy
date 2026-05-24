<script setup lang="ts">
import { computed } from 'vue'
import AimdRecorder from './AimdRecorder.vue'
import type { RecorderMilkdownSurfaceState } from './recorderMilkdownPlugin'

const props = defineProps<{
  surfaceState: RecorderMilkdownSurfaceState
  rawContent: string
  displayMode: 'inline' | 'block'
}>()

const renderedContent = computed(() => (
  props.displayMode === 'inline'
    ? `<span class="aimd-recorder-wysiwyg-field-host__anchor" aria-hidden="true"></span>${props.rawContent}`
    : props.rawContent
))
</script>

<template>
  <div
    class="aimd-recorder-wysiwyg-field-host"
    :class="`aimd-recorder-wysiwyg-field-host--${displayMode}`"
  >
    <AimdRecorder
      :content="renderedContent"
      :model-value="surfaceState.record"
      :readonly="surfaceState.readonly"
      :current-user-name="surfaceState.currentUserName"
      :now="surfaceState.now"
      :locale="surfaceState.locale"
      :messages="surfaceState.messages"
      :step-detail-display="surfaceState.stepDetailDisplay"
      :field-meta="surfaceState.fieldMeta"
      :field-state="surfaceState.fieldState"
      :wrap-field="surfaceState.wrapField"
      :custom-renderers="surfaceState.customRenderers"
      :field-adapters="surfaceState.fieldAdapters"
      :resolve-file="surfaceState.resolveFile"
      :type-plugins="surfaceState.typePlugins"
      @update:model-value="surfaceState.onUpdateRecord"
      @fields-change="surfaceState.onFieldsChange?.($event)"
      @error="surfaceState.onError?.($event)"
      @field-change="surfaceState.onFieldChange?.($event)"
      @field-blur="surfaceState.onFieldBlur?.($event)"
      @assigner-request="surfaceState.onAssignerRequest?.($event)"
      @assigner-cancel="surfaceState.onAssignerCancel?.($event)"
      @table-add-row="surfaceState.onTableAddRow?.($event)"
      @table-remove-row="surfaceState.onTableRemoveRow?.($event)"
    />
  </div>
</template>

<style scoped>
.aimd-recorder-wysiwyg-field-host {
  min-width: 0;
}

.aimd-recorder-wysiwyg-field-host--inline {
  display: inline-flex;
  align-items: stretch;
  max-width: min(100%, 760px);
  vertical-align: middle;
}

.aimd-recorder-wysiwyg-field-host--block {
  display: block;
  width: 100%;
}

.aimd-recorder-wysiwyg-field-host :deep(.aimd-protocol-recorder__timing) {
  display: none;
}

.aimd-recorder-wysiwyg-field-host :deep(.aimd-protocol-recorder__content) {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.aimd-recorder-wysiwyg-field-host :deep(.aimd-protocol-recorder__empty) {
  display: none;
}

.aimd-recorder-wysiwyg-field-host :deep(.aimd-recorder-wysiwyg-field-host__anchor) {
  display: none;
}

.aimd-recorder-wysiwyg-field-host--inline :deep(.aimd-protocol-recorder) {
  width: auto;
}
</style>
