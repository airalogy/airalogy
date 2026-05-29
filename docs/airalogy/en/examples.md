# Protocol Examples

Official Airalogy Protocol examples live in the monorepo under [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols). They were migrated from the former standalone `airalogy/protocols` repository so protocol examples, parser behavior, engine packages, and docs can evolve together.

You can preview and fill the AIMD portions on the [Airalogy Markdown Demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples). For engine-backed parsing, variable validation, and assigner execution, run the local Airalogy Protocol Demo:

```bash
pnpm dev:protocol-demo:full
```

Protocols with `assigner.py` require Airalogy Engine for automatic calculation, file processing, and report generation.

## Current Examples

| ID | Scenario | Runtime | Summary |
| --- | --- | --- | --- |
| `meeting-notes` | Meeting notes | Static | General-purpose meeting notes protocol for teams and projects. |
| `cuaac-kinetics` | Click reaction kinetics | Engine | CuAAC kinetic data upload, parameter calculation, plots, and report drafting. |
| `field-water-sample-observation` | Field water sample observation and disturbance analysis | Static | Field water sampling, same-day weather and site records, water chemistry and biogeochemical interpretation, monsoon and extreme rainfall disturbance analysis. |
| `literature-review-assistant` | AI-assisted literature review and evidence synthesis | Engine | Configure an OpenAI-compatible web-search model, screen candidate sources, extract evidence, appraise quality, and draft a review. |
| `fiber-endface-process` | Fiber endface micro/nano fabrication workflow | Static | Topic decomposition, process-route design, process window recording, and characterization planning for fiber endface devices. |
| `fiber-endface-sensing-calibration` | Fiber endface sensing calibration | Engine | Calibration data upload, sensitivity fitting, LOD estimation, QC, plotting, and report generation. |
| `drug-response-ic50` | Drug response IC50 analysis | Engine | Dose-response upload, IC50 estimation, QC, curve plotting, and report generation. |
| `diary` | Diary | Static | Compact structured diary protocol. |

## Repository Layout

- `examples/protocols/index.json`: machine-readable registry for official protocol examples.
- `examples/protocols/<example>/<locale>/protocol.aimd`: AIMD source loaded by docs and demo apps.
- `examples/protocols/<example>/<locale>/protocol.toml`: protocol metadata.
- `examples/protocols/<example>/<locale>/assigner.py`: optional engine-side assigner code.
- `apps/protocol-demo`: local demo service that loads these protocol packages and calls `@airalogy/airalogy-engine`.
- `spec/fixtures/protocols`: protocol fixtures reserved for regression and compatibility tests.
