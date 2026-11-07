import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

function publicCss(file, visited = new Set()) {
  if (visited.has(file)) return ''
  visited.add(file)
  const css = readFileSync(file, 'utf8')
  const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)]
    .filter(([, path]) => path.startsWith('.'))
    .map(([, path]) => publicCss(resolve(dirname(file), path), visited))
  return [...imports, css].join('\n')
}

test('public styles include the styles matching the shipped Vue components', () => {
  const css = publicCss(resolve(root, manifest.exports['./styles'].import))
  assert.equal(manifest.exports['./styles'].default, manifest.exports['./styles'].import)
  const js = readdirSync(resolve(root, 'dist')).filter(name => name.endsWith('.js'))
    .map(name => readFileSync(resolve(root, 'dist', name), 'utf8')).join('\n')
  const scopes = new Set([...js.matchAll(/__scopeId["']?\s*,\s*["'](data-v-[\w-]+)/g)].map(match => match[1]))
  assert.ok(scopes.size > 0, 'build must contain scoped Vue components')
  for (const scope of scopes) assert.ok(css.includes(`[${scope}]`), `missing packaged styles for ${scope}`)
  assert.match(css, /\.aimd-input-tools\[data-v-[\w-]+\]\s*\{[^}]*display:\s*flex/)
  assert.match(css, /\.aimd-input-tools__menu\[data-v-[\w-]+\]\s*\{[^}]*position:\s*absolute/)
  assert.ok(css.includes('.aimd-recorder-wysiwyg-surface'))
  assert.ok(css.includes('.aimd-field--no-style'))
})
