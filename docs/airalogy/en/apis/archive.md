# `.aira` Archive Packaging and Reader

Airalogy supports zip-based single-file archives for sharing protocols and records over chat, email, cloud drives, or other file-transfer tools.

Version 1 uses one unified suffix:

- `.aira`: the standard Airalogy archive container

The concrete payload type is stored in the internal manifest via the `kind` field:

- `kind: "protocol"`: a single Airalogy Protocol archive
- `kind: "protocols"`: a bundle of multiple Airalogy Protocol directories without records
- `kind: "records"`: a bundle of one or more Airalogy Record JSON payloads, optionally with embedded protocol directories

All archive kinds keep a machine-readable manifest at `_airalogy_archive/manifest.json`.

## Why this exists

An Airalogy Protocol is usually authored as a directory containing `protocol.aimd` plus optional sibling files such as `model.py`, `assigner.py`, `protocol.toml`, and `files/`. That layout is convenient for development, but awkward to send as a single file.

Airalogy archives keep the existing on-disk structure intact while wrapping it in a dedicated shareable container. This makes `.aira` the portable file surface for Airalogy Protocols and Airalogy Records: every computer can open, inspect, validate, and eventually route these files into Airalogy-compatible tools.

## CLI usage

Pack one protocol directory:

```bash
airalogy pack ./my_protocol -o my_protocol.aira
```

Pack multiple protocol directories without records:

```bash
airalogy pack ./protocol_a ./protocol_b -o protocols.aira
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

Inspect or validate an archive without extracting it:

```bash
airalogy inspect ./record_bundle.aira
airalogy inspect ./record_bundle.aira --json
airalogy validate ./record_bundle.aira
airalogy validate ./record_bundle.aira --json
```

## Airalogy Reader

The repository includes a browser-based Reader app at `apps/aira-reader`. It opens `.aira` files locally, displays the manifest, protocols, records, archive members, and validation issues, and does not upload file content to a server.

```bash
pnpm dev:aira-reader
pnpm build:aira-reader
```

The docs workflow publishes the Reader as a static app at `https://airalogy.github.io/airalogy/aira-reader/`.

## Python API

```python
from airalogy.archive import (
    inspect_archive,
    pack_protocol_archive,
    pack_protocols_archive,
    pack_records_archive,
    read_archive_manifest,
    validate_archive,
    unpack_archive,
)

pack_protocol_archive("my_protocol", "my_protocol.aira")
pack_protocols_archive(["protocol_a", "protocol_b"], "protocols.aira")
pack_records_archive(["record.json"], "records.aira", protocol_dirs=["my_protocol"])
manifest = read_archive_manifest("records.aira")
summary = inspect_archive("records.aira")
ok, issues = validate_archive("records.aira")
output_dir, manifest = unpack_archive("records.aira", "records_out")
```

## Protocol archive behavior

- The protocol is validated before packaging; if a sibling `model.py` exists, Airalogy also checks that `model.py::VarModel` only defines AIMD variable fields and that same-name fields do not have explicit type conflicts.
- The archive preserves the original protocol directory layout.
- `files/` and other regular protocol assets are included as-is.
- New archives include SHA-256 hashes for protocol files in the manifest so readers can detect file tampering.
- `.env` plus common cache artifacts such as `__pycache__/` and `.pyc` files are excluded by default.
- If `protocol.toml` exists, its metadata is copied into the manifest. Otherwise Airalogy falls back to the directory name and the first `# Heading` in `protocol.aimd` when available.

## Protocol bundle behavior

- A `kind: "protocols"` archive contains multiple Protocol directories and no Record payloads.
- Each Protocol is stored under its own `archive_root`, for example `protocols/my_protocol__0.1.0/`.
- This is useful for sharing a protocol pack, organization template pack, or a set of data standards before any records are collected.

## Record bundle behavior

- Input JSON files may contain either one record object or a list of record objects.
- Record bundle manifests keep per-record metadata such as `record_id`, `record_version`, `protocol_id`, and `protocol_version` when available.
- New archives include SHA-256 hashes for each packed record JSON payload.
- If embedded protocol directories are provided, Airalogy validates each protocol first, then tries to link each record to the matching embedded protocol in the manifest.

## Safety and limitations

- `airalogy unpack` performs safe extraction checks and rejects archive entries that try to escape the target directory.
- `airalogy validate` and Airalogy Reader check the manifest, member paths, record JSON payloads, protocol file references, and SHA-256 hashes when present.
- Because `.aira` is shared by multiple payload kinds, consumers should read `_airalogy_archive/manifest.json` and branch on `kind`.
- Version 1 bundles Protocol directories, JSON records, and optional embedded Protocol directories only.
- Version 1 does not automatically resolve remote Airalogy file IDs into raw file bytes.
