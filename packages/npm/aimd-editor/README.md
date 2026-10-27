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

## Figure Authoring And Formal Output

The reusable authoring entry keeps draft editing permissive while making explicit save and export operations strict. `prepareAimdForFormalOutput()` generates missing IDs for closed `fig` blocks that already have `src`, preserves existing IDs, rejects duplicate IDs or missing sources, and returns the AIMD source that must be written back before downloading `.aimd` or packaging `.aira`. When `generated` is non-empty, hosts should show a non-blocking notice that IDs were generated and written into the source.

```ts
import { prepareAimdForFormalOutput } from "@airalogy/aimd-editor/authoring"

const prepared = prepareAimdForFormalOutput(source)
source = prepared.content
```

Do not call this normalizer from automatic draft saving. `AimdSourceEditor` separately diagnoses closed figures with missing IDs and offers a generate-ID quick fix without rewriting incomplete input.

## Input Field Authoring

The toolbar provides Text, Integer, Decimal, Single choice, Multiple choice, and Yes/no shortcuts. More inputs contains dates, times, date/time, text lists, attachments, and custom types. Each shortcut opens a preselected form; choices are entered one per line without writing type syntax. A unique `field_1`, `field_2`, etc. ID is generated and written into AIMD on insertion; existing IDs never change just because fields move. Names are optional. Advanced settings expose the editable ID, custom type, and default value, with invalid or duplicate IDs rejected.

Use `mode="wysiwyg" field-display="compact"` to hide technical syntax in visual field placeholders. Click a placeholder to edit its properties. The package defaults remain source mode and detailed display. For actual data entry in the same editable document, use `AimdRecorderWysiwygSurface` from `@airalogy/aimd-recorder`; `AimdEditor` edits definitions, not Record values.

`collectAimdFieldIds`, `createAimdFieldId`, and `updateAimdInputField` are available from `@airalogy/aimd-editor/authoring`, and `AimdInputFieldDialog` is available from `@airalogy/aimd-editor/vue` for host integrations.

The input configuration dialog stays centered in the current viewport even when the host resets element margins. It keeps spacing on narrow screens and scrolls internally when its content is too tall.

Multiline `var_table` declarations remain structured fields in visual mode. Switching modes and saving preserves nested column IDs, titles, types and constraints; their `var(...)` definitions are not displayed as column labels.

## Step Authoring

The Step action opens `AimdStepFieldDialog`: names are optional, IDs are generated, and Advanced settings expose level and timer options. Existing IDs stay read-only when editing a title. The reusable `updateAimdStepField` authoring helper preserves unrelated parameters and stable identities. `{{step|mix, title="Mix sample", check=True}}` keeps its instructions in ordinary Markdown, not in the title. Recorder owns filled values and timing state.

## Checkpoint and Advanced Input Authoring

Quoted AIMD-looking text, such as `checked_message="Keep {{ref_var|wait_s}} literal"`, stays inside its parent field in visual mode and survives saving and reopening. Only references in ordinary document text become separate reference nodes.

The Checkpoint action also accepts an optional name, generates a persistent ID, and keeps existing IDs read-only. `AimdStepFieldDialog` accepts `fieldType="check"`; `updateAimdCheckField` preserves the ID while editing the title and checked message. Instructions stay in Markdown; recorded values belong to Recorder.

**Advanced / custom** offers all built-in types from the generated Python registry and host `varTypePlugins`, with a free-edit type expression below. Selecting a known type preserves nullability; expressions such as `list[MyType] | None` remain editable. Listing a custom type does not install its Python definition or a Recorder widget.

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

The Vue source editor surfaces parser-level semantic warnings for AIMD var definitions, including default/type mismatches and numeric constraint kwargs used on non-numeric types. It also reports missing or duplicate figure IDs and missing figure sources.

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
