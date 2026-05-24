# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` provides AIMD recorder styles, reusable record-input components, and a combined protocol-editing + recording surface.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. These pages describe frontend recorder behavior only.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Main Capabilities

- Recorder UI styles via `@airalogy/aimd-recorder/styles`.
- Inline protocol recorder component: `AimdRecorder`.
- Combined authoring + recording editor: `AimdRecorderEditor`.
- Reusable quiz answer component: `AimdQuizRecorder`.
- Built-in recorder widgets for `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence`.
- Frontend-only `assigner runtime=client` execution for pure var computations.

## Guides

- [AimdRecorder](/en/packages/aimd-recorder/recorder): render a protocol inline and collect record data.
- [AimdRecorderEditor](/en/packages/aimd-recorder/recorder-editor): keep editing AIMD structure while filling recorder data.
- [Customization](/en/packages/aimd-recorder/customization): adapt built-in fields, override labels, or inject per-type behavior.
