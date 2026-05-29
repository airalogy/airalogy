import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const runtimeDir = path.join(repoRoot, 'packages/runtime/airalogy-engine-image')
const dockerfilePath = path.join(runtimeDir, 'Dockerfile')
const requirementsPath = path.join(runtimeDir, 'protocol_requirements.txt')
const defaultRootfsDir = path.join(runtimeDir, 'airalogy-engine-image')
const defaultTarPath = path.join(runtimeDir, 'airalogy-engine-image.tar')
const manifestName = '.airalogy-rootfs.json'
const localPythonPackageDir = path.join(repoRoot, 'packages/pypi/airalogy')
const defaultBuildxBuilder = 'airalogy-engine-oci'
const fallbackBuildxBuilder = `${defaultBuildxBuilder}-container`

function parseArgs(argv) {
  const envBuildxBuilder = process.env.AIRALOGY_ENGINE_BUILDX_BUILDER
  const options = {
    force: false,
    image: process.env.AIRALOGY_ENGINE_IMAGE_TAG || 'airalogy-engine:latest',
    rootfsDir: process.env.ROOTFS_PATH || defaultRootfsDir,
    tarPath: defaultTarPath,
    builder: envBuildxBuilder || defaultBuildxBuilder,
    builderExplicit: Boolean(envBuildxBuilder),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') {
      continue
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--image') {
      options.image = requireValue(argv, ++index, arg)
    } else if (arg === '--rootfs') {
      options.rootfsDir = path.resolve(requireValue(argv, ++index, arg))
    } else if (arg === '--tar') {
      options.tarPath = path.resolve(requireValue(argv, ++index, arg))
    } else if (arg === '--builder') {
      options.builder = requireValue(argv, ++index, arg)
      options.builderExplicit = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function requireValue(argv, index, optionName) {
  const value = argv[index]
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`)
  }
  return value
}

function printHelp() {
  console.log(`
Usage: pnpm build:engine-rootfs [-- --force] [-- --image airalogy-engine:latest]

Build the Airalogy Engine sandbox image and export it as the local rootfs used
by the Node.js and Python engine packages.

Options:
  --force          Rebuild even if a rootfs directory already exists.
  --image <tag>    Docker image tag to build and export.
  --rootfs <path>  Output rootfs directory. Defaults to packages/runtime/airalogy-engine-image/airalogy-engine-image.
  --tar <path>     Temporary Docker image archive path.
  --builder <name> Buildx builder name for OCI export. Defaults to ${defaultBuildxBuilder}.
`)
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(' ')
  console.log(`$ ${printable}`)
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${printable} exited with code ${result.status}`)
  }
}

function checkCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'ignore',
    env: process.env,
  })

  return result.status === 0
}

function commandOutput(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
}

function ensureOciBuildxBuilder(builder, { allowFallback = false } = {}) {
  const inspect = commandOutput('docker', ['buildx', 'inspect', builder])
  if (inspect.status === 0) {
    const output = `${inspect.stdout}\n${inspect.stderr}`
    if (!output.includes('Driver: docker-container')) {
      if (allowFallback) {
        console.log(
          `Buildx builder "${builder}" exists but is not using the docker-container driver. ` +
          `Using "${fallbackBuildxBuilder}" instead.`,
        )
        return ensureOciBuildxBuilder(fallbackBuildxBuilder)
      }
      throw new Error(
        `Buildx builder "${builder}" already exists but is not using the docker-container driver.\n` +
        'Use a different builder name with --builder or AIRALOGY_ENGINE_BUILDX_BUILDER.',
      )
    }
    run('docker', ['buildx', 'inspect', builder, '--bootstrap'])
    return builder
  }

  run('docker', [
    'buildx',
    'create',
    '--name',
    builder,
    '--driver',
    'docker-container',
  ])
  run('docker', ['buildx', 'inspect', builder, '--bootstrap'])
  return builder
}

async function hashSources() {
  const hash = createHash('sha256')
  for (const filePath of [dockerfilePath, requirementsPath]) {
    hash.update(path.relative(repoRoot, filePath))
    hash.update('\0')
    hash.update(await readFile(filePath))
    hash.update('\0')
  }
  await hashDirectory(hash, localPythonPackageDir)
  return hash.digest('hex')
}

