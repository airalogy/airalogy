import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './RenderedAimdDocument.ts'), 'utf8')

describe('RenderedAimdDocument', () => {
  it('keeps internal reference navigation inside the nearest scroll panel', () => {
    expect(source).toContain('function scrollTargetIntoContainer')
    expect(source).toContain('container.scrollTo')
    expect(source).not.toContain('scrollIntoView')
  })
})
