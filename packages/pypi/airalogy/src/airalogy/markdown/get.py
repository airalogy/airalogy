"""
Utilities for working with Airalogy Markdown (AIMD).
"""

from __future__ import annotations

import re


_AIRALOGY_FILE_ID_REGEX = r"(airalogy\.id\.file\.[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+)"

_MARKDOWN_IMAGE_PATTERNS = [
    re.compile(r"!\[[^\]]*\]\(\s*" + _AIRALOGY_FILE_ID_REGEX + r"\s*\)"),
    re.compile(r"src\s*:\s*" + _AIRALOGY_FILE_ID_REGEX, re.IGNORECASE),
]

__all__ = ["get_airalogy_image_ids"]


def get_airalogy_image_ids(content: str) -> list[str]:
    """
    Extract Airalogy file IDs referenced as images in AIMD content.

    Supports standard Markdown image syntax (e.g., ![alt](airalogy.id.file...)),
    a common inverted variant (!(alt)[...]), and `fig` blocks with
    `src: airalogy.id.file...`.

    Args:
        content: AIMD markdown string.

    Returns:
        Unique Airalogy file IDs in the order they first appear.
    """
    ids: list[str] = []
    seen: set[str] = set()

    for pattern in _MARKDOWN_IMAGE_PATTERNS:
        for match in pattern.finditer(content):
            file_id = match.group(1)
            if file_id not in seen:
                seen.add(file_id)
                ids.append(file_id)

    return ids
