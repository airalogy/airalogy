import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './TutorialDemo.vue'), 'utf8')

describe('TutorialDemo routing', () => {
  it('keeps lesson query repair scoped to the tutorial route', () => {
    expect(source).toMatch(/watch\(\[lessonIds, lessonQueryId, \(\) => route\.path\]/)
    expect(source).toMatch(/if \(path !== '\/tutorial'\) return/)
    expect(source).toMatch(/path: '\/tutorial'/)
  })
})
