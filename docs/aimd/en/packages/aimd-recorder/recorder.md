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

## Built-In Recorder Behaviors

- `CurrentTime` and `UserName` can fill recorder values automatically from runtime context.
- `AiralogyMarkdown` renders as a full-width embedded AIMD/Markdown field with `Preview` and `Source` modes; preview uses the AIMD renderer and renders Mermaid code blocks, while source editing still supports switching to `WYSIWYG`.
- `DNASequence` renders a dedicated sequence widget with interactive and raw-structure modes, file import/export, topology switching, feature editing, and `SeqViz`-based visualization.
- `ref_var` references display current var values as readonly inline content when available.
- `var` and `var_table` labels display AIMD `title`, keep the canonical id visible when a title is present, and show `description` plus `example`/`examples` details only on hover or keyboard focus. The first scalar example becomes the default placeholder when no explicit placeholder override is provided.
- `list[str]`, `list[int]`, `list[float]`, and equivalent optional scalar-list vars render as full-row fields with repeatable, drag-reorderable item inputs plus JSON array mode, then save scalar arrays instead of forcing the generic structured textarea.
- `choice`, `true_false`, `blank`, `open`, and `scale` quiz types all have built-in recorder inputs.
- Numeric `var` inputs honor Pydantic-style constraints such as `gt`, `ge`, `lt`, `le`, and `multiple_of`; these constraints apply to `int`, `integer`, `float`, and `number` var types.
- Client assigners use the same numeric constraints for dependency readiness and skip execution while a dependent numeric field violates its declared bounds.

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
