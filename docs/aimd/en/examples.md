# AIMD Examples

The `examples/` directory stores AIMD examples for different business scenarios. An example shows how AIMD can be organized in a practical workflow and can also be copied as a starting point for a custom protocol.

Open the [Demo examples page](/demo/#/examples) to switch, edit, and fill these examples directly.

## Current Examples

| ID | Scenario | Summary |
| --- | --- | --- |
| `clinical-information-record` | Clinical information record | Bilingual case for structured clinical encounter, assessment, plan, and review records. |

Example sources live in the GitHub repository under [`examples/`](https://github.com/airalogy/airalogy/tree/main/examples/aimd), and the machine-readable registry is [`examples/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/aimd/index.json).

## Adding Examples

When adding examples, follow these conventions:

- Use one kebab-case subdirectory per example.
- Name the entry file `protocol.<locale>.aimd`.
- Include a README describing scope, covered fields, and usage notes.
- Register the example in `examples/index.json`.
