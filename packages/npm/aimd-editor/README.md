# @airalogy/aimd-editor

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-editor)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

AIMD (Airalogy Markdown) authoring toolkit for Monaco + Vue (WYSIWYG/source workflows).

## Install

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## Quick Start

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Vue Editor i18n

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

Use `messages` to override built-in copy per locale.

The Vue source editor surfaces parser-level semantic warnings for AIMD var definitions, including default/type mismatches and numeric constraint kwargs used on non-numeric types.

For advanced embedding, the low-level `AimdWysiwygEditor` now accepts a custom Milkdown plugin chain, and `AimdFieldDialog` can be limited to a focused subset of AIMD field kinds with `allowedTypes`.

## Documentation

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-editor>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-editor>
- Source docs: `docs/aimd/en/packages/aimd-editor.md`, `docs/aimd/zh/packages/aimd-editor.md`

## Citation

If `@airalogy/aimd-editor` is useful in your work, please cite the Airalogy paper:

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
