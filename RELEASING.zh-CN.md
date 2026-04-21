# 发布

[English Version](RELEASING.md)

Airalogy 通过 GitHub Actions 在推送类似 `v0.8.1` 的版本标签时自动发布到 PyPI。

## 发布流程

1. 更新 `pyproject.toml` 中的包版本。
2. 在 `CHANGELOG.md` 顶部补上对应版本条目。
3. 刷新 `uv.lock`，保证 `uv sync --locked --all-extras --dev` 仍然可用。
4. 将 release-prep 改动合并到 `main`。
5. 推送对应的 Git tag，例如 `git tag v0.8.1 && git push origin v0.8.1`。

发布 workflow 会先校验 Git tag 与 `pyproject.toml` 中的版本是否一致，然后通过 Trusted Publishing 构建并发布到 PyPI。

普通 `git push` 默认只会把分支提交推到远端，不会自动创建版本 tag，也不会自动把本地已有 tag 一起推上去。

这个仓库的发布 workflow 监听的是 `v*` 形式的 tag push，而不是分支 push。要触发发布，必须先创建 tag，再显式推送它，例如：

```bash
git tag v0.8.1
git push origin v0.8.1
```

## 版本更新

建议优先使用 `uv version` 更新 `pyproject.toml` 里的 `project.version`，而不是手动改值：

```bash
uv version 0.8.1
```

也可以按 SemVer 级别递增：

```bash
uv version --bump patch
uv version --bump minor
uv version --bump major
```

`src/airalogy/__init__.py` 现在会在运行时读取已安装包元数据，因此不再需要维护第二处硬编码版本号。

## PyPI 配置

要让自动发布成功，需要在 PyPI 项目中将 `airalogy/airalogy` 的 `.github/workflows/release.yml` 配置为受信任发布者。

这项配置通常只需要做一次：

- Owner：`airalogy`
- Repository：`airalogy`
- Workflow：`.github/workflows/release.yml`

## 说明

- 普通功能开发不应修改版本号或 `CHANGELOG.md`，除非当前改动就是明确的 release preparation。
- Git tag、`CHANGELOG.md` 和 `pyproject.toml` 中的版本号应保持一致。
