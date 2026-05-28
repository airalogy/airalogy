import { createReadStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')
const monorepoRoot = path.resolve(appRoot, '../..')
const protocolRoot = path.join(monorepoRoot, 'examples/protocols')
const registryPath = path.join(protocolRoot, 'index.json')
const distRoot = path.join(appRoot, 'dist')
const draftRoot = path.join(monorepoRoot, 'protocol-demo-tmp')
const defaultRootfsPath = path.join(
  monorepoRoot,
  'packages/runtime/airalogy-engine-image/airalogy-engine-image',
)
const defaultImage = 'numbcoder/airalogy-engine:0.1'
const port = Number(process.env.PORT ?? process.env.PROTOCOL_DEMO_PORT ?? 5190)
const isDev = process.argv.includes('--dev') || !process.argv.includes('--prod')
const jsonLimitBytes = 1_000_000
const draftCleanupDelayMs = 60_000
let engineModulePromise

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendText(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeResolve(root, relativePath) {
  const resolved = path.resolve(root, relativePath)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes protocol root: ${relativePath}`)
  }
  return resolved
}

function normalizeDraftRelativePath(value) {
  if (typeof value !== 'string') {
    throw new Error('Draft source file path must be a string')
  }

  const normalized = path.posix.normalize(value.replace(/\\/g, '/').replace(/^\/+/, ''))
  if (
    !normalized
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || path.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid draft source file path: ${value}`)
  }

  return normalized
}

function normalizeDraftSourceFiles(value) {
  if (value === undefined) {
    return null
  }
  if (!Array.isArray(value)) {
    throw new Error('Draft source files must be an array')
  }

  return value.map((file) => {
    if (!isPlainObject(file)) {
      throw new Error('Draft source file must be an object')
    }
    if (typeof file.content !== 'string') {
      throw new Error('Draft source file content must be a string')
    }

    return {
      relativePath: normalizeDraftRelativePath(file.relativePath),
      content: file.content,
    }
  })
}

async function createDraftProtocolDir(sourceFiles) {
  await mkdir(draftRoot, { recursive: true })
  const draftProtocolDir = await mkdtemp(path.join(draftRoot, 'protocol-'))

  for (const file of sourceFiles) {
    const targetPath = safeResolve(draftProtocolDir, file.relativePath)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, file.content, 'utf8')
  }

  return draftProtocolDir
}

function scheduleDraftProtocolDirCleanup(draftProtocolDir) {
  const timer = setTimeout(() => {
    void rm(draftProtocolDir, { recursive: true, force: true }).catch(() => undefined)
  }, draftCleanupDelayMs)
  timer.unref?.()
}

function sanitizeEnvVars(value) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const envVars = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      envVars[key] = String(rawValue)
    }
  }

  return Object.keys(envVars).length > 0 ? envVars : undefined
}

