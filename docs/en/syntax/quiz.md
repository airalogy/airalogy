# Quiz Syntax (`quiz` code block)

Use `quiz` for common assessment types in one unified syntax.

- `choice`: single-choice / multiple-choice
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
- Unknown top-level fields are rejected by parser validation
- Quiz syntax does not currently support custom extension fields

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
    "quiz_blank_1": {
      "b1": "21%"
    },
    "quiz_open_1": "Because both temperature and pressure affect this phenomenon."
  }
}
```

Mapping:

- `choice + single` -> `str` (option key)
- `choice + multiple` -> `list[str]` (option key list)
- `blank` -> `dict[str, str]` (`blank_key -> user input`)
- `open` -> `str`

For full record structure, see: [Record Data Structure](../data-structure/record.md).

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
- `answer`: correct option key(s)
- `default`: initial option key(s) for record form

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
