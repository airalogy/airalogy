# Airalogy Documentation (EN)

This folder contains the English documentation for the `airalogy` package, which provides a universal framework for standardized data digitization.

## Requirements

Python `>=3.13`.

## Installation

```bash
pip install airalogy
```

## APIs

- AIMD utilities: `docs/en/apis/markdown.md`
- Types: `docs/en/apis/types.md`
- Models: `docs/en/apis/models.md`
- Download/Upload: `docs/en/apis/download-upload.md`
- Document conversion: `docs/en/apis/convert.md`

## Syntax

See `docs/en/syntax/README.md`.

## Data Structure

See `docs/en/data-structure/README.md`.

## Development

We use `uv` for environment management/build and `ruff` for lint/format.

```bash
uv sync
uv run pytest
```
