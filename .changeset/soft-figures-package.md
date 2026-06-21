---
"@airalogy/aira-core": minor
"@airalogy/aimd-editor": patch
"@airalogy/aimd-renderer": patch
---

Add a browser-compatible protocol `.aira` archive writer for AIMD files with protocol-local assets such as `files/workflow-diagram.svg`.

Allow AIMD editor hosts to override the image toolbar action and receive the image button position so applications can offer URL figures, local uploads, or archive-aware image insertion flows from an anchored popover.

Include AIMD field, reference, quiz, and refs block styles in the renderer stylesheet so static previews that import `@airalogy/aimd-renderer/styles` render AIMD tokens correctly without depending on recorder styles.
