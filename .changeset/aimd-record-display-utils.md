---
"@airalogy/aimd-core": minor
"@airalogy/aimd-renderer": patch
"@airalogy/aimd-recorder": minor
---

Add shared AIMD Record display utilities for field value normalization, FileId detection, file input metadata, asset kind inference, and readonly display coercion.

Reuse the shared utilities from AIMD readonly rendering and Recorder var helpers so Record-backed document views and interactive field controls resolve file, code, markdown, DNA, boolean, and scalar values through the same semantics.

Organize readonly Record var rendering behind an internal value-renderer registry so future field displays can be added without expanding a single conditional chain.

Add a lightweight `@airalogy/aimd-recorder/record` entry for Record state, timer, DNA value, and display utility helpers without importing the full Recorder component surface.
