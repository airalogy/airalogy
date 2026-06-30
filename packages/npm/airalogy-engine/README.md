# airalogy-engine (Node.js)

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

Chinese README: [README.zh-CN.md](README.zh-CN.md)

Airalogy protocol execution sandbox for Node.js/TypeScript. Run protocol packages (`parse`, `assign`, `validate`) inside a secure [BoxLite](https://github.com/boxlite-ai/boxlite) sandbox, and execute AIMD workflow transition assignments across protocol Records.

## Design Rationale

Airalogy Engine separates the protocol runtime into four layers: Docker/BuildKit builds the sandbox environment, OCI image layout stores that environment as a standard portable artifact, BoxLite mounts the artifact and executes protocol code in isolation, and the Engine API exposes stable `image`, `rootfsPath`, and file bridge abstractions to host applications.

This design avoids depending on the host Python environment and avoids requiring Docker daemon access during normal protocol execution after the local rootfs has been built. It also keeps the runtime boundary explicit: future CI pipelines, hosted services, or alternative sandbox runtimes can reuse the same OCI artifact and Engine-level API without changing protocol packages or recorder integrations.

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

Building the local rootfs requires a running Docker daemon. On macOS, start Docker Desktop from Applications or run `open -a Docker`, then wait until `docker info` succeeds before running `pnpm build:engine-rootfs` or `pnpm build:engine-rootfs:force`. If you use Colima, Rancher Desktop, or another Docker-compatible runtime, start that runtime and make sure your Docker context points to it.

The build script exports an OCI layout, so it automatically creates and uses a Buildx builder with the `docker-container` driver. Docker's default `docker` driver cannot export `type=oci`. If you need a different builder name, pass `--builder <name>` or set `AIRALOGY_ENGINE_BUILDX_BUILDER`.

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
import { parseProtocol, assignVariable, runWorkflow, validateVariables } from "@airalogy/airalogy-engine";

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

// 4. Run a workflow transition graph
const workflowResult = await runWorkflow(
  "/path/to/workflow.aimd",
  {
    measurement: { data: { var: { raw_data: [1, 2, 3] } } },
    literature_review: { data: { var: { summary: "prior context" } } },
  },
  options,
);
console.log(workflowResult.data?.workflow_data?.path_data.steps);
console.log(workflowResult.data?.records); // Current Record snapshot.
```

## Workflow Runtime

`runWorkflow` and `runWorkflowTransition` execute fenced `workflow` definitions from a `workflow.aimd` file or directory. The runtime resolves `transition.inputs`, runs workflow-level Python assigners in the same BoxLite sandbox style, exposes assigner returns under `${transition_id.outputs.key}`, and applies `transition.assign` into target Record drafts. The primary workflow run artifact is `workflow_data.path_data.steps`, a Path-step timeline; `records` is the current Record snapshot derived from the run. The runtime does not persist Records or create Record versions; callers should save returned Record drafts through their platform or database layer.

Workflow references intentionally use `${...}` so constants and references are unambiguous. For example, `var.summary: ${prepare_analysis_inputs.outputs.summary}` copies a transition output, while `var.summary: prepare_analysis_inputs.outputs.summary` stores that exact string.

For trusted local demos or tests, pass `assignerRuntime: "local"` to run workflow-level Python assigners in the host Python process instead of BoxLite. Keep the default `assignerRuntime: "sandbox"` for untrusted workflow packages and production services.

## API

### `parseProtocol(protocolPath, envVars?, options?)`

Parse a protocol and return its schema, metadata, and fields.

### `assignVariable(protocolPath, varName, dependentData, envVars?, options?)`

Assign a variable value using the protocol's assigner functions.

### `validateVariables(protocolPath, vars, envVars?, options?)`

Validate variable values against the protocol's model.

### `runWorkflow(workflowPath, records, envVars?, options?)`

Run selected workflow transitions in declaration order. `workflowPath` may point to a `workflow.aimd` file or a directory containing `workflow.aimd`. The result data contains `workflow_data.path_data.steps`, `records`, `transition_outputs`, `executed_transitions`, `skipped_transitions`, `attempts`, and `node_iterations`.

### `runWorkflowTransition(workflowPath, transitionId, records, envVars?, options?)`

Run one workflow transition and return the updated Record drafts and transition metadata.

### `parseWorkflowContent(content)` and `isAimdWorkflowReference(value)`

Parse one workflow YAML payload and check whether a value is a `${node.section.field}` workflow reference expression.

All functions return `Promise<ProtocolResult>`:

```typescript
interface ProtocolResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  output?: string;
  files?: SandboxFileBridgeOutput[];
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

### Workflow Options

`runWorkflow` accepts all sandbox options plus `workflowId`, `transitionIds`, `transitionOutputs`, `nodeIterations`, `maxPasses`, and `assignerRuntime`. `runWorkflowTransition` accepts all sandbox options plus `workflowId`, `transitionOutputs`, `nodeIterations`, and `assignerRuntime`.

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
