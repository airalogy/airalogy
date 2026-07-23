import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyAimdDeclarativeMigration,
  compareAimdJsonSchemas,
  hashAimdMigrationManifest,
  validateAimdMigrationManifest,
  validateAimdProtocolContract,
} from '../dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(__dirname, '../../../..')
const fixture = JSON.parse(readFileSync(
  path.join(monorepoRoot, 'spec/fixtures/resource-contract/contracts.json'),
  'utf8',
))

test('schema compatibility matches the shared Python/npm fixture', () => {
  for (const entry of fixture.compatibility) {
    const report = compareAimdJsonSchemas(entry.before, entry.after)
    assert.equal(report.status, entry.level, entry.name)
    assert.equal(report.recommended_bump, entry.recommended_bump, entry.name)
  }
})

test('declarative migration matches the shared Python/npm fixture', async () => {
  const entry = fixture.migration
  assert.deepEqual(validateAimdMigrationManifest(entry.manifest), [])
  const result = applyAimdDeclarativeMigration(entry.input, entry.manifest)

  assert.equal(result.status, 'completed')
  assert.deepEqual(result.data, entry.output)
  assert.match(await hashAimdMigrationManifest(entry.manifest), /^[a-f0-9]{64}$/)
})

test('ResourceRef metadata validates roles and numeric quantity fields', () => {
  const fields = {
    var: ['source', 'amount'],
    var_definitions: [
      {
        id: 'source',
        type: 'ResourceRef["plasmid"]',
        kwargs: {
          resource_role: 'input',
          quantity_field: 'amount',
          container_required: true,
        },
      },
      { id: 'amount', type: 'Decimal' },
    ],
    var_table: [],
    client_assigner: [],
    connectors: [],
    collectors: [],
    workflow: [],
    quiz: [],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
  }

  assert.deepEqual(validateAimdProtocolContract({ kind: 'experiment' }, fields), [])
})

test('resource_definition rejects experimental runtime constructs', () => {
  const fields = {
    var: ['name'],
    var_definitions: [{ id: 'name', type: 'str' }],
    var_table: [],
    client_assigner: [],
    connectors: [],
    collectors: [],
    workflow: [],
    quiz: [],
    step: ['prepare'],
    check: ['confirm'],
    ref_step: [],
    ref_var: [],
  }

  const issues = validateAimdProtocolContract({ kind: 'resource_definition' }, fields)
  assert.equal(issues.length, 2)
  assert.ok(issues.every(issue => issue.code === 'resource_definition_forbidden_feature'))
})

test('custom migration functions require a declared package hash', () => {
  const issues = validateAimdMigrationManifest({
    version: 'airalogy.migration.v1',
    from: '1.0.0',
    to: '2.0.0',
    transform: { entrypoint: 'migrations/normalize.py:transform' },
  })

  assert.ok(issues.some(issue => issue.path === 'transform.code_hash'))
})
