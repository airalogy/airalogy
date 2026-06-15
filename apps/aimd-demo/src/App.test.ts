import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, './App.vue'), 'utf8')

describe('App layout', () => {
  it('keeps the examples route bounded to the viewport', () => {
    expect(source).toContain("'app--bounded': isBoundedRoute")
    expect(source).toContain("currentPath.value === '/examples' || currentPath.value.startsWith('/examples/')")
    expect(source).toContain("document.body.classList.toggle('aimd-demo-body--bounded', isBoundedRoute.value)")
    expect(source).toContain("window.scrollTo({ top: 0, left: 0 })")
    expect(source).toMatch(/body\.aimd-demo-body--bounded \{[\s\S]*height: 100dvh;[\s\S]*overflow: hidden;/)
    expect(source).toMatch(/body\.aimd-demo-body--bounded #app \{[\s\S]*height: 100%;[\s\S]*overflow: hidden;/)
    expect(source).toMatch(/\.app--bounded \{[\s\S]*height: 100dvh;[\s\S]*overflow: hidden;/)
    expect(source).toMatch(/\.app--bounded \.app-main \{[\s\S]*display: flex;[\s\S]*overflow: hidden;/)
  })
})
