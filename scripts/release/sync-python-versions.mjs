import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checkOnly = process.argv.includes('--check')

const pythonPackages = [
  'packages/pypi/airalogy',
  'packages/pypi/airalogy-engine',
]

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function writeText(relativePath, content) {
  writeFileSync(path.join(repoRoot, relativePath), content)
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function getTomlProjectName(pyprojectText, relativePath) {
  const match = pyprojectText.match(/^\s*name\s*=\s*"([^"]+)"/m)
  if (!match) {
    throw new Error(`Could not find project.name in ${relativePath}`)
  }
  return match[1]
}

function replaceProjectVersion(pyprojectText, version, relativePath) {
  const updated = pyprojectText.replace(
    /(^\[project\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
    (_match, prefix, suffix) => `${prefix}${version}${suffix}`,
  )
  if (updated === pyprojectText && !pyprojectText.includes(`version = "${version}"`)) {
    throw new Error(`Could not update project.version in ${relativePath}`)
  }
  return updated
}

function replaceAiralogyEngineDevDependency(pyprojectText, airalogyVersion) {
  return pyprojectText.replace(
    /("airalogy~=)[^"]+(")/,
    (_match, prefix, suffix) => `${prefix}${airalogyVersion}${suffix}`,
  )
}

const versions = new Map()

for (const packageDir of pythonPackages) {
  const packageJson = readJson(`${packageDir}/package.json`)
  versions.set(packageJson.name, packageJson.version)
}

const changedFiles = []

for (const packageDir of pythonPackages) {
  const packageJson = readJson(`${packageDir}/package.json`)
  const pyprojectPath = `${packageDir}/pyproject.toml`
  const original = readText(pyprojectPath)
  const projectName = getTomlProjectName(original, pyprojectPath)

  if (projectName !== packageJson.name) {
    throw new Error(
      `${pyprojectPath} project.name is ${projectName}, but package.json name is ${packageJson.name}`,
    )
  }

  let updated = replaceProjectVersion(original, packageJson.version, pyprojectPath)

  if (packageJson.name === 'airalogy-engine') {
    updated = replaceAiralogyEngineDevDependency(updated, versions.get('airalogy'))
  }

  if (updated !== original) {
    changedFiles.push(pyprojectPath)
    if (!checkOnly) {
      writeText(pyprojectPath, updated)
    }
  }
}

if (checkOnly && changedFiles.length > 0) {
  console.error('Python version metadata is out of sync:')
  for (const file of changedFiles) {
    console.error(`- ${file}`)
  }
  console.error('Run `corepack pnpm sync:python-versions`.')
  process.exit(1)
}

if (changedFiles.length === 0) {
  console.log('Python version metadata is already in sync.')
} else {
  console.log(`Updated Python version metadata in ${changedFiles.join(', ')}.`)
}
