#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '../..')
const outputPath = resolve(
  repoRoot,
  'packages/npm/aimd-core/src/types/airalogy-built-in-type-metadata.generated.json',
)
const checkOnly = process.argv.includes('--check')

const python = [
  'import json',
  'from airalogy.types import export_airalogy_type_metadata',
  'print(json.dumps(export_airalogy_type_metadata(load_plugins=False), ensure_ascii=False, indent=2))',
].join('; ')

const result = spawnSync(
  'uv',
  ['--directory', 'packages/pypi/airalogy', 'run', 'python', '-c', python],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '.uv-cache',
    },
    encoding: 'utf8',
  },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const nextContent = `${result.stdout.trimEnd()}\n`

if (checkOnly) {
  const currentContent = readFileSync(outputPath, 'utf8')
  if (currentContent !== nextContent) {
    console.error(`${outputPath} is out of date. Run pnpm sync:aimd-type-metadata.`)
    process.exit(1)
  }
  process.exit(0)
}

writeFileSync(outputPath, nextContent, 'utf8')
