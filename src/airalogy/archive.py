from __future__ import annotations

import json
import re
import tomllib
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

ARCHIVE_FORMAT = "airalogy.archive"
ARCHIVE_VERSION = 1
ARCHIVE_METADATA_DIR = "_airalogy_archive"
ARCHIVE_MANIFEST_PATH = f"{ARCHIVE_METADATA_DIR}/manifest.json"
ARCHIVE_SUFFIX = ".aira"

_EXCLUDED_FILE_NAMES = {
    ".DS_Store",
    ".env",
}
_EXCLUDED_DIR_NAMES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    "__pycache__",
}
_EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
}


class ArchiveError(ValueError):
    """Raised when an archive cannot be created or extracted safely."""


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str | None, fallback: str) -> str:
    if value is None:
        return fallback
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    return normalized or fallback


def _ensure_protocol_dir(protocol_dir: str | Path) -> Path:
    path = Path(protocol_dir)
    if not path.exists():
        raise ArchiveError(f"Protocol directory '{path}' not found.")
    if not path.is_dir():
        raise ArchiveError(f"Protocol path '{path}' must be a directory.")
    if not (path / "protocol.aimd").is_file():
        raise ArchiveError(
            f"Protocol directory '{path}' must contain 'protocol.aimd'."
        )
    return path


def _infer_protocol_name_from_aimd(protocol_dir: Path) -> str | None:
    protocol_file = protocol_dir / "protocol.aimd"
    try:
        content = protocol_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise ArchiveError(f"Failed to read '{protocol_file}': {exc}") from exc

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            name = stripped[2:].strip()
            return name or None
    return None


def _load_protocol_metadata(protocol_dir: Path) -> dict[str, Any]:
    protocol_toml = protocol_dir / "protocol.toml"
    metadata = {
        "protocol_id": protocol_dir.name,
        "protocol_version": None,
        "protocol_name": _infer_protocol_name_from_aimd(protocol_dir) or protocol_dir.name,
        "entrypoint": "protocol.aimd",
    }
    if not protocol_toml.is_file():
        return metadata

    try:
        with protocol_toml.open("rb") as handle:
            parsed = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise ArchiveError(f"Failed to read '{protocol_toml}': {exc}") from exc

    protocol_data = parsed.get("airalogy_protocol")
    if isinstance(protocol_data, dict):
        protocol_id = protocol_data.get("id")
        protocol_version = protocol_data.get("version")
        protocol_name = protocol_data.get("name")
        if isinstance(protocol_id, str) and protocol_id.strip():
            metadata["protocol_id"] = protocol_id.strip()
        if isinstance(protocol_version, str) and protocol_version.strip():
            metadata["protocol_version"] = protocol_version.strip()
        if isinstance(protocol_name, str) and protocol_name.strip():
            metadata["protocol_name"] = protocol_name.strip()
    return metadata


def _should_skip_protocol_path(path: Path, protocol_dir: Path, output_path: Path | None) -> bool:
    relative_parts = path.relative_to(protocol_dir).parts
    if any(part in _EXCLUDED_DIR_NAMES for part in relative_parts[:-1]):
        return True
    if path.name in _EXCLUDED_FILE_NAMES:
        return True
    if path.suffix in _EXCLUDED_SUFFIXES:
        return True
    if output_path is not None and path.resolve() == output_path.resolve():
        return True
    return False


def _collect_protocol_files(protocol_dir: Path, output_path: Path | None = None) -> list[Path]:
    files: list[Path] = []
    for path in sorted(protocol_dir.rglob("*")):
        if not path.is_file():
            continue
        if _should_skip_protocol_path(path, protocol_dir, output_path):
            continue
        files.append(path)
    return files


def _read_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArchiveError(f"Failed to read JSON from '{path}': {exc}") from exc


def _load_records_from_path(path: Path) -> list[dict[str, Any]]:
    parsed = _read_json_file(path)
    if isinstance(parsed, dict):
        return [parsed]
    if isinstance(parsed, list):
        records = [item for item in parsed if isinstance(item, dict)]
        if len(records) != len(parsed):
            raise ArchiveError(
                f"Record file '{path}' must contain only JSON objects when using a list."
            )
        if not records:
            raise ArchiveError(f"Record file '{path}' contains an empty list.")
        return records
    raise ArchiveError(
        f"Record file '{path}' must contain a JSON object or a list of JSON objects."
    )


