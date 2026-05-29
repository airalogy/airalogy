---
"airalogy": minor
"@airalogy/aimd-core": minor
"@airalogy/aimd-recorder": minor
---

Add the generic `CodeStr` code-string type to `airalogy.types` so AIMD fields such as `{{var|script: CodeStr}}` generate valid Python models while recorder UIs can present them as plain code editors.

Allow AIMD var-table defaults to contain multiline object-list values, expose those defaults through extracted field metadata, and initialize recorder var-table rows from those defaults without overwriting user-entered rows.

Run auto server assigners when their dependencies become available, and mount server assigner controls inside built-in `AiralogyMarkdown` fields that support inline assigner actions.

Add a rendered preview mode to the built-in recorder `AiralogyMarkdown` field, including Mermaid code block rendering for generated Markdown outputs.
