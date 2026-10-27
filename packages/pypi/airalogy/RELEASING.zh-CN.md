# 发布

[English Version](RELEASING.md)

Airalogy 的 PyPI 包使用 Changesets 管理版本，并通过 GitHub Actions 和 PyPI Trusted Publishing 自动发布。

## 发布流程

1. 完成功能或修复。
2. 如果改动影响已发布包的外部行为，运行 `corepack pnpm changeset:add`。
3. 选择受影响的包，例如 `airalogy` 或 `airalogy-engine`，并选择 SemVer bump。
4. 将功能 PR 合并到 `main`。
5. Changesets workflow 会创建或更新 release PR。
6. release PR 会更新包版本、changelog、Python `pyproject.toml` 和 `uv.lock`。
7. 将 release PR 合并到 `main`。
8. `.github/workflows/release.yml` 会构建并发布 PyPI 上尚不存在的包版本。

`airalogy-vX.Y.Z` 这类版本 tag 不再作为发布触发源。如果项目仍希望保留 Git tag，可以在发布完成后把它作为 release 标记创建。

## 版本元数据

每个 PyPI 包都有一个 private `package.json`，只作为 Changesets 的版本锚点：

- `packages/pypi/airalogy/package.json`
- `packages/pypi/airalogy-engine/package.json`

真正发布到 PyPI 的 Python 元数据仍然在 `pyproject.toml` 中。生成 release PR 时，`corepack pnpm changeset:version` 会运行：

```bash
corepack pnpm sync:python-versions
corepack pnpm lock:python
```

这会把 Changesets 计算出的版本同步到 `pyproject.toml`，同时更新对 `airalogy` 的运行时和开发依赖，并刷新 Python lockfile。同步过程也会更新 Engine 镜像的 `VERSION`，以及 Python 客户端、Node 客户端、测试和 Protocol Demo 使用的默认镜像标签。普通功能开发不应手动修改这些版本。

Python Engine 的私有版本锚点声明了对核心包的依赖，因此核心包 minor 升级改变兼容版本系列时，Changesets 会联动更新它。核心包发布需要切换默认镜像时，应为 `airalogy-engine` 和 `@airalogy/airalogy-engine` 都添加 patch changeset，包括核心包仅 patch 升级的情况：Changesets 无法从源码中的镜像地址自动推断 Node 客户端需要发布。

镜像发布仍是独立操作，由 `.github/workflows/release-engine-image.yml` 处理。发布默认使用新标签的 Engine 客户端之前，应先确认对应镜像已经发布并验证。同步版本或合并 release PR 本身不会发布该镜像。

## 本地检查

检查 Python 发布元数据是否同步：

```bash
corepack pnpm check:python-versions
corepack pnpm check:engine-image-release
corepack pnpm test:release
```

如果在 release 维护场景中手动调整了版本锚点，可以重新同步：

```bash
corepack pnpm sync:python-versions
corepack pnpm lock:python
```

## PyPI 配置

要让自动发布成功，需要在每个 PyPI 项目中将 `airalogy/airalogy` 的 `.github/workflows/release.yml` 配置为受信任发布者。

这项配置通常只需要做一次：

- Owner：`airalogy`
- Repository：`airalogy`
- Workflow：`.github/workflows/release.yml`

## 说明

- 普通功能开发不应手动 bump 版本号或编辑 changelog。
- 常规发布不要从本地机器手动发布 PyPI 包。
- 发布 workflow 会检查目标版本是否已经存在于 PyPI，并跳过已存在版本。
