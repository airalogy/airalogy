# Document Conversion (MarkItDown backend)

Airalogy provides a unified API for converting documents into Markdown via pluggable backends.

Currently supported backends:

- `markitdown` (optional dependency)

## Install

Enable the `markitdown` backend by installing the extra:

```bash
# pip
pip install "airalogy[markitdown]"

# uv (install into the current environment)
uv pip install "airalogy[markitdown]"

# uv (add to your project dependencies)
uv add "airalogy[markitdown]"
```

Note: MarkItDown uses its own extras per filetype (e.g. `pdf`, `docx`). `airalogy[markitdown]` installs the dependencies needed for PDF/DOCX conversion.

## API

Import:

```python
from airalogy.convert import to_markdown
```

Convert a local file:

```python
result = to_markdown("report.pdf", backend="markitdown")
print(result.text)
```

Convert bytes (recommended to provide `filename` so the backend can infer file type):

```python
result = to_markdown(file_bytes, filename="report.pdf", backend="markitdown")
print(result.text)
```

Convert an Airalogy-hosted file ID (downloads via `Airalogy` client first):

```python
from airalogy import Airalogy

client = Airalogy()
result = to_markdown(
    "airalogy.id.file.<UUID>.pdf",
    backend="markitdown",
    client=client,
)
print(result.text)
```

## Return value

`to_markdown(...)` returns a `MarkdownResult`:

- `text`: the converted Markdown content
- `backend`: the backend name used (e.g. `"markitdown"`)
- `source_filename`: the best-effort filename (if available)
- `warnings`: any non-fatal warnings (may be empty)
