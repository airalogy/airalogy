from __future__ import annotations

import json
import tomllib
from dataclasses import dataclass
from importlib import resources
from importlib.resources.abc import Traversable
from pathlib import Path, PurePosixPath
from typing import Any


_DATA_DIR = "data"


@dataclass(frozen=True)
class ProtocolExample:
    """A packaged Airalogy Protocol example for one locale."""

    id: str
    example_id: str
    locale: str
    directory: str
    aimd_path: str
    toml_path: str
    assigner_path: str | None
    sample_data_paths: tuple[str, ...]
    registry_entry: dict[str, Any]

    @property
    def directory_resource(self) -> Traversable:
        return _resource(self.directory)

    @property
    def aimd_resource(self) -> Traversable:
        return _resource(self.aimd_path)

    @property
    def toml_resource(self) -> Traversable:
        return _resource(self.toml_path)

    @property
    def assigner_resource(self) -> Traversable | None:
        if self.assigner_path is None:
            return None
        return _resource(self.assigner_path)

    def read_aimd(self) -> str:
        return self.aimd_resource.read_text(encoding="utf-8")

    def read_toml(self) -> str:
        return self.toml_resource.read_text(encoding="utf-8")

    def load_metadata(self) -> dict[str, Any]:
        return _load_metadata(self.toml_path)


def protocols_root() -> Traversable:
    """Return the packaged or repository protocol examples root."""

    packaged_root = resources.files(__package__).joinpath(_DATA_DIR)
    if packaged_root.joinpath("index.json").is_file():
        return packaged_root

    repository_root = find_repository_protocols_root()
    if repository_root is not None:
        return repository_root

    return packaged_root


def load_index() -> dict[str, Any]:
    """Load the packaged protocol example registry."""

    return json.loads(protocols_root().joinpath("index.json").read_text(encoding="utf-8"))


def iter_protocol_examples(locale: str | None = None) -> list[ProtocolExample]:
    """List packaged protocol examples, optionally filtered by locale."""

    examples: list[ProtocolExample] = []
    for entry in load_index()["examples"]:
        for entry_locale, aimd_path in entry.get("entry", {}).items():
            if locale is not None and entry_locale != locale:
                continue

            directory = entry.get("protocol_dir", {}).get(entry_locale)
            if directory is None:
                directory = str(PurePosixPath(aimd_path).parent)
            sample_data_paths = [
                *entry.get("sample_data", {}).get(entry_locale, []),
                *entry.get("assets", {}).get(entry_locale, []),
            ]
            metadata = _load_metadata(entry["toml"][entry_locale])

            examples.append(
                ProtocolExample(
                    id=metadata["id"],
                    example_id=entry["id"],
                    locale=entry_locale,
                    directory=directory,
                    aimd_path=aimd_path,
                    toml_path=entry["toml"][entry_locale],
                    assigner_path=entry.get("assigner", {}).get(entry_locale),
                    sample_data_paths=tuple(sample_data_paths),
                    registry_entry=entry,
                )
            )

    return examples


def get_protocol_example(protocol_id: str) -> ProtocolExample:
    """Return one packaged protocol example by its Airalogy Protocol id."""

    for example in iter_protocol_examples():
        if example.id == protocol_id:
            return example

    raise KeyError(f"Unknown Airalogy protocol example: {protocol_id}")


def _resource(relative_path: str) -> Traversable:
    resource = protocols_root()
    for part in relative_path.split("/"):
        resource = resource.joinpath(part)
    return resource


def _load_metadata(toml_path: str) -> dict[str, Any]:
    metadata = tomllib.loads(_resource(toml_path).read_text(encoding="utf-8")).get(
        "airalogy_protocol"
    )
    if not isinstance(metadata, dict):
        raise ValueError(f"Missing [airalogy_protocol] metadata in {toml_path}")
    return metadata


def find_repository_protocols_root() -> Path | None:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "examples" / "protocols"
        if (candidate / "index.json").is_file():
            return candidate

    return None


__all__ = [
    "ProtocolExample",
    "get_protocol_example",
    "iter_protocol_examples",
    "load_index",
    "protocols_root",
]
