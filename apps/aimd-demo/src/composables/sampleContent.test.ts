import { describe, expect, it } from 'vitest'

import { parseAndExtract } from '@airalogy/aimd-renderer'

import { DEFAULT_DEMO_EXAMPLE_ID, DEMO_EXAMPLES, getDemoExampleContent, getDemoExampleSource, resolveDemoExampleAsset } from './sampleContent'
import sampleContent from '../../../../examples/aimd/aimd-syntax-tour/protocol.aimd?raw'

describe('sampleContent', () => {
  it('demonstrates a browser-side assigner that writes list values', () => {
    const fields = parseAndExtract(sampleContent)

    expect(fields.var).toContain('aimd_content')
    expect(fields.var).toContain('image_ids')
    expect(fields.var_definitions?.find(field => field.id === 'aimd_content')).toMatchObject({
      type: 'AiralogyMarkdown',
    })
    expect(fields.var_definitions?.find(field => field.id === 'image_ids')).toMatchObject({
      type: 'list[str]',
    })

    expect(fields.client_assigner).toContainEqual(expect.objectContaining({
      id: 'extract_airalogy_image_ids',
      runtime: 'client',
      mode: 'manual',
      dependent_fields: ['aimd_content'],
      assigned_fields: ['image_ids'],
    }))
  })

  it('loads shared AIMD and protocol examples from registries', () => {
    expect(DEMO_EXAMPLES[0]?.id).toBe(DEFAULT_DEMO_EXAMPLE_ID)

    const syntaxTour = DEMO_EXAMPLES.find(example => example.id === 'aimd-syntax-tour')
    expect(syntaxTour).toMatchObject({
      kind: 'example',
      locales: ['en-US', 'zh-CN'],
    })
    expect(getDemoExampleContent(syntaxTour!, 'en-US')).toContain('# AIMD Syntax Tour')
    expect(getDemoExampleContent(syntaxTour!, 'zh-CN')).toContain('# AIMD 语法导览')
    expect(getDemoExampleSource(syntaxTour!, 'zh-CN')).toBe('aimd-syntax-tour/protocol.zh-CN.aimd')

    const clinicalCase = DEMO_EXAMPLES.find(example => example.id === 'clinical-information-record')
    expect(clinicalCase).toMatchObject({
      kind: 'case',
      locales: ['en-US', 'zh-CN'],
    })
    expect(getDemoExampleContent(clinicalCase!, 'en-US')).toContain('# Clinical Information Record Case')

    const protocolExample = DEMO_EXAMPLES.find(example => example.id === 'fiber-endface-process')
    expect(protocolExample).toMatchObject({
      kind: 'protocol',
      locales: ['zh-CN'],
    })
    expect(getDemoExampleContent(protocolExample!, 'zh-CN')).toContain('# 光纤端面微纳结构器件工艺路线设计与记录')
  })

  it('resolves protocol-local example assets without rewriting source content', () => {
    const syntaxTour = DEMO_EXAMPLES.find(example => example.id === 'aimd-syntax-tour')
    expect(syntaxTour).toBeTruthy()

    expect(getDemoExampleContent(syntaxTour!, 'en-US')).toContain('src: files/workflow-diagram.svg')
    expect(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'files/workflow-diagram.svg')).toMatch(/^(?:data:image\/svg\+xml|\/|\.\/)/)
    expect(resolveDemoExampleAsset(syntaxTour!, 'zh-CN', 'files/workflow-diagram.svg')).toBe(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'files/workflow-diagram.svg'))
    expect(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'airalogy.id.file.site-photo.png')).toBeNull()
    expect(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'https://example.com/workflow.svg')).toBeNull()
  })

  it('keeps the bilingual syntax tour compatible while translating human-facing content', () => {
    const syntaxTour = DEMO_EXAMPLES.find(example => example.id === 'aimd-syntax-tour')!
    const english = parseAndExtract(getDemoExampleContent(syntaxTour, 'en-US'))
    const chinese = parseAndExtract(getDemoExampleContent(syntaxTour, 'zh-CN'))
    for (const key of ['var', 'step', 'check', 'ref_var', 'ref_step', 'ref_fig', 'ref_media', 'cite'] as const) {
      expect(chinese[key], key).toEqual(english[key])
    }
    const varContract = (fields: typeof english) => fields.var_definitions?.map(({ id, type, default: defaultValue, enum: options }) => ({ id, type, defaultValue, options }))
    expect(varContract(chinese)).toEqual(varContract(english))
    const tableContract = (fields: typeof english) => fields.var_table.map(({ id, subvars }) => ({ id, subvars: subvars.map(({ id, type }) => ({ id, type })) }))
    expect(tableContract(chinese)).toEqual(tableContract(english))
    expect(chinese.client_assigner).toEqual(english.client_assigner)
    const stepContract = (fields: typeof english) => fields.step_hierarchy?.map(({ title, ...step }) => step)
    expect(stepContract(chinese)).toEqual(stepContract(english))
    const quizContract = (fields: typeof english) => fields.quiz.map(quiz => ({ id: quiz.id, type: quiz.type, mode: quiz.mode, score: quiz.score, answer: quiz.answer, optionKeys: quiz.options?.map(option => option.key) }))
    expect(quizContract(chinese)).toEqual(quizContract(english))
    expect(chinese.quiz).toHaveLength(7)
    expect(chinese.fig?.map(({ id, src }) => ({ id, src }))).toEqual(english.fig?.map(({ id, src }) => ({ id, src })))
    expect(chinese.var_definitions?.find(field => field.id === 'sample_name')?.kwargs?.title).toBe('样品名称')
    expect(chinese.step_hierarchy?.find(step => step.id === 'sample_preparation')?.title).toBe('准备样品')
    expect(chinese.quiz[0].stem).toBe('样品最初应存放在什么温度下？')
  })

  it('demonstrates quoted AIMD-looking text as a literal string parameter', () => {
    const fields = parseAndExtract(sampleContent)

    expect(sampleContent).toContain('checked_message="Literal AIMD-looking text stays plain here: {{ref_var|stable_wait_s}}."')
    expect(fields.var).toContain('stable_wait_s')
    expect(fields.check).toContain('quoted_message_boundary')
    expect(fields.ref_var.filter(id => id === 'stable_wait_s')).toHaveLength(1)
  })

  it('demonstrates provider-based platform video media', () => {
    const fields = parseAndExtract(sampleContent)

    expect(fields.ref_media).toEqual(expect.arrayContaining(['youtube_demo', 'bilibili_demo']))
    expect(fields.media).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'youtube_demo',
        kind: 'video',
        provider: 'youtube',
        src: 'https://www.youtube.com/embed/VIDEO_ID',
      }),
      expect.objectContaining({
        id: 'bilibili_demo',
        kind: 'video',
        provider: 'bilibili',
        src: 'https://player.bilibili.com/player.html?bvid=BV_ID',
      }),
    ]))
  })

  it('keeps every registered demo example loadable and parseable', () => {
    for (const example of DEMO_EXAMPLES) {
      expect(example.locales.length).toBeGreaterThan(0)

      for (const locale of example.locales) {
        const content = getDemoExampleContent(example, locale)
        expect(content.trim()).toBeTruthy()
        expect(() => parseAndExtract(content)).not.toThrow()
      }
    }
  })
})
