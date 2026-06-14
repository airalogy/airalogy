import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './main.ts'), 'utf8')

describe('aimd demo router startup', () => {
  it('mounts only after the initial route is ready', () => {
    expect(source).toMatch(/router\.isReady\(\)\.finally/)
    expect(source).toMatch(/app\.mount\('#app'\)/)
  })

  it('redirects unknown routes back to the tutorial', () => {
    expect(source).toMatch(/path: '\/:pathMatch\(\.\*\)\*'/)
    expect(source).toMatch(/redirect: '\/tutorial'/)
  })
})
