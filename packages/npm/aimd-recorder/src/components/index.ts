/**
 * AIMD Editor Components
 *
 * Placeholder for component exports
 * Components will be migrated from apps/web/src/components/custom/aimd
 */

import { defineAsyncComponent } from "vue"
import "../styles/recorder.css"
import AimdAssignerGraph from "./AimdAssignerGraph.vue"
import AimdCollectorField from "./AimdCollectorField.vue"
import AimdRecorder from "./AimdRecorder.vue"
import AimdRecorderEditor from "./AimdRecorderEditor.vue"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"
import AimdRequiredMarker from "./AimdRequiredMarker.vue"

const AimdDnaSequenceField = defineAsyncComponent(() => import("./AimdDnaSequenceField.vue"))
const AimdMarkdownField = defineAsyncComponent(() => import("./AimdMarkdownField.vue"))
const AimdEntityRefField = defineAsyncComponent(() => import("./AimdEntityRefField.vue"))

export {
  AimdAssignerGraph,
  AimdCollectorField,
  AimdRecorder,
  AimdRecorderEditor,
  AimdQuizRecorder,
  AimdRequiredMarker,
  AimdEntityRefField,
  AimdDnaSequenceField,
  AimdMarkdownField,
}

/**
 * @deprecated Use `AimdRecorder` instead.
 */
export const AimdProtocolRecorder = AimdRecorder
