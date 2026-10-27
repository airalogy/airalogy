# AimdRecorder

Use `AimdRecorder` when you want AIMD inputs rendered inline inside the protocol flow.

## Example

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

Sample: {{var|sample_name: str, title="Sample name", description="Human-readable sample label", examples=["S-001"]}}
Operator: {{var|operator: UserName}}
Record Time: {{var|current_time: CurrentTime}}
Temperature: {{var|temperature: float = 25.0, title="Temperature (C)", description="Ambient temperature in Celsius", examples=[25.0, 37.0]}}
Notes: {{var|notes: AiralogyMarkdown}}
Plasmid: {{var|plasmid: DNASequence}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    locale="en-US"
    current-user-name="Alice"
  />
</template>
```

`record` shape:

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

## Checkpoint Instructions

The visual form and field editing tools preserve the whole checkpoint when `checked_message` contains literal AIMD-looking text. For example, `checked_message="Keep {{ref_var|wait_s}} literal"` displays exactly that text after checking, without resolving the nested reference. References in ordinary Markdown outside the parameter string are unaffected. Editing, moving, or removing the checkpoint operates on its complete definition.

Checkpoints may have a short `title`, for example `{{check|safety_ready, title="Protective equipment"}}`. Detailed display shows the title and a smaller ID; compact display retains the title but hides the ID. The visual settings dialog edits the title and checked message while retaining the existing ID, checked state and notes. The title is optional; body content remains separate.

Write check instructions after the marker, for example `{{check|safety_ready}} Confirm gloves and eye protection.` The marker's ID is the stable Record key; its following paragraph is instruction content, not an implicit title. A standalone marker falls back to its ID. Recorder and its visual authoring widgets display the checkpoint badge once, exclude preview controls from the body, and preserve actual body content including nested inputs.

## Visual Form Authoring

Step markers use full-width, compact headers instead of inline cards. The number and optional `title` are primary; the ID is smaller secondary metadata and is hidden in compact display without hiding the title. Without a title, the number remains the primary label. Visual widgets use numbering from the whole document, including nested levels. Instructions stay editable below the header, with checkbox, expected duration, timer and note controls together. Empty renderer paragraphs do not create a blank body or move Notes onto a separate row; real body text, images and controls remain intact.

`AimdRecorderWysiwygSurface` combines editable prose with real Recorder widgets. Users can insert an input and immediately fill it, without switching to source or another pane. This is different from definition-only WYSIWYG placeholders.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdRecorderWysiwygSurface, createEmptyProtocolRecordData } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref('Sample: {{var|field_1: str, title="Sample name"}}')
const record = ref(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderWysiwygSurface
    v-model:content="content"
    v-model="record"
    field-display="compact"
    locale="en-US"
  />
</template>
```

The Input dialog generates a stable, unique ID before insertion. Users can choose text, integer, decimal, dropdown, yes/no, date, or text-list controls; title is optional. The Edit action beside a field opens its settings with the ID under Advanced. Values belong to `record`, not AIMD defaults. Renaming a var preserves the current value under its new key and retains the old key as detached data for recovery; external records and assigner code are not migrated. Deleting a field does not erase its stored value. Step settings edit the name and timer options while preserving the existing ID, references, checked state, notes and elapsed time. Other structural edits are delegated through `edit-field`; hosts can open their advanced/source editor. `AimdRecorderEditor` remains available for a complete multi-panel workbench.

`fieldDisplay="compact"` hides var headers and technical table keys, including IDs and titles, while retaining controls and validation messages. Empty native inputs can use the title as a placeholder; accessible labels remain available. List/JSON switches, calculation actions, and specialized editor toolbars remain usable. Pass `detailed` to restore metadata without changing content or values. All package components default to `detailed`; the AIMD Demo starts with a full-width visual form, shows field details on first visit, and restores the user's saved display preference. It also offers source, fill-only, and side-by-side views.

Visual authoring uses real Recorder controls, not definition-only placeholders:

| Field type | Input control |
| --- | --- |
| `str`, `int`, `float` | Text, integer, decimal inputs |
| `Literal[...]`, official named enums, `enum` options | Selects that preserve the original option value types |
| `list[Literal[...]]`, lists of official named enums | Checkbox groups storing option arrays |
| `bool` | Checkbox with visible Yes/No feedback |
| `bool \| None` | Unset/Yes/No select |
| `date`, `time`, `datetime`, `CurrentTime` | Corresponding date or time controls |
| `list[str]`, `list[int]`, `list[float]` | Item and JSON modes |
| Other structured lists and dictionaries | JSON input |
| `FileId*` | File selection and existing-file display |
| `JsonStr` and other code strings, `AiralogyMarkdown`, `DNASequence` | Dedicated editors |
| `EntityRef`, `ResourceRef` | Reference selection backed by host-provided data sources |

`T | None`, `Optional[T]`, and `Union[T, None]` retain the control for `T`; clearing a nullable native input or select writes `null`. Unknown types continue to use the default input or host-provided `typePlugins`; hiding metadata does not change the data type. Frontend interaction validation does not replace final Python/Pydantic validation.

For example, `{{var|analyses: list[Literal["Sequencing", "Microscopy"]] | None}}` stores `["Sequencing", "Microscopy"]` when both options are selected. Unchecking all options produces `[]`; Unset restores `null`. Frontend validation checks item membership, while Python/Pydantic remains authoritative. `AimdRecorderWysiwygSurface` and standalone `AimdRecorder` use the same control.

For visual-only hosts, `insertText(text)` inserts at the current caret. `showModeSwitch` exposes the source/visual switch and emits `switch-mode`; `imageToolbarAction="custom"` emits `request-image`. `readonly` disables both definition editing and value entry. Validation and provider props use the existing Recorder contracts. Embedded fields do not repeat the current-record search toolbar.

## Built-In Recorder Behaviors

Recorder emits Record values but does not create a persisted record, assign its identity/version, or write browser storage. The host owns these steps. The [online demo's save workflow](../../demo#save-templates-and-records) stores recoverable drafts and separates template export from `.aira` Record export using `@airalogy/aira-core`. Editing values never writes them into AIMD defaults.

- `CurrentTime` and `UserName` can fill recorder values automatically from runtime context.
- `AiralogyMarkdown` renders as a full-width embedded AIMD/Markdown field with `Preview` and `Source` modes; preview uses the AIMD renderer and renders Mermaid code blocks, while source editing still supports switching to `WYSIWYG`.
- `DNASequence` renders a dedicated sequence widget with interactive and raw-structure modes, file import/export, topology switching, feature editing, and `SeqViz`-based visualization.
- `EntityRef` and `list[EntityRef]` render as entity-reference controls when the host passes `entityResolvers`; resolver keys can match the AIMD `source` connector id or the `entity` namespace. Hosts can use `createAimdEntityResolversFromConnectors()` from `@airalogy/aimd-core/utils` to build these resolvers from parsed `connectors` metadata.
- Collector-bound `Observation[T]` and `list[Observation[T]]` fields render as acquisition controls when the host passes `collectorProviders`, with snapshot reads, manual polling controls, authorization, cancellation, provenance, and explicit manual fallback.
- `ref_var` references display current var values as readonly inline content when available.
- `var` and `var_table` labels display AIMD `title`, keep the canonical id visible when a title is present, and show `description` plus `example`/`examples` details only on hover or keyboard focus. The first scalar example becomes the default placeholder when no explicit placeholder override is provided.
- Select-backed nullable types such as `bool | None`, `Literal[...] | None`, and `BloodType | None` show a localized `Not set` option and store that choice as `null`. Required selects omit the empty option, so choosing a real enum value remains mandatory.
- `list[str]`, `list[int]`, `list[float]`, and equivalent optional scalar-list vars render as full-row fields with repeatable, drag-reorderable item inputs plus JSON array mode, then save scalar arrays instead of forcing the generic structured textarea.
- `AimdRecorder` includes a collapsed-by-default protocol-aware current-record search control that can search all fields or one selected field; when expanded it stays sticky at the top of the recorder, highlights matching controls, jumps between matches, and selects matched text inside native text inputs when possible.
- `choice`, `true_false`, `blank`, `open`, and `scale` quiz types all have built-in recorder inputs.
- Numeric `var` inputs honor Pydantic-style constraints such as `gt`, `ge`, `lt`, `le`, and `multiple_of`; these constraints apply to `int`, `integer`, `float`, and `number` var types.
- Client assigners use the same numeric constraints for dependency readiness and skip execution while a dependent numeric field violates its declared bounds.

## Record Validation

Use the Pydantic JSON Schema returned by protocol parsing as the shared contract, and call the component ref when the host needs a submit gate:

```vue
<AimdRecorder
  ref="recorderRef"
  v-model="record"
  :content="content"
  :validation-schema="parseResult.data?.json_schema"
/>
```

```ts
const result = await recorderRef.value?.validate()
if (!result?.valid) return
```

The schema contract accepts both engine keys (`vars`, `steps`, `checks`) and legacy platform aliases (`research_variable`, `research_step`, `research_check`). It validates required, type, format, pattern, enum, numeric, array, object, and built-in-type constraints, including normalized structured values such as uploaded files. Schema-required non-nullable recorder inputs reject empty strings and empty arrays even when the property already exists in the in-memory Record; nullable properties accept `null` and do not show a required marker. Without a schema, Recorder falls back to AIMD declarations, infers fields without defaults as required unless their type includes `None` or uses `Optional[...]`, and applies explicit `required` overrides from AIMD or `fieldMeta`.

Recorder validates only the changed or blurred field by default and preserves unrelated errors; configure this with `validationTriggers`. Table errors are tracked, rendered, and focused by exact row and column keys such as `var_table:samples:0:concentration`.

`AimdRecorder` and `AimdRecorderEditor` expose `validate()`, `validateField(fieldKey)`, `clearValidation(fieldKey?)`, and `focusFirstInvalidField()`. The validation result contains `issues` plus a `fieldState` map. Run authoritative server-side Pydantic validation after the client submit gate, and pass server errors through the existing `fieldState` prop.

## Collector Providers

Collector declarations are parsed from the Protocol, while the host controls real device and network access by injecting a provider map keyed by connector id:

```ts
const collectorProviders = {
  lab_sensor_gateway: {
    async read({ collector, signal }) {
      const response = await fetch(`/api/sensors/${collector.channel}`, { signal })
      return response.json()
    },
  },
}
```

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :collector-providers="collectorProviders"
  :request-collector-permission="requestCollectorPermission"
  :collector-record-key="recordId"
  collector-actor-id="user-123"
/>
```

The provider may return a raw value or an observation envelope. Recorder supplies `received_at` and trusted `source` metadata before writing the Record. The permission callback may return `false`, `true`/`"once"`, or `"record"`; record-scoped approval is cleared when the record key or Protocol content changes. See the normative [Collector syntax and runtime documentation](https://airalogy.github.io/airalogy/en/syntax/collectors).

The current browser runtime supports `snapshot` and manually started/stopped `polling`. It parses but does not execute `stream`, automatic record/step lifecycle triggers, or file-backed `ObservationSeriesRef[T]` acquisition.

## Client Assigner

Frontend-only client assigners run locally inside recorder mode.

````aimd
Water: {{var|water_volume_ml: float}}
Lemon: {{var|lemon_juice_ml: float}}
Total: {{var|total_liquid_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_volume_ml", "lemon_juice_ml"],
    assigned_fields: ["total_liquid_ml"],
  },
  function calculate_total_liquid_ml({ water_volume_ml, lemon_juice_ml }) {
    return {
      total_liquid_ml: Math.round((water_volume_ml + lemon_juice_ml) * 100) / 100,
    };
  }
);
```
````

For `mode: "manual"`, `AimdRecorder` exposes explicit trigger methods through the component ref:

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## Locale And Quiz Recorder

Both `AimdRecorder` and `AimdQuizRecorder` accept `locale` to switch built-in recorder labels:

```vue
<AimdRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

Standalone quiz usage:

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdQuizRecorder } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const answer = ref("")
const quiz = {
  id: "quiz_single_1",
  type: "choice",
  mode: "single",
  stem: "Choose one option",
  options: [
    { key: "A", text: "Option A" },
    { key: "B", text: "Option B" },
  ],
}
</script>

<template>
  <AimdQuizRecorder v-model="answer" :quiz="quiz" />
</template>
```

If a `choice` or `true_false` option defines `followups`, the recorder shows those inputs only after the option is selected. For these quizzes the answer value is structured as `{ selected, followups }`, while ordinary choice quizzes continue to use the legacy string or string-array shape and ordinary true/false quizzes continue to use booleans.

## Showing Grade Results

If the host has already graded the answers elsewhere, pass the result back into `AimdRecorder` or `AimdQuizRecorder` for inline display. Deterministic `scale` quizzes can also compute a local score/classification inside the recorder.

Whole recorder:

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :quiz-grades="quizGrades"
  choice-option-explanation-mode="selected"
  scale-grade-display-mode="submitted"
/>
```

Standalone quiz:

```vue
<AimdQuizRecorder
  v-model="answer"
  :quiz="quiz"
  choice-option-explanation-mode="graded"
  :grade="{
    quiz_id: 'quiz_single_1',
    earned_score: 4,
    max_score: 5,
    status: 'partial',
    method: 'keyword_rubric',
    feedback: 'The answer is mostly correct but still misses one point.',
    review_required: true,
  }"
/>
```

Recommended usage:

- grade `choice` and standard `blank` items locally
- grade deterministic `scale` items locally, then use `scaleGradeDisplayMode` to control whether the result appears on completion or only after submit
- use a backend provider for `open` items or highly flexible blanks
- for practice, pass `quizGrades` in real time so learners can immediately see status, score, and feedback
- if a `choice` option defines `explanation`, use `choiceOptionExplanationMode="selected"` to show that explanation immediately after the learner selects the option
- if option explanations should appear only after the learner submits, combine `:submitted="isSubmitted"` with `choiceOptionExplanationMode="submitted"`
- if a `scale` result should appear only after submit, combine `:submitted="isSubmitted"` with `scaleGradeDisplayMode="submitted"`
- if you want option explanations to appear only after grading is available, use `choiceOptionExplanationMode="graded"`
- for exams, omit `quizGrades` until grading is finalized
- unanswered quizzes with status `ungraded` do not show a grading panel by default
- do not expose real model secrets in the browser for formal assessment flows

Homework / reveal-after-submit example:

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :submitted="isSubmitted"
  choice-option-explanation-mode="submitted"
/>
```

`submitted` is controlled by the host app. `AimdRecorder` does not infer submission state on its own and does not include a built-in submit button.
