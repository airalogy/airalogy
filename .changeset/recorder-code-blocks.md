---
"@airalogy/aimd-renderer": patch
"@airalogy/aimd-recorder": patch
---

Render markdown code blocks with reusable Shiki-backed Vue code block rendering, including line numbers and soft wrapping that keeps wrapped lines aligned with the code column.

Allow the recorder workbench source and recording panels to be resized, and let users collapse the source panel when they need more room for the recorder.

Make block recorder fields such as AiralogyMarkdown, step, and check cards fill the available recorder panel width.

Make CodeStr, PyStr, and AiralogyMarkdown recorder editors start at a compact one-line height and grow with their content.

Show manual Assigner controls on every field declared in a shared server assigner's assigned_fields list.

Place var table Assigner controls in the table header so assigned table fields keep their full-width card layout.

Place CodeStr and PyStr Assigner controls in the field header instead of an external side button.
