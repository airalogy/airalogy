// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseAndExtract, renderToHtml } from '@airalogy/aimd-renderer'
import { DEMO_EXAMPLES, getDemoExampleContent } from './sampleContent'

const cases = [
  { id: 'ai-glasses-vinegar-titration', count: 18, tables: ['titrations', 'guidance_events'], timer: 'confirm_endpoint', ms: 30_000 },
  { id: 'ai-glasses-leaf-disk-photosynthesis', count: 19, tables: ['cup_setup', 'observations', 'endpoints', 'et50_results', 'guidance_events'], timer: 'vacuum_infiltrate', ms: 10_000 },
]

describe('AI glasses protocol examples', () => {
  it.each(cases)('loads and renders the complete $id procedure', async ({ id, count, tables, timer, ms }) => {
    const example = DEMO_EXAMPLES.find(item => item.id === id)
    expect(example).toMatchObject({ kind: 'protocol', locales: ['zh-CN'] })
    const content = getDemoExampleContent(example!, 'zh-CN')
    const fields = parseAndExtract(content)
    expect(fields.step).toHaveLength(count)
    expect(new Set(fields.step).size).toBe(count)
    expect(new Set(fields.check).size).toBe(fields.check.length)
    expect(fields.check).toContain('safety_ready')
    expect(fields.check).toContain('cleanup_confirmed')
    expect(fields.var_table.map(table => table.id)).toEqual(tables)
    const reviewTable = fields.var_table.find(table => table.id === (id.endsWith('titration') ? 'titrations' : 'endpoints'))
    expect(reviewTable?.subvars?.find(field => field.id === 'accepted')?.enum).toEqual(['纳入', '排除'])
    for (const ref of fields.ref_step) expect(fields.step).toContain(ref)
    expect(fields.step_hierarchy).toContainEqual(expect.objectContaining({ id: timer, estimated_duration_ms: ms, timer_mode: 'both' }))
    for (const field of fields.var_definitions ?? []) {
      if (['run_id', 'run_mode', 'run_status', 'operator'].includes(field.id)) expect(field.default).toBeUndefined()
    }
    const { html } = await renderToHtml(content, { locale: 'zh-CN' })
    const rendered = document.createElement('div')
    rendered.innerHTML = html
    expect(rendered.textContent).toContain('AI 眼镜实验指导')
    expect(rendered.querySelectorAll('[data-aimd-type="step"]')).toHaveLength(count)
    expect(rendered.querySelectorAll('.aimd-step__title')).toHaveLength(count)
    expect(content).not.toMatch(/^## \d+\./m)
    expect(rendered.querySelector('strong')?.textContent).toBe('操作：')
    for (const token of ['{{step|', '{{var|', '{{check|', '{{ref_step|']) {
      expect(rendered.textContent).not.toContain(token)
    }
  })
})