async function hashDirectory(hash, directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    if (
      entry.name === '__pycache__' ||
      entry.name === '.pytest_cache' ||
      entry.name === '.venv' ||
      entry.name === 'dist' ||
      entry.name.endsWith('.egg-info')
    ) {
      continue
    }

    const entryPath = path.join(directory, entry.name)
    const relativePath = path.relative(repoRoot, entryPath)
    if (entry.isDirectory()) {
      hash.update(`${relativePath}/`)
      hash.update('\0')
      await hashDirectory(hash, entryPath)
      continue
    }

    if (entry.isFile()) {
      const entryStat = await stat(entryPath)
      hash.update(relativePath)
      hash.update('\0')
      hash.update(String(entryStat.size))
      hash.update('\0')
      hash.update(await readFile(entryPath))
      hash.update('\0')
    }
  }
}

async function readManifest(rootfsDir) {
  const manifestPath = path.join(rootfsDir, manifestName)
  if (!existsSync(manifestPath)) {
    return null
  }

  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

async function writeManifest(rootfsDir, manifest) {
  await writeFile(
    path.join(rootfsDir, manifestName),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rootfsDir = path.resolve(options.rootfsDir)
  const tarPath = path.resolve(options.tarPath)
  const fingerprint = await hashSources()
  let shouldRebuildExistingRootfs = options.force

  if (existsSync(rootfsDir) && !options.force) {
    const manifest = await readManifest(rootfsDir)
    if (!existsSync(path.join(rootfsDir, 'oci-layout'))) {
      throw new Error(
        `Airalogy Engine rootfs directory exists but is incomplete: ${rootfsDir}\n` +
        'Rebuild it with: pnpm build:engine-rootfs -- --force',
      )
    }
    if (manifest?.fingerprint === fingerprint) {
      console.log(`Airalogy Engine rootfs is up to date: ${rootfsDir}`)
      return
    } else {
      console.log(`Airalogy Engine rootfs is stale: ${rootfsDir}`)
      console.log('Rebuilding because runtime source files changed.')
      shouldRebuildExistingRootfs = true
    }
  }

  if (!checkCommand('docker', ['--version'])) {
    throw new Error('Docker is required to build the Airalogy Engine rootfs.')
  }
  if (!checkCommand('docker', ['buildx', 'version'])) {
    throw new Error('Docker Buildx is required to build the Airalogy Engine rootfs.')
  }
  if (!checkCommand('docker', ['info'])) {
    throw new Error(
      [
        'Docker daemon is not running or not reachable.',
        'Start Docker Desktop (macOS: open -a Docker) and wait until `docker info` succeeds.',
        'If you use Colima, Rancher Desktop, or another Docker-compatible runtime, start it and select the matching Docker context before rebuilding the rootfs.',
      ].join('\n'),
    )
  }
  const buildxBuilder = ensureOciBuildxBuilder(options.builder, {
    allowFallback: !options.builderExplicit && options.builder === defaultBuildxBuilder,
  })

  if (shouldRebuildExistingRootfs) {
    await rm(rootfsDir, { recursive: true, force: true })
    await rm(tarPath, { force: true })
  }

  await mkdir(path.dirname(rootfsDir), { recursive: true })
  await mkdir(rootfsDir, { recursive: true })

  run('docker', [
    'buildx',
    'build',
    '--builder',
    buildxBuilder,
    '-f',
    dockerfilePath,
    '-t',
    options.image,
    '--output',
    `type=oci,dest=${tarPath}`,
    '.',
  ])
  run('tar', ['-xf', tarPath, '-C', rootfsDir], { cwd: runtimeDir })
  await rm(tarPath, { force: true })

  await writeManifest(rootfsDir, {
    schemaVersion: 1,
    image: options.image,
    builtAt: new Date().toISOString(),
    fingerprint,
    sources: [
      path.relative(repoRoot, dockerfilePath),
      path.relative(repoRoot, requirementsPath),
      path.relative(repoRoot, localPythonPackageDir),
    ],
  })

  console.log(`Airalogy Engine rootfs ready: ${rootfsDir}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
