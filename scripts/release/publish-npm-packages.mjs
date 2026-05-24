import { readdirSync, readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const npmRoot = path.join(repoRoot, 'packages/npm')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN || '',
    },
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function listNpmPackageDirs() {
  return readdirSync(npmRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages/npm', entry.name))
    .filter((packageDir) => {
      try {
        readJson(path.join(repoRoot, packageDir, 'package.json'))
        return true
      } catch {
        return false
      }
    })
    .sort()
}

function changedFiles() {
  if (process.argv.includes('--all') || process.env.RELEASE_NPM_ALL === '1') {
    return null
  }

  const diffArgs = process.env.GITHUB_ACTIONS === 'true'
    ? ['diff', '--name-only', 'HEAD^', 'HEAD']
    : ['diff', '--name-only', 'HEAD']

  return execFileSync('git', diffArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

function packagesToPublish() {
  const allPackageDirs = listNpmPackageDirs()
  const files = changedFiles()

  if (files === null) {
    return allPackageDirs
  }

  const changedPackageDirs = new Set()
  for (const file of files) {
    const match = file.match(/^(packages\/npm\/[^/]+)\/package\.json$/)
    if (match) {
      changedPackageDirs.add(match[1])
    }
  }

  return allPackageDirs.filter((packageDir) => changedPackageDirs.has(packageDir))
}

const packageDirs = packagesToPublish()

if (packageDirs.length === 0) {
  console.log('No npm package versions changed; skipping npm publish.')
  process.exit(0)
}

console.log(`Publishing npm packages: ${packageDirs.join(', ')}`)
run('corepack', ['pnpm', 'build:npm'])

for (const packageDir of packageDirs) {
  const packageJson = readJson(path.join(repoRoot, packageDir, 'package.json'))
  console.log(`Publishing ${packageJson.name}@${packageJson.version}`)
  run('corepack', [
    'pnpm',
    'publish',
    '--no-git-checks',
    '--access',
    'public',
    '--provenance',
  ], { cwd: path.join(repoRoot, packageDir) })
}
