# Batch Record Import

`airalogy.ingest` imports row-based data into Airalogy Record JSON for any Protocol.

The importer reads a Protocol's `protocol.aimd`. If `model.py::VarModel` exists, it overrides same-name fields in the `VarModel` generated from AIMD, while fields defined only in AIMD are kept; otherwise, the importer uses the `VarModel` generated from AIMD directly. Each input row becomes one Record. Variable data is validated with Pydantic; quiz answers are validated against the Protocol quiz definitions; step and check data are checked against the Protocol IDs.

## Python API

```python
from airalogy.ingest import import_records

result = import_records(
    protocol_dir="./my_protocol",
    input_path="./records.csv",
    output_path="./records.jsonl",
)

if not result.ok:
    for error in result.errors:
        print(error)
```

## VarModel Merge and Conflict Check

If a Protocol directory contains both `protocol.aimd` and `model.py`, the importer first generates a base `VarModel` from AIMD, then uses `model.py::VarModel` to override same-name fields. Fields that exist only in AIMD keep their AIMD-generated types. `model.py::VarModel` cannot define variable fields that do not exist in AIMD.

The default compatibility check fails when:

- `model.py::VarModel` defines a field that does not exist in AIMD
- the same field is explicitly declared in AIMD as a simple scalar type (`str`, `int`, `float`, or `bool`), but the annotation in `model.py::VarModel` conflicts with it

Use `validate_model_sync=False` only when you intentionally need to skip this compatibility check:

```python
result = import_records(
    protocol_dir="./my_protocol",
    input_path="./records.csv",
    validate_model_sync=False,
)
```

Supported input formats:

- CSV: `.csv`
- TSV: `.tsv`
- JSON Lines: `.jsonl`
- JSON: a row object, a list of row objects, or `{"records": [...]}`

Supported output formats:

- JSON array: `.json`
- JSON Lines: `.jsonl`

## Column Mapping

Unprefixed columns are imported into `data.var`:

```csv
sample_id,temperature_c
S1,37.5
```

The example above becomes:

```json
{
  "data": {
    "var": {
      "sample_id": "S1",
      "temperature_c": 37.5
    }
  }
}
```

Use prefixes for non-variable sections:

```csv
sample_id,quiz.quiz_choice_1,step.prepare.checked,check.qc.annotation,metadata.operator
S1,A,true,reviewed,alice
```

Supported prefixed paths:

- `var.<field_id>`
- `quiz.<quiz_id>`
- `step.<step_id>.checked`
- `step.<step_id>.annotation`
- `check.<check_id>.checked`
- `check.<check_id>.annotation`
- `metadata.<field_name>`
- `record_id`
- `record_version`
- `airalogy_record_id`

For list or object values, write JSON as the value of a column, such as `[{"name": "Alice"}]`.

## CLI

```bash
airalogy import-records ./my_protocol -i records.csv -o records.jsonl
```

Useful options:

- `--input-format csv|tsv|json|jsonl`
- `--output-format json|jsonl`
- `--allow-extra-var-fields`
- `--require-complete-quiz`
- `--no-template-defaults`
- `--no-record-ids`
- `--skip-model-sync-check`

By default, the CLI generates `record_id`, sets `record_version` to `1`, checks compatibility between `protocol.aimd` and `model.py::VarModel`, adds deterministic step/check defaults from the Protocol, computes `metadata.sha1`, and fails the import if any row has validation errors.
