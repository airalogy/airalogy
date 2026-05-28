import { BoxliteError, JsBoxlite } from "@boxlite-ai/boxlite";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXECUTOR_PATH = path.resolve(__dirname, "..", "protocol_executor.py");
const WORKING_DIR = "/home/airalogy/protocols";
const SANDBOX_LOG_FILE = "protocol_debug.log";
const CLEANUP_GRACE_MS = 1_000;
const DEFAULT_IMAGE = "numbcoder/airalogy-engine:0.1";
const FILE_BRIDGE_INPUT_DIR = `${WORKING_DIR}/.airalogy-file-bridge/inputs`;
const FILE_BRIDGE_OUTPUT_DIR = `${WORKING_DIR}/.airalogy-file-bridge/outputs`;
const backgroundCleanupTasks = new Set<Promise<void>>();

export interface ProtocolResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  output?: string;
  files?: SandboxFileBridgeOutput[];
}

export interface SandboxFileBridgeInput {
  id: string;
  path: string;
  fileName?: string;
  contentType?: string;
}

export interface SandboxFileBridgeOutput {
  id: string;
  path: string;
  file_name?: string;
  name?: string;
  content_type?: string;
  size?: number;
}

export interface SandboxFileBridgeOptions {
  inputs?: SandboxFileBridgeInput[];
  outputDir?: string;
}

export interface SandboxOptions {
  image?: string;
  rootfsPath?: string;
  timeout?: number;
  memoryMib?: number;
  cpus?: number;
  debug?: boolean;
  logFile?: string;
  fileBridge?: SandboxFileBridgeOptions;
}

type EnvVars = Record<string, string>;
type RuntimeBoxOptions = {
  memoryMib: number;
  cpus: number;
  workingDir: string;
  env?: Array<{ key: string; value: string }>;
  rootfsPath?: string;
  image?: string;
};

class SandboxExecutionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxExecutionTimeoutError";
  }
}

function isSandboxOptions(value: EnvVars | SandboxOptions | undefined): value is SandboxOptions {
  if (value === undefined) {
    return false;
  }

  return [
    "image",
    "rootfsPath",
    "timeout",
    "memoryMib",
    "cpus",
    "debug",
    "logFile",
    "fileBridge",
  ].some((key) => key in value);
}

function resolveEnvAndOptions(
  envVarsOrOptions: EnvVars | SandboxOptions | undefined,
  options: SandboxOptions | undefined,
): {
  envVars: EnvVars | undefined;
  options: SandboxOptions;
} {
  if (isSandboxOptions(envVarsOrOptions)) {
    return {
      envVars: undefined,
      options: envVarsOrOptions,
    };
  }

  return {
    envVars: envVarsOrOptions,
    options: options ?? {},
  };
}

function safeFileBridgeName(id: string): string {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function isFileBridgeInput(value: SandboxFileBridgeInput): boolean {
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.path === "string" &&
    value.path.length > 0
  );
}

function resolveFileBridgeInputs(inputs: SandboxFileBridgeInput[] | undefined): SandboxFileBridgeInput[] {
  if (!Array.isArray(inputs)) {
    return [];
  }

  return inputs.filter(isFileBridgeInput).map((input) => {
    const absPath = path.resolve(input.path);
    if (!existsSync(absPath) || !statSync(absPath).isFile()) {
      throw new Error(`fileBridge input must be a file: ${input.path}`);
    }

    return {
      ...input,
      path: absPath,
    };
  });
}

function isOciRootfsPath(rootfsPath: string): boolean {
  return (
    existsSync(rootfsPath) &&
    statSync(rootfsPath).isDirectory() &&
    existsSync(path.join(rootfsPath, "oci-layout"))
  );
}

