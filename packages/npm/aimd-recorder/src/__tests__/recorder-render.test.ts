import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')

describe('AimdRecorder render stability', () => {
  it('uses a stable outlet component instead of recreating an inline dynamic component on each render', () => {
    expect(source).toMatch(/const InlineNodesOutlet = defineComponent\(/)
    expect(source).toMatch(/<InlineNodesOutlet :nodes="inlineNodes" \/>/)
    expect(source).not.toMatch(/<component :is="\(\) => inlineNodes" \/>/)
  })

  it('skips echo-style modelValue syncs when the incoming record signature matches local state', () => {
    expect(source).toMatch(/if \(!shouldRebuild\) \{\s*return\s*\}/)
  })

  it('renders protocol timing summary pills when step estimates or recorded durations exist', () => {
    expect(source).toMatch(/showProtocolTimingSummary/)
    expect(source).toMatch(/aimd-protocol-recorder__timing-pill--estimate/)
    expect(source).toMatch(/protocolEstimatedDurationLabel/)
    expect(source).toMatch(/protocolRecordedDurationLabel/)
  })

  it('defaults step detail disclosure to auto and passes it through to the step field', () => {
    expect(source).toMatch(/stepDetailDisplay\?: AimdStepDetailDisplay/)
    expect(source).toMatch(/stepDetailDisplay: "auto"/)
    expect(source).toMatch(/detailDisplay: props\.stepDetailDisplay/)
  })

  it('normalizes grouped step body nodes so grouped content does not re-render the step header inside its own body', () => {
    expect(source).toMatch(/function normalizeStepBodyNodes\(bodyNodes: VNodeChild\[] = \[]\): VNodeChild\[]/)
    expect(source).toMatch(/const groupedBody = bodyNodes\.find\(\(child\) => isGroupedStepBodyNode\(child\)\)/)
    expect(source).toMatch(/bodyNodes: normalizedBodyNodes/)
  })

  it('rebuilds inline quiz nodes when quizGrades change so grading feedback can update reactively', () => {
    expect(source).toMatch(/watch\(\s*\(\) => props\.quizGrades,\s*\(\) => \{\s*scheduleInlineRebuild\(\)\s*\},\s*\{ deep: true \},\s*\)/)
  })

  it('passes choice option explanation display mode through to quiz widgets', () => {
    expect(source).toMatch(/choiceOptionExplanationMode\?: AimdChoiceOptionExplanationMode/)
    expect(source).toMatch(/choiceOptionExplanationMode: "hidden"/)
    expect(source).toMatch(/choiceOptionExplanationMode: props\.choiceOptionExplanationMode/)
    expect(source).toMatch(/watch\(\s*\(\) => props\.choiceOptionExplanationMode,\s*\(\) => \{\s*scheduleInlineRebuild\(\)\s*\},\s*\)/)
  })

  it('passes submission state through to quiz widgets so explanation visibility can switch after submit', () => {
    expect(source).toMatch(/submitted\?: boolean/)
    expect(source).toMatch(/submitted: false/)
    expect(source).toMatch(/submitted: props\.submitted/)
    expect(source).toMatch(/watch\(\s*\(\) => props\.submitted,\s*\(\) => \{\s*scheduleInlineRebuild\(\)\s*\},\s*\)/)
  })
})
