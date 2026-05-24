# Airalogy npm Packages

[![CI](https://github.com/airalogy/airalogy/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/ci.yml)
[![Docs](https://github.com/airalogy/airalogy/actions/workflows/docs.yml/badge.svg?branch=main)](https://github.com/airalogy/airalogy/actions/workflows/docs.yml)
[![npm scope](https://img.shields.io/badge/npm-%40airalogy%2F*-CB3837?logo=npm)](https://www.npmjs.com/org/airalogy)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../LICENSE)

This directory contains the publishable npm packages in the Airalogy monorepo:

| Package | npm | Docs | Summary |
| --- | --- | --- | --- |
| `@airalogy/aimd-core` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-core) | [README](./aimd-core/README.md) · [Site](https://airalogy.github.io/airalogy/aimd/en/packages/aimd-core/) | AIMD parser, syntax definitions, and utilities |
| `@airalogy/aimd-editor` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-editor) | [README](./aimd-editor/README.md) · [Site](https://airalogy.github.io/airalogy/aimd/en/packages/aimd-editor/) | Monaco editor integration and Vue authoring workflows |
| `@airalogy/aimd-renderer` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer) | [README](./aimd-renderer/README.md) · [Site](https://airalogy.github.io/airalogy/aimd/en/packages/aimd-renderer/) | Rendering AIMD to HTML and Vue |
| `@airalogy/aimd-recorder` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder) | [README](./aimd-recorder/README.md) · [Site](https://airalogy.github.io/airalogy/aimd/en/packages/aimd-recorder/) | Vue UI components and styles for structured AIMD recording |
| `@airalogy/airalogy-engine` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/airalogy-engine) | [README](./airalogy-engine/README.md) | Node.js API for the Airalogy protocol execution sandbox |

## AIMD Examples

Scenario examples live under [examples/](../../examples/aimd/) and are registered in the machine-readable [examples/index.json](../../examples/aimd/index.json). You can preview, edit, and fill these examples on the [Demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples).

## Development

Install dependencies at the repo root:

```bash
pnpm install
```

Run all packages in watch mode (build on change):

```bash
pnpm dev
```

Run dev for a single package:

```bash
pnpm --filter @airalogy/aimd-core dev
pnpm --filter @airalogy/aimd-editor dev
pnpm --filter @airalogy/aimd-renderer dev
pnpm --filter @airalogy/aimd-recorder dev
```

Start the Demo dev server (visually test all packages):

```bash
pnpm dev:demo
```

Visit http://localhost:5188 to see the demo, which includes:

- **Examples**: Browse repository AIMD scenario examples and fill them in the recorder
- **Core Parser**: Live AIMD Markdown parsing with AST and extracted fields
- **Editor**: Monaco editor token definitions and theme config preview
- **Renderer**: Live HTML / Vue VNode rendering preview
- **Recorder**: AIMD CSS styles and UI component preview

## Documentation

Docs are hosted under `docs/aimd/` with bilingual structure:

- English: `docs/aimd/en/`
- Chinese: `docs/aimd/zh/`
- Organized by package: `docs/aimd/{en|zh}/packages/*`
- Embedded demo page: `docs/aimd/{en|zh}/demo.md`

Run docs locally:

```bash
pnpm docs:aimd:dev
```

Build docs:

```bash
pnpm docs:aimd:build
```

`pnpm docs:aimd:build` packages both docs and demo assets (mounted under `/demo/` in the docs site).

Type-check all packages:

```bash
pnpm type-check
```

## Build

Build all packages:

```bash
pnpm build
```

Build a single package:

```bash
pnpm --filter @airalogy/aimd-core build
```

## Citation

If the AIMD packages are useful in your work, please cite the Airalogy paper:

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
