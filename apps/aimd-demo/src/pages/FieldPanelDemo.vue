<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { AimdRecorder, createEmptyProtocolRecordData } from '@airalogy/aimd-recorder'
import '@airalogy/aimd-recorder/styles'
import { useDemoLocale } from '../composables/demoI18n'

const { locale } = useDemoLocale()
const zh = computed(() => locale.value === 'zh-CN')
const content = computed(() => [
  `{{var|label: str, title="${zh.value ? '样本编号' : 'Sample label'}"}}`,
  `{{var|location: str, title="${zh.value ? '位置' : 'Location'}"}}`,
  `{{var|photo: FileIdJPG | None = None, title="${zh.value ? '标签照片' : 'Label photo'}"}}`,
  `{{step|prepare, title="${zh.value ? '准备标签' : 'Prepare labels'}", check=True}}`,
  `{{check|review, title="${zh.value ? '核对编号' : 'Verify label'}"}}`,
].join('\n\n'))
const record = ref(createEmptyProtocolRecordData())
const protocol = ref<InstanceType<typeof AimdRecorder>>()
const files = new Map<string, { name: string; url: string }>()
function selectFile(file: File) {
  const id = `demo-${crypto.randomUUID()}`
  files.set(id, { name: file.name, url: URL.createObjectURL(file) })
  return id
}
const resolveFileInfo = (id: string) => files.get(id)
onBeforeUnmount(() => files.forEach(file => URL.revokeObjectURL(file.url)))
</script>

<template>
  <h2>{{ zh ? '记录字段面板' : 'Record field panel' }}</h2>
  <p>{{ zh ? '此示例中的照片仅在本页预览。' : 'Photos in this example are previewed locally.' }}</p>
  <div class="panel-demo">
    <AimdRecorder layout="field-panel" :content="content" v-model="record" :locale="locale" :upload-file="selectFile" :resolve-file-info="resolveFileInfo" @navigate-field="key => protocol?.focusField(key)" />
    <AimdRecorder ref="protocol" :content="content" v-model="record" :locale="locale" :show-search="false" :upload-file="selectFile" :resolve-file-info="resolveFileInfo" />
  </div>
</template>

<style scoped>
.panel-demo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 1rem; margin-top: 1rem; }
@media (max-width: 720px) { .panel-demo { grid-template-columns: minmax(0, 1fr); } }
</style>
