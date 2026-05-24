# Quiz Syntax (`quiz` code block)

Use `quiz` for common assessment types in one unified syntax.

- `choice`: single-choice / multiple-choice
- `true_false`: judgment / true-false question
- `scale`: matrix / Likert-style questionnaire
- `blank`: fill-in-the-blank
- `open`: open-ended question

## Block Format (YAML)

`quiz` blocks are parsed as YAML, including standard key/value fields, lists, and multiline text.

Recommended conventions:

- Use 2 spaces for indentation
- Use `key: value` for fields
- Use `- ...` for list items (for example, `options` and `blanks`)
- Use `|` for multiline text and keep indentation on following lines
- Quote strings explicitly when they contain special characters
- Quote option keys such as `yes`, `no`, `on`, and `off`, which YAML may otherwise parse as booleans
- Unknown top-level fields are rejected by parser validation
- Use the built-in `grading` field when you want auto-grading rules

Multi-paragraph stem example:

````aimd
```quiz
id: quiz_open_multi_paragraph
type: open
stem: |
  Paragraph 1: describe the observed phenomenon.

  Paragraph 2: explain possible causes and provide evidence.
rubric: Mention at least two factors.
```
````

If you need the `parse_aimd` output shape, see API docs: [AIMD Utilities](../apis/markdown.md).

## Saved Answer Data Structure

Quiz answers are saved into `data.quiz`, keyed by quiz `id`, and validated by quiz-definition rules.

Example (`quiz` part only):

```json
{
  "quiz": {
    "quiz_choice_single_1": "A",
    "quiz_choice_multiple_1": ["A", "C"],
    "quiz_choice_with_followups_1": {
      "selected": "A",
      "followups": {
        "A": {
          "temperature_c": 4,
          "duration_hours": 2.5
        }
      }
    },
    "quiz_true_false_1": false,
    "quiz_true_false_with_followups_1": {
      "selected": true,
      "followups": {
        "true": {
          "color": "white"
        }
      }
    },
    "quiz_blank_1": {
      "b1": "21%"
    },
    "quiz_scale_1": {
      "s1": "not_at_all",
      "s2": "more_than_half_the_days"
    },
    "quiz_open_1": "Because both temperature and pressure affect this phenomenon."
  }
}
```

Mapping:

- `choice + single` -> `str` (option key)
- `choice + multiple` -> `list[str]` (option key list)
- `choice` with `options[].followups` -> `dict` (`selected` is the selected option key / key list, `followups` is `option_key -> followup field values`)
- `true_false` -> `bool`
- `true_false` with `options[].followups` -> `dict` (`selected` is a boolean, `followups` is `"true"` / `"false" -> followup field values`)
- `scale` -> `dict[str, str]` (`item_key -> selected option key`)
- `blank` -> `dict[str, str]` (`blank_key -> user input`)
- `open` -> `str`

For full record structure, see: [Record Data Structure](../data-structure/record.md).

## Auto Grading

User answers still live in `data.quiz`. Auto-grading results should usually be stored separately as a grade report instead of overwriting the raw answers.

Here, “stored separately” means separated in the data model, not necessarily a separate file. Common patterns include:

- returning it as a dedicated API field such as `grade_report`
- storing it as a related grading row/document in your database
- exporting it as a standalone JSON file when needed

The key rule is simple: keep the raw answers in `data.quiz` and do not write grading results back into the answer payload itself.

Recommended defaults:

- `choice`: exact answer matching
- `true_false`: exact boolean matching, or `option_points` when true/false needs asymmetric scoring
- `scale`: deterministic sum of per-item option `points`, with optional score bands / classifications
- `blank`: deterministic matching with normalization, aliases, and numeric tolerance
- `open`: rubric-based grading, with an optional LLM provider when needed

If you plan to use an LLM:

- store only a provider name such as `provider: teacher_default` in AIMD
- this provider name is only a logical identifier; you do not need to run a real service named `teacher_default`
- your host system can map it to backend config, an external model API, or a local/internal grading flow
- keep the real API key in your host app or backend service
- for formal exams, grade on the server side instead of exposing secrets in the browser

