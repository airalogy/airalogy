import assert from 'node:assert/strict'
import { test } from 'node:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
} from '../dist/parser.js'

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return {
    tree,
    fields: file.data.aimdFields,
  }
}

// ── Choice quiz: single mode ─────────────────────────────────────────────────

test('quiz choice single: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q1
type: choice
mode: single
stem: "What is 1+1?"
options:
  - key: a
    text: "1"
  - key: b
    text: "2"
  - key: c
    text: "3"
answer: b
\`\`\`
`)
  assert.equal(fields.quiz.length, 1)
  const q = fields.quiz[0]
  assert.equal(q.id, 'q1')
  assert.equal(q.type, 'choice')
  assert.equal(q.mode, 'single')
  assert.equal(q.stem, 'What is 1+1?')
  assert.equal(q.options.length, 3)
  assert.equal(q.answer, 'b')
})

test('quiz choice single: option explanations are parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q1_explanation
type: choice
mode: single
stem: "What is 1+1?"
options:
  - key: a
    text: "1"
    explanation: "Too small."
  - key: b
    text: "2"
    explanation: "Correct."
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].options, [
    { key: 'a', text: '1', explanation: 'Too small.' },
    { key: 'b', text: '2', explanation: 'Correct.' },
  ])
})

test('quiz choice single: option followups are parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q1_followups
type: choice
mode: single
stem: "Do you smoke?"
options:
  - key: "yes"
    text: "Yes"
    followups:
      - key: years
        type: int
        title: "Years"
        required: true
      - key: cigarettes_per_day
        type: float
        title: "Cigarettes per day"
        unit: "sticks/day"
        default: 10
      - key: passive
        type: bool
        required: false
  - key: "no"
    text: "No"
answer: "yes"
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].options[0].followups, [
    { key: 'years', type: 'int', required: true, title: 'Years' },
    { key: 'cigarettes_per_day', type: 'float', required: true, title: 'Cigarettes per day', unit: 'sticks/day', default: 10 },
    { key: 'passive', type: 'bool', required: false },
  ])
})

test('quiz choice single: followup type number is rejected', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q1_followups_bad
type: choice
mode: single
stem: "Do you smoke?"
options:
  - key: "yes"
    text: "Yes"
    followups:
      - key: years
        type: number
  - key: "no"
    text: "No"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice single: default value', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q2
type: choice
mode: single
stem: "Pick one"
options:
  - key: x
    text: "X"
  - key: y
    text: "Y"
default: x
\`\`\`
`)
  assert.equal(fields.quiz[0].default, 'x')
})

// ── True/false quiz ─────────────────────────────────────────────────────────

test('quiz true_false: basic parsing with default options', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_true_false
type: true_false
stem: "The sample should remain chilled during transfer."
answer: true
default: false
\`\`\`
`)
  assert.equal(fields.quiz.length, 1)
  const q = fields.quiz[0]
  assert.equal(q.id, 'q_true_false')
  assert.equal(q.type, 'true_false')
  assert.equal(q.mode, 'single')
  assert.equal(q.answer, true)
  assert.equal(q.default, false)
  assert.deepEqual(q.options, [
    { key: 'true', text: 'True' },
    { key: 'false', text: 'False' },
  ])
})

test('quiz true_false: custom option labels and explanations are parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_true_false_labels
type: true_false
stem: "The sample was stored at room temperature."
options:
  - key: true
    text: "True"
    explanation: "Room-temperature storage was recorded."
  - key: false
    text: "False"
    explanation: "Correct if the sample was kept cold."
answer: false
grading:
  strategy: option_points
  option_points:
    true: 0
    false: 2
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].options, [
    { key: 'true', text: 'True', explanation: 'Room-temperature storage was recorded.' },
    { key: 'false', text: 'False', explanation: 'Correct if the sample was kept cold.' },
  ])
  assert.equal(fields.quiz[0].answer, false)
  assert.deepEqual(fields.quiz[0].grading, {
    strategy: 'option_points',
    option_points: {
      true: 0,
      false: 2,
    },
  })
})

// ── Choice quiz: multiple mode ───────────────────────────────────────────────

