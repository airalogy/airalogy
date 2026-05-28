import { createReadStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
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
const fileStoreRoot = path.join(draftRoot, 'files')
const defaultRootfsPath = path.join(
  monorepoRoot,
  'packages/runtime/airalogy-engine-image/airalogy-engine-image',
)
const defaultImage = 'numbcoder/airalogy-engine:0.1'
const port = Number(process.env.PORT ?? process.env.PROTOCOL_DEMO_PORT ?? 5190)
const isDev = process.argv.includes('--dev') || !process.argv.includes('--prod')
const jsonLimitBytes = 1_000_000
const uploadLimitBytes = Number(process.env.AIRALOGY_PROTOCOL_DEMO_UPLOAD_LIMIT_BYTES ?? 50 * 1024 * 1024)
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

function sendBuffer(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-length': body.byteLength,
    ...headers,
  })
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

function defaultAiralogyEndpoint(options = {}) {
  if (process.env.AIRALOGY_PROTOCOL_DEMO_BASE_URL) {
    return process.env.AIRALOGY_PROTOCOL_DEMO_BASE_URL.replace(/\/+$/, '')
  }
  if (process.env.AIRALOGY_BASE_URL) {
    return process.env.AIRALOGY_BASE_URL.replace(/\/+$/, '')
  }
  if (process.env.AIRALOGY_ENDPOINT) {
    return process.env.AIRALOGY_ENDPOINT.replace(/\/+$/, '')
  }
  if (options.image && !options.rootfsPath) {
    return `http://host.docker.internal:${port}`
  }
  return `http://127.0.0.1:${port}`
}

