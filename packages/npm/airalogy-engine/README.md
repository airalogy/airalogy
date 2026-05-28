# airalogy-engine (Node.js)

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

Chinese README: [README.zh-CN.md](README.zh-CN.md)

Airalogy protocol execution sandbox for Node.js/TypeScript. Run protocol packages (`parse`, `assign`, `validate`) inside a secure [BoxLite](https://github.com/boxlite-ai/boxlite) sandbox.

## Installation

```bash
pnpm add @airalogy/airalogy-engine
```

## Sandbox Image

The engine runs protocol code in a BoxLite sandbox. You can use either a **remote Docker image** or a **local OCI rootfs directory**.

### Remote Image

```typescript
const result = await parseProtocol(protocolPath, undefined, {
  image: "numbcoder/airalogy-engine:0.1",
});
```

### Local OCI Rootfs (Recommended)

In this monorepo, build and export the image locally for faster, offline execution:

```bash
pnpm build:engine-rootfs
```

#### What is an OCI rootfs?

OCI stands for Open Container Initiative. Here "OCI rootfs" means an OCI image layout directory, which is a standard local directory format for container images, not a traditional unpacked Linux root filesystem and not a Docker-specific format. A valid directory contains `oci-layout`, `index.json`, and `blobs/sha256/...`; BoxLite mounts that image layout as the sandbox filesystem. If the directory exists but lacks `oci-layout`, rebuild it with `pnpm build:engine-rootfs:force`.

Then use `rootfsPath`:

```typescript
const result = await parseProtocol(protocolPath, undefined, {
  rootfsPath: "packages/runtime/airalogy-engine-image/airalogy-engine-image",
});
```

> If neither `image` nor `rootfsPath` is provided, the engine falls back to the default remote image `numbcoder/airalogy-engine:0.1`.

## Usage

```typescript
import { parseProtocol, assignVariable, validateVariables } from "@airalogy/airalogy-engine";

const protocolPath = "/path/to/your/protocol";
const options = { rootfsPath: "/path/to/airalogy-engine-image" }; // or { image: "..." }

// 1. Parse the protocol
const parseResult = await parseProtocol(protocolPath, { API_KEY: "xxx" }, options);
console.log(parseResult.data?.meta_data);
console.log(parseResult.data?.json_schema);

// 2. Assign a variable
const assignResult = await assignVariable(
  protocolPath,
  "duration",
  { seconds: 3600 },
  { API_KEY: "xxx" },
  options,
);
console.log(assignResult.data);

// 3. Validate variables
const validateResult = await validateVariables(
  protocolPath,
  { seconds: 60, duration: "PT1M" },
  { API_KEY: "xxx" },
  options,
);
console.log(validateResult.data);
```

## API

### `parseProtocol(protocolPath, envVars?, options?)`

Parse a protocol and return its schema, metadata, and fields.

### `assignVariable(protocolPath, varName, dependentData, envVars?, options?)`

Assign a variable value using the protocol's assigner functions.

### `validateVariables(protocolPath, vars, envVars?, options?)`

Validate variable values against the protocol's model.

All functions return `Promise<ProtocolResult>`:

```typescript
interface ProtocolResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  output?: string;
}
```

### Sandbox Options

All functions accept a `SandboxOptions` object:

| Option | Type | Default | Description |
|---|---|---|---|
| `image` | `string` | `"numbcoder/airalogy-engine:0.1"` | Remote Docker image name |
| `rootfsPath` | `string` | — | Path to a local OCI rootfs directory (overrides `image`) |
| `timeout` | `number` | `300` | Execution timeout in seconds. The sandboxed process will be killed once it times out|
| `memoryMib` | `number` | `512` | Memory limit in MiB |
| `cpus` | `number` | `1` | CPU limit |
| `debug` | `boolean` | `false` | Enable executor debug logging inside the sandbox |
| `logFile` | `string` | `"protocol_debug.log"` | Host file to append sandbox debug logs to |

## Development

```bash
cd node

# Install dependencies
pnpm install

# Build (copies executor + compiles TypeScript)
pnpm run build

# Type check
pnpm run type-check

# Lint
pnpm run lint

# Run tests
pnpm test
```

### Testing

Tests use [vitest](https://vitest.dev/) and support both sandbox modes via environment variables:

```bash
# Default: remote Docker image mode
pnpm test

# Use local OCI rootfs
SANDBOX_MODE=rootfs ROOTFS_PATH=../../runtime/airalogy-engine-image/airalogy-engine-image pnpm test

# Custom remote image
SANDBOX_IMAGE=numbcoder/airalogy-engine:0.1 pnpm test
```
