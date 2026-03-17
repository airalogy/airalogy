# Keep in sync with `pyproject.toml` and record changes in `CHANGELOG.md`.
__version__ = "0.3.0"

from airalogy.airalogy import Airalogy

from . import convert, markdown

__all__ = [
    "Airalogy",
    "convert",
    "markdown",
]
