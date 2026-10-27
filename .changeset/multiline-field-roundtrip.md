---
"@airalogy/aimd-editor": patch
"@airalogy/aimd-recorder": patch
---

Preserve multiline AIMD field definitions during visual-editor serialization instead of escaping indentation into character references. Recover legacy escaped indentation in visual drafts so nested var_table columns retain their IDs, titles and input types, while preserving quoted string escapes and literal text.
