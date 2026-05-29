# Airalogy Protocol Examples

This directory contains official, runnable Airalogy Protocol examples migrated from the former standalone `airalogy/protocols` repository.

Preview and fill the AIMD portions in the [AIMD demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples). Examples with `assigner.py` require an Airalogy Engine runtime for automatic calculation, file processing, and report generation.

## Example List

| ID | Scenario | Languages | Engine | Summary |
| --- | --- | --- | --- | --- |
| `meeting-notes` | Meeting notes | `en-US`, `zh-CN` | No | General-purpose meeting notes template for teams and projects. |
| `cuaac-kinetics` | Click reaction kinetics | `en-US`, `zh-CN` | Yes | CuAAC kinetic data upload, parameter calculation, plots, and report drafting. |
| `field-water-sample-observation` | Field water sample observation and disturbance analysis | `zh-CN` | No | Field water sampling, same-day weather and site records, water chemistry and biogeochemical interpretation, monsoon and extreme rainfall disturbance analysis. |
| `fiber-endface-process` | Fiber endface micro/nano fabrication workflow | `zh-CN` | No | Topic decomposition, process-route design, process window recording, and characterization planning for fiber endface devices. |
| `fiber-endface-sensing-calibration` | Fiber endface sensing calibration | `zh-CN` | Yes | Calibration data upload, sensitivity fitting, LOD estimation, QC, plotting, and report generation. |
| `drug-response-ic50` | Drug response IC50 analysis | `en-US`, `zh-CN` | Yes | Dose-response upload, IC50 estimation, QC, curve plotting, and report generation. |
| `diary` | Diary | `en-US`, `zh-CN` | No | Compact structured diary protocol. |

The machine-readable registry is [index.json](./index.json).

## Layout

- Each protocol variant is a complete protocol directory with `protocol.aimd` and `protocol.toml`.
- Optional `assigner.py` files sit next to their protocol files so the directory can be packed or executed as a unit.
- Optional sample data files are stored beside the corresponding locale variant.
- Compatibility and regression-only protocols live under [`spec/fixtures/protocols`](../../spec/fixtures/protocols), not in this user-facing example directory.

## Adding Protocol Examples

- Use one kebab-case directory per scenario.
- Use locale subdirectories such as `en-US/` and `zh-CN/`.
- Keep each locale subdirectory self-contained as an Airalogy Protocol package.
- Register the example in `index.json` so docs and demo apps can discover it.
- Do not commit real patient, participant, credential, or business data in example files.
