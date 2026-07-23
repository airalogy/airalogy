import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(
  resolve(__dirname, '../components/AimdResourceForm.vue'),
  'utf8',
)

describe('AimdResourceForm', () => {
  it('uses the shared Recorder and enforces the resource_definition contract', () => {
    expect(source).toContain('validateAimdProtocolContract')
    expect(source).toContain('{ kind: "resource_definition" }')
    expect(source).toContain(':resource-resolvers="resourceResolvers"')
    expect(source).toContain(':show-search="false"')
    expect(source).toContain('contract-error')
  })
})
