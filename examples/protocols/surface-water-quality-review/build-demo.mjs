import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createProtocolAiraArchive, createRecordsAiraArchive, openAiraArchive } from '../../../packages/npm/aira-core/dist/index.js'

const source = new URL('./zh-CN/', import.meta.url)
const output = new URL('../../../.tmp/surface-water-quality-review/', import.meta.url)
const aimd = await readFile(new URL('protocol.aimd', source), 'utf8')
const toml = await readFile(new URL('protocol.toml', source), 'utf8')
const fixtures = JSON.parse(await readFile(new URL('demo-records.json', source), 'utf8'))
const options = {
  aimd,
  protocol: { protocol_id: 'surface_water_quality_review_zh', protocol_version: '0.1.0', protocol_name: '地表水监测数据复核（演示）' },
  files: [{ path: 'protocol.toml', data: toml }],
  createdAt: '2026-11-03T00:00:00Z',
}
await mkdir(output, { recursive: true })
for (const [name, bytes] of [
  ['protocol.aira', await createProtocolAiraArchive(options)],
  ['demo-records.aira', await createRecordsAiraArchive({ ...options, records: fixtures.records.map(record => ({ record })) })],
]) {
  const validation = await (await openAiraArchive(bytes)).validate()
  if (!validation.ok) throw new Error(validation.issues.join('\n'))
  await writeFile(new URL(name, output), bytes)
  console.log(fileURLToPath(new URL(name, output)))
}
