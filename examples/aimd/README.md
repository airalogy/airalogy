# AIMD Examples

This directory manages standalone AIMD examples for different scenarios. Examples show how AIMD can be organized in practical workflows and can also be used as starting points for custom protocols.

Complete Airalogy Protocol examples with `protocol.toml`, optional `assigner.py`, and optional sample data live in [`examples/protocols`](../protocols/).

Preview and fill examples online on the [Demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples).

## Example List

| ID | Scenario | Entry | Summary |
| --- | --- | --- | --- |
| `aimd-syntax-tour` | AIMD syntax tour | [protocol.aimd](./aimd-syntax-tour/protocol.aimd) | Interactive syntax tour covering variables, tables, figures, citations, steps, checks, quizzes, references, Markdown review marks, and browser-side client assigners. |
| `clinical-information-record` | Clinical information record | [protocol.en-US.aimd](./clinical-information-record/protocol.en-US.aimd) / [protocol.zh-CN.aimd](./clinical-information-record/protocol.zh-CN.aimd) | Bilingual case for structured clinical encounter, assessment, plan, and review records. |

The machine-readable registry is [index.json](./index.json).

## Conventions

- Use one kebab-case subdirectory per example, such as `clinical-information-record/`.
- Name single-language or language-neutral entry files `protocol.aimd`; name localized entry files `protocol.<locale>.aimd`.
- Include a README for each example with scope, covered fields, and usage notes.
- Update `index.json` whenever adding an example so host applications can discover it.
- Do not commit real patient, participant, or business data in example files.