### What `provider` Means

`provider` is better understood as a grading configuration name or grading channel, not as a fixed service URL.

For example:

- `teacher_default`: the current teacher's default grading setup
- `school_exam_llm`: a grading setup used for formal exams
- `chemistry_lab_v1`: a course-specific grading setup

A typical flow looks like this:

1. Put `provider: teacher_default` in AIMD.
2. Send the quiz, answer, and `provider` to your backend.
3. Let the backend resolve that name to a real configuration.
4. Let the backend call an external model API, an internal model service, or a review workflow.

So `provider` itself is neither the API key nor the name of a required standalone service.

## Suggested Grade Result Shape

Keep grading output in a separate structure, for example:

```json
{
  "quiz": {
    "quiz_open_1": {
      "earned_score": 4,
      "max_score": 5,
      "status": "partial",
      "feedback": "Mentioned reaction rate but did not fully explain stability."
    }
  },
  "summary": {
    "total_earned_score": 4,
    "total_max_score": 5,
    "review_required_count": 0
  }
}
```

If you want to return it together with a record payload, a common shape looks like this:

```json
{
  "data": {
    "quiz": {
      "quiz_open_1": "Student raw answer"
    }
  },
  "grade_report": {
    "quiz": {
      "quiz_open_1": {
        "earned_score": 4,
        "max_score": 5,
        "status": "partial"
      }
    },
    "summary": {
      "total_earned_score": 4,
      "total_max_score": 5,
      "review_required_count": 0
    }
  }
}
```

## Choice Item (`type: choice`)

````aimd
```quiz
id: quiz_choice_single_1
type: choice
mode: single
score: 5
stem: Which option is correct?
options:
  - key: A
    text: Option A
    explanation: Explanation shown when A is selected
  - key: B
    text: Option B
answer: A
```
````

Required fields:

- `id`
- `type: choice`
- `mode`: `single` or `multiple`
- `stem`
- `options`: non-empty list, each item has `key` and `text`

Optional fields:

- `score`: non-negative number
- `answer`: correct option key(s). You may omit this when using `grading.strategy: option_points`
- `default`: initial option key(s) for record form
- `grading`: grading policy. Common choice cases are multiple-choice partial credit and per-option scoring
- `options[].followups`: structured fields that are shown and validated only when that option is selected

Each `options` item may also include:

- `explanation`: explanatory text for that option. It is not part of grading, but hosts or recorders may show it in practice-oriented flows to explain why the option is right or wrong

### Option Followups (`options[].followups`)

Use `followups` when a selected option requires extra structured information, such as storage temperature, processing duration, or details:

````aimd
```quiz
id: quiz_sample_storage
type: choice
mode: single
stem: How is the sample currently stored?
options:
  - key: A
    text: Refrigerated
    followups:
      - key: temperature_c
        type: float
        title: Temperature
        unit: °C
      - key: duration_hours
        type: float
        title: Duration
        unit: h
  - key: B
    text: Frozen
    followups:
      - key: freeze_thaw_count
        type: int
        title: Freeze-thaw count
        required: false
  - key: C
    text: Room temperature
    followups:
      - key: duration_hours
        type: float
        title: Duration
        unit: h
```
````

Each followup field contains:

- `key`: required followup field id, using the same naming rules as quiz ids
- `type`: required, currently one of `str`, `int`, `float`, `bool`
- `title`: optional display label
- `description`: optional field description
- `unit`: optional unit
- `required`: optional boolean, defaults to `true`
- `default`: optional default value, which must match `type`

Choice items with `followups` use structured answers:

```json
{
  "quiz_sample_storage": {
    "selected": "A",
    "followups": {
      "A": {
        "temperature_c": 4,
        "duration_hours": 2.5
      }
    }
  }
}
```

Rules:

- `selected` is a string for single choice, and a string list for multiple choice
- `followups` is keyed by option key and may contain only selected options
- when `require_complete=True`, required followup fields for selected options must be present
- followups are part of the raw answer payload; choice grading still uses only `selected`

## True/False Item (`type: true_false`)

Use `true_false` for judgment questions where the answer is a boolean.

````aimd
```quiz
id: quiz_true_false_1
type: true_false
score: 2
stem: The sample can be stored at room temperature overnight.
answer: false
```
````

Required fields:

- `id`
- `type: true_false`
- `stem`

Optional fields:

- `score`: non-negative number
- `answer`: boolean answer. YAML `true`/`false` and string keys `"true"`/`"false"` are accepted and normalized to booleans
- `default`: boolean default value for record form
- `options`: optional labels for the two choices. If omitted, Airalogy uses `true` / `false` options with `True` / `False` labels
- `options[].followups`: optional structured fields shown only after selecting `true` or `false`; field rules are the same as choice followups
- `grading`: supports `auto`, `exact_match`, and `option_points`

Custom labels must still use the canonical option keys `true` and `false`:

````aimd
```quiz
id: quiz_true_false_labels
type: true_false
stem: 样本可以常温过夜保存。
options:
  - key: true
    text: 对
  - key: false
    text: 错
grading:
  strategy: option_points
  option_points:
    true: 0
    false: 2
```
````

By default, record answers are stored as JSON booleans:

```json
{
  "quiz_true_false_1": false
}
```

If `true_false.options[].followups` defines followup fields, the answer uses the structured shape instead. `selected` remains a boolean, while `followups` uses string option keys `"true"` / `"false"`:

````aimd
```quiz
id: quiz_precipitate
type: true_false
stem: Was precipitate observed?
options:
  - key: true
    text: Yes
    followups:
      - key: color
        type: str
        title: Color
  - key: false
    text: No
```
````

```json
{
  "quiz_precipitate": {
    "selected": true,
    "followups": {
      "true": {
        "color": "white"
      }
    }
  }
}
```

True/false items without `followups` continue to use a plain boolean answer. Grading still uses only `selected` by default, while followups remain part of the raw answer.

Partial-credit example:

````aimd
```quiz
id: quiz_choice_multiple_1
type: choice
mode: multiple
score: 6
stem: Which items must be recorded?
options:
  - key: A
    text: Sample ID
  - key: B
    text: Operation time
  - key: C
    text: Operator
  - key: D
    text: Weather
answer: [A, B, C]
grading:
  strategy: partial_credit
```
````

`partial_credit` is for multiple-choice questions. It allows students to earn some points without getting every option exactly right: correct selections add credit, wrong selections reduce it, and the final score is clamped to the `0..score` range.

The rule can be understood like this:

- score ratio = `(number of correct selections - number of wrong selections) / number of correct answers`
- if the ratio is below `0`, use `0`
- if the ratio is above `1`, use `1`
- final score = `score ratio * score`

Using the example above with 4 options, 3 correct answers, and a maximum score of 6:

- select only `A`: `(1 - 0) / 3 * 6 = 2`
- select `A, B`: `(2 - 0) / 3 * 6 = 4`
- select `A, B, C`: `(3 - 0) / 3 * 6 = 6`
- select all `A, B, C, D`: `(3 - 1) / 3 * 6 = 4`
- select only `D`: `(0 - 1) / 3 * 6 = -2`, so the final score is clamped to `0`

This strategy is useful for teaching, practice, and homework, where you want to distinguish partial understanding from full mastery. If you want multiple-choice questions to score only when every correct option is selected and no wrong option is chosen, keep the default exact matching instead.

## Scale Item (`type: scale`)

`scale` is intended for matrix-style questionnaires such as Likert scales, symptom checklists, and standardized instruments that share one option set across multiple items.

