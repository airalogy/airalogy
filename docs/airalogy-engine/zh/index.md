# Airalogy Engine

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

Airalogy Engine 在 BoxLite sandbox 中运行协议包的 `parse`、`assign` 和 `validate` 操作。Python 包和 Node.js 包共享同一套 sandbox 镜像和协议执行器行为。

## 设计逻辑

Airalogy Engine 把协议运行时拆成四层：Docker/BuildKit 负责构建 sandbox 环境，OCI image layout 把这个环境保存成标准、可迁移的 artifact，BoxLite 挂载这个 artifact 并隔离执行协议代码，Engine API 则向宿主应用暴露稳定的 `image`、`rootfsPath` 和 file bridge 抽象。

这种设计避免依赖宿主机 Python 环境，也避免在本地 rootfs 构建完成后仍要求正常协议执行必须访问 Docker daemon。它还让运行边界保持清晰：未来无论是 CI 构建、托管服务，还是替换底层 sandbox runtime，都可以复用同一个 OCI artifact 和 Engine 层 API，而不需要改协议包或 recorder 集成。

## 包

| 包 | 源码 | Registry |
| --- | --- | --- |
| Python API | [`packages/pypi/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/packages/pypi/airalogy-engine) | [PyPI](https://pypi.org/project/airalogy-engine/) |
| Node.js API | [`packages/npm/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/packages/npm/airalogy-engine) | [npm](https://www.npmjs.com/package/@airalogy/airalogy-engine) |
| Sandbox 镜像 | [`packages/runtime/airalogy-engine-image`](https://github.com/airalogy/airalogy/tree/main/packages/runtime/airalogy-engine-image) | 本地 Docker/OCI rootfs |
| 示例协议 | [`examples/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/examples/airalogy-engine) | 仓库示例 |
| 协议演示 | [`apps/protocol-demo`](https://github.com/airalogy/airalogy/tree/main/apps/protocol-demo) | 本地 demo 服务 |

## Monorepo 结构

```text
packages/
├── pypi/airalogy-engine/        # Python 包
├── npm/airalogy-engine/         # Node.js 包
└── runtime/airalogy-engine-image/
    ├── Dockerfile
    └── protocol_requirements.txt

examples/airalogy-engine/        # 示例协议包
examples/protocols/              # 官方协议示例
apps/protocol-demo/              # 基于本地 engine 的 demo
```

## Sandbox 镜像

从 runtime 包构建共享 sandbox 镜像：

```bash
pnpm build:engine-rootfs
```

构建本地 rootfs 需要 Docker daemon 处于运行状态。在 macOS 上，请从“应用程序”启动 Docker Desktop，或运行 `open -a Docker`，然后等待 `docker info` 成功后再执行 `pnpm build:engine-rootfs` 或 `pnpm build:engine-rootfs:force`。如果使用 Colima、Rancher Desktop 或其他 Docker 兼容运行时，请先启动对应运行时，并确保 Docker context 指向它。

构建脚本需要导出 OCI layout，因此会自动创建并使用 `docker-container` driver 的 Buildx builder。Docker 默认的 `docker` driver 不能导出 `type=oci`。如果需要使用不同的 builder 名称，可以传入 `--builder <name>`，或设置 `AIRALOGY_ENGINE_BUILDX_BUILDER`。

这会在默认路径创建 rootfs：`packages/runtime/airalogy-engine-image/airalogy-engine-image`。如果 runtime 依赖发生变化，可以重新构建：

```bash
pnpm build:engine-rootfs:force
```

### 什么是 OCI rootfs？

OCI 是 Open Container Initiative 的缩写。导出的 rootfs 是 OCI image layout 目录，也就是 Open Container Initiative 定义的容器镜像本地目录格式；它不是传统的 Linux 根文件系统解包目录，也不是 Docker 专有格式。有效目录包含 `oci-layout`、`index.json` 和 `blobs/sha256/...`，BoxLite 会把这个镜像布局挂载为 sandbox 文件系统。如果目录已经存在但没有 `oci-layout`，应将其视为不完整构建，并运行 `pnpm build:engine-rootfs:force` 重新构建。

把导出的 rootfs 目录传给任一 engine 包即可使用。

## Python

从 PyPI 安装：

```bash
pip install airalogy-engine
```

使用本地 rootfs：

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(rootfs_path="./airalogy-engine-image")
result = await engine.parse_protocol("./protocol")
```

## Node.js

从 npm 安装：

```bash
pnpm add @airalogy/airalogy-engine
```

使用本地 rootfs：

```js
import { parseProtocol } from "@airalogy/airalogy-engine";

const result = await parseProtocol("./protocol", {
  rootfsPath: "./airalogy-engine-image",
});
```

## 协议 Demo

在仓库根目录启动本地 demo 服务：

```bash
pnpm dev:protocol-demo:full
```

Demo 会加载 `examples/protocols`，展示 AIMD recorder 界面，并调用 Node.js engine 包执行 `parse`、`validate` 和 `assign` 操作。

## 测试

Python 包：

```bash
cd packages/pypi/airalogy-engine
uv run pytest tests/ -v --sandbox-mode=rootfs \
  --rootfs-path=../../runtime/airalogy-engine-image/airalogy-engine-image
```

Node.js 包：

```bash
cd packages/npm/airalogy-engine
SANDBOX_MODE=rootfs \
ROOTFS_PATH=../../runtime/airalogy-engine-image/airalogy-engine-image \
AIRALOGY_ENGINE_RUN_SANDBOX_TESTS=1 \
pnpm test
```

如果没有本地 rootfs，Node.js 测试命令会运行路径校验测试并跳过 sandbox 集成用例，这样没有 BoxLite runtime 支持的机器也可以测试包本身。
