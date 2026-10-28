import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { npmVersionExists, orderPackagesForPublishing } from './npm-publication.mjs'

test('publishes dependencies before consumers, including optional and peer dependencies', () => {
  const packages = [
    { name: 'editor', dependencies: { renderer: '*' }, devDependencies: { demo: '*' } },
    { name: 'recorder', optionalDependencies: { editor: '*' } },
    { name: 'renderer', peerDependencies: { core: '*', vue: '*' } },
    { name: 'core' },
  ]
  assert.deepEqual(orderPackagesForPublishing(packages).map(pkg => pkg.name), ['core', 'renderer', 'editor', 'recorder'])
  assert.equal(packages[0].name, 'editor')
  assert.throws(() => orderPackagesForPublishing([
    { name: 'a', dependencies: { b: '*' } }, { name: 'b', dependencies: { a: '*' } },
  ]), /Circular release dependency/)
})

test('the repository release order respects all selected runtime dependencies', () => {
  const directory = new URL('../../packages/npm/', import.meta.url)
  const packages = readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => new URL(`${entry.name}/package.json`, directory)).filter(file => existsSync(file))
    .map(file => JSON.parse(readFileSync(file, 'utf8')))
  const order = orderPackagesForPublishing(packages).map(pkg => pkg.name)
  for (const pkg of packages) {
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) {
      if (order.includes(name)) assert.ok(order.indexOf(name) < order.indexOf(pkg.name), `${name} before ${pkg.name}`)
    }
  }
})

test('registry checks skip existing releases but fail closed for errors and wrong identities', async () => {
  const name = '@airalogy/aimd-core'
  const version = '1.2.3'
  assert.equal(await npmVersionExists(name, version, async () => ({ status: 404 })), false)
  assert.equal(await npmVersionExists(name, version, async url => {
    assert.equal(url, 'https://registry.npmjs.org/%40airalogy%2Faimd-core/1.2.3')
    return { status: 200, json: async () => ({ name, version }) }
  }), true)
  await assert.rejects(npmVersionExists(name, version, async () => ({ status: 503 })), /Unexpected npm response/)
  await assert.rejects(npmVersionExists(name, version, async () => ({ status: 200, json: async () => ({ name, version: '0.0.1' }) })), /Unexpected npm identity/)
})
