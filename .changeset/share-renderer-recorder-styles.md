---
"@airalogy/aimd-recorder": patch
"@airalogy/aimd-renderer": patch
---

Rename the internal renderer stylesheet to `renderer.css` and the recorder stylesheet to `recorder.css` while keeping the public `@airalogy/aimd-renderer/styles` and `@airalogy/aimd-recorder/styles` imports stable.

Make the recorder stylesheet import the renderer stylesheet and layer recorder-specific editing styles on top. Browser render helpers now load the renderer stylesheet as the canonical renderer CSS entry instead of treating it as math-only KaTeX styles.
