---
"@airalogy/aimd-core": minor
"@airalogy/aimd-editor": minor
"@airalogy/aimd-recorder": minor
"airalogy": patch
---

Add plain-language toolbar shortcuts for text, integer, decimal, single-choice, multiple-choice, and yes/no inputs, with date, time, text-list, attachment, and advanced inputs in a More menu. Preset dialogs generate persistent IDs without requiring syntax knowledge. Yes/no insertion uses a nullable boolean so unanswered values do not silently become false.

Resolve list item enums separately from scalar enums. Render `list[Literal[...]]` and lists of registered enums as checkbox groups, preserve typed array values and nullable resets, and validate item membership without changing the underlying AIMD syntax.

Allow Python AIMD scalar lists containing Literal values or registered scalar types without requiring table column definitions.
