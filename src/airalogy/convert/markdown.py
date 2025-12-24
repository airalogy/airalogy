from __future__ import annotations

import importlib
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Literal, overload

from ..airalogy import Airalogy


BackendName = Literal["markitdown"]


@dataclass(frozen=True, slots=True)
class MarkdownResult:
    text: str
    backend: str
    source_filename: str | None = None
    mime_type: str | None = None
    title: str | None = None
    warnings: list[str] = field(default_factory=list)


def available_backends() -> list[str]:
    return ["markitdown"]


def _looks_like_airalogy_file_id(value: str) -> bool:
    return value.startswith("airalogy.id.file.")


def _read_bytes_from_source(
    source: str | Path | bytes | BinaryIO,
    *,
    client: Airalogy | None,
    filename: str | None,
) -> tuple[bytes, str | None]:
    if isinstance(source, Path):
        return source.read_bytes(), source.name

    if isinstance(source, bytes):
        return source, filename or None

    if isinstance(source, str) and _looks_like_airalogy_file_id(source):
        if client is None:
            raise ValueError(
                "source looks like an Airalogy file id; pass `client=Airalogy()` "
                "or provide bytes/path instead."
            )
        return client.download_file_bytes(source), filename or source

    if isinstance(source, str):
        path = Path(source)
        if not path.exists():
            raise ValueError(
                "When `source` is a string it must be an existing file path or an "
                "Airalogy file id (airalogy.id.file.*)."
            )
        return path.read_bytes(), path.name

    data = source.read()
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("BinaryIO source must return bytes from .read()")

    inferred_name: str | None = None
    if filename:
        inferred_name = filename
    else:
        possible_name = getattr(source, "name", None)
        if isinstance(possible_name, str) and possible_name:
            inferred_name = Path(possible_name).name

    return bytes(data), inferred_name


def _extract_markdown_text(result: object) -> str:
    if isinstance(result, str):
        return result

    for attr in ("text_content", "markdown", "text", "content"):
        value = getattr(result, attr, None)
        if isinstance(value, str):
            return value

    return str(result)


def _convert_with_markitdown(
    *,
    data: bytes,
    source_filename: str | None,
    **options: object,
) -> MarkdownResult:
    try:
        module = importlib.import_module("markitdown")
    except ImportError as exc:
        raise ImportError(
            "Optional dependency `markitdown` is not installed. "
            'Install via `pip install "airalogy[markitdown]"` or '
            '`uv add "airalogy[markitdown]"` / `uv pip install "airalogy[markitdown]"`.'
        ) from exc

    markitdown_cls = getattr(module, "MarkItDown", None)
    if markitdown_cls is None:
        raise ImportError("`markitdown` is installed but `MarkItDown` was not found.")

    converter = markitdown_cls()

    suffix = ""
    if source_filename:
        suffix = Path(source_filename).suffix

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(data)
            tmp_path = tmp_file.name

        try:
            try:
                output = converter.convert(tmp_path, **options)
            except TypeError:
                output = converter.convert(tmp_path)
        except Exception as exc:
            exc_message = str(exc)
            if (
                "MissingDependencyException" in exc_message
                or "dependencies needed" in exc_message
            ):
                raise RuntimeError(
                    "markitdown is installed but is missing filetype dependencies "
                    "(e.g. `markitdown[pdf]`, `markitdown[docx]`). "
                    'Install via `pip install "airalogy[markitdown]"` (recommended) '
                    "or install MarkItDown extras directly."
                ) from exc
            raise

        text = _extract_markdown_text(output)
        return MarkdownResult(
            text=text,
            backend="markitdown",
            source_filename=source_filename,
        )
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@overload
def to_markdown(
    source: Path | str,
    *,
    backend: BackendName = "markitdown",
    client: Airalogy | None = None,
    filename: str | None = None,
    **options: object,
) -> MarkdownResult: ...


@overload
def to_markdown(
    source: bytes | BinaryIO,
    *,
    backend: BackendName = "markitdown",
    client: Airalogy | None = None,
    filename: str | None = None,
    **options: object,
) -> MarkdownResult: ...


def to_markdown(
    source: str | Path | bytes | BinaryIO,
    *,
    backend: str = "markitdown",
    client: Airalogy | None = None,
    filename: str | None = None,
    **options: object,
) -> MarkdownResult:
    """
    Convert a document into Markdown using a pluggable backend.

    `source` supports:
      - `Path`: read bytes from local file
      - `str`: local file path, or Airalogy file id (airalogy.id.file.*)
      - `bytes`: raw file bytes (recommend also passing `filename=...`)
      - `BinaryIO`: a binary file-like object
    """
    if backend not in available_backends():
        raise ValueError(
            f"Unknown backend: {backend}. Available: {available_backends()}"
        )

    data, source_filename = _read_bytes_from_source(
        source, client=client, filename=filename
    )

    if backend == "markitdown":
        return _convert_with_markitdown(
            data=data, source_filename=source_filename, **options
        )

    raise AssertionError("Unreachable: backend checked above")