def _normalize_record_descriptor(
    record: dict[str, Any],
    source_path: Path,
    source_index: int,
) -> dict[str, Any]:
    metadata = record.get("metadata")
    if metadata is None:
        metadata = {}
    if not isinstance(metadata, dict):
        raise ArchiveError(
            f"Record from '{source_path}' has a non-object 'metadata' field."
        )

    record_id = record.get("record_id") or record.get("id")
    if record_id is not None and not isinstance(record_id, str):
        record_id = str(record_id)

    record_version = record.get("record_version")
    if record_version is None:
        record_version = metadata.get("record_ver")

    protocol_id = metadata.get("protocol_id")
    if protocol_id is not None and not isinstance(protocol_id, str):
        protocol_id = str(protocol_id)

    protocol_version = metadata.get("protocol_version")
    if protocol_version is None:
        protocol_version = metadata.get("rn_ver")
    if protocol_version is not None and not isinstance(protocol_version, str):
        protocol_version = str(protocol_version)

    return {
        "record": record,
        "record_id": record_id,
        "record_version": record_version,
        "protocol_id": protocol_id,
        "protocol_version": protocol_version,
        "sha1": metadata.get("sha1"),
        "source_path": source_path.name,
        "source_index": source_index,
    }


def _build_record_archive_name(
    descriptor: dict[str, Any],
    used_names: set[str],
    fallback_index: int,
) -> str:
    record_id = descriptor.get("record_id")
    record_version = descriptor.get("record_version")
    if isinstance(record_id, str) and record_id.strip():
        base_name = _slugify(record_id.strip(), f"record-{fallback_index:04d}")
    else:
        base_name = _slugify(
            Path(descriptor["source_path"]).stem, f"record-{fallback_index:04d}"
        )

    version_suffix = ""
    if record_version is not None:
        version_suffix = f".v{record_version}"

    candidate = f"{base_name}{version_suffix}.json"
    serial = 2
    while candidate in used_names:
        candidate = f"{base_name}{version_suffix}-{serial}.json"
        serial += 1
    used_names.add(candidate)
    return candidate


def _build_protocol_archive_root(
    metadata: dict[str, Any],
    protocol_dir: Path,
    used_roots: set[str],
    prefix: str = "protocols",
) -> str:
    protocol_id = _slugify(metadata.get("protocol_id"), _slugify(protocol_dir.name, "protocol"))
    protocol_version = metadata.get("protocol_version")
    version_part = _slugify(protocol_version, "unversioned")
    base_root = f"{prefix}/{protocol_id}__{version_part}"
    candidate = base_root
    serial = 2
    while candidate in used_roots:
        candidate = f"{base_root}-{serial}"
        serial += 1
    used_roots.add(candidate)
    return candidate


def _record_protocol_match_key(descriptor: dict[str, Any]) -> tuple[str | None, str | None]:
    return descriptor.get("protocol_id"), descriptor.get("protocol_version")


