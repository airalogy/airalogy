# airalogy-engine (Node.js)

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

英文 README：[README.md](README.md)

Airalogy 协议执行 sandbox 的 Node.js/TypeScript 包。它在安全的 [BoxLite](https://github.com/boxlite-ai/boxlite) sandbox 中运行协议包的 `parse`、`assign` 和 `validate` 操作，也可以执行 AIMD Workflow 中跨 Protocol Record 的 transition assignment。

## 设计逻辑

Airalogy Engine 把协议运行时拆成四层：Docker/BuildKit 负责构建 sandbox 环境，OCI image layout 把这个环境保存成标准、可迁移的 artifact，BoxLite 挂载这个 artifact 并隔离执行协议代码，Engine API 则向宿主应用暴露稳定的 `image`、`rootfsPath` 和 file bridge 抽象。

这种设计避免依赖宿主机 Python 环境，也避免在本地 rootfs 构建完成后仍要求正常协议执行必须访问 Docker daemon。它还让运行边界保持清晰：未来无论是 CI 构建、托管服务，还是替换底层 sandbox runtime，都可以复用同一个 OCI artifact 和 Engine 层 API，而不需要改协议包或 recorder 集成。

## 安装

```bash
pnpm add @airalogy/airalogy-engine
```

## Sandbox 镜像

Engine 会在 BoxLite sandbox 中运行协议代码。可以使用远程 Docker 镜像，也可以使用本地 OCI rootfs 目录。

### 远程镜像

```typescript
const result = await parseProtocol(protocolPath, undefined, {
  image: "numbcoder/airalogy-engine:0.1",
});
```

### 本地 OCI Rootfs（推荐）

在 monorepo 中，可以把 sandbox 镜像构建并导出到本地，以获得更快、可离线的执行：

```bash
pnpm build:engine-rootfs
```

构建本地 rootfs 需要 Docker daemon 处于运行状态。在 macOS 上，请从“应用程序”启动 Docker Desktop，或运行 `open -a Docker`，然后等待 `docker info` 成功后再执行 `pnpm build:engine-rootfs` 或 `pnpm build:engine-rootfs:force`。如果使用 Colima、Rancher Desktop 或其他 Docker 兼容运行时，请先启动对应运行时，并确保 Docker context 指向它。

构建脚本需要导出 OCI layout，因此会自动创建并使用 `docker-container` driver 的 Buildx builder。Docker 默认的 `docker` driver 不能导出 `type=oci`。如果需要使用不同的 builder 名称，可以传入 `--builder <name>`，或设置 `AIRALOGY_ENGINE_BUILDX_BUILDER`。

#### 什么是 OCI rootfs？

OCI 是 Open Container Initiative 的缩写。这里的 "OCI rootfs" 指 OCI image layout 目录，也就是 Open Container Initiative 定义的容器镜像本地目录格式；它不是传统的 Linux 根文件系统解包目录，也不是 Docker 专有格式。有效目录应包含 `oci-layout`、`index.json` 和 `blobs/sha256/...`；BoxLite 会把这个镜像布局挂载为 sandbox 文件系统。如果目录存在但没有 `oci-layout`，说明构建不完整，请运行 `pnpm build:engine-rootfs:force` 重新构建。

然后传入 `rootfsPath`：

```typescript
const result = await parseProtocol(protocolPath, undefined, {
  rootfsPath: "packages/runtime/airalogy-engine-image/airalogy-engine-image",
});
```

> 如果没有提供 `image` 或 `rootfsPath`，engine 会回退到默认远程镜像 `numbcoder/airalogy-engine:0.1`。

## 使用

```typescript
import { parseProtocol, assignVariable, runWorkflow, validateVariables } from "@airalogy/airalogy-engine";

const protocolPath = "/path/to/your/protocol";
const options = { rootfsPath: "/path/to/airalogy-engine-image" }; // 或 { image: "..." }

const parseResult = await parseProtocol(protocolPath, { API_KEY: "xxx" }, options);
console.log(parseResult.data?.meta_data);
console.log(parseResult.data?.json_schema);

const assignResult = await assignVariable(
  protocolPath,
  "duration",
  { seconds: 3600 },
  { API_KEY: "xxx" },
  options,
);
console.log(assignResult.data);

const validateResult = await validateVariables(
  protocolPath,
  { seconds: 60, duration: "PT1M" },
  { API_KEY: "xxx" },
  options,
);
console.log(validateResult.data);

const workflowResult = await runWorkflow(
  "/path/to/workflow.aimd",
  {
    measurement: { data: { var: { raw_data: [1, 2, 3] } } },
    literature_review: { data: { var: { summary: "prior context" } } },
  },
  options,
);
console.log(workflowResult.data?.workflow_data?.path_data.steps);
console.log(workflowResult.data?.records); // 当前 Record 快照。
```

## Workflow Runtime

`runWorkflow` 和 `runWorkflowTransition` 会执行 `workflow.aimd` 中 fenced `workflow` block 定义的 transition。运行时会解析 `transition.inputs`，在 BoxLite sandbox 中调用 Workflow 级 Python assigner，把返回值暴露为 `${transition_id.outputs.key}`，再按 `transition.assign` 写入目标 Protocol 的 Record draft。Workflow 运行的主产物是 `workflow_data.path_data.steps` 这条 Path step 时间线；`records` 是本次运行派生出的当前 Record 快照。它不会持久化 Record，也不会创建 Record version；调用方应把返回的 Record draft 保存到自己的平台或数据库层。

Workflow 引用保留 `${...}`，是为了区分“引用”和“常量字符串”。例如 `var.summary: ${prepare_analysis_inputs.outputs.summary}` 表示复制 transition 输出，而 `var.summary: prepare_analysis_inputs.outputs.summary` 表示写入这个普通字符串。

对于可信的本地 demo 或测试，可以传入 `assignerRuntime: "local"`，让 Workflow 级 Python assigner 在宿主机 Python 进程中运行，而不是进入 BoxLite。对不可信 workflow 包和生产服务，仍应保留默认的 `assignerRuntime: "sandbox"`。

## API

### `parseProtocol(protocolPath, envVars?, options?)`

解析协议并返回 schema、metadata 和字段信息。

### `assignVariable(protocolPath, varName, dependentData, envVars?, options?)`

调用协议中的 assigner 函数为变量赋值。

### `validateVariables(protocolPath, vars, envVars?, options?)`

根据协议模型校验变量值。

### `runWorkflow(workflowPath, records, envVars?, options?)`

按声明顺序执行选中的 Workflow transitions。`workflowPath` 可以是 `workflow.aimd` 文件，也可以是包含 `workflow.aimd` 的目录。返回的 data 包含 `workflow_data.path_data.steps`、`records`、`transition_outputs`、`executed_transitions`、`skipped_transitions`、`attempts` 和 `node_iterations`。

### `runWorkflowTransition(workflowPath, transitionId, records, envVars?, options?)`

执行单个 Workflow transition，并返回更新后的 Record drafts 与 transition metadata。

### `parseWorkflowContent(content)` 和 `isAimdWorkflowReference(value)`

解析单个 Workflow YAML payload，并判断一个值是否是 `${node.section.field}` 形式的 Workflow 引用表达式。

所有函数都返回 `Promise<ProtocolResult>`：

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

所有函数都接受 `SandboxOptions` 对象：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `image` | `string` | `"numbcoder/airalogy-engine:0.1"` | 远程 Docker 镜像名 |
| `rootfsPath` | `string` | - | 本地 OCI rootfs 目录路径，会覆盖 `image` |
| `timeout` | `number` | `300` | 执行超时时间，单位秒 |
| `memoryMib` | `number` | `512` | 内存限制，单位 MiB |
| `cpus` | `number` | `1` | CPU 限制 |
| `debug` | `boolean` | `false` | 启用 sandbox 内 executor 调试日志 |
| `logFile` | `string` | `"protocol_debug.log"` | 追加 sandbox 调试日志的宿主机文件 |

### Workflow Options

`runWorkflow` 接受所有 sandbox options，并额外支持 `workflowId`、`transitionIds`、`transitionOutputs`、`nodeIterations`、`maxPasses` 和 `assignerRuntime`。`runWorkflowTransition` 接受所有 sandbox options，并额外支持 `workflowId`、`transitionOutputs`、`nodeIterations` 和 `assignerRuntime`。

## 开发

```bash
cd packages/npm/airalogy-engine

pnpm install
pnpm run build
pnpm run type-check
pnpm run lint
pnpm test
```

### 测试

测试使用 [vitest](https://vitest.dev/)，并通过环境变量支持不同 sandbox 模式：

```bash
# 默认：远程 Docker 镜像模式
pnpm test

# 使用本地 OCI rootfs
SANDBOX_MODE=rootfs ROOTFS_PATH=../../runtime/airalogy-engine-image/airalogy-engine-image pnpm test

# 使用自定义远程镜像
SANDBOX_IMAGE=numbcoder/airalogy-engine:0.1 pnpm test
```
