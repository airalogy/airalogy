from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("airalogy")
except PackageNotFoundError:
    # Keep imports working in an unchecked-out source tree before installation.
    __version__ = "0.0.0"

from airalogy.airalogy import Airalogy

from . import (
    archive,
    connectors,
    convert,
    ingest,
    markdown,
    migrations,
    protocol_contract,
    schema_compatibility,
)

__all__ = [
    "Airalogy",
    "archive",
    "connectors",
    "convert",
    "ingest",
    "markdown",
    "migrations",
    "protocol_contract",
    "schema_compatibility",
]