````aimd
```quiz
id: quiz_scale_1
type: scale
title: GAD-2 style check
stem: Over the last two weeks, how often have you been bothered by the following problems?
display: matrix
items:
  - key: s1
    stem: Feeling nervous, anxious, or on edge
  - key: s2
    stem: Not being able to stop or control worrying
options:
  - key: not_at_all
    text: Not at all
    points: 0
  - key: several_days
    text: Several days
    points: 1
  - key: more_than_half_the_days
    text: More than half the days
    points: 2
  - key: nearly_every_day
    text: Nearly every day
    points: 3
grading:
  strategy: sum
  bands:
    - min: 0
      max: 1
      label: Minimal
      interpretation: Symptoms are not elevated in this range.
    - min: 2
      max: 3
      label: Mild
    - min: 4
      max: 6
      label: Moderate to severe
```
````

Required fields:

- `id`
- `type: scale`
- `stem`
- `items`: non-empty list, each item includes `key` and `stem`
- `options`: non-empty list, each option includes `key`, `text`, and numeric `points`

Optional fields:

- `title`
- `description`
- `display`: `matrix` or `list` (`matrix` is the default)
- `default`: mapping from `item_key` to selected option key
- `grading.strategy`: currently `sum`
- `grading.bands`: optional score ranges for classification / interpretation
- `grading.bands[].interpretation`: optional human-readable explanation of what that band means
- `items[].key` and `options[].key`: identifier-style keys only; they must start with a letter and then use only letters, digits, or underscores

Behavior notes:

- scale answers are stored as `dict[str, str]`, keyed by `item.key`
- the parser validates that `default` only references known `item` keys and known option keys
- local scoring sums the selected option `points` across all items
- `grading.bands` does not change the numeric score; it only adds a classification layer on top of the total

Per-option scoring example:

````aimd
```quiz
id: quiz_choice_single_points_1
type: choice
mode: single
score: 5
stem: Which statement is the most appropriate?
options:
  - key: A
    text: Fully correct
  - key: B
    text: Reasonable but incomplete
  - key: C
    text: Clearly problematic
grading:
  strategy: option_points
  option_points:
    A: 5
    B: 3
    C: 0
```
````

For multiple choice, selected option scores are summed and then clamped into the `0..score` range. To prevent “select everything” behavior, assign negative points to clearly wrong options:

````aimd
```quiz
id: quiz_choice_multiple_points_1
type: choice
mode: multiple
score: 4
stem: Which items must be recorded?
options:
  - key: A
    text: Sample ID
  - key: B
    text: Operation time
  - key: C
    text: Operator
  - key: D
    text: Weather conditions
grading:
  strategy: option_points
  option_points:
    A: 1.5
    B: 1.5
    C: 1
    D: -1
```
````

## Blank Item (`type: blank`)

````aimd
```quiz
id: quiz_blank_1
type: blank
score: 3
stem: Fill [[b1]]
blanks:
  - key: b1
    answer: 21%
```
````

Required fields:

- `id`
- `type: blank`
- `stem`: include placeholders in `[[key]]` format
- `blanks`: non-empty list, each item has `key` and `answer`

Placeholder consistency rules:

- each `key` in `blanks` must appear in `stem`
- each placeholder in `stem` must be defined in `blanks`
- each key appears once in `stem`

Optional fields:

- `score`
- `default`
- `grading`

Auto-grading example:

````aimd
```quiz
id: quiz_blank_1
type: blank
score: 3
stem: Oxygen in air is about [[b1]]
blanks:
  - key: b1
    answer: 21%
grading:
  strategy: normalized_match
  blanks:
    - key: b1
      accepted_answers: ["21%", "21 %", "0.21"]
      normalize: ["trim", "remove_spaces"]
      numeric:
        target: 21
        tolerance: 0.5
        unit: "%"
```
````

Meaning:

- `accepted_answers`: equivalent answers that should count as correct
- `normalize`: text normalization rules before matching. These are built-in rule names, not custom scripts
- `numeric`: score by numeric tolerance, useful for units and approximate values

Numeric parsing and tolerance comparison are triggered only when you explicitly configure a `numeric` field for that blank. If you do not set it, the blank is graded only with text-matching rules.

