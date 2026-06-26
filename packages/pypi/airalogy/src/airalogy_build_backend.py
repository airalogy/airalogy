from __future__ import annotations

import shutil
from pathlib import Path

import uv_build
from airalogy_protocol_examples_validation import validate_protocol_examples
from uv_build import *  # noqa: F403


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
GENERATED_PROTOCOL_EXAMPLES = (
    PACKAGE_ROOT / "src" / "airalogy" / "examples" / "protocols" / "data"
)


def build_wheel(
    wheel_directory: str,
    config_settings: dict | None = None,
    metadata_directory: str | None = None,
):
    generated = sync_protocol_examples()
    try:
        return uv_build.build_wheel(wheel_directory, config_settings, metadata_directory)
    finally:
        if generated:
            shutil.rmtree(GENERATED_PROTOCOL_EXAMPLES, ignore_errors=True)


def build_sdist(sdist_directory: str, config_settings: dict | None = None):
    generated = sync_protocol_examples()
    try:
        return uv_build.build_sdist(sdist_directory, config_settings)
    finally:
        if generated:
            shutil.rmtree(GENERATED_PROTOCOL_EXAMPLES, ignore_errors=True)


def sync_protocol_examples() -> bool:
    source_protocol_examples = find_source_protocol_examples()
    target_index = GENERATED_PROTOCOL_EXAMPLES / "index.json"

    if source_protocol_examples is None:
        if target_index.is_file():
            return False
        raise FileNotFoundError(
            "Airalogy protocol examples are missing. Expected repository "
            f"examples/protocols or generated package data at {target_index}."
        )

    validate_protocol_examples(source_protocol_examples)

    if GENERATED_PROTOCOL_EXAMPLES.exists():
        shutil.rmtree(GENERATED_PROTOCOL_EXAMPLES)

    shutil.copytree(
        source_protocol_examples,
        GENERATED_PROTOCOL_EXAMPLES,
        ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"),
    )
    return True


def find_source_protocol_examples() -> Path | None:
    for parent in [PACKAGE_ROOT, *PACKAGE_ROOT.parents]:
        candidate = parent / "examples" / "protocols"
        if (candidate / "index.json").is_file():
            return candidate

    return None
