# Airalogy Record v1

An Airalogy Record is one standard data object recorded, validated, or generated through a Protocol. `.aira` is the container; Record is the most important standard data unit inside that container.

The public JSON Schema for Record v1 lives at:

```text
schemas/aira/record.v1.schema.json
```

## Core structure

```json
{
  "format": "airalogy.record",
  "schema_version": 1,
  "record_id": "11111111-1111-4111-8111-111111111111",
  "record_version": 1,
  "metadata": {
    "protocol_id": "sample_protocol",
    "protocol_version": "0.1.0"
  },
  "data": {
    "var": {},
    "step": {},
    "check": {},
    "quiz": {}
  }
}
```

New Records should include `format` and `schema_version`. For compatibility with existing data, the current validator allows old Records to omit these fields. When present, they must be `airalogy.record` and `1`.

## CLI usage

Inspect a Record file:

```bash
airalogy record inspect ./record.json
airalogy record inspect ./record.json --json
```

Validate the core Record structure:

```bash
airalogy record validate ./record.json
```

Validate `data.var` and `data.quiz` against a Protocol:

```bash
airalogy record validate ./record.json --protocol-dir ./my_protocol
```

If one Record file contains Records from multiple Protocols, pass `--protocol-dir` multiple times. Airalogy matches each Record by `metadata.protocol_id` and `metadata.protocol_version`:

```bash
airalogy record validate ./records.json \
  --protocol-dir ./protocol_a \
  --protocol-dir ./protocol_b
```

Options:

- `--protocol-dir`: Protocol directory for Protocol-level validation. Can be passed multiple times.
- `--allow-extra-var-fields`: allow fields in `data.var` that are not declared by the Protocol.
- `--require-complete-quiz`: require every quiz item in the Protocol to have a Record answer.
- `--skip-model-sync-check`: skip the compatibility check between `protocol.aimd` and `model.py::VarModel`.

## Relationship with `.aira`

When `airalogy pack` packages Record JSON files, it first validates the Record structure. If `--protocol-dir` is provided, matching Records are also validated against that Protocol's `data.var` contract.

`.aira` archive validation and Airalogy Reader also check basic Record payload structure, for example:

- the Record payload must be a JSON object;
- `record_version`, when present, must be a positive integer;
- `data` must be an object;
- `data.var` must be an object;
- `data.step`, `data.check`, and `data.quiz`, when present, must be objects.

Protocol-level deep validation currently runs in the Python CLI because it needs access to `protocol.aimd`, optional `model.py`, and quiz template definitions.
