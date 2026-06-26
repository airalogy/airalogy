# Airalogy Protocol Examples

This directory contains official, runnable Airalogy Protocol examples migrated from the former standalone `airalogy/protocols` repository.

Preview and fill the AIMD portions in the [AIMD demo examples page](https://airalogy.github.io/airalogy/aimd/demo/#/examples). Examples with `assigner.py` require an Airalogy Engine runtime for automatic calculation, file processing, and report generation.

## Example List

| ID | Scenario | Languages | Engine | Summary |
| --- | --- | --- | --- | --- |
| `meeting-notes` | Meeting notes | `en-US`, `zh-CN` | No | General-purpose meeting notes template for teams and projects. |
| `cuaac-kinetics` | Click reaction kinetics | `en-US`, `zh-CN` | Yes | CuAAC kinetic data upload, parameter calculation, plots, and report drafting. |
| `field-water-sample-observation` | Field water sample observation and disturbance analysis | `zh-CN` | No | Field water sampling, same-day weather and site records, water chemistry and biogeochemical interpretation, monsoon and extreme rainfall disturbance analysis. |
| `literature-review-assistant` | AI-assisted literature review and evidence synthesis | `zh-CN` | Yes | Configure an OpenAI-compatible web-search model, screen candidate sources, extract evidence, appraise quality, and draft a review. |
| `stock-fundamental-analysis-assistant` | AI-assisted stock fundamental analysis | `zh-CN` | Yes | Enter a stock ticker and company name, configure an OpenAI-compatible web-search model, and organize public filings, business segments, financial quality, valuation comparisons, risks, and a research report draft. |
| `monitoring-site-flow-graph-3d-print` | Monitoring site physical graph and 3D print parameters | `zh-CN` | Yes | Generate a physics-constrained directed graph from site latitude, longitude, and elevation, then output node, edge, scale, and structure parameters for 3D printing. |
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

## Required Structure

`examples/protocols` is the canonical source for official user-facing Protocol examples. The PyPI package does not keep a second committed copy; `packages/pypi/airalogy/src/airalogy/examples/protocols/data` is generated from this directory during `uv build` and is ignored by git.

Use one kebab-case scenario directory and one locale directory per Protocol variant:

```text
examples/protocols/<example-id>/<locale>/
├── protocol.aimd
├── protocol.toml
├── assigner.py          # optional
└── sample-data.csv      # optional
```

`<example-id>` is the public example slug used in GitHub paths and docs, for example `meeting-notes`. The Protocol id in `protocol.toml` is the stable runtime id used by APIs and package lookup, for example `meeting_notes_en`.

Every locale variant must be registered in `index.json` with matching `languages`, `protocol_dir`, `entry`, and `toml` entries. If an example has `assigner.py`, register it under `assigner`; if it has bundled data files, register them under `sample_data`. All registered paths must stay inside the corresponding locale directory.

## Validation And Packaging

Before committing Protocol example changes, run the focused validation:

```bash
UV_CACHE_DIR=.uv-cache uv --directory packages/pypi/airalogy run --with pytest python -m pytest tests/test_spec_fixtures.py
```

Before publishing `airalogy`, also build the Python package:

```bash
UV_CACHE_DIR=.uv-cache uv build --out-dir .tmp/python-build/airalogy packages/pypi/airalogy
```

The build backend validates the example registry, verifies all referenced files, checks Protocol metadata ids, generates the package-data copy, and then removes the generated directory from the working tree after the build.

The repository pre-push hook runs both checks automatically when a push includes changes under `examples/protocols`, `packages/pypi/airalogy`, or `.changeset`.

## Adding Protocol Examples

- Use one kebab-case directory per scenario.
- Use locale subdirectories such as `en-US/` and `zh-CN/`.
- Keep each locale subdirectory self-contained as an Airalogy Protocol package.
- Register the example in `index.json` so docs and demo apps can discover it.
- Do not commit real patient, participant, credential, or business data in example files.
