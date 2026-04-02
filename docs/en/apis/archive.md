# Archive Packaging

Airalogy supports zip-based single-file archives for sharing protocols and records over chat, email, cloud drives, or other file-transfer tools.

Version 1 uses one unified suffix:

- `.aira`: the standard Airalogy archive container

The concrete payload type is stored in the internal manifest via the `kind` field:

- `kind: "protocol"`: a single Airalogy Protocol archive
- `kind: "records"`: a bundle of one or more Airalogy Record JSON payloads, optionally with embedded protocol directories

Both archive types keep a machine-readable manifest at `_airalogy_archive/manifest.json`.

## Why this exists

An Airalogy Protocol is usually authored as a directory containing `protocol.aimd` plus optional sibling files such as `model.py`, `assigner.py`, `protocol.toml`, and `files/`. That layout is convenient for development, but awkward to send as a single file.

Airalogy archives keep the existing on-disk structure intact while wrapping it in a dedicated shareable container.

## CLI usage

Pack one protocol directory:

```bash
airalogy pack ./my_protocol -o my_protocol.aira
```

Pack one or more record JSON files:

```bash
airalogy pack ./record.json ./record-history.json -o records.aira
```

Embed related protocol directories into a record bundle:

```bash
airalogy pack ./record.json -o record_bundle.aira --protocol-dir ./my_protocol
```

Unpack an archive:

```bash
airalogy unpack ./my_protocol.aira -o ./extracted_protocol
airalogy unpack ./record_bundle.aira -o ./extracted_bundle
```

## Python API

```python
from airalogy.archive import (
    pack_protocol_archive,
    pack_records_archive,
    read_archive_manifest,
    unpack_archive,
)

pack_protocol_archive("my_protocol", "my_protocol.aira")
pack_records_archive(["record.json"], "records.aira", protocol_dirs=["my_protocol"])
manifest = read_archive_manifest("records.aira")
output_dir, manifest = unpack_archive("records.aira", "records_out")
```

## Protocol archive behavior

- The archive preserves the original protocol directory layout.
- `files/` and other regular protocol assets are included as-is.
- `.env` plus common cache artifacts such as `__pycache__/` and `.pyc` files are excluded by default.
- If `protocol.toml` exists, its metadata is copied into the manifest. Otherwise Airalogy falls back to the directory name and the first `# Heading` in `protocol.aimd` when available.

## Record bundle behavior

- Input JSON files may contain either one record object or a list of record objects.
- Record bundle manifests keep per-record metadata such as `record_id`, `record_version`, `protocol_id`, and `protocol_version` when available.
- If embedded protocol directories are provided, Airalogy tries to link each record to the matching embedded protocol in the manifest.

## Safety and limitations

- `airalogy unpack` performs safe extraction checks and rejects archive entries that try to escape the target directory.
- Because `.aira` is shared by multiple payload kinds, consumers should read `_airalogy_archive/manifest.json` and branch on `kind`.
- Version 1 bundles JSON records and optional protocol directories only.
- Version 1 does not automatically resolve remote Airalogy file IDs into raw file bytes.
