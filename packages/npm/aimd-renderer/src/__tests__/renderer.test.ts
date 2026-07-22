import { existsSync, readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { resolveQuizPreviewOptions } from '../common/quiz-preview'
import {
  createCustomElementAimdRenderer,
  parseAndExtract,
  renderToHtmlSync,
  renderToVue,
  createRenderer,
} from '../common/processor'
import { getFinalIndent, parseFieldTag } from '../index'
import { createAimdRendererMessages } from '../locales'
import {
  AimdMarkdownPreview,
  AimdRecordCompare,
  AimdRecordReport,
  AimdRecordTable,
  createReadonlyRecordRenderContext,
  normalizeRecordRenderValue,
  renderReadonlyRecordToVue,
} from '../vue'
import { createCodeBlockRenderer, createStepCardRenderer, renderDefaultAimdNode } from '../vue/vue-renderer'

const rendererStylesPath = existsSync('src/styles/renderer.css')
  ? 'src/styles/renderer.css'
  : 'packages/npm/aimd-renderer/src/styles/renderer.css'
const rendererStyles = readFileSync(rendererStylesPath, 'utf8')

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

function findVNodeByClass(node: any, expectedClass: string): any | null {
  if (!node || typeof node !== 'object') {
    return null
  }

  const className = node.props?.class
  const classes = Array.isArray(className)
    ? className
    : typeof className === 'string'
      ? className.split(/\s+/)
      : []
  if (classes.includes(expectedClass)) {
    return node
  }

  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.component?.subTree?.children)
      ? node.component.subTree.children
      : []

  for (const child of children) {
    const match = findVNodeByClass(child, expectedClass)
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

const WORKFLOW_AIMD = [
  '# Workflow Example',
  '',
  '```workflow',
  'version: airalogy.workflow.v1',
  'id: analysis_workflow',
  'title: Analysis Workflow',
  'description: Builds analysis inputs from measurement and literature records.',
  '',
  'nodes:',
  '  - id: measurement',
  '    protocol: ./measurement/protocol.aimd',
  '    title: Measurement',
  '  - id: literature_review',
  '    protocol: ./literature-review/protocol.aimd',
  '    title: Literature Review',
  '  - id: analysis',
  '    protocol: ./analysis/protocol.aimd',
  '    title: Analysis',
  '',
  'assigners:',
  '  - id: build_analysis_inputs',
  '    runtime: python',
  '    entrypoint: ./assigners/build_analysis_inputs.py:assign',
  '    outputs:',
  '      raw_data_summary: str',
  '      background_summary: str',
  '',
  'transitions:',
  '  - id: prepare_analysis_inputs',
  '    from:',
  '      - measurement',
  '      - literature_review',
  '    to:',
  '      - analysis',
  '    run: build_analysis_inputs',
  '    inputs:',
  '      raw_data: ${measurement.var.raw_data}',
  '      background_summary: ${literature_review.var.summary}',
  '    assign:',
  '      analysis:',
  '        var.raw_data_summary: ${prepare_analysis_inputs.outputs.raw_data_summary}',
  '        var.background_summary: ${prepare_analysis_inputs.outputs.background_summary}',
  '',
  'logic: |',
  '  Use one workflow-level assigner to join multiple upstream Protocol Records.',
  'default_initial_node: measurement',
  '```',
].join('\n')

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
    expect(fields.workflow).toHaveLength(0)
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

  it('extracts multiline var tables with object-list defaults', () => {
    const content = `{{var|monitoring_sites: list[MonitoringSite] = [
      {"site_id": "S01", "latitude": 30.0, "longitude": 120.0, "elevation_m": 128.0},
      {"site_id": "S02", "latitude": 30.1, "longitude": 120.1, "elevation_m": 82.0}
    ],
    title = "Monitoring sites",
    subvars = [
      var(site_id: str, title = "Site ID"),
      var(latitude: float, title = "Latitude"),
      var(longitude: float, title = "Longitude"),
      var(elevation_m: float, title = "Elevation")
    ]
  }}`
    const fields = parseAndExtract(content)

    expect(fields.var_table[0]).toMatchObject({
      id: 'monitoring_sites',
      title: 'Monitoring sites',
      type_annotation: 'list[MonitoringSite]',
      default: [
        { site_id: 'S01', latitude: 30, longitude: 120, elevation_m: 128 },
        { site_id: 'S02', latitude: 30.1, longitude: 120.1, elevation_m: 82 },
      ],
    })
    expect(fields.var_table[0]?.subvars.map(subvar => subvar.id)).toEqual([
      'site_id',
      'latitude',
      'longitude',
      'elevation_m',
    ])
  })

  it('extracts workflow definitions', () => {
    const fields = parseAndExtract(WORKFLOW_AIMD)
    expect(fields.workflow).toHaveLength(1)
    expect(fields.workflow?.[0]).toMatchObject({
      id: 'analysis_workflow',
      version: 'airalogy.workflow.v1',
      default_initial_node: 'measurement',
    })
    expect(fields.workflow?.[0]?.transitions[0]).toMatchObject({
      id: 'prepare_analysis_inputs',
      from: ['measurement', 'literature_review'],
      to: ['analysis'],
      run: 'build_analysis_inputs',
      assign: {
        analysis: {
          'var.raw_data_summary': '${prepare_analysis_inputs.outputs.raw_data_summary}',
          'var.background_summary': '${prepare_analysis_inputs.outputs.background_summary}',
        },
      },
    })
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

  it('renders CriticMarkup review marks to semantic HTML', () => {
    const { html } = renderToHtmlSync('Add {++new++}, delete {--old--}, replace {~~old~>new~~}, comment {>>check units<<}, highlight {==important==}.')

    expect(html).toContain('<ins class="aimd-critic aimd-critic--addition"')
    expect(html).toContain('data-critic-kind="addition"')
    expect(html).toContain('<del class="aimd-critic aimd-critic--deletion"')
    expect(html).toContain('data-critic-kind="deletion"')
    expect(html).toContain('<span class="aimd-critic aimd-critic--substitution"')
    expect(html).toContain('aimd-critic--substitution-old')
    expect(html).toContain('aimd-critic--substitution-new')
    expect(html).toContain('<span class="aimd-critic aimd-critic--comment"')
    expect(html).toContain('check units')
    expect(html).toContain('<mark class="aimd-critic aimd-critic--highlight"')
    expect(html).toContain('important')
    expect(html).not.toContain('{++new++}')
    expect(html).not.toContain('{--old--}')
    expect(html).not.toContain('{~~old~>new~~}')
    expect(html).not.toContain('{>>check units<<}')
    expect(html).not.toContain('{==important==}')
  })

  it('does not parse CriticMarkup inside inline code', () => {
    const { html } = renderToHtmlSync('Literal `{++not a mark++}` and `{~~old~>new~~}` remain code.')

    expect(html).toContain('<code>{++not a mark++}</code>')
    expect(html).toContain('<code>{~~old~>new~~}</code>')
    expect(html).not.toContain('aimd-critic--addition')
    expect(html).not.toContain('aimd-critic--substitution')
  })

  it('renders AIMD var fields', () => {
    const { html, fields } = renderToHtmlSync('{{var|temperature}}')
    expect(fields.var).toContain('temperature')
    expect(html).toContain('temperature')
  })

  it('renders workflow blocks as structured UI instead of raw code', () => {
    const { html, fields } = renderToHtmlSync(WORKFLOW_AIMD)

    expect(fields.workflow?.[0]?.id).toBe('analysis_workflow')
    expect(html).toContain('class="aimd-workflow"')
    expect(html).toContain('data-aimd-workflow-id="analysis_workflow"')
    expect(html).toContain('Analysis Workflow')
    expect(html).toContain('prepare_analysis_inputs')
    expect(html).toContain('build_analysis_inputs')
    expect(html).toContain('var.raw_data_summary')
    expect(html).not.toContain('class="language-workflow"')
  })

  it('renders workflow run state when provided by the host', () => {
    const { html } = renderToHtmlSync(WORKFLOW_AIMD, {
      workflowRuns: {
        analysis_workflow: {
          records: {
            measurement: { data: { var: { raw_data: [1, 2, 3] } } },
            analysis: { data: { var: { raw_data_summary: 'n=3' } } },
          },
          node_iterations: { analysis: 1 },
          executed_transitions: [{ id: 'prepare_analysis_inputs' }],
          transition_outputs: {
            prepare_analysis_inputs: {
              raw_data_summary: 'n=3',
              background_summary: 'PRIOR CONTEXT',
            },
          },
          attempts: [{
            transition: 'prepare_analysis_inputs',
            assigner: 'build_analysis_inputs',
            status: 'succeeded',
          }],
        },
      },
    })

    expect(html).toContain('2 records')
    expect(html).toContain('executed')
    expect(html).toContain('iteration 1')
    expect(html).toContain('n=3')
    expect(html).toContain('PRIOR CONTEXT')
  })

  it('resolves figure asset URLs during HTML rendering', () => {
    const seenContexts: Array<{ src: string, kind: string, id?: string, title?: string }> = []
    const { html } = renderToHtmlSync([
      '```fig',
      'id: workflow_diagram',
      'src: files/workflow-diagram.svg',
      'title: Workflow Diagram',
      '```',
    ].join('\n'), {
      resolveAssetUrl: (src, context) => {
        seenContexts.push({ src, ...context })
        return `/assets/${src.split('/').pop()}`
      },
    })

    expect(seenContexts).toEqual([{
      src: 'files/workflow-diagram.svg',
      kind: 'fig',
      id: 'workflow_diagram',
      title: 'Workflow Diagram',
    }])
    expect(html).toContain('src="/assets/workflow-diagram.svg"')
  })

  it('renders media blocks with resolved assets and default pin controls during HTML rendering', () => {
    const seenContexts: Array<{ src: string, kind: string, id?: string, mediaKind?: string }> = []
    const { html, fields } = renderToHtmlSync([
      'Watch {{ref_media|lecture_demo}} while reading.',
      '',
      '```media',
      'id: lecture_demo',
      'kind: video',
      'src: files/videos/demo.mp4',
      'mime: video/mp4',
      'poster: files/images/demo-poster.png',
      'title: Lecture Demo',
      'legend: Watch this while reading the following section.',
      '```',
    ].join('\n'), {
      resolveAssetUrl: (src, context) => {
        seenContexts.push({ src, ...context })
        return `/assets/${src.split('/').pop()}`
      },
    })

    expect(fields.ref_media).toEqual(['lecture_demo'])
    expect(fields.media?.[0]).toMatchObject({
      id: 'lecture_demo',
      kind: 'video',
      src: 'files/videos/demo.mp4',
      poster: 'files/images/demo-poster.png',
    })
    expect(seenContexts).toEqual([
      {
        src: 'files/videos/demo.mp4',
        kind: 'media',
        id: 'lecture_demo',
        title: 'Lecture Demo',
        mediaKind: 'video',
      },
      {
        src: 'files/images/demo-poster.png',
        kind: 'media_poster',
        id: 'lecture_demo',
        title: 'Lecture Demo',
        mediaKind: 'video',
      },
    ])
    expect(html).toContain('<span class="aimd-ref aimd-ref--media"')
    expect(html).toContain('data-aimd-ref-kind="media"')
    expect(html).toContain('<figure class="aimd-media')
    expect(html).toContain('src="/assets/demo.mp4"')
    expect(html).toContain('poster="/assets/demo-poster.png"')
    expect(html).toContain('Video 1')
    expect(html).toContain('Video 1: Lecture Demo')
    expect(html).toContain('data-aimd-media-pin="lecture_demo"')
    expect(html).toContain('data-aimd-media-size="medium"')
    expect(html).toContain('data-aimd-media-legend="expanded"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('data-aimd-media-unpin-label="Unpin"')
    expect(html).toContain('class="aimd-media__actions"')
    expect(html).toContain('data-aimd-media-legend-toggle="lecture_demo"')
    expect(html).toContain('data-aimd-media-show-legend-label="Details"')
    expect(html).toContain('data-aimd-media-size-controls="lecture_demo"')
    expect(html).toContain('data-aimd-media-size-option="small"')
    expect(html).toContain('aria-label="Medium pinned size"')
  })

  it('renders provider videos as iframe players while keeping video numbering', () => {
    const { html, fields } = renderToHtmlSync([
      'Watch {{ref_media|youtube_demo}} while reading.',
      '',
      '```media',
      'id: youtube_demo',
      'kind: video',
      'provider: youtube',
      'src: https://www.youtube.com/embed/VIDEO_ID',
      'title: YouTube Demo',
      '```',
    ].join('\n'))

    expect(fields.media?.[0]).toMatchObject({
      id: 'youtube_demo',
      kind: 'video',
      provider: 'youtube',
      src: 'https://www.youtube.com/embed/VIDEO_ID',
    })
    expect(html).toContain('<iframe')
    expect(html).toContain('class="aimd-media__embed"')
    expect(html).toContain('src="https://www.youtube.com/embed/VIDEO_ID"')
    expect(html).toContain('data-aimd-media-kind="video"')
    expect(html).toContain('data-aimd-media-provider="youtube"')
    expect(html).toContain('Video 1')
    expect(html).toContain('Video 1: YouTube Demo')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('Embed 1')
  })

  it('numbers media references by concrete media kind during HTML rendering', () => {
    const { html } = renderToHtmlSync([
      '先看 {{ref_media|intro_video}}，再听 {{ref_media|narration_audio}}，最后看 {{ref_media|demo_video}}。',
      '',
      '```media',
      'id: intro_video',
      'kind: video',
      'src: files/videos/intro.mp4',
      'title: 介绍视频',
      '```',
      '',
      '```media',
      'id: narration_audio',
      'kind: audio',
      'src: files/audio/narration.mp3',
      'title: 讲解音频',
      '```',
      '',
      '```media',
      'id: demo_video',
      'kind: video',
      'src: files/videos/demo.mp4',
      'title: 演示视频',
      '```',
    ].join('\n'), {
      locale: 'zh-CN',
    })

    expect(html).toContain('视频 1')
    expect(html).toContain('视频 1：介绍视频')
    expect(html).toContain('音频 1')
    expect(html).toContain('音频 1：讲解音频')
    expect(html).toContain('视频 2')
    expect(html).toContain('视频 2：演示视频')
    expect(html).toContain('type="video/mp4"')
    expect(html).toContain('type="audio/mpeg"')
    expect(html).not.toContain('媒体 1')
  })

  it('renders internal references without route-breaking bare hash hrefs', () => {
    const { html } = renderToHtmlSync([
      'As shown in {{ref_fig|workflow_diagram}}, follow {{ref_step|prepare_sample}}.',
      '',
      '```fig',
      'id: workflow_diagram',
      'src: files/workflow-diagram.svg',
      'title: Workflow Diagram',
      '```',
      '',
      '{{step|prepare_sample}}',
    ].join('\n'))

    expect(html).not.toContain('href="#fig-workflow_diagram"')
    expect(html).not.toContain('href="#step-prepare_sample"')
    expect(html).toContain('<span class="aimd-ref aimd-ref--fig"')
    expect(html).toContain('data-aimd-ref-target="workflow_diagram"')
    expect(html).toContain('data-aimd-ref-kind="fig"')
    expect(html).toContain('<span class="aimd-ref aimd-ref--step"')
    expect(html).toContain('data-aimd-ref-target="prepare_sample"')
    expect(html).toContain('data-aimd-ref-kind="step"')
  })

  it('styles rendered figures as attached image-caption blocks', () => {
    expect(rendererStyles).toMatch(/\.aimd-figure \{[\s\S]*?width: fit-content;/)
    expect(rendererStyles).toMatch(/\.aimd-figure \{[\s\S]*?overflow: hidden;/)
    expect(rendererStyles).not.toContain('box-shadow: 0 10px 28px')
    expect(rendererStyles).toMatch(/\.aimd-figure__caption \{[\s\S]*?border-top: 1px solid #d8e2ef;/)
    expect(rendererStyles).toMatch(/\.aimd-figure__legend \{[\s\S]*?margin: 4px 0 0;/)
  })

  it('styles rendered Markdown prose inside the renderer container', () => {
    expect(rendererStyles).toMatch(/\.aimd-renderer \{[\s\S]*?line-height: 1\.56;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(h1\) \{[\s\S]*?font-size: 2em;[\s\S]*?line-height: 1\.12;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(h2\) \{[\s\S]*?font-size: 1\.38em;[\s\S]*?line-height: 1\.18;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(h3\) \{[\s\S]*?font-size: 1\.08em;[\s\S]*?line-height: 1\.24;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(ul\) \{[\s\S]*?list-style: disc outside;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(ol\) \{[\s\S]*?list-style: decimal outside;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(li\) \{[\s\S]*?line-height: 1\.48;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(a\) \{[\s\S]*?color: #0969da;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(blockquote\) \{[\s\S]*?border-left: 4px solid #d0d7de;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(table:not\(\[class\*="aimd-"\]\)\) \{[\s\S]*?overflow-x: auto;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(table:not\(\[class\*="aimd-"\]\) th, table:not\(\[class\*="aimd-"\]\) td\) \{[\s\S]*?border: 1px solid #d8dee8;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(pre:not\(\[class\*="aimd-"\]\)\) \{[\s\S]*?white-space: pre;/)
    expect(rendererStyles).toMatch(/\.aimd-renderer :where\(code:not\(pre code\)\) \{[\s\S]*?background: rgba\(175, 184, 193, 0\.2\);/)
    expect(rendererStyles).toMatch(/\.aimd-renderer li::marker \{[\s\S]*?color: #64748b;/)
  })

  it('styles rendered media as contained media-caption blocks', () => {
    expect(rendererStyles).toMatch(/\.aimd-media \{[\s\S]*?width: min\(100%, 920px\);/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned \{[\s\S]*?position: sticky;/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned \{[\s\S]*?margin-top: 0;/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned\[data-aimd-media-size="small"\] \{[\s\S]*?--aimd-media-pinned-small-width/)
    expect(rendererStyles).toMatch(/\.aimd-media__video,[\s\S]*?\.aimd-media__embed \{[\s\S]*?aspect-ratio: 16 \/ 9;/)
    expect(rendererStyles).toMatch(/\.aimd-media__caption \{[\s\S]*?border-top: 1px solid #d8e2ef;/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned\[data-aimd-media-legend="collapsed"\] \.aimd-media__legend \{[\s\S]*?display: none;/)
    expect(rendererStyles).toMatch(/\.aimd-media__actions \{[\s\S]*?margin-left: auto;/)
    expect(rendererStyles).toMatch(/\.aimd-media__legend-toggle \{[\s\S]*?display: none;/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned \.aimd-media__legend-toggle \{[\s\S]*?display: inline-flex;/)
    expect(rendererStyles).toMatch(/\.aimd-media__size-controls \{[\s\S]*?display: none;/)
    expect(rendererStyles).toMatch(/\.aimd-media--pinned \.aimd-media__size-controls \{[\s\S]*?display: inline-flex;/)
    expect(rendererStyles).toMatch(/\.aimd-media__pin \{[\s\S]*?cursor: pointer;/)
  })

  it('styles AIMD fields without depending on recorder styles', () => {
    expect(rendererStyles).toMatch(/\.aimd-field \{[\s\S]*?display: inline-flex;/)
    expect(rendererStyles).toMatch(/\.aimd-field \{[\s\S]*?max-width: 100%;/)
    expect(rendererStyles).toMatch(/\.aimd-field \{[\s\S]*?flex-wrap: wrap;/)
    expect(rendererStyles).toMatch(/\.aimd-field--var \{[\s\S]*?background-color: var\(--aimd-var-bg\);/)
    expect(rendererStyles).toMatch(/\.aimd-field__name--with-metadata \{[\s\S]*?flex-direction: column;/)
    expect(rendererStyles).toMatch(/\.aimd-field__title \{[\s\S]*?overflow-wrap: anywhere;/)
    expect(rendererStyles).toMatch(/\.aimd-field--var-table \{[\s\S]*?display: block;/)
    expect(rendererStyles).toMatch(/\.aimd-field--var-table \{[\s\S]*?width: 100%;/)
    expect(rendererStyles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview \{[\s\S]*?table-layout: fixed;/)
    expect(rendererStyles).toMatch(/\.aimd-field--quiz \{[\s\S]*?max-width: 860px;/)
    expect(rendererStyles).toMatch(/\.aimd-field--check \{[\s\S]*?display: inline-flex;/)
    expect(rendererStyles).toMatch(/\.aimd-refs \{[\s\S]*?border-top: 1px solid #d8dee8;/)
  })

  it('styles citation popovers as selectable hoverable content', () => {
    expect(rendererStyles).toContain('.aimd-cite__popover')
    expect(rendererStyles).not.toContain('.aimd-cite__ref::after')
    expect(rendererStyles).toMatch(/\.aimd-cite__popover \{[\s\S]*?pointer-events: none;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__popover \{[\s\S]*?user-select: text;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__popover::before \{[\s\S]*?height: 10px;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__ref:hover \.aimd-cite__popover,[\s\S]*?pointer-events: auto;/)
  })

  it('styles internal references as focusable route-safe targets', () => {
    expect(rendererStyles).toMatch(/\.aimd-ref\[data-aimd-ref-target\] \{[\s\S]*?cursor: pointer;/)
    expect(rendererStyles).toMatch(/\.aimd-ref\[data-aimd-ref-target\]:focus-visible \{[\s\S]*?outline: 2px solid rgba\(25, 118, 210, 0\.36\);/)
  })

  it('renders citation markers with reference tooltips and refs blocks', () => {
    const content = [
      'Cite the method {{cite|yang2025airalogyaiempowereduniversaldata, doe2024protocol}}.',
      '',
      '```refs',
      '@misc{yang2025airalogyaiempowereduniversaldata,',
      '      title={Airalogy: AI-empowered universal data digitization for research automation},',
      '      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},',
      '      year={2025},',
      '      eprint={2506.18586},',
      '      archivePrefix={arXiv},',
      '      primaryClass={cs.AI},',
      '      url={https://arxiv.org/abs/2506.18586},',
      '}',
      '',
      '@misc{doe2024protocol,',
      '  title = "Protocol Notes",',
      '  author = "Doe, Jane",',
      '  year = "2024",',
      '  url = "https://example.com/protocol"',
      '}',
      '```',
    ].join('\n')

    const { html, fields } = renderToHtmlSync(content)

    expect(fields.cite).toEqual(['yang2025airalogyaiempowereduniversaldata', 'doe2024protocol'])
    expect(fields.refs?.[0]).toMatchObject({
      id: 'yang2025airalogyaiempowereduniversaldata',
      entry_type: 'misc',
      title: 'Airalogy: AI-empowered universal data digitization for research automation',
      url: 'https://arxiv.org/abs/2506.18586',
    })
    expect(fields.refs?.[1]).toMatchObject({
      id: 'doe2024protocol',
      url: 'https://example.com/protocol',
    })
    expect(html).not.toContain('href="#ref-yang2025airalogyaiempowereduniversaldata"')
    expect(html).not.toContain('href="#ref-doe2024protocol"')
    expect(html).toContain('role="doc-noteref"')
    expect(html).toContain('data-aimd-ref-id="yang2025airalogyaiempowereduniversaldata"')
    expect(html).toContain('data-aimd-ref-summary="Zijie Yang')
    expect(html).toContain('data-aimd-citation-labels="1,2"')
    expect(html).toContain('<span class="aimd-cite__label">1</span>')
    expect(html).toContain('<span class="aimd-cite__label">2</span>')
    expect(html).toContain('<span class="aimd-cite__popover" role="tooltip">Zijie Yang')
    expect(html).not.toContain('<span class="aimd-cite__label">yang2025airalogyaiempowereduniversaldata</span>')
    expect(html).toContain('<section class="aimd-refs"')
    expect(html).toContain('id="ref-yang2025airalogyaiempowereduniversaldata"')
    expect(html).toContain('Airalogy: AI-empowered universal data digitization for research automation')
    expect(html).toContain('href="https://arxiv.org/abs/2506.18586"')
    expect(html).toContain('href="https://example.com/protocol"')
  })

  it('moves refs blocks to the end of the rendered document', () => {
    const content = [
      '```refs',
      '@misc{doe2024protocol,',
      '  title = "Protocol Notes",',
      '  author = "Doe, Jane",',
      '  year = "2024"',
      '}',
      '```',
      '',
      'The body continues after the refs declaration.',
    ].join('\n')

    const { html } = renderToHtmlSync(content)

    expect(html.indexOf('<p>The body continues after the refs declaration.</p>')).toBeLessThan(html.indexOf('<section class="aimd-refs"'))
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
    expect(html).toContain('aimd-field__metadata-examples')
    expect(html).toContain('aimd-field__metadata-example')
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
    expect(html).toContain('aimd-field__metadata-example')
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
  it('validates isolated Collector fields against protocol metadata', async () => {
    const context = parseAndExtract([
      '```connectors',
      'sensor_gateway:',
      '  kind: data_source',
      '  descriptor: ./sensor.yaml',
      '```',
      '',
      '```collectors',
      'temperature_sensor:',
      '  connector: sensor_gateway',
      '  channel: room.temperature',
      '```',
    ].join('\n'))

    const { fields } = await renderToVue(
      '{{var|temperature: Observation[float] | None, collector="temperature_sensor"}}',
      {
        collectorContext: {
          connectors: context.connectors,
          collectors: context.collectors,
          step: context.step,
        },
      },
    )

    expect(fields.var).toEqual(['temperature'])
    expect(fields.connectors).toEqual([])
    expect(fields.collectors).toEqual([])
  })

  it('renders workflow blocks as Vue nodes', async () => {
    const { nodes, fields } = await renderToVue(WORKFLOW_AIMD)
    const workflowNode = findVNodeByClass({ children: nodes }, 'aimd-workflow') as any

    expect(fields.workflow?.[0]?.id).toBe('analysis_workflow')
    expect(workflowNode).toBeTruthy()
    expect(workflowNode.props['data-aimd-workflow-id']).toBe('analysis_workflow')
    expect(collectVNodeText(workflowNode)).toContain('Analysis Workflow')
    expect(collectVNodeText(workflowNode)).toContain('prepare_analysis_inputs')
  })

  it('renders references as Vue nodes', async () => {
    const { nodes } = await renderToVue(
      [
        'Cite {{cite|yang2025airalogyaiempowereduniversaldata}}.',
        '',
        '```refs',
        '@misc{yang2025airalogyaiempowereduniversaldata,',
        '      title={Airalogy: AI-empowered universal data digitization for research automation},',
        '      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},',
        '      year={2025},',
        '      eprint={2506.18586},',
        '      archivePrefix={arXiv},',
        '      primaryClass={cs.AI},',
        '      url={https://arxiv.org/abs/2506.18586},',
        '}',
        '```',
      ].join('\n'),
    )

    const refsNode = nodes
      .map(node => findVNodeByType(node, 'section'))
      .find(Boolean) as any
    const citeNode = nodes
      .map(node => findVNodeByClass(node, 'aimd-cite'))
      .find(Boolean) as any

    expect(refsNode).toBeTruthy()
    expect(refsNode.props.class).toBe('aimd-refs')
    expect(refsNode.props.id).toBe('refs')
    expect(citeNode).toBeTruthy()
    const citeRefNode = findVNodeByClass(citeNode, 'aimd-cite__ref') as any
    const citeLabelNode = findVNodeByClass(citeNode, 'aimd-cite__label') as any
    const citePopoverNode = findVNodeByClass(citeNode, 'aimd-cite__popover') as any
    expect(citeRefNode.type).toBe('span')
    expect(citeRefNode.props.href).toBeUndefined()
    expect(citeRefNode.props['data-aimd-ref-summary']).toContain('Airalogy: AI-empowered universal data digitization for research automation')
    expect(collectVNodeText(citeLabelNode).trim()).toBe('1')
    expect(citePopoverNode.type).toBe('span')
    expect(citePopoverNode.props.role).toBe('tooltip')
    expect(collectVNodeText(citePopoverNode)).toContain('Airalogy: AI-empowered universal data digitization for research automation')
    expect(collectVNodeText(nodes)).toContain('References')
    expect(collectVNodeText(nodes)).toContain('Airalogy: AI-empowered universal data digitization for research automation')
    expect(collectVNodeText(citeNode)).not.toContain('yang2025airalogyaiempowereduniversaldata')
  })

  it('resolves figure asset URLs during Vue rendering', async () => {
    const { nodes } = await renderToVue([
      '```fig',
      'id: workflow_diagram',
      'src: files/workflow-diagram.svg',
      'title: Workflow Diagram',
      '```',
    ].join('\n'), {
      resolveAssetUrl: (src, context) => {
        expect(context).toMatchObject({
          kind: 'fig',
          id: 'workflow_diagram',
          title: 'Workflow Diagram',
        })
        return `/assets/${src.split('/').pop()}`
      },
    })

    const img = findVNodeByType({ children: nodes }, 'img') as any
    expect(img).toBeTruthy()
    expect(img.props.src).toBe('/assets/workflow-diagram.svg')
  })

  it('resolves media asset URLs during Vue rendering', async () => {
    const seenContexts: Array<{ src: string, kind: string, id?: string, mediaKind?: string }> = []
    const { nodes } = await renderToVue([
      '```media',
      'id: lecture_demo',
      'kind: video',
      'src: files/videos/demo.mp4',
      'poster: files/images/demo-poster.png',
      'title: Lecture Demo',
      'legend: Watch this while reading the following section.',
      '```',
    ].join('\n'), {
      resolveAssetUrl: (src, context) => {
        seenContexts.push({ src, ...context })
        return `/assets/${src.split('/').pop()}`
      },
    })

    const mediaFigure = findVNodeByClass({ children: nodes }, 'aimd-media') as any
    const video = findVNodeByType({ children: nodes }, 'video') as any
    const source = findVNodeByType({ children: nodes }, 'source') as any
    const actionGroup = findVNodeByClass({ children: nodes }, 'aimd-media__actions') as any
    const legendToggle = findVNodeByClass({ children: nodes }, 'aimd-media__legend-toggle') as any
    const sizeControls = findVNodeByClass({ children: nodes }, 'aimd-media__size-controls') as any
    const sizeButton = findVNodeByClass({ children: nodes }, 'aimd-media__size') as any
    const pinButton = findVNodeByClass({ children: nodes }, 'aimd-media__pin') as any
    expect(mediaFigure).toBeTruthy()
    expect(mediaFigure.props['data-aimd-media-size']).toBe('medium')
    expect(mediaFigure.props['data-aimd-media-legend']).toBe('expanded')
    expect(video).toBeTruthy()
    expect(video.props.src).toBe('/assets/demo.mp4')
    expect(video.props.poster).toBe('/assets/demo-poster.png')
    expect(source).toBeTruthy()
    expect(source.props.type).toBe('video/mp4')
    expect(actionGroup).toBeTruthy()
    expect(legendToggle).toBeTruthy()
    expect(legendToggle.props['data-aimd-media-legend-toggle']).toBe('lecture_demo')
    expect(legendToggle.props['data-aimd-media-show-legend-label']).toBe('Details')
    expect(legendToggle.props['aria-expanded']).toBe('false')
    expect(typeof legendToggle.props.onClick).toBe('function')
    expect(sizeControls).toBeTruthy()
    expect(sizeControls.props['data-aimd-media-size-controls']).toBe('lecture_demo')
    expect(sizeButton).toBeTruthy()
    expect(sizeButton.props['data-aimd-media-size-option']).toBe('small')
    expect(sizeButton.props['aria-label']).toBe('Small pinned size')
    expect(typeof sizeButton.props.onClick).toBe('function')
    expect(pinButton).toBeTruthy()
    expect(pinButton.props['data-aimd-media-pin']).toBe('lecture_demo')
    expect(pinButton.props['data-aimd-media-unpin-label']).toBe('Unpin')
    expect(pinButton.props['aria-pressed']).toBe('false')
    expect(typeof pinButton.props.onClick).toBe('function')
    expect(seenContexts).toEqual(expect.arrayContaining([
      {
        src: 'files/videos/demo.mp4',
        kind: 'media',
        id: 'lecture_demo',
        title: 'Lecture Demo',
        mediaKind: 'video',
      },
      {
        src: 'files/images/demo-poster.png',
        kind: 'media_poster',
        id: 'lecture_demo',
        title: 'Lecture Demo',
        mediaKind: 'video',
      },
    ]))
  })

  it('pins Vue media with collapsed legends and adjustable pinned size', async () => {
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const { nodes } = await renderToVue([
      '```media',
      'id: lecture_demo',
      'kind: video',
      'src: files/videos/demo.mp4',
      'title: Lecture Demo',
      'legend: This longer description should collapse while the media is pinned.',
      '```',
    ].join('\n'))

    const wrapper = mount({
      render: () => h('div', nodes),
    })

    try {
      const media = wrapper.find('.aimd-media')
      expect(media.attributes('data-aimd-media-size')).toBe('medium')
      expect(media.attributes('data-aimd-media-legend')).toBe('expanded')

      await wrapper.find('.aimd-media__pin').trigger('click')
      expect(media.classes()).toContain('aimd-media--pinned')
      expect(media.attributes('data-aimd-media-size')).toBe('medium')
      expect(media.attributes('data-aimd-media-legend')).toBe('collapsed')
      expect(wrapper.find('.aimd-media__legend-toggle').text()).toBe('Details')
      expect(requestAnimationFrameSpy).toHaveBeenCalled()

      await wrapper.find('[data-aimd-media-size-option="small"]').trigger('click')
      expect(media.attributes('data-aimd-media-size')).toBe('small')

      await wrapper.find('.aimd-media__legend-toggle').trigger('click')
      expect(media.attributes('data-aimd-media-legend')).toBe('expanded')
      expect(wrapper.find('.aimd-media__legend-toggle').text()).toBe('Hide')
    }
    finally {
      wrapper.unmount()
      requestAnimationFrameSpy.mockRestore()
      scrollBySpy.mockRestore()
    }
  })

  it('allows only one Vue media item to be pinned at a time', async () => {
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const { nodes } = await renderToVue([
      '```media',
      'id: first_video',
      'kind: video',
      'src: files/videos/first.mp4',
      'title: First Video',
      'legend: First description.',
      '```',
      '',
      '```media',
      'id: second_video',
      'kind: video',
      'src: files/videos/second.mp4',
      'title: Second Video',
      'legend: Second description.',
      '```',
    ].join('\n'))

    const wrapper = mount({
      render: () => h('div', nodes),
    })

    try {
      const mediaItems = wrapper.findAll('.aimd-media')
      const pinButtons = wrapper.findAll('.aimd-media__pin')
      expect(mediaItems).toHaveLength(2)
      expect(pinButtons).toHaveLength(2)

      await pinButtons[0].trigger('click')
      expect(mediaItems[0].classes()).toContain('aimd-media--pinned')
      expect(mediaItems[0].attributes('data-aimd-media-legend')).toBe('collapsed')
      expect(mediaItems[1].classes()).not.toContain('aimd-media--pinned')

      await pinButtons[1].trigger('click')
      expect(mediaItems[0].classes()).not.toContain('aimd-media--pinned')
      expect(mediaItems[0].attributes('data-aimd-media-pinned')).toBe('false')
      expect(mediaItems[0].attributes('data-aimd-media-legend')).toBe('expanded')
      expect(pinButtons[0].attributes('aria-pressed')).toBe('false')
      expect(pinButtons[0].text()).toBe('Pin')
      expect(mediaItems[1].classes()).toContain('aimd-media--pinned')
      expect(mediaItems[1].attributes('data-aimd-media-legend')).toBe('collapsed')
      expect(pinButtons[1].attributes('aria-pressed')).toBe('true')
    }
    finally {
      wrapper.unmount()
      requestAnimationFrameSpy.mockRestore()
      scrollBySpy.mockRestore()
    }
  })

  it('renders Vue figure references as route-safe internal markers', async () => {
    const { nodes } = await renderToVue([
      'As shown in {{ref_fig|workflow_diagram}}.',
      '',
      '```fig',
      'id: workflow_diagram',
      'src: files/workflow-diagram.svg',
      'title: Workflow Diagram',
      '```',
    ].join('\n'))

    const figRefNode = findVNodeByClass({ children: nodes }, 'aimd-ref--fig') as any
    expect(figRefNode).toBeTruthy()
    expect(figRefNode.type).toBe('span')
    expect(figRefNode.props.href).toBeUndefined()
    expect(figRefNode.props['data-aimd-ref-target']).toBe('workflow_diagram')
    expect(figRefNode.props['data-aimd-ref-kind']).toBe('fig')
    expect(figRefNode.props.tabindex).toBe(0)
  })

  it('renders Vue media references as route-safe internal markers', async () => {
    const { nodes } = await renderToVue([
      'Watch {{ref_media|lecture_demo}} while reading.',
      '',
      '```media',
      'id: lecture_demo',
      'kind: video',
      'src: files/videos/demo.mp4',
      'title: Lecture Demo',
      '```',
    ].join('\n'))

    const mediaRefNode = findVNodeByClass({ children: nodes }, 'aimd-ref--media') as any
    expect(mediaRefNode).toBeTruthy()
    expect(mediaRefNode.type).toBe('span')
    expect(mediaRefNode.props.href).toBeUndefined()
    expect(mediaRefNode.props['data-aimd-ref-target']).toBe('lecture_demo')
    expect(mediaRefNode.props['data-aimd-ref-kind']).toBe('media')
    expect(mediaRefNode.props['data-aimd-ref-media-kind']).toBe('video')
    expect(mediaRefNode.props.tabindex).toBe(0)
    expect(collectVNodeText(mediaRefNode)).toContain('Video 1')
  })

  it('moves refs Vue nodes to the end of the rendered document', async () => {
    const { nodes } = await renderToVue(
      [
        '```refs',
        '@misc{doe2024protocol,',
        '  title = "Protocol Notes",',
        '  author = "Doe, Jane",',
        '  year = "2024"',
        '}',
        '```',
        '',
        'The body continues after the refs declaration.',
      ].join('\n'),
    )

    const rootChildren = Array.isArray((nodes[0] as any)?.children)
      ? (nodes[0] as any).children
      : nodes
    const refsIndex = rootChildren.findIndex((node: any) => Boolean(findVNodeByClass(node, 'aimd-refs')))
    const bodyIndex = rootChildren.findIndex((node: any) => collectVNodeText(node).includes('The body continues after the refs declaration.'))

    expect(bodyIndex).toBeGreaterThanOrEqual(0)
    expect(refsIndex).toBeGreaterThanOrEqual(0)
    expect(bodyIndex).toBeLessThan(refsIndex)
  })

  it('renders code blocks with line numbers and wrapping classes', async () => {
    const { nodes } = await renderToVue(
      '```json\n{\n  "model":"qwen3.6-flash","enable_search":true\n}\n```',
      {
        elementRenderers: {
          pre: createCodeBlockRenderer(null, {
            lineNumbers: true,
            wrap: true,
          }),
        },
      },
    )

    const pre = findVNodeByType(nodes[0], 'pre') as any
    expect(pre).toBeTruthy()
    expect(pre.props.class).toContain('aimd-code-block')
    expect(pre.props.class).toContain('aimd-code-block--line-numbers')
    expect(pre.props.class).toContain('aimd-code-block--wrap')
    expect(pre.props['data-lang']).toBe('json')
    const code = findVNodeByType(pre, 'code') as any
    expect(code.children).toHaveLength(3)
    expect(code.children[1].children[1].props.style['--aimd-code-wrap-indent']).toBe('2ch')
    expect(collectVNodeText(pre)).toContain('1')
    expect(collectVNodeText(pre)).toContain('qwen3.6-flash')
  })

  it('keeps blank code lines visible without adding an extra line for the trailing markdown fence newline', async () => {
    const { nodes } = await renderToVue(
      '```json\n{\n\n  "model": "qwen3.6-flash"\n}\n```',
      {
        elementRenderers: {
          pre: createCodeBlockRenderer(null, {
            lineNumbers: true,
            wrap: true,
          }),
        },
      },
    )

    const pre = findVNodeByType(nodes[0], 'pre') as any
    const code = findVNodeByType(pre, 'code') as any
    expect(code.children).toHaveLength(4)
    expect(code.children[1].children[1].children).toBe('\u00a0')
    expect(code.children[2].children[1].props.style['--aimd-code-wrap-indent']).toBe('2ch')
  })

  it('uses Shiki token output when a highlighter is available', async () => {
    const highlighter = {
      codeToHtml: (code: string) => code,
      codeToTokensBase: () => [
        [
          { content: '  ', color: '#24292e' },
          { content: '"model"', color: '#005cc5' },
        ],
      ],
    }
    const { nodes } = await renderToVue('```json\n  "model"\n```', {
      elementRenderers: {
        pre: createCodeBlockRenderer(highlighter, {
          lineNumbers: true,
          wrap: true,
        }),
      },
    })

    const pre = findVNodeByType(nodes[0], 'pre') as any
    const code = findVNodeByType(pre, 'code') as any
    const tokenSpans = code.children[0].children[1].children
    expect(tokenSpans[0].props.style).toEqual({ color: '#24292e' })
    expect(tokenSpans[1].props.style).toEqual({ color: '#005cc5' })
    expect(tokenSpans[1].children).toBe('"model"')
  })

  it('keeps the legacy plain pre fallback when called with a theme string and no highlighter', async () => {
    const { nodes } = await renderToVue('```json\n{"model":"qwen"}\n```', {
      elementRenderers: {
        pre: createCodeBlockRenderer(null, 'github-light'),
      },
    })

    const pre = findVNodeByType(nodes[0], 'pre') as any
    expect(pre.props.class).toBe('language-json')
    expect(pre.props.class).not.toContain('aimd-code-block')
    const code = findVNodeByType(pre, 'code') as any
    expect(code.props.class).toBe('language-json')
    expect(code.children).toBe('{"model":"qwen"}')
  })

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
// readonly record rendering
// ---------------------------------------------------------------------------

describe('readonly record rendering', () => {
  it('normalizes bare record data and full record payload wrappers', () => {
    expect(normalizeRecordRenderValue({
      var: { sample_id: { value: 'S-001' } },
      step: { prepare: { checked: true } },
      var_table: {
        samples: [{ sample_id: 'S-001' }],
      },
    })).toEqual({
      var: { sample_id: { value: 'S-001' } },
      step: { prepare: { checked: true } },
      check: {},
      quiz: {},
      var_table: {
        samples: [{ sample_id: 'S-001' }],
      },
    })

    expect(normalizeRecordRenderValue({
      record_id: 'rec-001',
      data: {
        var: { sample_id: 'S-002' },
        quiz: { qc: ['A', 'B'] },
      },
    })).toEqual({
      var: { sample_id: 'S-002' },
      var_table: {},
      step: {},
      check: {},
      quiz: { qc: ['A', 'B'] },
    })
  })

  it('creates an edit-mode readonly render context for record-backed documents', () => {
    const context = createReadonlyRecordRenderContext(
      { data: { var: { sample_id: 'S-003' } } },
      { quizPreview: { showAnswers: true } },
    )

    expect(context.mode).toBe('edit')
    expect(context.readonly).toBe(true)
    expect(context.quizPreview).toEqual({ showAnswers: true })
    expect(context.value?.var.sample_id).toBe('S-003')
  })

  it('renders record values into AIMD fields without enabling input editing', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      [
        'Sample {{var|sample_id: str}}',
        '',
        '{{check|prepared}} Prepared.',
      ].join('\n'),
      {
        data: {
          var: { sample_id: { value: 'S-004' } },
          check: { prepared: { checked: true } },
        },
      },
      {
        groupCheckBodies: true,
      },
    )

    expect(collectVNodeText(nodes)).toContain('S-004')
    expect(collectVNodeText(nodes)).not.toContain('sample_id')
    const input = findVNodeByType({ children: nodes }, 'input') as any
    expect(input).toBeTruthy()
    expect(input.props.checked).toBe(true)
    expect(input.props.disabled).toBe(true)
  })

  it('renders decimal-like record values without JSON string quotes', async () => {
    const decimal = {
      toJSON: () => '177',
      toNumber: () => 177,
      toString: () => '177',
    }
    const { nodes } = await renderReadonlyRecordToVue(
      'Height: {{var|height: float}}',
      {
        data: {
          var: {
            height: { value: decimal, displayedValue: '177', type: 'float' },
          },
        },
      },
    )

    expect(collectVNodeText(nodes)).toMatch(/Height:\s+177/)
    expect(collectVNodeText(nodes)).not.toContain('"177"')
  })

  it('shows readable missing labels only when record values are absent', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      'Sample {{var|sample_id: str, title="Sample ID"}}',
      {
        data: {
          var: {},
        },
      },
    )

    expect(collectVNodeText(nodes)).toContain('Missing')
    expect(collectVNodeText(nodes)).toContain('Sample ID')
    const missing = findVNodeByType({ children: nodes }, 'span') as any
    expect(missing.props.title).toContain('data.var.sample_id')
  })

  it('renders file-backed image fields with resolved assets', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      'Site photo: {{var|site_photo: FileIdPNG}}',
      {
        data: {
          var: {
            site_photo: 'airalogy.id.file.site-photo.png',
          },
        },
      },
      {
        resolveAsset: context => context.fileId === 'airalogy.id.file.site-photo.png'
          ? {
              url: 'blob:site-photo',
              filename: 'site-photo.png',
              mimeType: 'image/png',
            }
          : null,
      },
    )

    const img = findVNodeByType({ children: nodes }, 'img') as any
    expect(img).toBeTruthy()
    expect(img.props.src).toBe('blob:site-photo')
    expect(img.props.alt).toBe('site-photo.png')
  })

  it('renders manifest-resolved file fields even when the protocol did not declare FileId type', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      'Attachment: {{var|sample_file}}',
      {
        data: {
          var: {
            sample_file: 'airalogy.id.file.sample-note.txt',
          },
        },
      },
      {
        resolveAsset: context => context.fieldPath === 'data.var.sample_file'
          ? {
              href: 'blob:sample-note',
              filename: 'sample-note.txt',
              mimeType: 'text/plain',
            }
          : null,
      },
    )

    const link = findVNodeByType({ children: nodes }, 'a') as any
    expect(link).toBeTruthy()
    expect(link.props.href).toBe('blob:sample-note')
    expect(collectVNodeText(link)).toContain('sample-note.txt')
  })

  it('resolves markdown image elements through readonly record assets', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      '![Calibration chart](airalogy.id.file.chart.svg)',
      { data: { var: {} } },
      {
        resolveAsset: context => context.fileId === 'airalogy.id.file.chart.svg'
          ? {
              url: 'blob:chart',
              filename: 'chart.svg',
              mimeType: 'image/svg+xml',
            }
          : null,
      },
    )

    const img = findVNodeByType({ children: nodes }, 'img') as any
    expect(img).toBeTruthy()
    expect(img.props.src).toBe('blob:chart')
    expect(img.props.alt).toBe('Calibration chart')
  })

  it('renders AiralogyMarkdown record values through the AIMD Vue renderer', async () => {
    const { nodes } = await renderReadonlyRecordToVue(
      'Report:\n\n{{var|report: AiralogyMarkdown}}',
      {
        data: {
          var: {
            report: [
              '# Finding',
              '',
              '![Chart](airalogy.id.file.chart.svg)',
              '',
              'Nested token: {{var|nested: str, title="Nested value"}}',
            ].join('\n'),
          },
        },
      },
      {
        resolveAsset: context => context.fileId === 'airalogy.id.file.chart.svg'
          ? {
              url: 'blob:chart',
              filename: 'chart.svg',
              mimeType: 'image/svg+xml',
            }
          : null,
      },
    )

    const wrapper = mount({
      render: () => h('div', nodes),
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.aimd-record-field--markdown h1').text()).toBe('Finding')
      expect(wrapper.find('.aimd-record-field--markdown img').attributes('src')).toBe('blob:chart')
    })
    expect(wrapper.find('.aimd-record-field--markdown').text()).toContain('Nested value')
    wrapper.unmount()
  })

  it('mounts the shared readonly record preview component with renderer classes', async () => {
    const wrapper = mount(AimdMarkdownPreview, {
      props: {
        content: 'Sample {{var|sample_id: str}}',
        readonlyRecordData: {
          data: {
            var: {
              sample_id: 'S-006',
            },
          },
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('S-006')
    })

    expect(wrapper.find('.aimd-renderer').exists()).toBe(true)
    expect(wrapper.find('.rendered-aimd-document').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('sample_id')
    const exposed = wrapper.vm as unknown as {
      env: { fields: { var: string[] } }
      rootElement: HTMLElement | null
    }
    expect(exposed.env.fields.var).toEqual(['sample_id'])
    expect(exposed.rootElement).toBeInstanceOf(HTMLElement)
    wrapper.unmount()
  })

  it('resolves relative rendered URLs through the shared preview component', async () => {
    const wrapper = mount(AimdMarkdownPreview, {
      props: {
        content: '![Plot](files/plot.png)',
        resolveUrl: async url => ({ url: `/resolved/${url}` }),
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('img').attributes('src')).toBe('/resolved/files/plot.png')
    })

    wrapper.unmount()
  })
})

describe('default Vue renderer fallback', () => {
  it('lets host adapters reuse canonical field markup', async () => {
    const rendered = await renderDefaultAimdNode('var', {
      type: 'aimd',
      fieldType: 'var',
      id: 'sample_id',
      scope: 'var',
      raw: '{{var|sample_id}}',
    }, {
      mode: 'preview',
      readonly: true,
      locale: 'en-US',
      messages: createAimdRendererMessages('en-US'),
    })

    expect(rendered?.props?.class).toContain('aimd-field--var')
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

describe('multi-Record views', () => {
  const aimd = [
    '# Participant report',
    '',
    'Participant: {{var|participant: str, title = "Participant name", description = "Name shown in the participant list", examples = ["Alice", "Bob"]}}',
    '',
    'Age: {{var|age: int, title = "Age"}}',
    '',
    'Active: {{var|active: bool, title = "Active"}}',
    '',
    'Notes: {{var|notes: AiralogyMarkdown, title = "Notes"}}',
  ].join('\n')

  const records = [
    {
      record_id: 'record-a',
      metadata: { record_num: 105 },
      data: {
        var: {
          participant: 'Alice',
          age: 34,
          active: true,
          notes: '# Stable\n\nNo adverse events.',
        },
      },
    },
    {
      record_id: 'record-b',
      metadata: { record_num: 104 },
      data: {
        var: {
          participant: 'Bob',
          age: 34,
          active: false,
          notes: '# Review\n\nFollow-up required.',
        },
      },
    },
  ]

  it('renders a compact table without mounting full Markdown previews per row', async () => {
    const wrapper = mount(AimdRecordTable, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:participant', 'var:age', 'var:active', 'var:notes'],
        selectedRecordKeys: [],
        locale: 'en-US',
      },
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('thead [data-field-key]')).toHaveLength(4)
    expect(wrapper.find('.aimd-markdown-preview').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('No adverse events.')
    expect(wrapper.text()).not.toContain('# Stable')

    await wrapper.findAll('tbody input[type="checkbox"]')[0]?.setValue(true)
    expect(wrapper.emitted('update:selectedRecordKeys')?.[0]).toEqual([['record-a']])

    await wrapper.find('.aimd-record-table-view__record-link').trigger('click')
    expect(wrapper.emitted('open-record')?.[0]?.[0]).toEqual(records[0])
    wrapper.unmount()
  })

  it('enforces the configured comparison selection limit', () => {
    const extraRecords = [
      ...records,
      { record_id: 'record-c', data: { var: { participant: 'C', age: 30 } } },
    ]
    const wrapper = mount(AimdRecordTable, {
      props: {
        aimd,
        records: extraRecords,
        selectedRecordKeys: ['record-a', 'record-b'],
        selectionLimit: 2,
      },
    })

    const rowCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
    expect(rowCheckboxes[0]?.attributes('disabled')).toBeUndefined()
    expect(rowCheckboxes[1]?.attributes('disabled')).toBeUndefined()
    expect(rowCheckboxes[2]?.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('reveals complete field metadata from table headers on hover or keyboard focus', async () => {
    const wrapper = mount(AimdRecordTable, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:participant'],
        locale: 'en-US',
      },
    })

    const fieldHelp = wrapper.find('[data-field-key="var:participant"] .aimd-record-field-help')
    expect(fieldHelp.attributes('tabindex')).toBe('0')
    expect(fieldHelp.attributes('aria-label')).toBe('Show details for Participant name')

    await fieldHelp.trigger('mouseenter')
    const popover = document.body.querySelector<HTMLElement>('.aimd-record-field-help__popover')
    expect(popover?.getAttribute('role')).toBe('tooltip')
    expect(popover?.textContent).toContain('Participant name')
    expect(popover?.textContent).toContain('participant')
    expect(popover?.textContent).toContain('str')
    expect(popover?.textContent).toContain('Name shown in the participant list')
    expect(popover?.textContent).toContain('Alice')
    expect(popover?.textContent).toContain('Bob')
    expect(fieldHelp.attributes('aria-describedby')).toBe(popover?.id)

    await fieldHelp.trigger('mouseleave')
    expect(document.body.querySelector('.aimd-record-field-help__popover')).toBeNull()
    wrapper.unmount()
  })

  it('keeps at least one visible protocol field selected', async () => {
    const wrapper = mount(AimdRecordTable, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:participant'],
      },
    })

    const selectedField = wrapper.find('.aimd-record-table-view__field-menu input:checked')
    expect(selectedField.attributes('disabled')).toBeDefined()
    await selectedField.setValue(false)
    expect(wrapper.findAll('thead [data-field-key]')).toHaveLength(1)
    expect(wrapper.emitted('update:fieldKeys')).toBeUndefined()
    wrapper.unmount()
  })

  it('transposes selected records and marks different fields', () => {
    const wrapper = mount(AimdRecordCompare, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:age', 'var:active'],
      },
    })

    const ageRow = wrapper.find('[data-field-key="var:age"]')
    const activeRow = wrapper.find('[data-field-key="var:active"]')
    expect(ageRow.attributes('data-different')).toBe('false')
    expect(activeRow.attributes('data-different')).toBe('true')
    expect(wrapper.findAll('thead .aimd-record-compare__record-link')).toHaveLength(2)
    wrapper.unmount()
  })

  it('uses the same accessible field details in comparison rows', async () => {
    const wrapper = mount(AimdRecordCompare, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:age'],
        locale: 'zh-CN',
      },
    })

    const fieldHelp = wrapper.find('[data-field-key="var:age"] .aimd-record-field-help')
    expect(fieldHelp.attributes('aria-label')).toBe('查看Age的字段详情')
    await fieldHelp.trigger('focus')

    const popover = document.body.querySelector<HTMLElement>('.aimd-record-field-help__popover')
    expect(popover?.textContent).toContain('字段age')
    expect(popover?.textContent).toContain('类型int')
    expect(fieldHelp.attributes('aria-describedby')).toBe(popover?.id)

    wrapper.unmount()
    expect(document.body.querySelector('.aimd-record-field-help__popover')).toBeNull()
  })

  it('compares every Protocol field by default', () => {
    const wrapper = mount(AimdRecordCompare, {
      props: {
        aimd,
        records,
      },
    })

    expect(wrapper.findAll('tbody [data-field-key]')).toHaveLength(4)
    expect(wrapper.find('[data-field-key="var:participant"]').exists()).toBe(true)
    expect(wrapper.find('[data-field-key="var:notes"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('can show only differences and asks for at least two records', async () => {
    const wrapper = mount(AimdRecordCompare, {
      props: {
        aimd,
        records,
        fieldKeys: ['var:age', 'var:active'],
        showOnlyDifferences: true,
      },
    })

    expect(wrapper.find('[data-field-key="var:age"]').exists()).toBe(false)
    expect(wrapper.find('[data-field-key="var:active"]').exists()).toBe(true)
    await wrapper.setProps({ records: [records[0]] })
    expect(wrapper.text()).toContain('Select at least two records')
    wrapper.unmount()
  })

  it('renders the complete report through the shared readonly preview', async () => {
    const wrapper = mount(AimdRecordReport, {
      props: {
        aimd,
        record: records[0],
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Participant report')
      expect(wrapper.text()).toContain('Alice')
    })
    expect(wrapper.find('.aimd-record-report').exists()).toBe(true)
    expect(wrapper.find('.rendered-aimd-document').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ships stable responsive collection styles', () => {
    expect(rendererStyles).toContain('.aimd-record-table-view__scroller')
    expect(rendererStyles).toContain('.aimd-record-compare__row--different')
    expect(rendererStyles).toContain('.aimd-record-field-help__popover')
    expect(rendererStyles).toContain('position: fixed')
    expect(rendererStyles).toMatch(/\.aimd-record-table-view__toolbar,\s*\.aimd-record-compare__toolbar\s*\{[^}]*padding-inline:\s*12px;/)
    expect(rendererStyles).toContain('@media (max-width: 640px)')
    expect(rendererStyles).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.aimd-record-table-view__toolbar,\s*\.aimd-record-compare__toolbar\s*\{[^}]*padding-inline:\s*10px;/)
  })
})
