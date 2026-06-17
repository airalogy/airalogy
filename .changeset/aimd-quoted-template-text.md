---
"@airalogy/aimd-core": patch
---

Treat AIMD-looking delimiters inside quoted template parameters as plain string text so fields such as `checked_message` can contain literal `{{...}}` snippets without truncating the outer template.
