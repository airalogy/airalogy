import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { engineImageName, engineImageVersionFile, filesWithDefaultImage } from '../airalogy-engine/image-release-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'airalogy-release-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(path.join(directory, 'scripts/release'), { recursive: true })
  copyFileSync(path.join(root, 'scripts/release/sync-python-versions.mjs'), path.join(directory, 'scripts/release/sync-python-versions.mjs'))
  for (const file of [
    'scripts/airalogy-engine/image-release-contract.mjs',
    'scripts/airalogy-engine/check-image-release.mjs',
    'packages/runtime/airalogy-engine-image/Dockerfile',
    'packages/runtime/airalogy-engine-image/protocol_requirements.txt',
    engineImageVersionFile,
    ...filesWithDefaultImage,
  ]) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    copyFileSync(path.join(root, file), path.join(directory, file))
  }
  for (const name of ['airalogy', 'airalogy-engine']) {
    const target = path.join(directory, 'packages/pypi', name)
    mkdirSync(target, { recursive: true })
    for (const file of ['package.json', 'pyproject.toml']) copyFileSync(path.join(root, 'packages/pypi', name, file), path.join(target, file))
  }
  return directory
}

test('release sync updates Python dependencies and Engine image defaults together', t => {
  const directory = fixture(t)
  const anchorPath = path.join(directory, 'packages/pypi/airalogy/package.json')
  const anchor = JSON.parse(readFileSync(anchorPath, 'utf8'))
  anchor.version = '9.8.7'
  writeFileSync(anchorPath, JSON.stringify(anchor))
  const script = path.join(directory, 'scripts/release/sync-python-versions.mjs')
  const before = readFileSync(path.join(directory, 'packages/pypi/airalogy-engine/pyproject.toml'), 'utf8')
  const imageBefore = readFileSync(path.join(directory, engineImageVersionFile), 'utf8')
  const check = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' })
  assert.equal(check.status, 1)
  assert.equal(readFileSync(path.join(directory, 'packages/pypi/airalogy-engine/pyproject.toml'), 'utf8'), before)
  assert.equal(readFileSync(path.join(directory, engineImageVersionFile), 'utf8'), imageBefore)
  execFileSync(process.execPath, [script])
  const engine = readFileSync(path.join(directory, 'packages/pypi/airalogy-engine/pyproject.toml'), 'utf8')
  assert.deepEqual([...engine.matchAll(/"airalogy~=([^"]+)"/g)].map(match => match[1]), ['9.8.7', '9.8.7'])
  assert.match(readFileSync(path.join(directory, 'packages/pypi/airalogy/pyproject.toml'), 'utf8'), /version = "9\.8\.7"/)
  assert.equal(readFileSync(path.join(directory, engineImageVersionFile), 'utf8'), '9.8.7\n')
  for (const file of filesWithDefaultImage) {
    assert.ok(readFileSync(path.join(directory, file), 'utf8').includes(`${engineImageName}:9.8.7`), file)
  }
  assert.doesNotThrow(() => execFileSync(process.execPath, [script, '--check']))
  assert.doesNotThrow(() => execFileSync(process.execPath, [path.join(directory, 'scripts/airalogy-engine/check-image-release.mjs')]))
})

test('the engine release anchor declares the same minor-series core dependency', () => {
  const engine = JSON.parse(readFileSync(path.join(root, 'packages/pypi/airalogy-engine/package.json'), 'utf8'))
  assert.equal(engine.dependencies.airalogy, 'workspace:~')
})
