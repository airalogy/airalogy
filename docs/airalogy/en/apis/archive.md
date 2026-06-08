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

Embed local file payloads referenced by Records:

```bash
airalogy pack ./record.json -o record_bundle.aira --file-payload ./files.json
```

`files.json` may contain one object, an array of objects, or an object with a top-level `files` array:

```json
{
  "files": [
    {
      "path": "./downloads/image.png",
      "file_id": "airalogy.id.file.xxx.png",
      "source_uri": "oss://bucket/path/image.png",
      "filename": "image.png",
      "mime_type": "image/png",
      "record_id": "01234567-0123-0123-0123-0123456789ab",
      "field_path": "data.var.sample_photo"
    }
  ]
}
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

## Example archives

The repository includes ready-to-open sample archives in `examples/aira/`:

- `single-protocol.aira`: one Protocol and no Record
- `protocols-bundle.aira`: multiple Protocols and no Record
- `records-with-protocol.aira`: one embedded Protocol and multiple Records
- `multi-protocol-records.aira`: multiple embedded Protocols and Records from multiple Protocols
- `records-with-file.aira`: one embedded Protocol, one Record, one file reference, and one offline blob

These files are useful for testing Airalogy Reader and for checking how different archive `kind` values appear in the manifest.

## Internal file structure

A `.aira` file is a ZIP archive. Every archive must contain `_airalogy_archive/manifest.json`; all other files are interpreted through that manifest.

Single Protocol archive:

```text
example.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
├─ protocol.toml              # optional but recommended
├─ model.py                   # optional
├─ assigner.py                # optional
└─ files/                     # optional protocol assets
   └─ ...
```

For `kind: "protocol"`, the Protocol files are stored at the archive root. The manifest uses `protocol.files` to list those members and `protocol.file_hashes` to store SHA-256 hashes keyed by the same relative file paths.

Multiple Protocol bundle:

```text
protocols.aira
├─ _airalogy_archive/
│  └─ manifest.json
└─ protocols/
   ├─ contact_note__0.1.0/
   │  ├─ protocol.aimd
   │  ├─ protocol.toml
   │  └─ ...
   └─ measurement_note__0.1.0/
      ├─ protocol.aimd
      ├─ protocol.toml
      └─ ...
```

For `kind: "protocols"`, `manifest.protocols[]` contains one entry per Protocol. Each entry has an `archive_root`, and its `files` and `file_hashes` are relative to that `archive_root`.

Record bundle, optionally with embedded Protocols:

```text
records.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ records/
│  ├─ 11111111-1111-4111-8111-111111111111.v1.json
│  └─ 22222222-2222-4222-8222-222222222222.v1.json
└─ protocols/                 # present only when protocols are embedded
   └─ contact_note__0.1.0/
      ├─ protocol.aimd
      ├─ protocol.toml
      └─ ...
```

For `kind: "records"`, `manifest.records[]` describes each Record payload. The `path` field points to the actual JSON file under `records/`. When the archive embeds related Protocols, `manifest.protocols[]` uses the same structure as a Protocol bundle, and each Record can point to a matching Protocol through `embedded_protocol_root`.

Record file payload layer:

Some Records contain file-like `var` fields. In a cloud deployment, those fields may point to an OSS object, S3 object, file service ID, or signed URL. When a `.aira` archive needs to be usable offline, the actual file bytes should live in a dedicated content-addressed blob layer, not in `records/` and not in a Protocol `files/` directory.

```text
records-with-files.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ records/
│  └─ record-001.v1.json
├─ protocols/
│  └─ sample_protocol__0.1.0/
│     └─ ...
└─ blobs/
   └─ sha256/
      └─ ab/
         └─ cd/
            └─ abcdef...1234
```

The blob path is content-addressed and can be sharded by hash prefix. Consumers should treat the manifest as authoritative and should not infer metadata from the path alone.

Recommended manifest shape for file payloads:

```json
{
  "blobs": [
    {
      "blob_id": "sha256:abcdef...1234",
      "archive_path": "blobs/sha256/ab/cd/abcdef...1234",
      "sha256": "abcdef...1234",
      "size": 123456
    }
  ],
  "files": [
    {
      "file_id": "airalogy.file.xxx",
      "source_uri": "oss://bucket/path/image.png",
      "blob_id": "sha256:abcdef...1234",
      "filename": "image.png",
      "mime_type": "image/png",
      "record_path": "records/record-001.v1.json",
      "field_path": "data.var.sample_photo"
    }
  ]
}
```

This separates physical bytes from semantic file references. A Record can keep its original cloud reference, while the archive can optionally carry the actual bytes for offline use. Multiple Records can point to the same blob without duplicating it.

Protocol `files/` and archive `blobs/` have different meanings:

- Protocol `files/`: assets required by the Protocol definition.
- Archive `blobs/`: payload bytes referenced by Record data or external source objects.

The archive format should support at least two export modes:

- `reference-only`: keep file IDs and source URIs, but do not bundle the bytes.
- `offline-bundle`: keep source references and also include verified blobs in `blobs/`.

Important manifest fields:

- `format`: currently `airalogy.archive`
- `version`: archive format version, currently `1`
- `kind`: `protocol`, `protocols`, or `records`
- `created_at`: archive creation timestamp
- `protocol`: single Protocol metadata for `kind: "protocol"`
- `protocols`: embedded or bundled Protocol metadata for `kind: "protocols"` and `kind: "records"`
- `records`: Record payload metadata for `kind: "records"`
- `blobs`: optional physical file payloads stored inside the archive
- `files`: optional semantic file references that connect Record fields, source URIs, and blobs

## Python API

```python
from airalogy.archive import (
    inspect_archive,
    load_file_payload_specs,
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
pack_records_archive(
    ["record.json"],
    "records_with_files.aira",
    file_payloads=load_file_payload_specs("files.json"),
)
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
- If file payload specs are provided, Airalogy stores local file bytes under `blobs/sha256/`, de-duplicates identical payloads by SHA-256, and writes semantic file references into `manifest.files[]`.
- File payload specs without a local `path`, `local_path`, or `file_path` are stored as reference-only entries in `manifest.files[]`.

## Safety and limitations

- `airalogy unpack` performs safe extraction checks and rejects archive entries that try to escape the target directory.
- `airalogy validate` and Airalogy Reader check the manifest, member paths, record JSON payloads, protocol file references, and SHA-256 hashes when present.
- Because `.aira` is shared by multiple payload kinds, consumers should read `_airalogy_archive/manifest.json` and branch on `kind`.
- Version 1 bundles Protocol directories, JSON records, optional embedded Protocol directories, and optional local file payloads under `blobs/`.
- Version 1 does not automatically download remote Airalogy file IDs or OSS objects. Exporters should download those bytes first, then pass local paths through `--file-payload` or `file_payloads`.
