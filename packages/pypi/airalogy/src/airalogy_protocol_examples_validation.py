from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path, PurePosixPath
from typing import Any


EXAMPLE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PROTOCOL_ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
LOCALE_RE = re.compile(r"^[a-z]{2}(?:-[A-Z]{2})?$")


def validate_protocol_examples(root: Path) -> None:
    errors: list[str] = []
    index_path = root / "index.json"
    if not index_path.is_file():
        raise ValueError(f"Missing protocol example registry: {index_path}")

    try:
        registry = json.loads(index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid protocol example registry JSON: {index_path}: {exc}") from exc

    examples = registry.get("examples")
    if not isinstance(examples, list) or not examples:
        raise ValueError("Protocol example registry must contain a non-empty examples array.")

    seen_example_ids: set[str] = set()
    seen_protocol_ids: set[str] = set()
    for entry_index, entry in enumerate(examples):
        if not isinstance(entry, dict):
            errors.append(f"examples[{entry_index}] must be an object.")
            continue

        example_id = entry.get("id")
        if not isinstance(example_id, str) or not EXAMPLE_ID_RE.fullmatch(example_id):
            errors.append(
                f"examples[{entry_index}].id must be kebab-case, got {example_id!r}."
            )
            continue
        if example_id in seen_example_ids:
            errors.append(f"Duplicate example id: {example_id}.")
        seen_example_ids.add(example_id)

        languages = entry.get("languages")
        if not isinstance(languages, list) or not languages:
            errors.append(f"{example_id}: languages must be a non-empty array.")
            continue

        for locale in languages:
            if not isinstance(locale, str) or not LOCALE_RE.fullmatch(locale):
                errors.append(f"{example_id}: invalid locale {locale!r}.")
                continue
            validate_locale_entry(root, entry, example_id, locale, seen_protocol_ids, errors)

    if errors:
        bullet_list = "\n".join(f"- {error}" for error in errors)
        raise ValueError(f"Invalid Airalogy protocol examples:\n{bullet_list}")


def validate_locale_entry(
    root: Path,
    entry: dict[str, Any],
    example_id: str,
    locale: str,
    seen_protocol_ids: set[str],
    errors: list[str],
) -> None:
    protocol_dir = get_registry_path(entry, "protocol_dir", locale, errors, example_id)
    aimd_path = get_registry_path(entry, "entry", locale, errors, example_id)
    toml_path = get_registry_path(entry, "toml", locale, errors, example_id)
    if protocol_dir is None or aimd_path is None or toml_path is None:
        return

    expected_dir = f"{example_id}/{locale}"
    if protocol_dir != expected_dir:
        errors.append(f"{example_id} {locale}: protocol_dir must be {expected_dir!r}.")

    expected_aimd = f"{protocol_dir}/protocol.aimd"
    expected_toml = f"{protocol_dir}/protocol.toml"
    if aimd_path != expected_aimd:
        errors.append(f"{example_id} {locale}: entry must be {expected_aimd!r}.")
    if toml_path != expected_toml:
        errors.append(f"{example_id} {locale}: toml must be {expected_toml!r}.")

    assigner_path = entry.get("assigner", {}).get(locale)
    if assigner_path is not None:
        expected_assigner = f"{protocol_dir}/assigner.py"
        if assigner_path != expected_assigner:
            errors.append(f"{example_id} {locale}: assigner must be {expected_assigner!r}.")
        validate_relative_file(root, assigner_path, errors, f"{example_id} {locale} assigner")

    for sample_path in entry.get("sample_data", {}).get(locale, []):
        if not isinstance(sample_path, str) or not sample_path.startswith(f"{protocol_dir}/"):
            errors.append(
                f"{example_id} {locale}: sample_data paths must stay inside {protocol_dir!r}."
            )
            continue
        validate_relative_file(root, sample_path, errors, f"{example_id} {locale} sample_data")

    aimd_file = validate_relative_file(root, aimd_path, errors, f"{example_id} {locale} AIMD")
    toml_file = validate_relative_file(root, toml_path, errors, f"{example_id} {locale} TOML")
    if aimd_file is not None and aimd_file.read_text(encoding="utf-8").strip() == "":
        errors.append(f"{example_id} {locale}: protocol.aimd must not be empty.")
    if toml_file is not None:
        validate_protocol_metadata(toml_file, example_id, locale, seen_protocol_ids, errors)


def get_registry_path(
    entry: dict[str, Any],
    section: str,
    locale: str,
    errors: list[str],
    example_id: str,
) -> str | None:
    value = entry.get(section, {}).get(locale)
    if not isinstance(value, str):
        errors.append(f"{example_id} {locale}: missing {section}.{locale}.")
        return None
    if is_unsafe_relative_path(value):
        errors.append(f"{example_id} {locale}: unsafe relative path {value!r}.")
        return None
    return value


def validate_relative_file(
    root: Path,
    relative_path: str,
    errors: list[str],
    label: str,
) -> Path | None:
    if is_unsafe_relative_path(relative_path):
        errors.append(f"{label}: unsafe relative path {relative_path!r}.")
        return None

    file_path = root / relative_path
    if not file_path.is_file():
        errors.append(f"{label}: missing file {relative_path!r}.")
        return None
    return file_path


def validate_protocol_metadata(
    toml_file: Path,
    example_id: str,
    locale: str,
    seen_protocol_ids: set[str],
    errors: list[str],
) -> None:
    try:
        metadata = tomllib.loads(toml_file.read_text(encoding="utf-8")).get(
            "airalogy_protocol"
        )
    except tomllib.TOMLDecodeError as exc:
        errors.append(f"{example_id} {locale}: invalid protocol.toml: {exc}.")
        return

    if not isinstance(metadata, dict):
        errors.append(f"{example_id} {locale}: missing [airalogy_protocol].")
        return

    protocol_id = metadata.get("id")
    if not isinstance(protocol_id, str) or not PROTOCOL_ID_RE.fullmatch(protocol_id):
        errors.append(f"{example_id} {locale}: protocol id must be snake_case.")
        return
    if protocol_id in seen_protocol_ids:
        errors.append(f"{example_id} {locale}: duplicate protocol id {protocol_id!r}.")
    seen_protocol_ids.add(protocol_id)

    for key in ("name", "version"):
        if not isinstance(metadata.get(key), str) or metadata[key].strip() == "":
            errors.append(f"{example_id} {locale}: [airalogy_protocol].{key} is required.")


def is_unsafe_relative_path(path: str) -> bool:
    pure_path = PurePosixPath(path)
    return pure_path.is_absolute() or ".." in pure_path.parts
