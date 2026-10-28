import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

test('Python retries select only unpublished packages and expose explicit publication gates', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'airalogy-publish-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const mock = path.join(directory, 'registry.mjs')
  const output = path.join(directory, 'outputs')
  writeFileSync(mock, 'globalThis.fetch = async url => ({ status: url.includes("/airalogy/") ? 200 : 404 });')
  const result = execFileSync(process.execPath, [
    '--import', mock, fileURLToPath(new URL('./list-python-packages-to-publish.mjs', import.meta.url)), '--all',
  ], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } })
  assert.deepEqual(JSON.parse(result).packages.map(pkg => pkg.name), ['airalogy-engine'])
  const gates = readFileSync(output, 'utf8')
  assert.match(gates, /^has_core=false$/m)
  assert.match(gates, /^has_engine=true$/m)
})

test('the Python workflow publishes core before engine from separate distribution folders', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8')
  const core = workflow.indexOf('- name: Publish Airalogy Core to PyPI')
  const engine = workflow.indexOf('- name: Publish Airalogy Engine to PyPI after Core')
  assert.ok(core >= 0 && engine > core)
  assert.match(workflow.slice(core, engine), /if: steps\.python\.outputs\.has_core == 'true'/)
  assert.match(workflow.slice(core, engine), /packages-dir: dist-to-publish\/airalogy\n/)
  assert.match(workflow.slice(engine), /if: steps\.python\.outputs\.has_engine == 'true'/)
  assert.match(workflow.slice(engine), /packages-dir: dist-to-publish\/airalogy-engine/)
})