def _find_matching_protocol_root(
    record_descriptor: dict[str, Any],
    embedded_protocols: list[dict[str, Any]],
) -> str | None:
    record_protocol_id, record_protocol_version = _record_protocol_match_key(
        record_descriptor
    )
    if not record_protocol_id:
        return None

    exact_matches = [
        protocol["archive_root"]
        for protocol in embedded_protocols
        if protocol["metadata"].get("protocol_id") == record_protocol_id
        and protocol["metadata"].get("protocol_version") == record_protocol_version
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(exact_matches) > 1:
        raise ArchiveError(
            f"Multiple embedded protocols match record protocol '{record_protocol_id}' version '{record_protocol_version}'."
        )

    id_only_matches = [
        protocol["archive_root"]
        for protocol in embedded_protocols
        if protocol["metadata"].get("protocol_id") == record_protocol_id
    ]
    if len(id_only_matches) == 1:
        return id_only_matches[0]
    if len(id_only_matches) > 1:
        raise ArchiveError(
            f"Multiple embedded protocols match record protocol '{record_protocol_id}'."
        )
    return None


def _validate_output_path_for_write(output_path: Path, force: bool) -> None:
    if output_path.exists() and not force:
        raise ArchiveError(
            f"Output path '{output_path}' already exists. Use force=True to overwrite."
        )
    if output_path.exists() and output_path.is_dir():
        raise ArchiveError(
            f"Output path '{output_path}' must be a file, not a directory."
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)


def pack_protocol_archive(
    protocol_dir: str | Path,
    output_path: str | Path | None = None,
    *,
    force: bool = False,
) -> Path:
    protocol_dir_path = _ensure_protocol_dir(protocol_dir)
    destination = (
        Path(output_path)
        if output_path is not None
        else protocol_dir_path.with_suffix(ARCHIVE_SUFFIX)
    )
    _validate_output_path_for_write(destination, force=force)

    protocol_files = _collect_protocol_files(protocol_dir_path, output_path=destination)
    metadata = _load_protocol_metadata(protocol_dir_path)
    relative_files = [
        path.relative_to(protocol_dir_path).as_posix() for path in protocol_files
    ]

    manifest = {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "kind": "protocol",
        "created_at": _utc_now_iso(),
        "protocol": {
            **metadata,
            "files": relative_files,
        },
    }

    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            ARCHIVE_MANIFEST_PATH,
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        )
        for file_path in protocol_files:
            archive.write(
                file_path,
                arcname=file_path.relative_to(protocol_dir_path).as_posix(),
            )

    return destination


def pack_records_archive(
    record_paths: Iterable[str | Path],
    output_path: str | Path | None = None,
    *,
    protocol_dirs: Iterable[str | Path] | None = None,
    force: bool = False,
) -> Path:
    record_path_list = [Path(path) for path in record_paths]
    if not record_path_list:
        raise ArchiveError("At least one record JSON file is required.")
    for path in record_path_list:
        if not path.exists():
            raise ArchiveError(f"Record file '{path}' not found.")
        if not path.is_file():
            raise ArchiveError(f"Record path '{path}' must be a file.")

    destination = (
        Path(output_path)
        if output_path is not None
        else (
            record_path_list[0].with_suffix(ARCHIVE_SUFFIX)
            if len(record_path_list) == 1
            else Path.cwd() / f"records{ARCHIVE_SUFFIX}"
        )
    )
    _validate_output_path_for_write(destination, force=force)

    record_descriptors: list[dict[str, Any]] = []
    for record_path in record_path_list:
        records = _load_records_from_path(record_path)
        for source_index, record in enumerate(records, start=1):
            record_descriptors.append(
                _normalize_record_descriptor(
                    record=record,
                    source_path=record_path,
                    source_index=source_index,
                )
            )

    embedded_protocols: list[dict[str, Any]] = []
    used_protocol_roots: set[str] = set()
    for protocol_dir in protocol_dirs or []:
        protocol_dir_path = _ensure_protocol_dir(protocol_dir)
        metadata = _load_protocol_metadata(protocol_dir_path)
        archive_root = _build_protocol_archive_root(
            metadata=metadata,
            protocol_dir=protocol_dir_path,
            used_roots=used_protocol_roots,
        )
        embedded_protocols.append(
            {
                "protocol_dir": protocol_dir_path,
                "metadata": metadata,
                "archive_root": archive_root,
                "files": _collect_protocol_files(protocol_dir_path, output_path=destination),
            }
        )

    used_record_names: set[str] = set()
    manifest_records: list[dict[str, Any]] = []
    for index, descriptor in enumerate(record_descriptors, start=1):
        archive_name = _build_record_archive_name(descriptor, used_record_names, index)
        archive_path = f"records/{archive_name}"
        embedded_protocol_root = _find_matching_protocol_root(
            descriptor, embedded_protocols
        )
        manifest_records.append(
            {
                "path": archive_path,
                "record_id": descriptor["record_id"],
                "record_version": descriptor["record_version"],
                "protocol_id": descriptor["protocol_id"],
                "protocol_version": descriptor["protocol_version"],
                "sha1": descriptor["sha1"],
                "source_path": descriptor["source_path"],
                "source_index": descriptor["source_index"],
                "embedded_protocol_root": embedded_protocol_root,
            }
        )
        descriptor["archive_path"] = archive_path

    manifest = {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "kind": "records",
        "created_at": _utc_now_iso(),
        "records": manifest_records,
        "protocols": [
            {
                **protocol["metadata"],
                "archive_root": protocol["archive_root"],
                "files": [
                    path.relative_to(protocol["protocol_dir"]).as_posix()
                    for path in protocol["files"]
                ],
            }
            for protocol in embedded_protocols
        ],
    }

    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            ARCHIVE_MANIFEST_PATH,
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        )

        for descriptor in record_descriptors:
            archive.writestr(
                descriptor["archive_path"],
                json.dumps(descriptor["record"], indent=2, ensure_ascii=False) + "\n",
            )

        for protocol in embedded_protocols:
            protocol_dir_path = protocol["protocol_dir"]
            for file_path in protocol["files"]:
                relative_path = file_path.relative_to(protocol_dir_path).as_posix()
                archive.write(
                    file_path,
                    arcname=f"{protocol['archive_root']}/{relative_path}",
                )

    return destination