async function execMkdir(box: any, dir: string): Promise<void> {
  const execution = await box.exec("mkdir", ["-p", dir], undefined, false);
  const result = await execution.wait();
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create sandbox directory: ${dir}`);
  }
}

function buildFileBridgeMap(inputs: SandboxFileBridgeInput[]): Record<string, Record<string, string>> {
  const fileMap: Record<string, Record<string, string>> = {};
  for (const input of inputs) {
    const sandboxFileName = `${safeFileBridgeName(input.id)}.bin`;
    const sandboxPath = `${FILE_BRIDGE_INPUT_DIR}/${sandboxFileName}`;
    fileMap[input.id] = {
      path: sandboxPath,
    };
    if (input.fileName) {
      fileMap[input.id].file_name = input.fileName;
    }
    if (input.contentType) {
      fileMap[input.id].content_type = input.contentType;
    }
  }

  return fileMap;
}

async function prepareFileBridge(
  box: any,
  inputs: SandboxFileBridgeInput[],
): Promise<void> {
  await execMkdir(box, FILE_BRIDGE_INPUT_DIR);
  await execMkdir(box, FILE_BRIDGE_OUTPUT_DIR);

  for (const input of inputs) {
    const sandboxFileName = `${safeFileBridgeName(input.id)}.bin`;
    const sandboxPath = `${FILE_BRIDGE_INPUT_DIR}/${sandboxFileName}`;
    await box.copyIn(input.path, sandboxPath, {
      includeParent: false,
      overwrite: true,
      followSymlinks: false,
    });
  }
}

async function copyOutFileBridgeOutputs(
  box: any,
  outputDir: string | undefined,
): Promise<SandboxFileBridgeOutput[]> {
  const hostOutputDir = outputDir ? path.resolve(outputDir) : mkdtempSync(path.join(os.tmpdir(), "airalogy-file-bridge-"));
  mkdirSync(hostOutputDir, { recursive: true });

  try {
    await box.copyOut(`${FILE_BRIDGE_OUTPUT_DIR}/`, hostOutputDir, {
      recursive: true,
      includeParent: false,
    });
  } catch {
    return [];
  }

  const outputs: SandboxFileBridgeOutput[] = [];
  for (const entry of readdirSync(hostOutputDir)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const metadataPath = path.join(hostOutputDir, entry);
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    const id = typeof metadata.id === "string" ? metadata.id : entry.slice(0, -".json".length);
    const filePath = path.join(hostOutputDir, `${id}.bin`);
    if (!existsSync(filePath)) {
      continue;
    }

    outputs.push({
      id,
      path: filePath,
      file_name: typeof metadata.file_name === "string" ? metadata.file_name : undefined,
      name: typeof metadata.name === "string" ? metadata.name : undefined,
      content_type: typeof metadata.content_type === "string" ? metadata.content_type : undefined,
      size: typeof metadata.size === "number" ? metadata.size : undefined,
    });
  }

  return outputs;
}

function trackBackgroundCleanup(task: Promise<void>): void {
  backgroundCleanupTasks.add(task);
  void task.finally(() => {
    backgroundCleanupTasks.delete(task);
  });
}

async function copyOutLog(box: any, logFile: string): Promise<void> {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "airalogy-engine-log-"));

  try {
    await box.copyOut(`${WORKING_DIR}/${SANDBOX_LOG_FILE}`, tmpDir, {
      includeParent: false,
    });

    const tmpLog = path.join(tmpDir, SANDBOX_LOG_FILE);
    if (!existsSync(tmpLog)) {
      return;
    }

    const logContent = readFileSync(tmpLog, "utf8");
    if (logContent) {
      appendFileSync(logFile, logContent, { encoding: "utf8" });
    }
  } catch {
    // Best-effort log collection should never fail the sandbox call.
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function decodeStreamChunk(line: string | Buffer | Uint8Array): string {
  if (typeof line === "string") {
    return line;
  }

  return Buffer.from(line).toString("utf8");
}

async function collectOutputStream(
  stream: { next(): Promise<string | Buffer | Uint8Array | null> } | null,
  outputLines: string[],
): Promise<void> {
  if (stream === null) {
    return;
  }

  try {
    while (true) {
      const line = await stream.next();
      if (line === null) {
        return;
      }
      outputLines.push(decodeStreamChunk(line));
    }
  } catch {
    // Stream collection is best-effort because timeout cleanup may close
    // the underlying pipes while readers are still draining.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForCleanup(promises: Promise<unknown>[]): Promise<void> {
  if (promises.length === 0) {
    return;
  }

  await Promise.race([
    Promise.allSettled(promises).then(() => undefined),
    sleep(CLEANUP_GRACE_MS),
  ]);
}

async function cleanupBox(box: any, runtime: any): Promise<void> {
  try {
    await box.stop();
  } catch {
    // Best-effort background cleanup.
  }

  try {
    if (typeof runtime.remove === "function") {
      await runtime.remove(box.id, true);
    }
  } catch {
    // Best-effort background cleanup.
  }
}

async function copyProtocolIntoBox(box: any, protocolPath: string): Promise<void> {
  await box.copyIn(`${protocolPath}/`, `${WORKING_DIR}/protocol/`, {
    recursive: true,
    overwrite: true,
    followSymlinks: false,
    includeParent: false,
  });
}

async function execCommandWithTimeout(
  box: any,
  command: string[],
  timeout: number,
): Promise<{
  execResult?: { exitCode: number };
  stdout: string;
  stderr: string;
  timedOut: boolean;
}> {
  const execution = await box.exec(command[0], command.slice(1), undefined, false);

  let stdoutStream: { next(): Promise<string | Buffer | Uint8Array | null> } | null = null;
  let stderrStream: { next(): Promise<string | Buffer | Uint8Array | null> } | null = null;

  try {
    stdoutStream = await execution.stdout();
  } catch {
    stdoutStream = null;
  }

  try {
    stderrStream = await execution.stderr();
  } catch {
    stderrStream = null;
  }

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const stdoutPromise = collectOutputStream(stdoutStream, stdoutLines);
  const stderrPromise = collectOutputStream(stderrStream, stderrLines);
  const waitPromise: Promise<{ result?: { exitCode: number }; error?: unknown }> = execution
    .wait()
    .then((result: { exitCode: number }) => ({ result }))
    .catch((error: unknown) => ({ error }));

  let timedOut = false;
  let waitOutcome: { result?: { exitCode: number }; error?: unknown } | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutMessage = `Execution timed out after ${timeout} seconds`;

  try {
    waitOutcome = await Promise.race([
      waitPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new SandboxExecutionTimeoutError(timeoutMessage));
        }, timeout * 1000);
      }),
    ]);
  } catch (err: unknown) {
    if (err instanceof SandboxExecutionTimeoutError) {
      timedOut = true;
      await Promise.race([
        execution.kill().catch(() => undefined),
        sleep(CLEANUP_GRACE_MS),
      ]);
      await waitForCleanup([waitPromise, stdoutPromise, stderrPromise]);
    } else {
      throw err;
    }
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }

  if (!timedOut) {
    await Promise.allSettled([stdoutPromise, stderrPromise]);
  }

  if (waitOutcome?.error !== undefined) {
    throw waitOutcome.error;
  }

  return {
    execResult: waitOutcome?.result,
    stdout: stdoutLines.join(""),
    stderr: stderrLines.join(""),
    timedOut,
  };
}

async function executeInSandbox(
  action: string,
  protocolPath: string,
  params: Record<string, unknown>,
  envVars?: EnvVars,
  options: SandboxOptions = {},
): Promise<ProtocolResult> {
  const {
    image,
    rootfsPath,
    timeout = 300,
    memoryMib = 512,
    cpus = 1,
    debug = false,
    logFile = SANDBOX_LOG_FILE,
    fileBridge,
  } = options;

  const resolvedImage = image ?? (rootfsPath ? undefined : DEFAULT_IMAGE);

  const absProtocolPath = path.resolve(protocolPath);
  if (!existsSync(absProtocolPath) || !statSync(absProtocolPath).isDirectory()) {
    throw new Error(`protocol_path must be a directory: ${protocolPath}`);
  }
  if (!existsSync(path.join(absProtocolPath, "protocol.aimd"))) {
    throw new Error(`protocol.aimd not found in protocol_path: ${protocolPath}`);
  }

  if (rootfsPath !== undefined) {
    const absRootfs = path.resolve(rootfsPath);
    if (!isOciRootfsPath(absRootfs)) {
      throw new Error(`rootfs_path must be an OCI layout directory: ${rootfsPath}`);
    }
  }

  const fileBridgeInputs = resolveFileBridgeInputs(fileBridge?.inputs);
  const fileBridgeEnabled = fileBridge !== undefined;
  const sandboxEnv: EnvVars = { ...(envVars ?? {}) };
  if (debug) {
    sandboxEnv.PROTOCOL_DEBUG = "1";
  }
  if (fileBridgeEnabled) {
    sandboxEnv.AIRALOGY_LOCAL_FILE_MAP_JSON = JSON.stringify(buildFileBridgeMap(fileBridgeInputs));
    sandboxEnv.AIRALOGY_LOCAL_FILE_OUTPUT_DIR = FILE_BRIDGE_OUTPUT_DIR;
  }

  const boxOptions: RuntimeBoxOptions = {
    memoryMib,
    cpus,
    workingDir: WORKING_DIR,
    env:
      Object.keys(sandboxEnv).length > 0
        ? Object.entries(sandboxEnv).map(([key, value]) => ({ key, value }))
        : undefined,
  };

  if (rootfsPath !== undefined) {
    boxOptions.rootfsPath = path.resolve(rootfsPath);
  } else {
    boxOptions.image = resolvedImage;
  }

  const runtime = JsBoxlite.withDefaultConfig();
  let box: any;
  let result: ProtocolResult | undefined;
  let timedOut = false;

  try {
    box = await runtime.create(boxOptions, undefined);
    await box.copyIn(EXECUTOR_PATH, `${WORKING_DIR}/`, { includeParent: false });
    await copyProtocolIntoBox(box, absProtocolPath);
    if (fileBridgeEnabled) {
      await prepareFileBridge(box, fileBridgeInputs);
    }

    const execOutcome = await execCommandWithTimeout(
      box,
      [
        "python",
        "protocol_executor.py",
        action,
        "protocol",
        JSON.stringify(params),
      ],
      timeout,
    );
    timedOut = execOutcome.timedOut;

    if (execOutcome.timedOut) {
      result = {
        success: false,
        message: `Execution timed out after ${timeout} seconds`,
        output: "",
      };
    } else if (execOutcome.execResult === undefined) {
      result = {
        success: false,
        message: "Sandbox execution did not return a result",
        output: execOutcome.stderr.trim(),
      };
    } else if (execOutcome.execResult.exitCode !== 0) {
      result = {
        success: false,
        message: `Protocol exec failed with return code ${execOutcome.execResult.exitCode}`,
        output: execOutcome.stderr.trim(),
      };
    } else {
      const output = execOutcome.stdout.trim();
      try {
        result = JSON.parse(output) as ProtocolResult;
      } catch {
        result = {
          success: false,
          message: "Invalid JSON output from protocol executor",
          output,
        };
      }
    }
  } catch (err: unknown) {
    if (err instanceof BoxliteError) {
      result = {
        success: false,
        message: `Sandbox error: ${err.message}`,
        output: "",
      };
    } else {
      throw err;
    }
  } finally {
    if (box !== undefined) {
      if (fileBridgeEnabled && !timedOut) {
        const files = await copyOutFileBridgeOutputs(box, fileBridge?.outputDir);
        if (files.length > 0 && result !== undefined) {
          result = {
            ...result,
            files: [...(result.files ?? []), ...files],
          };
        }
      }
      if (debug) {
        await copyOutLog(box, logFile);
      }
      if (timedOut) {
        trackBackgroundCleanup(cleanupBox(box, runtime));
      } else {
        try {
          await box.stop();
        } catch {
          if (result === undefined) {
            throw new Error("Failed to stop BoxLite sandbox after execution");
          }
        }
      }
    }
  }

  return result ?? {
    success: false,
    message: "Sandbox execution failed without a result",
    output: "",
  };
}

export function parseProtocol(
  protocolPath: string,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export function parseProtocol(
  protocolPath: string,
  envVars?: EnvVars,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export async function parseProtocol(
  protocolPath: string,
  envVarsOrOptions?: EnvVars | SandboxOptions,
  options?: SandboxOptions,
): Promise<ProtocolResult> {
  const resolved = resolveEnvAndOptions(envVarsOrOptions, options);
  return executeInSandbox("parse_protocol", protocolPath, {}, resolved.envVars, resolved.options);
}

export function assignVariable(
  protocolPath: string,
  varName: string,
  dependentData: Record<string, unknown>,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export function assignVariable(
  protocolPath: string,
  varName: string,
  dependentData: Record<string, unknown>,
  envVars?: EnvVars,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export async function assignVariable(
  protocolPath: string,
  varName: string,
  dependentData: Record<string, unknown>,
  envVarsOrOptions?: EnvVars | SandboxOptions,
  options?: SandboxOptions,
): Promise<ProtocolResult> {
  const resolved = resolveEnvAndOptions(envVarsOrOptions, options);
  const params = {
    var_name: varName,
    dependent_data: dependentData,
  };
  return executeInSandbox("assign_variable", protocolPath, params, resolved.envVars, resolved.options);
}

export function validateVariables(
  protocolPath: string,
  vars: Record<string, unknown>,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export function validateVariables(
  protocolPath: string,
  vars: Record<string, unknown>,
  envVars?: EnvVars,
  options?: SandboxOptions,
): Promise<ProtocolResult>;
export async function validateVariables(
  protocolPath: string,
  vars: Record<string, unknown>,
  envVarsOrOptions?: EnvVars | SandboxOptions,
  options?: SandboxOptions,
): Promise<ProtocolResult> {
  const resolved = resolveEnvAndOptions(envVarsOrOptions, options);
  return executeInSandbox("validate_variables", protocolPath, vars, resolved.envVars, resolved.options);
}
