# AIMD Examples

The `examples/aimd/` directory stores standalone AIMD examples for different business scenarios. An example shows how AIMD can be organized in a practical workflow and can also be copied as a starting point for a custom protocol.

Complete Airalogy Protocol examples live under `examples/protocols/`. Those examples include `protocol.toml` and may include `assigner.py` plus sample data for engine-backed workflows.

Open the [Demo examples page](/demo/#/examples) to switch, edit, and fill these examples directly.

## Current Examples

| ID | Scenario | Summary |
| --- | --- | --- |
| `aimd-syntax-tour` | AIMD syntax tour | Interactive syntax tour covering variables, tables, figures, citations, steps, checks, quizzes, references, Markdown review marks, and browser-side client assigners. |
| `clinical-information-record` | Clinical information record | Bilingual case for structured clinical encounter, assessment, plan, and review records. |

## Protocol Examples

| ID | Scenario | Summary |
| --- | --- | --- |
| `meeting-notes` | Meeting notes | General-purpose meeting notes protocol for teams and projects. |
| `cuaac-kinetics` | Click reaction kinetics | CuAAC kinetic data upload, automatic calculation, plots, and report drafting. |
| `field-water-sample-observation` | Field water sample observation and disturbance analysis | Field water sampling, same-day weather and site records, water chemistry and biogeochemical interpretation, monsoon and extreme rainfall disturbance analysis. |
| `literature-review-assistant` | AI-assisted literature review and evidence synthesis | Configure an OpenAI-compatible web-search model, screen candidate sources, extract evidence, appraise quality, and draft a review. |
| `stock-fundamental-analysis-assistant` | AI-assisted stock fundamental analysis | Enter a stock ticker and company name, configure an OpenAI-compatible web-search model, and organize public filings, business segments, financial quality, valuation comparisons, risks, and a research report draft. |
| `monitoring-site-flow-graph-3d-print` | Monitoring site physical graph and 3D print parameters | Generate a physics-constrained directed graph from site latitude, longitude, and elevation, then output node, edge, scale, and structure parameters for 3D printing. |
| `fiber-endface-process` | Fiber endface micro/nano fabrication workflow | Topic decomposition, process-route design, process window recording, and characterization planning for fiber endface devices. |
| `fiber-endface-sensing-calibration` | Fiber endface sensing calibration | Calibration data upload, sensitivity fitting, LOD estimation, QC, plotting, and report generation. |
| `drug-response-ic50` | Drug response IC50 analysis | Dose-response upload, IC50 estimation, QC, curve plotting, and report generation. |
| `diary` | Diary | Compact structured diary protocol. |

AIMD example sources live in [`examples/aimd`](https://github.com/airalogy/airalogy/tree/main/examples/aimd), and their machine-readable registry is [`examples/aimd/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/aimd/index.json). Complete protocol examples live in [`examples/protocols`](https://github.com/airalogy/airalogy/tree/main/examples/protocols), and their registry is [`examples/protocols/index.json`](https://github.com/airalogy/airalogy/blob/main/examples/protocols/index.json).

## Adding Examples

When adding examples, follow these conventions:

- Use one kebab-case subdirectory per example.
- Name the entry file `protocol.<locale>.aimd`.
- Include a README describing scope, covered fields, and usage notes.
- Register standalone AIMD examples in `examples/aimd/index.json`.
- Register complete protocol examples in `examples/protocols/index.json`.
