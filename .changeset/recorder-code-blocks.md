---
"@airalogy/aimd-renderer": patch
"@airalogy/aimd-recorder": patch
---

Render markdown code blocks with reusable Shiki-backed Vue code block rendering, including line numbers and soft wrapping that keeps wrapped lines aligned with the code column.

Allow the recorder workbench source and recording panels to be resized, and let users collapse the source panel when they need more room for the recorder.

Make block recorder fields such as AiralogyMarkdown, step, and check cards fill the available recorder panel width.

Make CodeStr, PyStr, and AiralogyMarkdown recorder editors start at a compact one-line height and grow with their content.
