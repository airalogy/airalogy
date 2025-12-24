"""
Document conversion utilities.

This package provides a stable, unified API for converting various inputs
(files/bytes/Airalogy file IDs) into Markdown using pluggable backends.
"""

from .markdown import MarkdownResult, available_backends, to_markdown

__all__ = [
    "MarkdownResult",
    "available_backends",
    "to_markdown",
]
