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

Because step/check template defaults are enabled by default, the input above produces a core Record fragment like this. The CSV does not provide `step.prepare.annotation` or `check.qc.checked`, so they are filled as `""` and `false`. This example omits the generated `record_id`, `record_version`, `metadata.sha1`, and protocol metadata that may come from `protocol.toml`:

```json
{
  "metadata": {
    "operator": "alice"
  },
  "data": {
    "var": {
      "sample_id": "S1"
    },
    "quiz": {
      "quiz_choice_1": "A"
    },
    "step": {
      "prepare": {
        "annotation": "",
        "checked": true
      }
    },
    "check": {
      "qc": {
        "annotation": "reviewed",
        "checked": false
      }
    }
  }
}
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

- `--input-format csv|tsv|json|jsonl`: explicitly set the input format. The default `auto` infers it from the input file suffix.
- `--output-format json|jsonl`: explicitly set the output format. The default `auto` infers it from the output file suffix.
- `--allow-extra-var-fields`: allow input fields that are not declared by the Protocol and keep them in `data.var`. By default, these fields are errors. Because extra fields are not validated by `VarModel`, this is not recommended for normal imports.
- `--require-complete-quiz`: require every quiz defined by the Protocol to have an imported answer. By default, quiz answers may be omitted.
- `--no-template-defaults`: do not auto-fill step/check template defaults. By default, deterministic `annotation` and `checked` fields are added from the Protocol.
- `--no-record-ids`: do not generate `record_id` values. If the input data explicitly provides a `record_id` column, that value is still used.
- `--skip-model-sync-check`: skip compatibility checks between `protocol.aimd` and `model.py::VarModel`. By default, model-only variable fields and same-name explicit type conflicts are rejected; use this only for migration or debugging.

By default, the CLI generates `record_id`, sets `record_version` to `1`, checks compatibility between `protocol.aimd` and `model.py::VarModel`, adds deterministic step/check defaults from the Protocol, computes `metadata.sha1`, and fails the import if any row has validation errors.