The `numeric` fields mean:

- `target`: target numeric value, required
- `tolerance`: allowed deviation, optional
- `unit`: unit, optional. Use it only when you want the system to strip a trailing unit before comparing the numeric value

If the answer is just a plain number with no unit, you can simply omit `unit`, for example:

```yaml
numeric:
  target: 7
  tolerance: 0.2
```

In the current implementation, the system does not try to infer units from free-form natural language. It uses a more deterministic rule:

1. convert full-width characters to half-width and trim outer whitespace
2. if `unit` is configured, strip that unit from the end of the answer
3. parse the remaining part as a number

So these are usually recognized successfully:

- `21%`
- `21 %`
- `２１％`
- `1,200 mg` (when `unit: "mg"` is configured)

And these usually are not parsed directly as numeric answers:

- `about 21%`
- `twenty-one percent`
- `mg21`

So `unit` is not discovered by "smart extraction"; it is matched explicitly from the end of the answer based on the rule you configure.

Currently supported `normalize` rules:

- `trim`: remove leading and trailing whitespace
- `lowercase`: convert to lowercase
- `collapse_whitespace`: collapse consecutive whitespace into a single space
- `remove_spaces`: remove all whitespace characters
- `fullwidth_to_halfwidth`: convert full-width characters to half-width characters

If you do not explicitly set `normalize`, the system uses this default:

```yaml
["trim", "collapse_whitespace"]
```

## Open Item (`type: open`)

````aimd
```quiz
id: quiz_open_1
type: open
score: 10
stem: Explain the phenomenon
rubric: Mention at least two factors
```
````

Required fields:

- `id`
- `type: open`
- `stem`

Optional fields:

- `score`
- `rubric`
- `grading`

Local rubric example:

````aimd
```quiz
id: quiz_open_1
type: open
score: 5
stem: Explain why this step needs temperature control
grading:
  strategy: keyword_rubric
  rubric_items:
    - id: rate
      points: 2
      desc: Mention reaction rate
      keywords: ["reaction rate", "rate"]
    - id: stability
      points: 3
      desc: Mention sample stability
      keywords: ["sample stability", "stability"]
```
````

If you want LLM-based grading instead:

````aimd
```quiz
id: quiz_open_llm_1
type: open
score: 10
stem: Explain the causes of the phenomenon in detail
grading:
  strategy: llm_rubric
  provider: teacher_default
  require_review_below: 0.8
  rubric_items:
    - id: factor_a
      points: 5
      desc: Describe at least one key factor
    - id: factor_b
      points: 5
      desc: Provide a reasonable justification
```
````

Here, `teacher_default` is only a configuration name. A typical flow is: the frontend sends the quiz, answer, and `provider` to your backend; the backend then uses that name to choose the real model, prompt preset, and secret, and finally calls either an external API or an internal model for grading.

Notes:

- `provider` is a host-side provider name, not a plaintext API key
- when using provider / LLM grading, the backend must return a structured grade result object rather than free-form text
- at minimum, return `earned_score`, `max_score`, `status`, and `method`; add `feedback`, `confidence`, and `review_required` when useful
- if the provider returns only natural-language text, the system does not reliably extract a score from it; the current implementation marks such cases as `needs_review`
- `require_review_below` is a confidence threshold in the `0..1` range. For example, `0.8` means the quiz should be flagged for manual review when the grading confidence is below `0.8`
- for built-in `keyword_rubric` grading, this threshold is applied directly by the system
- for `llm` / `llm_rubric` provider-based grading, the backend should read this config and decide whether to set `review_required: true` based on the returned `confidence`
- keeping `rubric_items` is strongly recommended for auditability and feedback

For example, the backend can return a structured result like:

```json
{
  "earned_score": 8,
  "max_score": 10,
  "status": "partial",
  "method": "llm",
  "feedback": "The main factors were mentioned, but the reasoning is still incomplete.",
  "confidence": 0.84,
  "review_required": false
}
```