def read_archive_manifest(archive_path: str | Path) -> dict[str, Any]:
    archive_file = Path(archive_path)
    if not archive_file.exists():
        raise ArchiveError(f"Archive '{archive_file}' not found.")
    if not archive_file.is_file():
        raise ArchiveError(f"Archive path '{archive_file}' must be a file.")

    try:
        with zipfile.ZipFile(archive_file, "r") as archive:
            try:
                raw_manifest = archive.read(ARCHIVE_MANIFEST_PATH)
            except KeyError as exc:
                raise ArchiveError(
                    f"Archive '{archive_file}' does not contain '{ARCHIVE_MANIFEST_PATH}'."
                ) from exc
    except zipfile.BadZipFile as exc:
        raise ArchiveError(f"Archive '{archive_file}' is not a valid zip file.") from exc

    try:
        manifest = json.loads(raw_manifest.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ArchiveError(
            f"Archive manifest in '{archive_file}' is not valid JSON."
        ) from exc

    if manifest.get("format") != ARCHIVE_FORMAT:
        raise ArchiveError(
            f"Archive '{archive_file}' has unsupported format '{manifest.get('format')}'."
        )
    if manifest.get("version") != ARCHIVE_VERSION:
        raise ArchiveError(
            f"Archive '{archive_file}' has unsupported version '{manifest.get('version')}'."
        )
    if manifest.get("kind") not in {"protocol", "records"}:
        raise ArchiveError(
            f"Archive '{archive_file}' has unsupported kind '{manifest.get('kind')}'."
        )
    return manifest


def _safe_extract_member(archive: zipfile.ZipFile, member: zipfile.ZipInfo, output_dir: Path) -> None:
    relative_path = PurePosixPath(member.filename)
    if relative_path.is_absolute():
        raise ArchiveError(f"Archive member '{member.filename}' uses an absolute path.")
    if any(part == ".." for part in relative_path.parts):
        raise ArchiveError(f"Archive member '{member.filename}' escapes the output directory.")

    destination = output_dir.joinpath(*relative_path.parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with archive.open(member, "r") as source, destination.open("wb") as target:
        target.write(source.read())


def unpack_archive(
    archive_path: str | Path,
    output_dir: str | Path | None = None,
    *,
    force: bool = False,
) -> tuple[Path, dict[str, Any]]:
    archive_file = Path(archive_path)
    manifest = read_archive_manifest(archive_file)
    destination = (
        Path(output_dir)
        if output_dir is not None
        else archive_file.with_suffix("")
    )

    if destination.exists():
        if not force:
            raise ArchiveError(
                f"Output directory '{destination}' already exists. Use force=True to overwrite."
            )
        if not destination.is_dir():
            raise ArchiveError(
                f"Output path '{destination}' must be a directory when it already exists."
            )
    else:
        destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive_file, "r") as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            _safe_extract_member(archive, member, destination)

    return destination, manifest
