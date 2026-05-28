# Protocol Examples

Official Airalogy Protocol examples live in the monorepo under [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols). They were migrated from the former standalone `airalogy/protocols` repository so protocol examples, parser behavior, engine packages, and docs can evolve together.

You can preview and fill the AIMD portions on the [AIMD demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples). Protocols with `assigner.py` require Airalogy Engine for automatic calculation, file processing, and report generation.

## Current Examples

| ID | Scenario | Runtime | Summary |
| --- | --- | --- | --- |
| `meeting-notes` | Meeting notes | Static | General-purpose meeting notes protocol for teams and projects. |
| `cuaac-kinetics` | Click reaction kinetics | Engine | CuAAC kinetic data upload, parameter calculation, plots, and report drafting. |
| `drug-response-ic50` | Drug response IC50 analysis | Engine | Dose-response upload, IC50 estimation, QC, curve plotting, and report generation. |
| `diary` | Diary | Static | Compact structured diary protocol. |

## Repository Layout

- `examples/protocols/index.json`: machine-readable registry for official protocol examples.
- `examples/protocols/<example>/<locale>/protocol.aimd`: AIMD source loaded by docs and demo apps.
- `examples/protocols/<example>/<locale>/protocol.toml`: protocol metadata.
- `examples/protocols/<example>/<locale>/assigner.py`: optional engine-side assigner code.
- `spec/fixtures/protocols`: protocol fixtures reserved for regression and compatibility tests.
