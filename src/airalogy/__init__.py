from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("airalogy")
except PackageNotFoundError:
    # Keep imports working in an unchecked-out source tree before installation.
    __version__ = "0.0.0"

from airalogy.airalogy import Airalogy

from . import archive, convert, markdown

__all__ = [
    "Airalogy",
    "archive",
    "convert",
    "markdown",
]
