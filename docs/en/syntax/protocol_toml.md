# `protocol.toml` — Metadata for an Airalogy Protocol

`protocol.toml` holds the **metadata** of an Airalogy Protocol, using the easy-to-read [TOML](https://toml.io/) format (much like Python’s [`pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)).
In most cases you can let Airalogy generate this file automatically when you upload a protocol, but you may create or edit it yourself to fine-tune the details.

## 1 File Location

Place `protocol.toml` in the root of the protocol package:

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
└── protocol.toml
```

## 2 · Schema

```toml
[airalogy_protocol]
id          = "alice_s_protocol"          # Unique within its Project
version     = "0.0.1"                     # Semantic version: x.y.z
name        = "Alice's Protocol"          # Human-friendly title
description = "An example protocol for demonstration purposes."

authors = [
  { name = "Alice", email = "alice@airalogy.com", airalogy_user_id = "airalogy.id.user.alice" }
]

maintainers = [
  { name = "Alice", email = "alice@airalogy.com", airalogy_user_id = "airalogy.id.user.alice" }
]

disciplines = ["drug discovery", "biology"]  # First item = primary discipline
keywords    = ["cck-8", "cell viability", "drug screening", "proliferation assay"]

license = "Apache-2.0"  # Optional license identifier
```

### Field Notes

| Key | Required | Description |
| - | - | - |
| `id` | ✓ | ID for the protocol. When uploaded to an Airalogy Protocol Repository, this ID becomes the repository ID. It must be unique within its parent Project. |
| `version` | ✓ | Must follow `x.y.z`. If omitted, Airalogy starts at `0.0.1`. |
| `name` | ✓ | Display name. If omitted, Airalogy derives it from the first-level heading in `protocol.aimd`. |
| `description` | – | Short summary of the protocol. |
| `authors` | – | List of author objects (`name`, optional `email`, optional `airalogy_user_id`). |
| `maintainers` | – | List in the same format as `authors`. |
| `disciplines` | - | List of disciplines. The first item is the primary discipline. |
| `keywords` | – | Free-text tags that aid search and discovery. |
| `license` | – | SPDX-style licence identifier (e.g. `MIT`, `GPL-3.0-or-later`, `CC-BY-4.0`). Empty string = no licence declared. |

> **Why no `lab_id` / `project_id`?**
> Those identifiers belong to higher-level Airalogy objects (Lab and Project) and are therefore not stored inside the protocol’s own metadata file.

## Reference

`protocol.toml` is inspired by the structure and goals of Python’s [`pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/).