test('quiz choice multiple: parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q3
type: choice
mode: multiple
stem: "Select all that apply"
options:
  - key: a
    text: "Option A"
  - key: b
    text: "Option B"
  - key: c
    text: "Option C"
answer:
  - a
  - c
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.mode, 'multiple')
  assert.deepEqual(q.answer, ['a', 'c'])
})

// ── Choice quiz: with score ──────────────────────────────────────────────────

test('quiz choice: score is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q4
type: choice
mode: single
stem: "Scored question"
score: 5
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
answer: a
\`\`\`
`)
  assert.equal(fields.quiz[0].score, 5)
})

// ── Choice quiz: extra fields ────────────────────────────────────────────────

test('quiz choice: extra fields preserved', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q5
type: choice
mode: single
stem: "With hint"
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
hint: "Think carefully"
\`\`\`
`)
  assert.equal(fields.quiz[0].extra?.hint, 'Think carefully')
})

test('quiz choice: grading config is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q5_grading
type: choice
mode: multiple
stem: "Choose the right answers"
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
answer:
  - a
grading:
  strategy: partial_credit
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].grading, { strategy: 'partial_credit' })
})

test('quiz choice: option_points grading is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q5_option_points
type: choice
mode: single
stem: "Choose the best answer"
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
grading:
  strategy: option_points
  option_points:
    a: 1
    b: 3
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].grading, {
    strategy: 'option_points',
    option_points: { a: 1, b: 3 },
  })
})

test('quiz choice: invalid option_points key is rejected', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q5_option_points_bad
type: choice
mode: single
stem: "Choose the best answer"
options:
  - key: a
    text: "A"
grading:
  strategy: option_points
  option_points:
    b: 2
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz scale: parsing with items, points, display, bands, and defaults', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_scale
type: scale
title: GAD-7
description: Frequency scale over the last two weeks.
stem: "How often have you been bothered by the following problems?"
display: matrix
items:
  - key: s1
    stem: Feeling nervous
    description: Item description
  - key: s2
    stem: Unable to relax
options:
  - key: not_at_all
    text: Not at all
    points: 0
  - key: several_days
    text: Several days
    points: 1
    explanation: Mild frequency
grading:
  strategy: sum
  bands:
    - min: 0
      max: 1
      label: Low
      interpretation: Monitor only
default:
  s1: not_at_all
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.type, 'scale')
  assert.equal(q.title, 'GAD-7')
  assert.equal(q.description, 'Frequency scale over the last two weeks.')
  assert.equal(q.display, 'matrix')
  assert.deepEqual(q.items, [
    { key: 's1', stem: 'Feeling nervous', description: 'Item description' },
    { key: 's2', stem: 'Unable to relax' },
  ])
  assert.deepEqual(q.options, [
    { key: 'not_at_all', text: 'Not at all', points: 0 },
    { key: 'several_days', text: 'Several days', points: 1, explanation: 'Mild frequency' },
  ])
  assert.deepEqual(q.grading, {
    strategy: 'sum',
    bands: [
      { min: 0, max: 1, label: 'Low', interpretation: 'Monitor only' },
    ],
  })
  assert.deepEqual(q.default, { s1: 'not_at_all' })
})

// ── Blank quiz ───────────────────────────────────────────────────────────────

test('quiz blank: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q6
type: blank
stem: "The capital of France is [[b1]]"
blanks:
  - key: b1
    answer: Paris
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.type, 'blank')
  assert.equal(q.blanks.length, 1)
  assert.equal(q.blanks[0].key, 'b1')
  assert.equal(q.blanks[0].answer, 'Paris')
})

test('quiz blank: multiple blanks', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q7
type: blank
stem: "[[b1]] + [[b2]] = 3"
blanks:
  - key: b1
    answer: "1"
  - key: b2
    answer: "2"
\`\`\`
`)
  assert.equal(fields.quiz[0].blanks.length, 2)
})

test('quiz blank: default value as dict', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q8
type: blank
stem: "Answer: [[b1]]"
blanks:
  - key: b1
    answer: "42"
default:
  b1: "?"
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].default, { b1: '?' })
})

