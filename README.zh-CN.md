# Airalogy

[![CI](https://github.com/airalogy/airalogy/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/ci.yml)
[![Docs](https://github.com/airalogy/airalogy/actions/workflows/docs.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/docs.yml)
[![PyPI airalogy](https://img.shields.io/pypi/v/airalogy?label=airalogy&logo=pypi&color=3775A9)](https://pypi.org/project/airalogy/)
[![PyPI airalogy-engine](https://img.shields.io/pypi/v/airalogy-engine?label=airalogy-engine&logo=pypi&color=3775A9)](https://pypi.org/project/airalogy-engine/)
[![npm scope](https://img.shields.io/badge/npm-%40airalogy%2F*-CB3837?logo=npm)](https://www.npmjs.com/org/airalogy)
[![arXiv](https://img.shields.io/badge/arXiv-2506.18586-b31b1b.svg)](https://arxiv.org/abs/2506.18586)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[English](README.md)

Airalogy 是 Airalogy protocol 生态的 monorepo：

- `packages/pypi/airalogy`：Python protocol core，包含 AIMD 解析、校验、模型、Records 与 CLI。
- `packages/pypi/airalogy-engine`：Python 协议执行沙箱包。
- `packages/npm/aira-core`：TypeScript `.aira` 归档解析、创建与校验工具。
- `packages/npm/aimd-*`：TypeScript AIMD 解析器、渲染器、编辑器与 recorder 组件。
- `packages/npm/airalogy-engine`：Node.js 协议执行沙箱包。
- `packages/runtime/airalogy-engine-image`：engine 包使用的 sandbox image 定义。
- `apps/protocol-demo`：基于 Node.js engine 包的本地 Airalogy Protocol demo。
- `examples/aimd`：用于浏览器预览和 recorder demo 的独立 AIMD 案例。
- `examples/protocols`：完整官方 Airalogy Protocol 案例，迁移自原先独立的 `airalogy/protocols` 仓库。
- `spec/fixtures`：跨实现兼容性测试使用的共享 protocol fixtures。

## 包

| 包名 | Registry | 源码 | 说明 |
| --- | --- | --- | --- |
| `airalogy` | [![PyPI version](https://img.shields.io/pypi/v/airalogy?logo=pypi&color=3775A9)](https://pypi.org/project/airalogy/) | [`packages/pypi/airalogy`](packages/pypi/airalogy) | Python protocol core，包含 AIMD 解析、校验、records 与 CLI |
| `airalogy-engine` | [![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?logo=pypi&color=3775A9)](https://pypi.org/project/airalogy-engine/) | [`packages/pypi/airalogy-engine`](packages/pypi/airalogy-engine) | Python 协议执行沙箱 API |
| `@airalogy/aimd-core` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-core) | [`packages/npm/aimd-core`](packages/npm/aimd-core) | TypeScript AIMD 解析器、语法定义与工具 |
| `@airalogy/aimd-editor` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-editor) | [`packages/npm/aimd-editor`](packages/npm/aimd-editor) | Monaco 编辑器集成与 Vue 编辑流程 |
| `@airalogy/aimd-renderer` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer) | [`packages/npm/aimd-renderer`](packages/npm/aimd-renderer) | 将 AIMD 渲染为 HTML 与 Vue |
| `@airalogy/aimd-recorder` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder) | [`packages/npm/aimd-recorder`](packages/npm/aimd-recorder) | 面向结构化 AIMD 记录的 Vue UI 组件 |
| `@airalogy/aira-core` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faira-core?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aira-core) | [`packages/npm/aira-core`](packages/npm/aira-core) | 面向浏览器的 `.aira` 归档解析、创建与校验工具 |
| `@airalogy/airalogy-engine` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/airalogy-engine) | [`packages/npm/airalogy-engine`](packages/npm/airalogy-engine) | Node.js 协议执行沙箱 API |

## 开发

Python 包命令在对应 package 目录中运行：

```bash
cd packages/pypi/airalogy
uv sync --locked --all-extras --dev
uv run pytest tests/
```

```bash
cd packages/pypi/airalogy-engine
uv sync --locked --dev
uv run pytest tests/ --sandbox-mode=rootfs
```

npm 包命令在仓库根目录运行：

```bash
pnpm install
pnpm build:npm
pnpm type-check
pnpm test
```

使用 Docker 构建的 engine rootfs 启动完整本地 protocol demo：

```bash
pnpm dev:protocol-demo:full
```

## 文档

- 文档首页：`docs/home`
- Airalogy Python 包文档：`docs/airalogy`
- AIMD npm 包文档：`docs/aimd`
- Airalogy Engine 文档：`docs/airalogy-engine`
- 官方 protocol 案例：`examples/protocols`

已发布文档会组装到同一个 GitHub Pages 站点：

- <https://airalogy.github.io/airalogy/>
- <https://airalogy.github.io/airalogy/zh/>
- <https://airalogy.github.io/airalogy/airalogy/>
- <https://airalogy.github.io/airalogy/aimd/>
- <https://airalogy.github.io/airalogy/airalogy-engine/>

## 发布

- 已发布包使用 Changesets 管理版本。
- npm 包从 `packages/npm/*` 通过 npm Trusted Publishing 发布。
- PyPI 包版本由私有 `package.json` 锚定，同步到 `pyproject.toml`，并通过 PyPI Trusted Publishing 发布。

## 引用

如果 Airalogy 或 AIMD 包对你的工作有帮助，请引用 Airalogy 论文：

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```

原先独立的 `aimd` 和 `airalogy-engine` 仓库计划在本 monorepo 迁移落地后成为归档镜像。
