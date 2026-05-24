# Migration

As of `@airalogy/aimd-core` 2.0.0, parsed AIMD nodes and extracted field objects no longer expose legacy `name` aliases.

## Replacements

- `AimdNode.name` -> `AimdNode.id`
- `AimdVarTableField.name` -> `AimdVarTableField.id`
- `AimdSubvar.name` -> `AimdSubvar.id`
- `AimdStepField.name` -> `AimdStepField.id`
- `AimdStepField.parentName` -> `AimdStepField.parent_id`
- `AimdStepField.prevName` -> `AimdStepField.prev_id`
- `AimdStepField.nextName` -> `AimdStepField.next_id`
- `AimdTemplateEnv.record.byName` -> `AimdTemplateEnv.record.byId`
- `renderer data-aimd-name` -> `renderer data-aimd-id`

## What To Update

1. Read identifiers only from `id`.
2. Replace hierarchy lookups with `parent_id` / `prev_id` / `next_id`.
3. If you were scraping renderer output, switch any selectors or metadata reads from `data-aimd-name` to `data-aimd-id`.
4. If you built template env helpers around `record.byName`, rename them to `record.byId`.