function resolveEngineEnvVars(input, options, protocolId) {
  const userEnvVars = sanitizeEnvVars(input) ?? {}
  const endpoint = defaultAiralogyEndpoint(options)
  const envVars = {
    AIRALOGY_BASE_URL: endpoint,
    AIRALOGY_ENDPOINT: endpoint,
    AIRALOGY_API_KEY: process.env.AIRALOGY_PROTOCOL_DEMO_API_KEY ?? 'protocol-demo-local',
    AIRALOGY_PROTOCOL_ID: protocolId,
    ...userEnvVars,
  }

  if (userEnvVars.AIRALOGY_BASE_URL && !userEnvVars.AIRALOGY_ENDPOINT) {
    envVars.AIRALOGY_ENDPOINT = userEnvVars.AIRALOGY_BASE_URL
  }
  if (userEnvVars.AIRALOGY_ENDPOINT && !userEnvVars.AIRALOGY_BASE_URL) {
    envVars.AIRALOGY_BASE_URL = userEnvVars.AIRALOGY_ENDPOINT
  }

  return envVars
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

function isRootfsAvailable(rootfsPath = defaultRootfsPath) {
  return existsSync(path.join(rootfsPath, 'oci-layout'))
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

  if (rootfsPath || mode === 'rootfs' || isRootfsAvailable()) {
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

async function loadRequestBody(req, limitBytes) {
  const chunks = []
  let total = 0

  for await (const chunk of req) {
    total += chunk.byteLength
    if (total > limitBytes) {
      throw new Error('Request body is too large')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

async function loadJsonBody(req) {
  const bodyBuffer = await loadRequestBody(req, jsonLimitBytes)

  if (bodyBuffer.byteLength === 0) {
    return {}
  }

  const body = bodyBuffer.toString('utf8')
  return body.trim() ? JSON.parse(body) : {}
}

function parseContentDisposition(value) {
  const result = {}
  for (const part of value.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=')
    if (!rawKey) continue
    const rawValue = rawValueParts.join('=').trim()
    result[rawKey.toLowerCase()] = rawValue.replace(/^"|"$/g, '')
  }
  return result
}

async function loadMultipartBody(req) {
  const contentTypeHeader = req.headers['content-type']
  const contentTypeValue = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
  const boundary = contentTypeValue?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1]
    ?? contentTypeValue?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2]
  if (!boundary) {
    throw new Error('Missing multipart boundary')
  }

  const rawBody = (await loadRequestBody(req, uploadLimitBytes)).toString('latin1')
  const parts = rawBody.split(`--${boundary}`)
  const fields = {}
  let file = null

  for (const rawPart of parts) {
    if (!rawPart || rawPart === '--\r\n' || rawPart === '--') continue
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n--$/, '').replace(/\r\n$/, '')
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd < 0) continue

    const headerLines = part.slice(0, headerEnd).split('\r\n')
    const headers = {}
    for (const line of headerLines) {
      const separator = line.indexOf(':')
      if (separator < 0) continue
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim()
    }

    const disposition = headers['content-disposition']
    if (!disposition) continue
    const dispositionParams = parseContentDisposition(disposition)
    const name = dispositionParams.name
    if (!name) continue

    const content = Buffer.from(part.slice(headerEnd + 4), 'latin1')
    if (dispositionParams.filename !== undefined) {
      file = {
        fieldName: name,
        fileName: path.basename(dispositionParams.filename || 'upload.bin'),
        contentType: headers['content-type'] || 'application/octet-stream',
        content,
      }
    } else {
      fields[name] = content.toString('utf8')
    }
  }

  return { fields, file }
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

function guessContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.csv') return 'text/csv; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function normalizeFileId(value) {
  const fileId = decodeURIComponent(String(value ?? ''))
  if (!/^airalogy\.id\.file\.[a-f0-9-]+$/i.test(fileId)) {
    throw new Error(`Invalid Airalogy file id: ${fileId}`)
  }
  return fileId
}

function storedFilePath(fileId) {
  return path.join(fileStoreRoot, `${fileId}.bin`)
}

function storedFileMetaPath(fileId) {
  return path.join(fileStoreRoot, `${fileId}.json`)
}

async function storeUploadedFile(file) {
  if (!file?.content || file.content.byteLength === 0) {
    throw new Error('Uploaded file is empty')
  }

  await mkdir(fileStoreRoot, { recursive: true })
  const fileId = `airalogy.id.file.${randomUUID()}`
  const fileName = file.fileName || 'upload.bin'
  const contentType = file.contentType && file.contentType !== 'application/octet-stream'
    ? file.contentType
    : guessContentType(fileName)
  const metadata = {
    id: fileId,
    file_name: fileName,
    name: fileName,
    content_type: contentType,
    size: file.content.byteLength,
    uploaded_at: new Date().toISOString(),
  }

  await writeFile(storedFilePath(fileId), file.content)
  await writeFile(storedFileMetaPath(fileId), JSON.stringify(metadata, null, 2), 'utf8')
  return metadata
}

async function readStoredFile(fileIdValue) {
  const fileId = normalizeFileId(fileIdValue)
  const metadataPath = storedFileMetaPath(fileId)
  const filePath = storedFilePath(fileId)
  if (!existsSync(metadataPath) || !existsSync(filePath)) {
    throw new Error(`Unknown Airalogy file id: ${fileId}`)
  }

  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  return {
    metadata,
    content: await readFile(filePath),
  }
}

function collectAiralogyFileIds(value, result = new Set()) {
  if (typeof value === 'string' && /^airalogy\.id\.file\.[a-f0-9-]+$/i.test(value)) {
    result.add(value)
    return result
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAiralogyFileIds(item, result)
    }
    return result
  }

  if (isPlainObject(value)) {
    for (const item of Object.values(value)) {
      collectAiralogyFileIds(item, result)
    }
  }

  return result
}

async function buildFileBridgeInputs(value) {
  const inputs = []

  for (const fileId of collectAiralogyFileIds(value)) {
    const metadataPath = storedFileMetaPath(fileId)
    const filePath = storedFilePath(fileId)
    if (!existsSync(metadataPath) || !existsSync(filePath)) {
      continue
    }

    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    inputs.push({
      id: fileId,
      path: filePath,
      fileName: metadata.file_name ?? metadata.name,
      contentType: metadata.content_type,
    })
  }

  return inputs
}

async function withFileBridge(options, values) {
  await mkdir(fileStoreRoot, { recursive: true })
  const outputDir = await mkdtemp(path.join(draftRoot, 'file-bridge-output-'))
  return {
    outputDir,
    options: {
      ...options,
      fileBridge: {
        ...(options.fileBridge ?? {}),
        inputs: await buildFileBridgeInputs(values),
        outputDir,
      },
    },
  }
}

async function persistFileBridgeOutputs(result) {
  if (!result || !Array.isArray(result.files)) {
    return result
  }

  await mkdir(fileStoreRoot, { recursive: true })
  const files = []
  for (const file of result.files) {
    if (!isPlainObject(file) || typeof file.id !== 'string' || typeof file.path !== 'string') {
      continue
    }

    const fileId = normalizeFileId(file.id)
    const content = await readFile(file.path)
    const metadataPath = path.join(path.dirname(file.path), `${fileId}.json`)
    const metadata = existsSync(metadataPath)
      ? JSON.parse(await readFile(metadataPath, 'utf8'))
      : { ...file }
    delete metadata.path

    await writeFile(storedFilePath(fileId), content)
    await writeFile(storedFileMetaPath(fileId), JSON.stringify(metadata, null, 2), 'utf8')
    files.push(metadata)
  }

  return {
    ...result,
    files,
  }
}

function fileDownloadHeaders(metadata) {
  const fileName = String(metadata.file_name ?? metadata.name ?? 'download.bin').replace(/"/g, '')
  return {
    'content-type': metadata.content_type || guessContentType(fileName),
    'content-disposition': `inline; filename="${fileName}"`,
    'cache-control': 'no-store',
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

async function callEngine(action, protocolDir, body, protocolId) {
  const engine = await loadEngineModule()
  const options = resolveSandboxOptions(body.sandbox)
  const envVars = resolveEngineEnvVars(body.envVars, options, protocolId)
  const draftSourceFiles = normalizeDraftSourceFiles(body.sourceFiles)
  let draftProtocolDir

  if (draftSourceFiles) {
    draftProtocolDir = await createDraftProtocolDir(draftSourceFiles)
    protocolDir = draftProtocolDir
  }

  try {
    if (action === 'parse') {
      return engine.parseProtocol(protocolDir, envVars, options)
    }

    if (action === 'assign') {
      if (typeof body.varName !== 'string' || !body.varName.trim()) {
        throw new Error('varName is required')
      }
      const dependentData = isPlainObject(body.dependentData) ? body.dependentData : {}
      const fileBridge = await withFileBridge(options, dependentData)
      try {
        const result = await engine.assignVariable(
          protocolDir,
          body.varName.trim(),
          dependentData,
          envVars,
          fileBridge.options,
        )
        return persistFileBridgeOutputs(result)
      } finally {
        void rm(fileBridge.outputDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }

    if (action === 'validate') {
      const vars = isPlainObject(body.vars) ? body.vars : {}
      return engine.validateVariables(protocolDir, vars, envVars, options)
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
      exists: isRootfsAvailable(),
    },
    image: process.env.SANDBOX_IMAGE ?? defaultImage,
    mode: process.env.SANDBOX_MODE ?? (isRootfsAvailable() ? 'rootfs' : 'unconfigured'),
  }
}

async function handleAiralogyFileApi(req, res) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const pathname = requestUrl.pathname

  if (!pathname.startsWith('/airalogy/')) {
    return false
  }

  try {
    if (req.method === 'POST' && pathname === '/airalogy/upload') {
      const { file } = await loadMultipartBody(req)
      const metadata = await storeUploadedFile(file)
      sendJson(res, 200, metadata)
      return true
    }

    const downloadMatch = pathname.match(/^\/airalogy\/download\/(.+)$/)
    if (downloadMatch && req.method === 'GET') {
      const { metadata, content } = await readStoredFile(downloadMatch[1])
      sendBuffer(res, 200, content, fileDownloadHeaders(metadata))
      return true
    }

    const urlMatch = pathname.match(/^\/airalogy\/get_file_url\/(.+)$/)
    if (urlMatch && req.method === 'GET') {
      const fileId = normalizeFileId(urlMatch[1])
      const endpoint = defaultAiralogyEndpoint()
      sendJson(res, 200, {
        url: `${endpoint}/airalogy/download/${encodeURIComponent(fileId)}`,
      })
      return true
    }

    sendJson(res, 404, { message: `Unknown Airalogy route: ${pathname}` })
    return true
  } catch (err) {
    sendJson(res, 500, {
      message: err instanceof Error ? err.message : String(err),
    })
    return true
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

    if (req.method === 'POST' && pathname === '/api/files/upload') {
      const { file } = await loadMultipartBody(req)
      const metadata = await storeUploadedFile(file)
      sendJson(res, 200, { ok: true, result: metadata })
      return true
    }

    const fileMatch = pathname.match(/^\/api\/files\/(.+)$/)
    if (fileMatch && req.method === 'GET') {
      const { metadata, content } = await readStoredFile(fileMatch[1])
      sendBuffer(res, 200, content, fileDownloadHeaders(metadata))
      return true
    }

    const match = pathname.match(/^\/api\/protocols\/([^/]+)\/([^/]+)\/(parse|assign|validate)$/)
    if (match && req.method === 'POST') {
      const [, id, locale, action] = match
      const body = await loadJsonBody(req)
      const { protocolDir } = await resolveProtocolVariant(decodeURIComponent(id), decodeURIComponent(locale))
      const result = await callEngine(action, protocolDir, body, decodeURIComponent(id))
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
      if (await handleAiralogyFileApi(req, res)) return
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
    if (await handleAiralogyFileApi(req, res)) return
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
