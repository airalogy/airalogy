---
"@airalogy/aimd-core": patch
"@airalogy/aimd-editor": minor
"@airalogy/aimd-recorder": minor
"airalogy": patch
---

Separate the required setting from the default value in the visual editor. The recorder keeps nullable controls editable and distinguishes an unanswered yes/no question from `false`. Generated Python models preserve explicit `None` defaults.

For example, `tags: list[str] | None = None` leaves an unanswered list as `null` instead of initializing it to `[]`. An explicitly supplied `[]` still means zero items. Existing records are not rewritten.
