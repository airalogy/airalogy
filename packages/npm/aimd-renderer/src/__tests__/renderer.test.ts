import { describe, expect, it } from 'vitest'

import { resolveQuizPreviewOptions } from '../common/quiz-preview'
import {
  createCustomElementAimdRenderer,
  parseAndExtract,
  renderToHtmlSync,
  renderToVue,
  createRenderer,
} from '../common/processor'
import { getFinalIndent, parseFieldTag } from '../index'
import { createStepCardRenderer } from '../vue/vue-renderer'

function findVNodeByType(node: any, expectedType: string): any | null {
  if (!node || typeof node !== 'object') {
    return null
  }

  if (node.type === expectedType) {
    return node
  }

  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.component?.subTree?.children)
      ? node.component.subTree.children
      : []

  for (const child of children) {
    const match = findVNodeByType(child, expectedType)
    if (match) {
      return match
    }
  }

  return null
}

function collectVNodeText(node: any): string {
  if (node == null) {
    return ''
  }

  if (typeof node === 'string') {
    return node
  }

  if (Array.isArray(node)) {
    return node.map((item) => collectVNodeText(item)).join(' ')
  }

  if (typeof node === 'object') {
    return collectVNodeText(node.children)
  }

  return ''
}

// ---------------------------------------------------------------------------
// resolveQuizPreviewOptions
// ---------------------------------------------------------------------------

