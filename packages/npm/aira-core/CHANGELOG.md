# @airalogy/aira-core

## 0.3.0

### Minor Changes

- c8b8066: Add a browser-compatible protocol `.aira` archive writer for AIMD files with protocol-local assets such as `files/workflow-diagram.svg`.

  Allow AIMD editor hosts to override the image toolbar action and receive the image button position so applications can offer URL figures, local uploads, or archive-aware image insertion flows from an anchored popover.

  Include AIMD field, reference, quiz, refs block, and full-width variable-table preview styles in the renderer stylesheet so static previews that import `@airalogy/aimd-renderer/styles` render AIMD tokens correctly without depending on recorder styles.

## 0.2.0

### Minor Changes

- 0355d77: Add SHA-256-backed `.aira` archive inspection and validation for the Python archive API and CLI.

  Add the browser-readable `@airalogy/aira-core` parser/validator package and a static Airalogy Reader app for opening `.aira` files locally.

  Render AIMD protocol content inside Airalogy Reader with `@airalogy/aimd-renderer`, including Record-backed field values when a `.aira` archive carries protocol records.

  Add readonly Record rendering helpers to `@airalogy/aimd-renderer` so Vue hosts can render AIMD protocols with static Record data embedded in the matching fields, including host-resolved file and image assets.

  Polish readonly Record rendering so user-facing content defaults to readable labels while keeping field identifiers in metadata for advanced views such as Airalogy Reader's optional Show field IDs toggle.

  Add a Tauri desktop wrapper for Airalogy Reader so the same local archive viewer can be packaged as installable macOS, Windows, and Linux apps.

### Patch Changes

- 0ebd143: Support `.aira` record archives with optional file references and offline blob payloads under `blobs/sha256/`.
- 00ad822: Support `.aira` protocol bundle archives containing multiple Protocol directories without Record payloads.
