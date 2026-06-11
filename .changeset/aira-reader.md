---
"airalogy": minor
"@airalogy/aira-core": minor
"@airalogy/aimd-renderer": minor
---

Add SHA-256-backed `.aira` archive inspection and validation for the Python archive API and CLI.

Add the browser-readable `@airalogy/aira-core` parser/validator package and a static Airalogy Reader app for opening `.aira` files locally.

Render AIMD protocol content inside Airalogy Reader with `@airalogy/aimd-renderer`, including Record-backed field values when a `.aira` archive carries protocol records.

Add readonly Record rendering helpers to `@airalogy/aimd-renderer` so Vue hosts can render AIMD protocols with static Record data embedded in the matching fields, including host-resolved file and image assets.

Add a Tauri desktop wrapper for Airalogy Reader so the same local archive viewer can be packaged as installable macOS, Windows, and Linux apps.