describe('resolveQuizPreviewOptions', () => {
  it('defaults to hidden in preview mode', () => {
    const result = resolveQuizPreviewOptions('preview')
    expect(result.showAnswers).toBe(false)
    expect(result.showRubric).toBe(false)
  })

  it('defaults to revealed in report mode', () => {
    const result = resolveQuizPreviewOptions('report')
    expect(result.showAnswers).toBe(true)
    expect(result.showRubric).toBe(true)
  })

  it('normalizes timeline to preview', () => {
    const result = resolveQuizPreviewOptions('timeline')
    expect(result.showAnswers).toBe(false)
    expect(result.showRubric).toBe(false)
  })

  it('respects explicit overrides', () => {
    const result = resolveQuizPreviewOptions('preview', {
      showAnswers: true,
      showRubric: false,
    })
    expect(result.showAnswers).toBe(true)
    expect(result.showRubric).toBe(false)
  })

  it('overrides report defaults', () => {
    const result = resolveQuizPreviewOptions('report', {
      showAnswers: false,
    })
    expect(result.showAnswers).toBe(false)
    expect(result.showRubric).toBe(true)
  })

  it('handles unknown modes as non-report', () => {
    const result = resolveQuizPreviewOptions('unknown')
    expect(result.showAnswers).toBe(false)
    expect(result.showRubric).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseAndExtract
// ---------------------------------------------------------------------------

describe('parseAndExtract', () => {
  it('extracts var fields', () => {
    const fields = parseAndExtract('{{var|temperature: float = 36.5, gt = 0}}')
    expect(fields.var).toContain('temperature')
    expect(fields.var_definitions?.[0]).toMatchObject({
      id: 'temperature',
      type: 'float',
      default: 36.5,
      kwargs: {
        gt: 0,
      },
    })
  })

  it('extracts step fields', () => {
    const fields = parseAndExtract('{{step|wash_hands}}')
    expect(fields.step.length).toBeGreaterThan(0)
  })

  it('extracts check fields', () => {
    const fields = parseAndExtract('{{check|verify_result}}')
    expect(fields.check.length).toBeGreaterThan(0)
  })

  it('returns empty fields for plain markdown', () => {
    const fields = parseAndExtract('# Hello World\n\nJust some text.')
    expect(fields.var).toHaveLength(0)
    expect(fields.step).toHaveLength(0)
    expect(fields.quiz).toHaveLength(0)
  })

  it('extracts multiple fields from mixed content', () => {
    const content = [
      '{{var|name: str = "Alice"}}',
      '{{var|age: int = 25}}',
      '{{step|step1}}',
    ].join('\n\n')
    const fields = parseAndExtract(content)
    expect(fields.var).toContain('name')
    expect(fields.var).toContain('age')
    expect(fields.step.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// renderToHtmlSync
// ---------------------------------------------------------------------------

describe('renderToHtmlSync', () => {
  it('renders plain markdown to HTML', () => {
    const { html } = renderToHtmlSync('# Hello')
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })

  it('renders AIMD var fields', () => {
    const { html, fields } = renderToHtmlSync('{{var|temperature}}')
    expect(fields.var).toContain('temperature')
    expect(html).toContain('temperature')
  })

  it('renders AIMD var field display metadata', () => {
    const { html, fields } = renderToHtmlSync('{{var|record_date: str, title="Record date", description="ISO date", examples=["2026-05-26", "2026-05-27"]}}')
    expect(fields.var_definitions?.[0]?.title).toBe('Record date')
    expect(fields.var_definitions?.[0]?.description).toBe('ISO date')
    expect(fields.var_definitions?.[0]?.examples).toEqual(['2026-05-26', '2026-05-27'])
    expect(html).toContain('data-aimd-title="Record date"')
    expect(html).toContain('data-aimd-description="ISO date"')
    expect(html).toContain('data-aimd-examples="2026-05-26, 2026-05-27"')
    expect(html).toContain('Record date')
    expect(html).toContain('record_date')
    expect(html).toContain('ISO date')
    expect(html).toContain('aria-label="ISO date')
    expect(html).not.toContain('title="ISO date')
    expect(html).not.toContain('aimd-field__description')
    expect(html).toContain('aimd-field__metadata-popover')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('2026-05-26')
  })

  it('renders AIMD var_table and column display metadata', () => {
    const { html, fields } = renderToHtmlSync('{{var_table|samples, title="Samples", description="Measured rows", examples=["S-001 row"], subvars=[var(sample_id: str, title="Sample ID", description="Tube identifier", examples=["S-001"])]}}')
    expect(fields.var_table[0]?.title).toBe('Samples')
    expect(fields.var_table[0]?.description).toBe('Measured rows')
    expect(fields.var_table[0]?.examples).toEqual(['S-001 row'])
    expect(fields.var_table[0]?.subvars[0]?.title).toBe('Sample ID')
    expect(fields.var_table[0]?.subvars[0]?.examples).toEqual(['S-001'])
    expect(html).toContain('Samples')
    expect(html).toContain('samples')
    expect(html).toContain('Measured rows')
    expect(html).toContain('S-001 row')
    expect(html).toContain('data-column-id="sample_id"')
    expect(html).toContain('Sample ID')
    expect(html).toContain('Tube identifier')
    expect(html).toContain('aria-label="Measured rows')
    expect(html).toContain('aria-label="Tube identifier')
    expect(html).not.toContain('title="Measured rows')
    expect(html).not.toContain('title="Tube identifier')
    expect(html).not.toContain('aimd-field__description')
    expect(html).toContain('aimd-field__metadata-popover')
    expect(html).toContain('S-001')
  })

  it('returns extracted fields alongside HTML', () => {
    const { fields } = renderToHtmlSync('{{step|wash}} and {{check|verify}}')
    expect(fields.step.length).toBeGreaterThan(0)
    expect(fields.check.length).toBeGreaterThan(0)
  })

  it('renders GFM tables', () => {
    const content = '| A | B |\n|---|---|\n| 1 | 2 |'
    const { html } = renderToHtmlSync(content)
    expect(html).toContain('<table')
    expect(html).toContain('<td')
  })

  it('renders true/false quiz options and report answers', () => {
    const { html, fields } = renderToHtmlSync(
      [
        '```quiz',
        'id: q_true_false',
        'type: true_false',
        'stem: "The sample stayed cold."',
        'answer: true',
        '```',
      ].join('\n'),
      { mode: 'report' },
    )

    expect(fields.quiz[0].type).toBe('true_false')
    expect(html).toContain('True/false')
    expect(html).toContain('true. True')
    expect(html).toContain('false. False')
    expect(html).toContain('Answer: true')
  })

  it('extracts true/false option followups', () => {
    const { fields } = renderToHtmlSync(
      [
        '```quiz',
        'id: q_true_false_followups',
        'type: true_false',
        'stem: "Was precipitate observed?"',
        'options:',
        '  - key: true',
        '    text: "Yes"',
        '    followups:',
        '      - key: color',
        '        type: str',
        '        title: Color',
        '  - key: false',
        '    text: "No"',
        '```',
      ].join('\n'),
    )

    expect(fields.quiz[0].options?.[0]?.followups).toEqual([
      { key: 'color', type: 'str', required: true, title: 'Color' },
    ])
  })

  it('supports host custom element renderers for AIMD nodes', () => {
    const { html } = renderToHtmlSync(
      "{{step|verify, 2, title='Verify Output', subtitle='Cross-check', check=True, result=True}}\n\nStep body content.",
      {
        groupStepBodies: true,
        aimdElementRenderers: {
          step: createCustomElementAimdRenderer('step-card', (node) => {
            const stepNode = node as any
            return {
              'step-id': stepNode.id,
              'step-number': stepNode.step,
              title: stepNode.title,
              subtitle: stepNode.subtitle,
              level: String(stepNode.level),
              'has-check': stepNode.check ? 'true' : undefined,
              'is-result': stepNode.result ? 'true' : undefined,
            }
          }, {
            container: true,
            stripDefaultChildren: true,
          }),
        },
      },
    )

    expect(html).toContain('<step-card')
    expect(html).toContain('step-id="verify"')
    expect(html).toContain('step-number="1"')
    expect(html).toContain('title="Verify Output"')
    expect(html).toContain('subtitle="Cross-check"')
    expect(html).toContain('has-check="true"')
    expect(html).toContain('is-result="true"')
    expect(html).toContain('data-aimd-step-body="true"')
    expect(html).toContain('Step body content.')
  })

  it('stops grouped step bodies at headings and dividers', () => {
    const { html } = renderToHtmlSync(
      [
        '## Section',
        '',
        "{{step|step1, title='Step One'}}",
        '',
        'Body one.',
        '',
        '---',
        '',
        '## Next',
        '',
        '{{step|step2}}',
        '',
        'Body two.',
      ].join('\n'),
      {
        groupStepBodies: true,
        aimdElementRenderers: {
          step: createCustomElementAimdRenderer('step-card', (node) => ({
            'step-id': node.id,
            'step-number': (node as any).step,
            title: (node as any).title || node.id,
          }), {
            container: true,
            stripDefaultChildren: true,
          }),
        },
      },
    )

    expect(html).toContain('<h2>Section</h2>')
    expect(html).toContain('<hr>')
    expect(html).toContain('<h2>Next</h2>')
    expect(html).toContain('step-id="step1"')
    expect(html).toContain('step-id="step2"')
    expect(html).toContain('Body one.')
    expect(html).toContain('Body two.')
    expect(html.indexOf('Body one.')).toBeLessThan(html.indexOf('<hr>'))
    expect(html.indexOf('<hr>')).toBeLessThan(html.indexOf('step-id="step2"'))
  })

  it('can lift block-style var types out of inline paragraphs', () => {
    const { html } = renderToHtmlSync(
      'Experiment summary: {{var|summary: AiralogyMarkdown}}',
      { blockVarTypes: ['AiralogyMarkdown'] },
    )

    expect(html).toContain('<p>Experiment summary: </p>')
    expect(html).toContain('<div class="aimd-field aimd-field--var aimd-block-var"')
    expect(html).not.toContain('<p>Experiment summary: <span')
  })

  it('can lift block-style var types out of tight list items', () => {
    const { html } = renderToHtmlSync(
      '- Experiment summary: {{var|summary: AiralogyMarkdown}}',
      { blockVarTypes: ['AiralogyMarkdown'] },
    )

    expect(html).toContain('<li><p>Experiment summary: </p><div class="aimd-field aimd-field--var aimd-block-var"')
    expect(html).not.toContain('<li>Experiment summary: <span')
  })
})

describe('renderToVue', () => {
  it('renders host-ready step cards with grouped body content', async () => {
    const { nodes } = await renderToVue(
      "{{step|verify, 2, title='Verify Output', subtitle='Cross-check', check=True}}\n\nStep body content.",
      {
        groupStepBodies: true,
        aimdRenderers: {
          step: createStepCardRenderer(),
        },
      },
    )

    expect(nodes).toHaveLength(1)
    const card = findVNodeByType(nodes[0], 'article') as any
    expect(card).toBeTruthy()
    expect(card.props.class).toContain('aimd-step-card')
    expect(card.props['data-aimd-step-id']).toBe('verify')
    const header = card.children[0] as any
    const leftCluster = header.children[0] as any
    const contentStack = leftCluster.children[1] as any
    expect(contentStack.children[1].children).toBe('Verify Output')
    expect(contentStack.children[2].children).toBe('Cross-check')
    const body = card.children[1] as any
    expect(body.props.class).toContain('aimd-step-card__body')
    expect(collectVNodeText(body)).toContain('Step body content.')
  })

  it('groups inline check body copy into the check renderer when enabled', async () => {
    const { nodes } = await renderToVue(
      '{{check|measurement_complete, checked_message="量子测量完成"}} 确认所有孔位的量子共振值已记录完毕。',
      {
        groupCheckBodies: true,
        aimdRenderers: {
          check: (node, _ctx, children) => ({
            type: 'section',
            props: { 'data-test-check-id': node.id },
            children,
          }) as any,
        },
      },
    )

    expect(nodes).toHaveLength(1)
    const card = findVNodeByType(nodes[0], 'section') as any
    expect(card).toBeTruthy()
    expect(card.props['data-test-check-id']).toBe('measurement_complete')
    expect(collectVNodeText(card)).toContain('确认所有孔位的量子共振值已记录完毕')
    expect(collectVNodeText(card)).not.toContain('measurement_complete')
  })
})

// ---------------------------------------------------------------------------
// createRenderer
// ---------------------------------------------------------------------------

describe('createRenderer', () => {
  it('creates a reusable renderer', () => {
    const renderer = createRenderer()
    expect(renderer).toHaveProperty('toHtml')
    expect(renderer).toHaveProperty('toVue')
    expect(renderer).toHaveProperty('extractFields')
  })

  it('renderer.extractFields works', () => {
    const renderer = createRenderer()
    const fields = renderer.extractFields('{{var|x}}')
    expect(fields.var).toContain('x')
  })
})

// ---------------------------------------------------------------------------
// getFinalIndent
// ---------------------------------------------------------------------------

describe('getFinalIndent', () => {
  it('returns simple index for level 1', () => {
    expect(getFinalIndent({ sequence: 0, level: 1 })).toBe('1')
    expect(getFinalIndent({ sequence: 4, level: 1 })).toBe('5')
  })

  it('builds hierarchical indent from parent chain', () => {
    const parent = { sequence: 0, level: 1, parent: undefined }
    expect(getFinalIndent({ parent, sequence: 1, level: 2 })).toBe('1.2')
  })

  it('handles deeply nested parents', () => {
    const grandparent = { sequence: 0, level: 1, parent: undefined }
    const parent = { sequence: 2, level: 2, parent: grandparent }
    expect(getFinalIndent({ parent, sequence: 0, level: 3 })).toBe('1.3.1')
  })
})

// ---------------------------------------------------------------------------
// parseFieldTag
// ---------------------------------------------------------------------------

describe('parseFieldTag', () => {
  it('parses simple var tag', () => {
    const result = parseFieldTag('var|temperature')
    expect(result).toEqual([{ type: 'var', name: 'temperature' }])
  })

  it('parses step tag', () => {
    const result = parseFieldTag('step|wash_hands')
    expect(result).toEqual([{ type: 'step', name: 'wash_hands' }])
  })

  it('parses var_table tag', () => {
    const result = parseFieldTag('var_table|measurements|col1,col2')
    expect(result[0].type).toBe('var_table')
  })
})
