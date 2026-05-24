import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pypiRoot = path.join(repoRoot, 'packages/pypi')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function readText(filePath) {
  return readFileSync(filePath, 'utf8')
}

function listPythonPackageDirs() {
  return readdirSync(pypiRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages/pypi', entry.name))
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

function getChangedPackageJsonDirs() {
  const all = process.argv.includes('--all')
    || process.env.RELEASE_PYTHON_ALL === '1'
    || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'

  if (all) {
    return null
  }

  const diffArgs = process.env.GITHUB_ACTIONS === 'true'
    ? ['diff', '--name-status', 'HEAD^', 'HEAD']
    : ['diff', '--name-status', 'HEAD']

  const changedPackageDirs = new Set()
  const lines = execFileSync('git', diffArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)

  for (const line of lines) {
    const [status, file] = line.split('\t')
    const match = file?.match(/^(packages\/pypi\/[^/]+)\/package\.json$/)

    if (match && status !== 'A') {
      changedPackageDirs.add(match[1])
    }
  }

  return changedPackageDirs
}

function candidatePackageDirs() {
  const allPackageDirs = listPythonPackageDirs()
  const changedPackageDirs = getChangedPackageJsonDirs()

  if (changedPackageDirs === null) {
    return allPackageDirs
  }

  return allPackageDirs.filter((packageDir) => changedPackageDirs.has(packageDir))
}

function getPyprojectVersion(packageDir) {
  const pyprojectPath = path.join(repoRoot, packageDir, 'pyproject.toml')
  const pyproject = readText(pyprojectPath)
  const match = pyproject.match(/^\s*version\s*=\s*"([^"]+)"/m)
  if (!match) {
    throw new Error(`Could not find project.version in ${packageDir}/pyproject.toml`)
  }
  return match[1]
}

async function pypiVersionExists(packageName, version) {
  const response = await fetch(
    `https://pypi.org/pypi/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/json`,
    { headers: { accept: 'application/json' } },
  )

  if (response.status === 200) {
    return true
  }

  if (response.status === 404) {
    return false
  }

  throw new Error(`Unexpected PyPI response for ${packageName} ${version}: ${response.status}`)
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
  }
}

const packagesToPublish = []

for (const packageDir of candidatePackageDirs()) {
  const packageJson = readJson(path.join(repoRoot, packageDir, 'package.json'))
  const pyprojectVersion = getPyprojectVersion(packageDir)

  if (packageJson.version !== pyprojectVersion) {
    throw new Error(
      `${packageDir} has package.json version ${packageJson.version}, but pyproject.toml version ${pyprojectVersion}`,
    )
  }

  const exists = await pypiVersionExists(packageJson.name, packageJson.version)
  if (!exists) {
    packagesToPublish.push({
      name: packageJson.name,
      version: packageJson.version,
      dir: packageDir,
    })
  }
}

setOutput('has_packages', packagesToPublish.length > 0 ? 'true' : 'false')
setOutput('package_dirs', packagesToPublish.map((packageInfo) => packageInfo.dir).join(' '))

console.log(JSON.stringify({ packages: packagesToPublish }, null, 2))
