import { describe, expect, it } from 'vitest'

import { parseAndExtract } from '@airalogy/aimd-renderer'

import { DEFAULT_DEMO_EXAMPLE_ID, DEMO_EXAMPLES, getDemoExampleContent, resolveDemoExampleAsset } from './sampleContent'
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
      locales: ['en-US'],
    })
    expect(getDemoExampleContent(syntaxTour!, 'en-US')).toContain('# AIMD Syntax Tour')

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
    expect(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'airalogy.id.file.site-photo.png')).toBeNull()
    expect(resolveDemoExampleAsset(syntaxTour!, 'en-US', 'https://example.com/workflow.svg')).toBeNull()
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
