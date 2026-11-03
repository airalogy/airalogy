# Surface-Water Data Review: Presentation Guide

This Chinese-language Protocol introduces Airalogy through three levels: enter readings, compare automatically, then trace supporting records. Show the first two chapters initially and continue to the third when the audience wants more detail. There is no need to explain every field.

The Protocol contains operational instructions and one prominent demonstration notice. Presentation guidance, calculation details, and integration boundaries belong in this guide. All example data is fictional and the rules are illustrative.

## Scenario Rationale

The [published responsibilities of the Zhejiang provincial monitoring center](https://www.zjemc.org.cn/jggk/jgzz/) include surface-water monitoring, automatic/manual comparison, quality management, and information-system support. Public sources also describe [standardized monitoring report formats](https://www.cnemc.cn/gzdt/dfxx/202402/t20240201_1065474.shtml) and [whole-process quality management, LIMS, and data use](https://www.mee.gov.cn/zcwj/zcjd/202504/t20250427_1118455.shtml). These provide the public context for exploring Airalogy as a structured task and record layer.

## Report Introduction

Staff enter site details and readings in a familiar form. Airalogy retains structured raw values, calculates differences, and identifies follow-up items using explicit rules. Instrument references, source files, sample handover, and human review add the context needed for later analysis, reporting, and exchange.

## Progressive Demonstration

| Level | Protocol location | Show | Main message |
| --- | --- | --- | --- |
| Start with a familiar form | Chapter 1 and the calculated results in chapter 2 | Enter a task, site, and paired readings; see the mean and difference | Staff can fill the form directly while structured data is created |
| Review a discrepancy | Chapter 2 | Change one value, inspect the updated results and summary, then choose follow-up actions | The same record retains raw values, calculations, and follow-up |
| Trace the evidence | Chapter 3 | Inspect sources, instrument references, handover, and review; export the record | Results link to supporting information, with the template and records archived together |

These are presentation levels within one Protocol, not separate versions or a field-operation sequence. Safety, instrument checks, and comparability must still be established before actual measurement or comparison; chapter 3 groups their evidence. Leave source code, field IDs, detailed formulas, and most traceability fields for technical discussion.

## Files and Use

- `protocol.aimd`: a blank template with three progressive chapters, eight titled steps, three tables, and a browser-side assigner. All record fields are retained.
- `protocol.toml`: Protocol identity and version `0.1.0`.
- `demo-records.json`: three synthetic records against the same template, without pre-completed steps, checkmarks, or reviewer signatures.
- `../build-demo.mjs`: writes a template archive and a three-record archive to `.tmp/surface-water-quality-review/`, without modifying the template.

Select the Chinese title “地表水监测数据复核” in the AIMD demo catalog for the blank template. The calculation needs no Docker, Engine, external API, or AI service. From the repository root:

```bash
pnpm --filter @airalogy/aira-core build
node examples/protocols/surface-water-quality-review/build-demo.mjs
```

Save any existing editor draft before importing `.tmp/surface-water-quality-review/demo-records.aira` into the online editor. `protocol.aira` contains only the blank template. Derived results are recalculated by Recorder rather than duplicated in fixture JSON.

## Demonstration Records

All DO values are in mg/L. Each Record represents one paired comparison and accepts one input row; another time point or remeasurement belongs in a new Record. The fixtures retain raw inputs and use the same calculation rules.

| Record | Automatic DO | Field readings | Mean | RPD | Absolute difference | Expected outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `DEMO-WQ-001-consistent` | 6.70 | 6.80 / 6.60 | 6.70 | 2.99% | 0.00 | Consistent under demo rules |
| `DEMO-WQ-002-discrepancy` | 3.20 | 6.80 / 6.60 | 6.70 | 2.99% | 3.50 | Investigate discrepancy |
| `DEMO-WQ-003-repeatability` | 5.00 | 6.80 / 3.20 | 5.00 | 72.00% | Not calculated | Repeatability requires remeasurement |

## 3 / 5 / 8-Minute Walkthrough

| Time | Action | Message |
| --- | --- | --- |
| 0–1 minutes | Open chapter 1 and enter task/site details, or pre-import the archive and select record 1 | Begin with a familiar form |
| 1–3 minutes | Show 6.70 against 6.80/6.60, confirm both conditions as yes, and inspect mean 6.70 and difference 0.00 | Input immediately produces calculations; a three-minute introduction can end here |
| 3–4 minutes | Change the automatic value to 3.20, inspect difference 3.50, and choose follow-up actions | Data changes drive results and next actions |
| 4–5 minutes | Select record 3: the means coincide but RPD is 72%; optionally set comparability to no | Data quality matters beyond the final mean; a five-minute introduction can end here |
| 5–7 minutes | Open chapter 3 and select one example each of source batch, instrument reference, and sample handover | Trace results to evidence without walking through every field |
| 7–8 minutes | Inspect structured data and save/export `.aira`; recap input, calculation, and traceability | One reusable template, multiple exchangeable records |

Use demonstration copies. Show missing readings, zero means, and low-value reminders only when discussing rule details, not as a checklist for the first presentation.

## Calculation Details

- Rule version: `DEMO-DO-001 v1`. Illustrative thresholds: RPD ≤ 10%, difference ≤ 0.50 mg/L, and a review reminder for field means below 5.00 mg/L.
- RPD = |reading 1 − reading 2| / mean × 100%. Apply decisions to unrounded values and display two decimals. A zero mean leaves RPD undefined and requires review.
- Check inputs, instrument validity, and comparability before repeatability and differences. Missing values are not zero; failed repeatability prevents a favorable comparison result.
- These are repeated field readings, not independently collected duplicate samples. DO uses field measurements. Laboratory follow-up follows approved analyte-specific sampling, preservation, and handover methods.
- The fixtures' five-minute gap is not an approved pairing window. Staff verify actual pairing conditions against the task plan; this example records their confirmation.

## Production Integration

Fictional data and illustrative thresholds are not an approved monitoring SOP, report, or basis for water classification, pollution attribution, or final data acceptance. Agreement under the demo rules still requires human review. The example does not imply institutional adoption of Airalogy.

| Available in this example | Production work to agree and implement |
| --- | --- |
| Typed fields, titled steps, tables, and checkpoints | Approved methods, task plans, and template governance |
| Reproducible browser calculations and summary | Authoritative server recalculation, completeness checks, and submission gates |
| Source IDs, attachment fields, and follow-up references | Station, LIMS, barcode, and archive-system integration |
| Reviewer name, opinion, and checkpoints | Authentication, roles, electronic signatures, audit, and authorization |
| Template snapshot and multiple records in `.aira` | Approved report mappings and controlled report generation |

No real external system is connected. Names and checkmarks are not authentication, electronic signatures, or export gates. Actual field work remains subject to safety procedures and approved methods.

A possible pilot is one approved task template, a small authorized/de-identified record set, and one well-defined integration. Joint acceptance should cover field completeness, reproducible calculations, traceability, and export/reimport. Do not upload sensitive site information, personal data, or credentials without authorization.
