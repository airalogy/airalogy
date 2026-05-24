/**
 * AIMD Editor Components
 *
 * Placeholder for component exports
 * Components will be migrated from apps/web/src/components/custom/aimd
 */

import { defineAsyncComponent } from "vue"
import AimdRecorder from "./AimdRecorder.vue"
import AimdRecorderEditor from "./AimdRecorderEditor.vue"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"

const AimdDnaSequenceField = defineAsyncComponent(() => import("./AimdDnaSequenceField.vue"))
const AimdMarkdownField = defineAsyncComponent(() => import("./AimdMarkdownField.vue"))

export { AimdRecorder, AimdRecorderEditor, AimdQuizRecorder, AimdDnaSequenceField, AimdMarkdownField }

/**
 * @deprecated Use `AimdRecorder` instead.
 */
export const AimdProtocolRecorder = AimdRecorder
