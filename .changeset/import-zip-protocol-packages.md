---
"@airalogy/aira-core": minor
---

Expose `openZipArchive()` for browser-compatible reading of ordinary ZIP containers without requiring an Airalogy manifest.

This lets editor hosts import folder bundles such as `protocol.aimd` plus `files/` assets, then repack them as standard `.aira` archives with `createProtocolAiraArchive()`.