test('quiz blank: single blank with string default', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q9
type: blank
stem: "Answer: [[b1]]"
blanks:
  - key: b1
    answer: "42"
default: "initial"
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].default, { b1: 'initial' })
})

test('quiz blank: grading config is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q9_grading
type: blank
stem: "Answer: [[b1]]"
blanks:
  - key: b1
    answer: "42"
grading:
  strategy: normalized_match
  blanks:
    - key: b1
      accepted_answers: ["42", "42.0"]
      normalize: ["trim", "remove_spaces"]
      numeric:
        target: 42
        tolerance: 0.5
\`\`\`
`)
  assert.equal(fields.quiz[0].grading.strategy, 'normalized_match')
  assert.deepEqual(fields.quiz[0].grading.blanks, [{
    key: 'b1',
    accepted_answers: ['42', '42.0'],
    normalize: ['trim', 'remove_spaces'],
    numeric: {
      target: 42,
      tolerance: 0.5,
    },
  }])
})

// ── Open quiz ────────────────────────────────────────────────────────────────

test('quiz open: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q10
type: open
stem: "Explain photosynthesis."
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.type, 'open')
  assert.equal(q.stem, 'Explain photosynthesis.')
})

test('quiz open: with rubric', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q11
type: open
stem: "Describe the process."
rubric: "Must mention light and CO2."
\`\`\`
`)
  assert.equal(fields.quiz[0].rubric, 'Must mention light and CO2.')
})

test('quiz open: with default', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q12
type: open
stem: "Your answer?"
default: "Type here..."
\`\`\`
`)
  assert.equal(fields.quiz[0].default, 'Type here...')
})

test('quiz open: grading config is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q12_grading
type: open
stem: "Explain why."
grading:
  strategy: llm_rubric
  provider: teacher_default
  require_review_below: 0.8
  rubric_items:
    - id: rate
      points: 2
      desc: "Mention rate"
      keywords: ["rate", "speed"]
\`\`\`
`)
  assert.equal(fields.quiz[0].grading.strategy, 'llm_rubric')
  assert.equal(fields.quiz[0].grading.provider, 'teacher_default')
  assert.equal(fields.quiz[0].grading.require_review_below, 0.8)
  assert.deepEqual(fields.quiz[0].grading.rubric_items, [{
    id: 'rate',
    points: 2,
    desc: 'Mention rate',
    keywords: ['rate', 'speed'],
  }])
})

// ── YAML validation errors (errors are caught internally, quiz is skipped) ───

test('quiz: missing id is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
type: choice
mode: single
stem: "no id"
options:
  - key: a
    text: "A"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: missing type is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
stem: "no type"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: invalid type is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: essay
stem: "invalid type"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: missing stem is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: open
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: missing mode is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
stem: "no mode"
options:
  - key: a
    text: "A"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: invalid answer key is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
mode: single
stem: "bad answer"
options:
  - key: a
    text: "A"
answer: z
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: duplicate option keys are skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
mode: single
stem: "dup keys"
options:
  - key: a
    text: "A"
  - key: a
    text: "B"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: numeric option keys are skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
mode: single
stem: "numeric option keys"
options:
  - key: "0"
    text: "A"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz scale: numeric option keys are skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: scale
stem: "numeric option keys"
items:
  - key: s1
    stem: "Item 1"
options:
  - key: "0"
    text: "Not at all"
    points: 0
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: missing placeholder in stem is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "No placeholder here"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: undefined placeholder is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "Answer: [[b99]]"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: duplicate placeholder is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "[[b1]] and [[b1]]"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: negative score is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: open
stem: "bad score"
score: -1
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: invalid grading config is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad_grading
type: open
stem: "Explain"
grading:
  strategy: llm_rubric
  require_review_below: 2
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

// ── Duplicate quiz ids are deduplicated ──────────────────────────────────────

test('quiz: duplicate quiz ids are deduplicated', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_same
type: open
stem: "First"
\`\`\`

\`\`\`quiz
id: q_same
type: open
stem: "Second"
\`\`\`
`)
  assert.equal(fields.quiz.length, 1)
})
