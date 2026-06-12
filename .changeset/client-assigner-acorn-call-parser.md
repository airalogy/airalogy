---
"@airalogy/aimd-core": patch
---

Parse `assigner runtime=client` registration calls with Acorn so JavaScript regex literals containing delimiters, such as `)` inside a character class, no longer break client assigner extraction.
