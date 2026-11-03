---
"@airalogy/aimd-editor": patch
---

Preserve fenced-code metadata during visual editing and DOM round trips, including `runtime=client` on browser assigners. Loading or switching editor modes must not silently disable client calculations by rewriting their fence to a plain `assigner` block.