function numberOption(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function stringOption(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function booleanOption(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return fallback
}

function resolveSandboxOptions(input) {
  const sandbox = isPlainObject(input) ? input : {}
  const mode = stringOption(sandbox.mode) ?? process.env.SANDBOX_MODE
  const rootfsPath = stringOption(sandbox.rootfsPath) ?? process.env.ROOTFS_PATH
  const image = stringOption(sandbox.image) ?? process.env.SANDBOX_IMAGE
  const debug = booleanOption(sandbox.debug, process.env.AIRALOGY_PROTOCOL_DEMO_DEBUG === '1')
  const logFile = stringOption(sandbox.logFile) ?? process.env.AIRALOGY_PROTOCOL_DEMO_LOG_FILE

  const options = {
    timeout: numberOption(
      sandbox.timeout ?? process.env.AIRALOGY_PROTOCOL_DEMO_TIMEOUT,
      60,
      1,
      600,
    ),
    memoryMib: numberOption(
      sandbox.memoryMib ?? process.env.AIRALOGY_PROTOCOL_DEMO_MEMORY_MIB,
      512,
      128,
      8192,
    ),
    cpus: numberOption(sandbox.cpus ?? process.env.AIRALOGY_PROTOCOL_DEMO_CPUS, 1, 1, 16),
  }

  if (debug) {
    options.debug = true
  }
  if (logFile) {
    options.logFile = logFile
  }

  if (rootfsPath || mode === 'rootfs' || existsSync(defaultRootfsPath)) {
    options.rootfsPath = rootfsPath ?? defaultRootfsPath
  } else if (mode === 'image' || image) {
    options.image = image ?? defaultImage
  } else {
    throw new Error(
      `Local Airalogy Engine rootfs not found at ${defaultRootfsPath}. ` +
      'Run "pnpm build:engine-rootfs", set ROOTFS_PATH, or explicitly use sandbox mode "image".',
    )
  }

  return options
}

async function loadJsonBody(req) {
  const chunks = []
  let total = 0

  for await (const chunk of req) {
    total += chunk.byteLength
    if (total > jsonLimitBytes) {
      throw new Error('Request body is too large')
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const body = Buffer.concat(chunks).toString('utf8')
  return body.trim() ? JSON.parse(body) : {}
}

async function loadEngineModule() {
  if (!engineModulePromise) {
    engineModulePromise = import('@airalogy/airalogy-engine')
  }

  return engineModulePromise
}

async function readTextIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null
  }

  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) {
    return null
  }

  return readFile(filePath, 'utf8')
}

async function loadRegistry() {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'))

  const examples = await Promise.all(registry.examples.map(async (item) => {
    const variants = {}

    for (const locale of item.languages) {
      const protocolDirRelative = item.protocol_dir?.[locale]
      const aimdRelative = item.entry?.[locale]
      const tomlRelative = item.toml?.[locale]
      const assignerRelative = item.assigner?.[locale]
      const sampleDataRelative = item.sample_data?.[locale] ?? []

      const sampleData = await Promise.all(sampleDataRelative.map(async (relativePath) => {
        const absPath = safeResolve(protocolRoot, relativePath)
        return {
          path: relativePath,
          content: await readTextIfExists(absPath),
        }
      }))

      variants[locale] = {
        locale,
        protocolDir: protocolDirRelative,
        protocolDirPath: protocolDirRelative ? safeResolve(protocolRoot, protocolDirRelative) : null,
        aimdPath: aimdRelative,
        aimd: aimdRelative ? await readTextIfExists(safeResolve(protocolRoot, aimdRelative)) : null,
        tomlPath: tomlRelative,
        toml: tomlRelative ? await readTextIfExists(safeResolve(protocolRoot, tomlRelative)) : null,
        assignerPath: assignerRelative,
        assigner: assignerRelative ? await readTextIfExists(safeResolve(protocolRoot, assignerRelative)) : null,
        sampleData,
      }
    }

    return {
      ...item,
      variants,
    }
  }))

  return {
    ...registry,
    protocol_root: protocolRoot,
    examples,
  }
}

async function resolveProtocolVariant(id, locale) {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'))
  const protocol = registry.examples.find((item) => item.id === id)

  if (!protocol) {
    throw new Error(`Unknown protocol example: ${id}`)
  }
  if (!protocol.languages.includes(locale)) {
    throw new Error(`Protocol example ${id} does not provide locale ${locale}`)
  }

  const protocolDirRelative = protocol.protocol_dir?.[locale]
  if (!protocolDirRelative) {
    throw new Error(`Protocol example ${id}/${locale} has no protocol directory`)
  }

  return {
    protocol,
    protocolDir: safeResolve(protocolRoot, protocolDirRelative),
  }
}

async function callEngine(action, protocolDir, body) {
  const engine = await loadEngineModule()
  const envVars = sanitizeEnvVars(body.envVars)
  const options = resolveSandboxOptions(body.sandbox)
  const draftSourceFiles = normalizeDraftSourceFiles(body.sourceFiles)
  let draftProtocolDir

  if (draftSourceFiles) {
    draftProtocolDir = await createDraftProtocolDir(draftSourceFiles)
    protocolDir = draftProtocolDir
  }

  try {
    if (action === 'parse') {
      return envVars
        ? engine.parseProtocol(protocolDir, envVars, options)
        : engine.parseProtocol(protocolDir, options)
    }

    if (action === 'assign') {
      if (typeof body.varName !== 'string' || !body.varName.trim()) {
        throw new Error('varName is required')
      }
      const dependentData = isPlainObject(body.dependentData) ? body.dependentData : {}
      return envVars
        ? engine.assignVariable(protocolDir, body.varName.trim(), dependentData, envVars, options)
        : engine.assignVariable(protocolDir, body.varName.trim(), dependentData, options)
    }

    if (action === 'validate') {
      const vars = isPlainObject(body.vars) ? body.vars : {}
      return envVars
        ? engine.validateVariables(protocolDir, vars, envVars, options)
        : engine.validateVariables(protocolDir, vars, options)
    }

    throw new Error(`Unknown engine action: ${action}`)
  } finally {
    if (draftProtocolDir) {
      scheduleDraftProtocolDirCleanup(draftProtocolDir)
    }
  }
}

async function healthPayload() {
  let engine = { available: true }
  try {
    await loadEngineModule()
  } catch (err) {
    engine = {
      available: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  return {
    ok: true,
    engine,
    protocolRoot,
    rootfs: {
      path: defaultRootfsPath,
      exists: existsSync(defaultRootfsPath),
    },
    image: process.env.SANDBOX_IMAGE ?? defaultImage,
    mode: process.env.SANDBOX_MODE ?? (existsSync(defaultRootfsPath) ? 'rootfs' : 'unconfigured'),
  }
}

async function handleApi(req, res) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const pathname = requestUrl.pathname

  if (!pathname.startsWith('/api/')) {
    return false
  }

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, await healthPayload())
      return true
    }

    if (req.method === 'GET' && pathname === '/api/protocols') {
      sendJson(res, 200, await loadRegistry())
      return true
    }

    const match = pathname.match(/^\/api\/protocols\/([^/]+)\/([^/]+)\/(parse|assign|validate)$/)
    if (match && req.method === 'POST') {
      const [, id, locale, action] = match
      const body = await loadJsonBody(req)
      const { protocolDir } = await resolveProtocolVariant(decodeURIComponent(id), decodeURIComponent(locale))
      const result = await callEngine(action, protocolDir, body)
      sendJson(res, 200, { ok: true, result })
      return true
    }

    sendJson(res, 404, { ok: false, message: `Unknown API route: ${pathname}` })
    return true
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    })
    return true
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath)
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.ico') return 'image/x-icon'
  return 'application/octet-stream'
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(requestUrl.pathname)
  let filePath = safeResolve(distRoot, pathname === '/' ? 'index.html' : pathname.slice(1))

  if (!existsSync(filePath) || !(await stat(filePath)).isFile()) {
    filePath = path.join(distRoot, 'index.html')
  }

  res.writeHead(200, { 'content-type': contentType(filePath) })
  createReadStream(filePath).pipe(res)
}

async function createRequestHandler() {
  if (!isDev) {
    return async (req, res) => {
      if (await handleApi(req, res)) return
      if (!existsSync(distRoot)) {
        sendText(res, 500, 'dist/ is missing. Run pnpm --filter @airalogy/protocol-demo build first.')
        return
      }
      await serveStatic(req, res)
    }
  }

  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    root: appRoot,
    appType: 'spa',
    server: {
      middlewareMode: true,
    },
  })

  return async (req, res) => {
    if (await handleApi(req, res)) return
    vite.middlewares(req, res, () => {
      sendText(res, 404, 'Not found')
    })
  }
}

const requestHandler = await createRequestHandler()
const server = createServer((req, res) => {
  void requestHandler(req, res).catch((err) => {
    sendJson(res, 500, {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    })
  })
})

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`
  console.log(`Airalogy Protocol Demo listening at ${url}`)
  if (isDev) {
    console.log(`Vite dev middleware is active: ${pathToFileURL(appRoot).href}`)
  }
})
