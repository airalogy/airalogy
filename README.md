# Airalogy

[![CI](https://github.com/airalogy/airalogy/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/ci.yml)
[![Docs](https://github.com/airalogy/airalogy/actions/workflows/docs.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/docs.yml)
[![PyPI airalogy](https://img.shields.io/pypi/v/airalogy?label=airalogy&logo=pypi&color=3775A9)](https://pypi.org/project/airalogy/)
[![PyPI airalogy-engine](https://img.shields.io/pypi/v/airalogy-engine?label=airalogy-engine&logo=pypi&color=3775A9)](https://pypi.org/project/airalogy-engine/)
[![npm scope](https://img.shields.io/badge/npm-%40airalogy%2F*-CB3837?logo=npm)](https://www.npmjs.com/org/airalogy)
[![arXiv](https://img.shields.io/badge/arXiv-2506.18586-b31b1b.svg)](https://arxiv.org/abs/2506.18586)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Airalogy is the monorepo for the Airalogy protocol ecosystem:

- `packages/pypi/airalogy`: Python protocol core, AIMD parsing, validation, models, records, and CLI.
- `packages/pypi/airalogy-engine`: Python protocol execution sandbox package.
- `packages/npm/aimd-*`: TypeScript AIMD parser, renderer, editor, and recorder packages.
- `packages/npm/airalogy-engine`: Node.js protocol execution sandbox package.
- `packages/runtime/airalogy-engine-image`: sandbox image definition used by engine packages.
- `spec/fixtures`: shared protocol fixtures for cross-implementation compatibility.

## Packages

| Package | Registry | Source | Summary |
| --- | --- | --- | --- |
| `airalogy` | [![PyPI version](https://img.shields.io/pypi/v/airalogy?logo=pypi&color=3775A9)](https://pypi.org/project/airalogy/) | [`packages/pypi/airalogy`](packages/pypi/airalogy) | Python protocol core, AIMD parsing, validation, records, and CLI |
| `airalogy-engine` | [![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?logo=pypi&color=3775A9)](https://pypi.org/project/airalogy-engine/) | [`packages/pypi/airalogy-engine`](packages/pypi/airalogy-engine) | Python protocol execution sandbox API |
| `@airalogy/aimd-core` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-core) | [`packages/npm/aimd-core`](packages/npm/aimd-core) | TypeScript AIMD parser, syntax definitions, and utilities |
| `@airalogy/aimd-editor` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-editor) | [`packages/npm/aimd-editor`](packages/npm/aimd-editor) | Monaco editor integration and Vue authoring workflows |
| `@airalogy/aimd-renderer` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer) | [`packages/npm/aimd-renderer`](packages/npm/aimd-renderer) | AIMD rendering to HTML and Vue |
| `@airalogy/aimd-recorder` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder) | [`packages/npm/aimd-recorder`](packages/npm/aimd-recorder) | Vue UI components for structured AIMD recording |
| `@airalogy/airalogy-engine` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?logo=npm&color=CB3837)](https://www.npmjs.com/package/@airalogy/airalogy-engine) | [`packages/npm/airalogy-engine`](packages/npm/airalogy-engine) | Node.js protocol execution sandbox API |

## Development

Python package commands run from their package directories:

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

npm package commands run from the repository root:

```bash
pnpm install
pnpm build:npm
pnpm type-check
pnpm test
```

## Documentation

- Airalogy Python package docs: `docs/airalogy`
- AIMD npm package docs: `docs/aimd`
- Airalogy Engine overview: `docs/airalogy-engine`

## Releases

- Published packages are versioned with Changesets.
- npm packages publish from `packages/npm/*` through npm Trusted Publishing.
- PyPI package versions are anchored by private `package.json` files, synced to `pyproject.toml`, and published through PyPI Trusted Publishing.

## Citation

If Airalogy or the AIMD packages are useful in your work, please cite the Airalogy paper:

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

The former standalone `aimd` and `airalogy-engine` repositories are intended to become archived mirrors after this monorepo migration lands.
