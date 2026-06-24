---
"@airalogy/aimd-core": minor
"@airalogy/aimd-renderer": minor
"@airalogy/aimd-editor": minor
"airalogy": minor
---

Add AIMD `media` blocks and `ref_media` references for video, audio, ordinary files, and default media pin controls.

Renderer hosts can resolve protocol-local media assets with `resolveAssetUrl()` using `context.kind` values of `media` and `media_poster`. Vue rendering now provides a compact default pin/unpin interaction for video and audio media, including single-item pinning, collapsed descriptions, and small, medium, and large pinned-size controls, while static HTML rendering exposes matching data attributes for host-controlled behavior.
