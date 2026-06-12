import { describe, expect, it } from 'vitest'

import { parseAndExtract } from '@airalogy/aimd-renderer'

import sampleContent from './sampleContent.aimd?raw'

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
})
