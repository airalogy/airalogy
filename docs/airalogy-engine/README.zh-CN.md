# airalogy-engine

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

英文 README：[README.md](README.md)

Airalogy 协议执行 sandbox。它在 BoxLite sandbox 中运行协议包的 `parse`、`assign` 和 `validate` 操作。

## Monorepo 结构

```text
packages/
├── pypi/airalogy-engine/        # Python 包
├── npm/airalogy-engine/         # Node.js 包
└── runtime/airalogy-engine-image/
    ├── Dockerfile
    └── protocol_requirements.txt

examples/airalogy-engine/        # 示例协议包
```

## Sandbox 镜像

从 runtime 包构建共享 sandbox 镜像：

```bash
pnpm build:engine-rootfs
```

这会在默认路径创建 rootfs：`packages/runtime/airalogy-engine-image/airalogy-engine-image`。如果 runtime 依赖发生变化，可以重新构建：

```bash
pnpm build:engine-rootfs:force
```

OCI 是 Open Container Initiative 的缩写。导出的 rootfs 是 OCI image layout 目录，也就是 Open Container Initiative 定义的容器镜像本地目录格式；它不是传统的 Linux 根文件系统解包目录，也不是 Docker 专有格式。有效目录包含 `oci-layout`、`index.json` 和 `blobs/sha256/...`，BoxLite 会把这个镜像布局挂载为 sandbox 文件系统。如果目录已经存在但没有 `oci-layout`，应将其视为不完整构建，并运行 `pnpm build:engine-rootfs:force` 重新构建。

把导出的 rootfs 目录传给任一 engine 包即可使用。

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
