import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

function parseArgs(argv) {
  const options = {
    force: false,
    image: process.env.AIRALOGY_ENGINE_IMAGE_TAG || 'airalogy-engine:latest',
    rootfsDir: process.env.ROOTFS_PATH || defaultRootfsDir,
    tarPath: defaultTarPath,
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

async function hashSources() {
  const hash = createHash('sha256')
  for (const filePath of [dockerfilePath, requirementsPath]) {
    hash.update(path.relative(repoRoot, filePath))
    hash.update('\0')
    hash.update(await readFile(filePath))
    hash.update('\0')
  }
  return hash.digest('hex')
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

  if (existsSync(rootfsDir) && !options.force) {
    const manifest = await readManifest(rootfsDir)
    if (!existsSync(path.join(rootfsDir, 'manifest.json'))) {
      throw new Error(
        `Airalogy Engine rootfs directory exists but is incomplete: ${rootfsDir}\n` +
        'Rebuild it with: pnpm build:engine-rootfs -- --force',
      )
    }
    if (manifest?.fingerprint === fingerprint) {
      console.log(`Airalogy Engine rootfs is up to date: ${rootfsDir}`)
    } else {
      console.log(`Airalogy Engine rootfs already exists: ${rootfsDir}`)
      console.log('It may be stale. Rebuild with: pnpm build:engine-rootfs -- --force')
    }
    return
  }

  if (!checkCommand('docker', ['--version'])) {
    throw new Error('Docker is required to build the Airalogy Engine rootfs.')
  }

  if (options.force) {
    await rm(rootfsDir, { recursive: true, force: true })
    await rm(tarPath, { force: true })
  }

  await mkdir(path.dirname(rootfsDir), { recursive: true })
  await mkdir(rootfsDir, { recursive: true })

  run('docker', ['build', '-t', options.image, '.'], { cwd: runtimeDir })
  run('docker', ['save', '-o', tarPath, options.image], { cwd: runtimeDir })
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
    ],
  })

  console.log(`Airalogy Engine rootfs ready: ${rootfsDir}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
