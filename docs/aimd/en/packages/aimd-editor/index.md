# @airalogy/aimd-editor

`@airalogy/aimd-editor` provides AIMD Monaco language integration and Vue editor surfaces for source and WYSIWYG workflows.

## Install

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

`vue` is required when using the Vue editor APIs from the root entry.

## Entry Points

- `@airalogy/aimd-editor`: full package entry, including Monaco helpers and Vue editor APIs.
- `@airalogy/aimd-editor/monaco`: Monaco language config and theme helpers.
- `@airalogy/aimd-editor/vue`: explicit Vue subpath for editor-focused imports.
- `@airalogy/aimd-editor/embedded`: low-level source + WYSIWYG editor surfaces for host packages.
- `@airalogy/aimd-editor/wysiwyg`: lightweight WYSIWYG-only entry.

## Monaco Integration

Use `@airalogy/aimd-editor/monaco` when you want AIMD syntax highlighting, language configuration, and completion inside Monaco.

```ts
import * as monaco from "monaco-editor"
import {
  language,
  conf,
  completionItemProvider,
} from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Choose A Surface

- [Vue Editor](/en/packages/aimd-editor/vue-editor): use `AimdEditor` for the standard source/WYSIWYG authoring workflow.
- [Embedded Surfaces](/en/packages/aimd-editor/embedded): embed `AimdWysiwygEditor`, constrain field insertion, or inject host-specific Milkdown plugins.

The Vue source editor reports parser-level semantic warnings for AIMD var definitions, including default/type mismatches and Pydantic-style numeric constraint kwargs used on non-numeric types.

## Notes

- AIMD syntax keywords remain English, such as `type: choice` and `mode: single`.
- `AIMD_FIELD_TYPES` and `MD_TOOLBAR_ITEMS` are legacy compatibility exports. Prefer the factory helpers that generate localized UI metadata.

For a full interactive integration, refer to the editor demo in `aimd/demo`.
