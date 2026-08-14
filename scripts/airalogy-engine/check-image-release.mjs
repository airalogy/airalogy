import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(__dirname, '../..')
const runtimeDirectory = path.join(
  repositoryRoot,
  'packages/runtime/airalogy-engine-image',
)

const readText = async filePath => (await readFile(filePath, 'utf8')).trim()
const readJson = async filePath => JSON.parse(await readText(filePath))

const imageVersion = await readText(path.join(runtimeDirectory, 'VERSION'))
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(imageVersion)) {
  throw new Error(`Invalid Engine image version: ${imageVersion}`)
}

const corePackage = await readJson(
  path.join(repositoryRoot, 'packages/pypi/airalogy/package.json'),
)
const coreProject = await readText(
  path.join(repositoryRoot, 'packages/pypi/airalogy/pyproject.toml'),
)
const coreProjectVersion = /^version\s*=\s*"([^"]+)"$/mu.exec(coreProject)?.[1]
if (corePackage.version !== imageVersion || coreProjectVersion !== imageVersion) {
  throw new Error(
    `Engine image ${imageVersion} must match Airalogy Core ` +
      `${corePackage.version}/${coreProjectVersion ?? 'missing'}`,
  )
}

const expectedImage = `ghcr.io/airalogy/airalogy-engine:${imageVersion}`
const filesWithDefaultImage = [
  'packages/pypi/airalogy-engine/src/airalogy_engine/engine.py',
  'packages/pypi/airalogy-engine/tests/conftest.py',
  'packages/npm/airalogy-engine/src/index.ts',
  'packages/npm/airalogy-engine/tests/engine.test.ts',
  'apps/protocol-demo/scripts/server.mjs',
  'apps/protocol-demo/src/App.vue',
]
for (const relativePath of filesWithDefaultImage) {
  const contents = await readText(path.join(repositoryRoot, relativePath))
  if (!contents.includes(expectedImage)) {
    throw new Error(`${relativePath} must use ${expectedImage}`)
  }
}

const requirements = await readText(
  path.join(runtimeDirectory, 'protocol_requirements.txt'),
)
if (/^airalogy(?:\[|[=<>~!])/mu.test(requirements)) {
  throw new Error(
    'protocol_requirements.txt must not install a stale remote Airalogy Core; the Dockerfile installs the checked-out source',
  )
}

const dockerfile = await readText(path.join(runtimeDirectory, 'Dockerfile'))
for (const requiredContract of [
  'ARG ENGINE_IMAGE_VERSION=',
  'ARG AIRALOGY_CORE_VERSION=',
  'org.opencontainers.image.version=',
  'io.airalogy.core.version=',
]) {
  if (!dockerfile.includes(requiredContract)) {
    throw new Error(`Engine Dockerfile is missing ${requiredContract}`)
  }
}

const tagArgumentIndex = process.argv.indexOf('--tag')
if (tagArgumentIndex !== -1) {
  const suppliedTag = process.argv[tagArgumentIndex + 1]
  const expectedTag = `engine-image-v${imageVersion}`
  if (suppliedTag !== expectedTag) {
    throw new Error(`Release tag ${suppliedTag ?? 'missing'} must be ${expectedTag}`)
  }
}

console.log(
  `Airalogy Engine image ${imageVersion} is aligned with Core and ${expectedImage}`,
)
