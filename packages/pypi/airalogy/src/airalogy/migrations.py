"""Protocol Schema migration manifest validation and deterministic transforms."""

from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

MigrationOperationName = Literal["rename", "copy", "remove", "set_default"]

_SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
_FORBIDDEN_PATH_SEGMENTS = {"__proto__", "constructor", "prototype"}


@dataclass(frozen=True)
class MigrationIssue:
    path: str
    message: str


@dataclass(frozen=True)
class MigrationResult:
    data: dict[str, Any]
    status: Literal["completed", "needs_review", "failed"]
    issues: tuple[MigrationIssue, ...]
    rule_hash: str


def migration_rule_hash(manifest: dict[str, Any]) -> str:
    canonical = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def validate_migration_manifest(manifest: dict[str, Any]) -> list[MigrationIssue]:
    issues: list[MigrationIssue] = []
    if manifest.get("version") != "airalogy.migration.v1":
        issues.append(MigrationIssue("version", 'version must be "airalogy.migration.v1"'))
    for key in ("from", "to"):
        value = manifest.get(key)
        if not isinstance(value, str) or not _SEMVER_PATTERN.fullmatch(value.strip()):
            issues.append(MigrationIssue(key, f"{key} must be a semantic version"))
    operations = manifest.get("operations", [])
    if not isinstance(operations, list):
        return [*issues, MigrationIssue("operations", "operations must be a list")]
    for index, operation in enumerate(operations):
        path = f"operations.{index}"
        if not isinstance(operation, dict):
            issues.append(MigrationIssue(path, "operation must be an object"))
            continue
        name = operation.get("op")
        if name not in {"rename", "copy", "remove", "set_default"}:
            issues.append(MigrationIssue(f"{path}.op", f"unsupported migration operation: {name!r}"))
            continue
        required_keys = ("from", "to") if name in {"rename", "copy"} else ("field",)
        for key in required_keys:
            value = operation.get(key)
            if not isinstance(value, str) or not value.strip():
                issues.append(MigrationIssue(f"{path}.{key}", f"{key} must be a field path"))
            elif any(
                segment in _FORBIDDEN_PATH_SEGMENTS
                for segment in value.split(".")
            ):
                issues.append(
                    MigrationIssue(
                        f"{path}.{key}",
                        f"{key} contains a forbidden field path segment",
                    )
                )
        if name == "set_default" and "value" not in operation:
            issues.append(MigrationIssue(f"{path}.value", "set_default requires value"))
    transform = manifest.get("transform")
    if transform is not None:
        if not isinstance(transform, dict):
            issues.append(MigrationIssue("transform", "transform must be an object"))
        else:
            entrypoint = transform.get("entrypoint")
            code_hash = transform.get("code_hash")
            if not isinstance(entrypoint, str) or ":" not in entrypoint:
                issues.append(
                    MigrationIssue(
                        "transform.entrypoint",
                        "entrypoint must use a package-relative path and function name, e.g. migrations/v1.py:migrate",
                    )
                )
            elif entrypoint.startswith("/") or ".." in entrypoint.split(":", 1)[0].split("/"):
                issues.append(MigrationIssue("transform.entrypoint", "entrypoint must stay inside the Protocol package"))
            elif not entrypoint.rsplit(":", 1)[1].isidentifier():
                issues.append(
                    MigrationIssue(
                        "transform.entrypoint",
                        "entrypoint function name must be a Python identifier",
                    )
                )
            if (
                not isinstance(code_hash, str)
                or len(code_hash) != 64
                or any(character not in "0123456789abcdefABCDEF" for character in code_hash)
            ):
                issues.append(
                    MigrationIssue(
                        "transform.code_hash",
                        "code_hash must be the 64-character SHA-256 of the packaged function",
                    )
                )
    return issues


def _segments(path: str) -> list[str]:
    return [segment for segment in path.split(".") if segment]


def _read(data: dict[str, Any], path: str) -> tuple[bool, Any]:
    current: Any = data
    for segment in _segments(path):
        if not isinstance(current, dict) or segment not in current:
            return False, None
        current = current[segment]
    return True, current


def _write(data: dict[str, Any], path: str, value: Any, *, only_missing: bool = False) -> None:
    segments = _segments(path)
    if not segments:
        return
    current = data
    for segment in segments[:-1]:
        nested = current.get(segment)
        if not isinstance(nested, dict):
            nested = {}
            current[segment] = nested
        current = nested
    if not only_missing or segments[-1] not in current:
        current[segments[-1]] = deepcopy(value)


def _remove(data: dict[str, Any], path: str) -> bool:
    segments = _segments(path)
    if not segments:
        return False
    current: Any = data
    for segment in segments[:-1]:
        if not isinstance(current, dict) or segment not in current:
            return False
        current = current[segment]
    if not isinstance(current, dict) or segments[-1] not in current:
        return False
    del current[segments[-1]]
    return True


def apply_declarative_migration(
    record_data: dict[str, Any],
    manifest: dict[str, Any],
) -> MigrationResult:
    """Apply only deterministic declarative rules.

    A declared sandbox transform is intentionally not executed here. Hosts must
    run it in an isolated worker without network or secrets and persist the
    returned code hash separately.
    """

    validation_issues = validate_migration_manifest(manifest)
    rule_hash = migration_rule_hash(manifest)
    if validation_issues:
        return MigrationResult(deepcopy(record_data), "failed", tuple(validation_issues), rule_hash)

    result = deepcopy(record_data)
    issues: list[MigrationIssue] = []
    for index, operation in enumerate(manifest.get("operations", [])):
        name = operation["op"]
        if name in {"rename", "copy"}:
            found, value = _read(result, operation["from"])
            if not found:
                issues.append(
                    MigrationIssue(
                        f"operations.{index}.from",
                        f'source field "{operation["from"]}" was not collected',
                    )
                )
                continue
            _write(result, operation["to"], value)
            if name == "rename":
                _remove(result, operation["from"])
        elif name == "remove":
            _remove(result, operation["field"])
        elif name == "set_default":
            _write(result, operation["field"], operation["value"], only_missing=True)

    status: Literal["completed", "needs_review", "failed"] = (
        "needs_review" if issues or manifest.get("transform") else "completed"
    )
    return MigrationResult(result, status, tuple(issues), rule_hash)
