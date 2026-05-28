# Protocol Fixtures

This directory contains Airalogy Protocol fixtures migrated from the former standalone `airalogy/protocols` repository.

These fixtures are regression and compatibility inputs for parser, assigner, file conversion, image extraction, and engine workflows. They are intentionally separate from user-facing examples in `examples/protocols`.

## Fixtures

| ID | Focus |
| --- | --- |
| `markdown-conversion` | DOCX/PDF upload variables and Markdown conversion assigner wiring. |
| `docx-roundtrip` | Minimal DOCX upload, text extraction, and processed DOCX/PDF export. |
| `typed-var-table` | Typed variable table syntax. |
| `aimd-image` | Airalogy Markdown image extraction and visual-understanding assigner wiring. |
| `aimd-multi-hop-image` | Multi-hop Airalogy Markdown image references. |
| `multi-level-assigner` | Multi-level assigner chains with auto/manual/auto-first behavior. |
