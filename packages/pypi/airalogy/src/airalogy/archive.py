from __future__ import annotations

import hashlib
import json
import re
import tomllib
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from .markdown import validate_aimd

ARCHIVE_FORMAT = "airalogy.archive"
ARCHIVE_VERSION = 1
ARCHIVE_METADATA_DIR = "_airalogy_archive"
ARCHIVE_MANIFEST_PATH = f"{ARCHIVE_METADATA_DIR}/manifest.json"
ARCHIVE_SUFFIX = ".aira"
ARCHIVE_KINDS = {"protocol", "protocols", "records"}
BLOB_HASH_ALGORITHM = "sha256"
BLOBS_ROOT = "blobs"

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_FILE_PAYLOAD_PATH_KEYS = ("path", "local_path", "file_path")

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


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read_file_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as exc:
        raise ArchiveError(f"Failed to read '{path}': {exc}") from exc


def _as_non_empty_string(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    stripped = value.strip()
    return stripped or None


def _without_none_values(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


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


def _validate_protocol_definition(protocol_dir: Path) -> None:
    protocol_file = protocol_dir / "protocol.aimd"
    try:
        content = protocol_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise ArchiveError(f"Failed to read '{protocol_file}': {exc}") from exc

    is_valid, errors = validate_aimd(content, protocol_dir=protocol_dir)
    if is_valid:
        return

    error_messages = "; ".join(str(error) for error in errors)
    raise ArchiveError(
        f"Protocol '{protocol_dir}' failed validation: {error_messages}"
    )


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


def _relative_protocol_file_hashes(protocol_dir: Path, files: Iterable[Path]) -> dict[str, str]:
    return {
        path.relative_to(protocol_dir).as_posix(): _sha256_bytes(_read_file_bytes(path))
        for path in files
    }


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


def load_file_payload_specs(path: str | Path) -> list[dict[str, Any]]:
    """Load file payload specs for record archive packing.

    The JSON file may contain one object, a list of objects, or an object with a
    top-level ``files`` or ``file_payloads`` list. Relative local payload paths
    are resolved against the JSON file location, not the current working
    directory.
    """
    spec_path = Path(path)
    parsed = _read_json_file(spec_path)
    if isinstance(parsed, dict):
        if isinstance(parsed.get("files"), list):
            items = parsed["files"]
        elif isinstance(parsed.get("file_payloads"), list):
            items = parsed["file_payloads"]
        else:
            items = [parsed]
    elif isinstance(parsed, list):
        items = parsed
    else:
        raise ArchiveError(
            f"File payload spec '{spec_path}' must contain an object, a list, "
            "or an object with a 'files' list."
        )

    specs = [item for item in items if isinstance(item, dict)]
    if len(specs) != len(items):
        raise ArchiveError(
            f"File payload spec '{spec_path}' must contain only JSON objects."
        )
    base_dir = spec_path.resolve().parent
    return [_resolve_file_payload_spec_paths(spec, base_dir) for spec in specs]


def _resolve_file_payload_spec_paths(
    spec: dict[str, Any],
    base_dir: Path,
) -> dict[str, Any]:
    normalized = dict(spec)
    for key in _FILE_PAYLOAD_PATH_KEYS:
        value = _as_non_empty_string(normalized.get(key))
        if value is None:
            continue
        local_path = Path(value)
        if not local_path.is_absolute():
            local_path = base_dir / local_path
        normalized[key] = str(local_path.resolve())
    return normalized


def _blob_archive_path(sha256: str) -> str:
    return f"{BLOBS_ROOT}/{BLOB_HASH_ALGORITHM}/{sha256[:2]}/{sha256[2:4]}/{sha256}"


def _file_payload_local_path(spec: dict[str, Any]) -> Path | None:
    for key in _FILE_PAYLOAD_PATH_KEYS:
        value = _as_non_empty_string(spec.get(key))
        if value:
            return Path(value)
    return None


def _record_lookup_key(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _resolve_file_record_path(
    spec: dict[str, Any],
    record_descriptors: list[dict[str, Any]],
    valid_record_paths: set[str],
) -> str | None:
    explicit_record_path = _as_non_empty_string(spec.get("record_path"))
    if explicit_record_path:
        if explicit_record_path not in valid_record_paths:
            raise ArchiveError(
                f"File payload references unknown record_path '{explicit_record_path}'."
            )
        return explicit_record_path

    record_id = _record_lookup_key(_as_non_empty_string(spec.get("record_id")))
    if record_id:
        matches = [
            descriptor["archive_path"]
            for descriptor in record_descriptors
            if descriptor.get("record_id") == record_id
        ]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ArchiveError(
                f"File payload record_id '{record_id}' matches multiple records."
            )
        raise ArchiveError(f"File payload record_id '{record_id}' does not match any record.")

    source_path = _as_non_empty_string(spec.get("source_path"))
    source_index = spec.get("source_index")
    if source_path is not None and source_index is not None:
        try:
            source_index = int(source_index)
        except (TypeError, ValueError) as exc:
            raise ArchiveError(
                f"File payload source_index for '{source_path}' must be an integer."
            ) from exc
        matches = [
            descriptor["archive_path"]
            for descriptor in record_descriptors
            if descriptor.get("source_path") == Path(source_path).name
            and descriptor.get("source_index") == source_index
        ]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ArchiveError(
                f"File payload source reference '{source_path}' index {source_index} "
                "matches multiple records."
            )
        raise ArchiveError(
            f"File payload source reference '{source_path}' index {source_index} "
            "does not match any record."
        )

    if len(record_descriptors) == 1 and _as_non_empty_string(spec.get("field_path")):
        return record_descriptors[0]["archive_path"]

    return None


def _normalize_file_payloads(
    file_payloads: Iterable[dict[str, Any]] | None,
    record_descriptors: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, bytes]]:
    blob_entries_by_id: dict[str, dict[str, Any]] = {}
    blob_payloads: dict[str, bytes] = {}
    file_entries: list[dict[str, Any]] = []
    valid_record_paths = {
        descriptor["archive_path"]
        for descriptor in record_descriptors
        if isinstance(descriptor.get("archive_path"), str)
    }

    for index, spec in enumerate(file_payloads or [], start=1):
        if not isinstance(spec, dict):
            raise ArchiveError(f"File payload #{index} must be an object.")

        local_path = _file_payload_local_path(spec)
        blob_id: str | None = None
        blob_size: int | None = None
        filename = _as_non_empty_string(spec.get("filename"))
        if local_path is not None:
            if not local_path.exists():
                raise ArchiveError(f"File payload path '{local_path}' not found.")
            if not local_path.is_file():
                raise ArchiveError(f"File payload path '{local_path}' must be a file.")
            payload = _read_file_bytes(local_path)
            sha256 = _sha256_bytes(payload)
            blob_id = f"{BLOB_HASH_ALGORITHM}:{sha256}"
            blob_size = len(payload)
            archive_path = _blob_archive_path(sha256)
            blob_payloads.setdefault(archive_path, payload)
            blob_entries_by_id.setdefault(
                blob_id,
                {
                    "blob_id": blob_id,
                    "archive_path": archive_path,
                    "sha256": sha256,
                    "size": blob_size,
                },
            )
            if filename is None:
                filename = local_path.name
        elif _as_non_empty_string(spec.get("blob_id")):
            raise ArchiveError(
                f"File payload #{index} provides blob_id but no local file path."
            )

        record_path = _resolve_file_record_path(spec, record_descriptors, valid_record_paths)
        file_entry = _without_none_values(
            {
                "file_id": _as_non_empty_string(spec.get("file_id")),
                "source_uri": _as_non_empty_string(spec.get("source_uri")),
                "blob_id": blob_id,
                "filename": filename,
                "mime_type": _as_non_empty_string(spec.get("mime_type")),
                "size": blob_size,
                "record_path": record_path,
                "field_path": _as_non_empty_string(spec.get("field_path")),
            }
        )
        if not any(file_entry.get(key) for key in ("file_id", "source_uri", "blob_id")):
            raise ArchiveError(
                f"File payload #{index} must include a file_id, source_uri, or local file path."
            )
        file_entries.append(file_entry)

    return list(blob_entries_by_id.values()), file_entries, blob_payloads


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


def _collect_protocol_archive_descriptors(
    protocol_dirs: Iterable[str | Path],
    *,
    output_path: Path,
) -> list[dict[str, Any]]:
    descriptors: list[dict[str, Any]] = []
    used_protocol_roots: set[str] = set()
    for protocol_dir in protocol_dirs:
        protocol_dir_path = _ensure_protocol_dir(protocol_dir)
        _validate_protocol_definition(protocol_dir_path)
        metadata = _load_protocol_metadata(protocol_dir_path)
        archive_root = _build_protocol_archive_root(
            metadata=metadata,
            protocol_dir=protocol_dir_path,
            used_roots=used_protocol_roots,
        )
        descriptors.append(
            {
                "protocol_dir": protocol_dir_path,
                "metadata": metadata,
                "archive_root": archive_root,
                "files": _collect_protocol_files(protocol_dir_path, output_path=output_path),
            }
        )
    return descriptors


def _protocol_bundle_manifest_entry(protocol: dict[str, Any]) -> dict[str, Any]:
    protocol_dir = protocol["protocol_dir"]
    return {
        **protocol["metadata"],
        "archive_root": protocol["archive_root"],
        "files": [
            path.relative_to(protocol_dir).as_posix()
            for path in protocol["files"]
        ],
        "file_hashes": _relative_protocol_file_hashes(
            protocol_dir,
            protocol["files"],
        ),
    }


def _write_protocol_bundle_files(
    archive: zipfile.ZipFile,
    protocols: Iterable[dict[str, Any]],
) -> None:
    for protocol in protocols:
        protocol_dir_path = protocol["protocol_dir"]
        for file_path in protocol["files"]:
            relative_path = file_path.relative_to(protocol_dir_path).as_posix()
            archive.write(
                file_path,
                arcname=f"{protocol['archive_root']}/{relative_path}",
            )


def pack_protocol_archive(
    protocol_dir: str | Path,
    output_path: str | Path | None = None,
    *,
    force: bool = False,
) -> Path:
    protocol_dir_path = _ensure_protocol_dir(protocol_dir)
    _validate_protocol_definition(protocol_dir_path)
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
    file_hashes = _relative_protocol_file_hashes(protocol_dir_path, protocol_files)

    manifest = {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "kind": "protocol",
        "created_at": _utc_now_iso(),
        "protocol": {
            **metadata,
            "files": relative_files,
            "file_hashes": file_hashes,
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


def pack_protocols_archive(
    protocol_dirs: Iterable[str | Path],
    output_path: str | Path | None = None,
    *,
    force: bool = False,
) -> Path:
    protocol_dir_list = [Path(path) for path in protocol_dirs]
    if not protocol_dir_list:
        raise ArchiveError("At least one protocol directory is required.")

    destination = (
        Path(output_path)
        if output_path is not None
        else (
            protocol_dir_list[0].with_suffix(ARCHIVE_SUFFIX)
            if len(protocol_dir_list) == 1
            else Path.cwd() / f"protocols{ARCHIVE_SUFFIX}"
        )
    )
    _validate_output_path_for_write(destination, force=force)

    protocols = _collect_protocol_archive_descriptors(
        protocol_dir_list,
        output_path=destination,
    )
    manifest = {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "kind": "protocols",
        "created_at": _utc_now_iso(),
        "protocols": [
            _protocol_bundle_manifest_entry(protocol)
            for protocol in protocols
        ],
    }

    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            ARCHIVE_MANIFEST_PATH,
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        )
        _write_protocol_bundle_files(archive, protocols)

    return destination


def pack_records_archive(
    record_paths: Iterable[str | Path],
    output_path: str | Path | None = None,
    *,
    protocol_dirs: Iterable[str | Path] | None = None,
    file_payloads: Iterable[dict[str, Any]] | None = None,
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

    embedded_protocols = _collect_protocol_archive_descriptors(
        protocol_dirs or [],
        output_path=destination,
    )

    used_record_names: set[str] = set()
    record_payloads: dict[str, str] = {}
    manifest_records: list[dict[str, Any]] = []
    for index, descriptor in enumerate(record_descriptors, start=1):
        archive_name = _build_record_archive_name(descriptor, used_record_names, index)
        archive_path = f"records/{archive_name}"
        embedded_protocol_root = _find_matching_protocol_root(
            descriptor, embedded_protocols
        )
        record_payload = json.dumps(descriptor["record"], indent=2, ensure_ascii=False) + "\n"
        record_payloads[archive_path] = record_payload
        manifest_records.append(
            {
                "path": archive_path,
                "record_id": descriptor["record_id"],
                "record_version": descriptor["record_version"],
                "protocol_id": descriptor["protocol_id"],
                "protocol_version": descriptor["protocol_version"],
                "sha1": descriptor["sha1"],
                "sha256": _sha256_bytes(record_payload.encode("utf-8")),
                "source_path": descriptor["source_path"],
                "source_index": descriptor["source_index"],
                "embedded_protocol_root": embedded_protocol_root,
            }
        )
        descriptor["archive_path"] = archive_path

    manifest_blobs, manifest_files, blob_payloads = _normalize_file_payloads(
        file_payloads,
        record_descriptors,
    )
    manifest = {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "kind": "records",
        "created_at": _utc_now_iso(),
        "records": manifest_records,
        "protocols": [
            _protocol_bundle_manifest_entry(protocol)
            for protocol in embedded_protocols
        ],
    }
    if manifest_blobs:
        manifest["blobs"] = manifest_blobs
    if manifest_files:
        manifest["files"] = manifest_files

    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            ARCHIVE_MANIFEST_PATH,
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        )

        for descriptor in record_descriptors:
            archive.writestr(
                descriptor["archive_path"],
                record_payloads[descriptor["archive_path"]],
            )

        _write_protocol_bundle_files(archive, embedded_protocols)
        for archive_path, payload in blob_payloads.items():
            archive.writestr(archive_path, payload)

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
    if manifest.get("kind") not in ARCHIVE_KINDS:
        raise ArchiveError(
            f"Archive '{archive_file}' has unsupported kind '{manifest.get('kind')}'."
        )
    return manifest


def _validate_zip_member_path(member_name: str) -> str | None:
    relative_path = PurePosixPath(member_name)
    if relative_path.is_absolute():
        return f"Archive member '{member_name}' uses an absolute path."
    if any(part == ".." for part in relative_path.parts):
        return f"Archive member '{member_name}' escapes the output directory."
    return None


def _read_archive_member_bytes(archive: zipfile.ZipFile, member_name: str) -> bytes:
    try:
        return archive.read(member_name)
    except KeyError as exc:
        raise ArchiveError(f"Archive is missing member '{member_name}'.") from exc


def _archive_member_sha256(archive: zipfile.ZipFile, member_name: str) -> str:
    return _sha256_bytes(_read_archive_member_bytes(archive, member_name))


def _validate_protocol_manifest(
    archive: zipfile.ZipFile,
    manifest: dict[str, Any],
    *,
    prefix: str = "",
) -> list[str]:
    issues: list[str] = []
    protocol = manifest.get("protocol") if not prefix else manifest
    if not isinstance(protocol, dict):
        return ["Protocol manifest entry must be an object."]

    entrypoint = protocol.get("entrypoint", "protocol.aimd")
    if not isinstance(entrypoint, str) or not entrypoint:
        issues.append("Protocol entrypoint must be a non-empty string.")
        entrypoint = "protocol.aimd"

    files = protocol.get("files")
    if not isinstance(files, list) or not all(isinstance(item, str) for item in files):
        issues.append("Protocol files must be a list of paths.")
        files = []

    file_hashes = protocol.get("file_hashes")
    if file_hashes is not None and not isinstance(file_hashes, dict):
        issues.append("Protocol file_hashes must be an object when present.")
        file_hashes = None

    archive_names = set(archive.namelist())
    expected_entrypoint = f"{prefix}{entrypoint}" if prefix else entrypoint
    if expected_entrypoint not in archive_names:
        issues.append(f"Protocol entrypoint '{expected_entrypoint}' is missing.")

    for file_name in files:
        member_name = f"{prefix}{file_name}" if prefix else file_name
        path_issue = _validate_zip_member_path(member_name)
        if path_issue:
            issues.append(path_issue)
            continue
        if member_name not in archive_names:
            issues.append(f"Protocol file '{member_name}' is missing.")
            continue
        if isinstance(file_hashes, dict) and file_name in file_hashes:
            expected_hash = file_hashes[file_name]
            actual_hash = _archive_member_sha256(archive, member_name)
            if expected_hash != actual_hash:
                issues.append(
                    f"Protocol file '{member_name}' sha256 mismatch: expected {expected_hash}, got {actual_hash}."
                )

    return issues


def _validate_protocols_manifest(
    archive: zipfile.ZipFile,
    protocols: Any,
    *,
    require_non_empty: bool = False,
) -> tuple[list[str], set[str]]:
    issues: list[str] = []
    if not isinstance(protocols, list):
        return ["Protocols manifest field must be a list."], set()
    if require_non_empty and not protocols:
        issues.append("Protocols manifest field must include at least one protocol.")

    protocol_roots: set[str] = set()
    for index, protocol in enumerate(protocols, start=1):
        if not isinstance(protocol, dict):
            issues.append(f"Protocol manifest entry #{index} must be an object.")
            continue
        archive_root = protocol.get("archive_root")
        if not isinstance(archive_root, str) or not archive_root:
            issues.append(f"Protocol manifest entry #{index} is missing archive_root.")
            continue
        if archive_root in protocol_roots:
            issues.append(f"Protocol manifest entry #{index} uses duplicate archive_root '{archive_root}'.")
            continue
        protocol_roots.add(archive_root)
        root_prefix = archive_root.rstrip("/") + "/"
        issues.extend(
            _validate_protocol_manifest(
                archive,
                protocol,
                prefix=root_prefix,
            )
        )
    return issues, protocol_roots


def _validate_blobs_manifest(
    archive: zipfile.ZipFile,
    blobs: Any,
) -> tuple[list[str], set[str]]:
    issues: list[str] = []
    blob_ids: set[str] = set()
    if blobs is None:
        return issues, blob_ids
    if not isinstance(blobs, list):
        return ["Blobs manifest field must be a list."], blob_ids

    archive_names = set(archive.namelist())
    archive_paths: set[str] = set()
    for index, blob in enumerate(blobs, start=1):
        if not isinstance(blob, dict):
            issues.append(f"Blob manifest entry #{index} must be an object.")
            continue

        blob_id = blob.get("blob_id")
        archive_path = blob.get("archive_path")
        expected_hash = blob.get("sha256")
        expected_size = blob.get("size")

        if not isinstance(blob_id, str) or not blob_id:
            issues.append(f"Blob manifest entry #{index} is missing blob_id.")
            continue
        if blob_id in blob_ids:
            issues.append(f"Blob manifest entry #{index} uses duplicate blob_id '{blob_id}'.")
            continue
        blob_ids.add(blob_id)

        if not isinstance(expected_hash, str) or not _SHA256_RE.fullmatch(expected_hash):
            issues.append(f"Blob '{blob_id}' must include a valid sha256 hash.")
            continue
        expected_blob_id = f"{BLOB_HASH_ALGORITHM}:{expected_hash}"
        if blob_id != expected_blob_id:
            issues.append(
                f"Blob '{blob_id}' does not match sha256-derived id '{expected_blob_id}'."
            )

        if not isinstance(archive_path, str) or not archive_path:
            issues.append(f"Blob '{blob_id}' is missing archive_path.")
            continue
        path_issue = _validate_zip_member_path(archive_path)
        if path_issue:
            issues.append(path_issue)
            continue
        if not archive_path.startswith(f"{BLOBS_ROOT}/{BLOB_HASH_ALGORITHM}/"):
            issues.append(
                f"Blob '{blob_id}' archive_path must be under "
                f"'{BLOBS_ROOT}/{BLOB_HASH_ALGORITHM}/'."
            )
        if archive_path in archive_paths:
            issues.append(f"Blob '{blob_id}' uses duplicate archive_path '{archive_path}'.")
            continue
        archive_paths.add(archive_path)
        if archive_path not in archive_names:
            issues.append(f"Blob file '{archive_path}' is missing.")
            continue

        raw_blob = _read_archive_member_bytes(archive, archive_path)
        actual_hash = _sha256_bytes(raw_blob)
        if actual_hash != expected_hash:
            issues.append(
                f"Blob file '{archive_path}' sha256 mismatch: "
                f"expected {expected_hash}, got {actual_hash}."
            )
        if isinstance(expected_size, int) and expected_size != len(raw_blob):
            issues.append(
                f"Blob file '{archive_path}' size mismatch: "
                f"expected {expected_size}, got {len(raw_blob)}."
            )
        elif expected_size is not None and not isinstance(expected_size, int):
            issues.append(f"Blob '{blob_id}' size must be an integer when present.")

    return issues, blob_ids


def _validate_file_references_manifest(
    files: Any,
    *,
    blob_ids: set[str],
    record_paths: set[str],
) -> list[str]:
    issues: list[str] = []
    if files is None:
        return issues
    if not isinstance(files, list):
        return ["Files manifest field must be a list."]

    for index, file_ref in enumerate(files, start=1):
        if not isinstance(file_ref, dict):
            issues.append(f"File manifest entry #{index} must be an object.")
            continue

        file_id = file_ref.get("file_id")
        source_uri = file_ref.get("source_uri")
        blob_id = file_ref.get("blob_id")
        record_path = file_ref.get("record_path")
        field_path = file_ref.get("field_path")

        if not any(isinstance(value, str) and value for value in (file_id, source_uri, blob_id)):
            issues.append(
                f"File manifest entry #{index} must include file_id, source_uri, or blob_id."
            )
        if blob_id is not None:
            if not isinstance(blob_id, str) or not blob_id:
                issues.append(f"File manifest entry #{index} blob_id must be a string.")
            elif blob_id not in blob_ids:
                issues.append(
                    f"File manifest entry #{index} references missing blob_id '{blob_id}'."
                )
        if record_path is not None:
            if not isinstance(record_path, str) or not record_path:
                issues.append(f"File manifest entry #{index} record_path must be a string.")
            elif record_path not in record_paths:
                issues.append(
                    f"File manifest entry #{index} references missing record_path '{record_path}'."
                )
        if field_path is not None and (not isinstance(field_path, str) or not field_path):
            issues.append(f"File manifest entry #{index} field_path must be a string.")

    return issues


def inspect_archive(archive_path: str | Path) -> dict[str, Any]:
    """Return a stable summary for an Airalogy .aira archive."""
    archive_file = Path(archive_path)
    manifest = read_archive_manifest(archive_file)
    with zipfile.ZipFile(archive_file, "r") as archive:
        members = [
            name
            for name in archive.namelist()
            if not name.endswith("/")
        ]
        summary: dict[str, Any] = {
            "path": str(archive_file),
            "format": manifest["format"],
            "version": manifest["version"],
            "kind": manifest["kind"],
            "created_at": manifest.get("created_at"),
            "member_count": len(members),
            "manifest_path": ARCHIVE_MANIFEST_PATH,
        }
        if manifest["kind"] == "protocol":
            protocol = manifest.get("protocol") or {}
            summary["protocol"] = {
                "protocol_id": protocol.get("protocol_id"),
                "protocol_version": protocol.get("protocol_version"),
                "protocol_name": protocol.get("protocol_name"),
                "entrypoint": protocol.get("entrypoint"),
                "file_count": len(protocol.get("files") or []),
            }
        elif manifest["kind"] in {"protocols", "records"}:
            records = manifest.get("records") or []
            protocols = manifest.get("protocols") or []
            blobs = manifest.get("blobs") or []
            files = manifest.get("files") or []
            record_items = records if isinstance(records, list) else []
            protocol_items = protocols if isinstance(protocols, list) else []
            blob_items = blobs if isinstance(blobs, list) else []
            file_items = files if isinstance(files, list) else []
            summary["records"] = {
                "count": len(record_items),
                "protocol_ids": sorted(
                    {
                        item.get("protocol_id")
                        for item in record_items
                        if isinstance(item, dict) and item.get("protocol_id")
                    }
                ),
            }
            summary["protocols"] = {
                "count": len(protocol_items),
                "protocol_ids": sorted(
                    {
                        item.get("protocol_id")
                        for item in protocol_items
                        if isinstance(item, dict) and item.get("protocol_id")
                    }
                ),
            }
            summary["blobs"] = {
                "count": len(blob_items),
                "total_size": sum(
                    item.get("size", 0)
                    for item in blob_items
                    if isinstance(item, dict) and isinstance(item.get("size"), int)
                ),
            }
            summary["files"] = {
                "count": len(file_items),
                "offline_count": sum(
                    1
                    for item in file_items
                    if isinstance(item, dict) and item.get("blob_id")
                ),
            }
        return summary


def validate_archive(archive_path: str | Path) -> tuple[bool, list[str]]:
    """Validate an Airalogy .aira archive without extracting it."""
    archive_file = Path(archive_path)
    issues: list[str] = []
    try:
        manifest = read_archive_manifest(archive_file)
        with zipfile.ZipFile(archive_file, "r") as archive:
            archive_names = set(archive.namelist())
            for member in archive.infolist():
                path_issue = _validate_zip_member_path(member.filename)
                if path_issue:
                    issues.append(path_issue)

            if ARCHIVE_MANIFEST_PATH not in archive_names:
                issues.append(f"Archive is missing '{ARCHIVE_MANIFEST_PATH}'.")

            if manifest["kind"] == "protocol":
                issues.extend(_validate_protocol_manifest(archive, manifest))

            elif manifest["kind"] == "protocols":
                protocol_issues, _protocol_roots = _validate_protocols_manifest(
                    archive,
                    manifest.get("protocols"),
                    require_non_empty=True,
                )
                issues.extend(protocol_issues)

            elif manifest["kind"] == "records":
                records = manifest.get("records")
                if not isinstance(records, list):
                    issues.append("Records manifest field must be a list.")
                    records = []
                protocol_issues, protocol_roots = _validate_protocols_manifest(
                    archive,
                    manifest.get("protocols"),
                )
                issues.extend(protocol_issues)
                record_paths: set[str] = set()
                for index, record in enumerate(records, start=1):
                    if not isinstance(record, dict):
                        issues.append(f"Record manifest entry #{index} must be an object.")
                        continue
                    record_path = record.get("path")
                    if not isinstance(record_path, str) or not record_path:
                        issues.append(f"Record manifest entry #{index} is missing a path.")
                        continue
                    path_issue = _validate_zip_member_path(record_path)
                    if path_issue:
                        issues.append(path_issue)
                        continue
                    if record_path not in archive_names:
                        issues.append(f"Record file '{record_path}' is missing.")
                        continue
                    record_paths.add(record_path)
                    raw_record = _read_archive_member_bytes(archive, record_path)
                    try:
                        parsed_record = json.loads(raw_record.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        issues.append(f"Record file '{record_path}' is not valid UTF-8 JSON.")
                        continue
                    if not isinstance(parsed_record, dict):
                        issues.append(f"Record file '{record_path}' must contain a JSON object.")
                    expected_hash = record.get("sha256")
                    if isinstance(expected_hash, str) and expected_hash:
                        actual_hash = _sha256_bytes(raw_record)
                        if actual_hash != expected_hash:
                            issues.append(
                                f"Record file '{record_path}' sha256 mismatch: expected {expected_hash}, got {actual_hash}."
                            )
                    embedded_protocol_root = record.get("embedded_protocol_root")
                    if (
                        embedded_protocol_root is not None
                        and embedded_protocol_root not in protocol_roots
                    ):
                        issues.append(
                            f"Record file '{record_path}' references missing embedded protocol root '{embedded_protocol_root}'."
                        )
                blob_issues, blob_ids = _validate_blobs_manifest(
                    archive,
                    manifest.get("blobs"),
                )
                issues.extend(blob_issues)
                issues.extend(
                    _validate_file_references_manifest(
                        manifest.get("files"),
                        blob_ids=blob_ids,
                        record_paths=record_paths,
                    )
                )

    except ArchiveError as exc:
        issues.append(str(exc))
    except zipfile.BadZipFile:
        issues.append(f"Archive '{archive_file}' is not a valid zip file.")

    return not issues, issues


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
