# CHANGELOG

## 0.0.12 (20251223)

### Features

- Add new code-string types: `JsonStr`, `TomlStr`, `YamlStr`.
- Add support for Python standard library types in `ModelGenerator`, including `datetime`, `date`, `time`, `timedelta`, `Decimal`, `UUID`, `Path`, `PurePath`, `IPv4Address`, and `IPv6Address`. 

### Fixes

- AIMD var defined in code blocks will not be parsed

## 0.0.11 (20251217)

### Features

- Add new Assigner Modes: `auto_readonly` and `manual_readonly`, allowing assigned fields to be locked in the UI after assignment.

### Breaking

- Remove Assigner mode `auto_force`; `auto` is now defined as auto-trigger on dependency change with force overwrite.

## 0.0.10 (20251202)

### Features

- Rename `airalogy.aimd` module to `airalogy.markdown` for better clarity
- Add `get_airalogy_image_ids` API for `airalogy.markdown`

## 0.0.9 (20251120)

### Features

- Add Typed AIMD variable syntax support
- Add command-line interface (CLI) with syntax checking and model generation commands
- Add Chinese demographic enum types for enhanced data modeling
- Support standalone assigner functions with simplified decorator syntax

### Documentation

- Add typed AIMD variable syntax documentation
- Simplify Assigner syntax documentation by removing class-based definitions

### Development

- New parser implementation

## 0.0.8 (20251029)

### Features

- Add `CurrentProtocolId` and `CurrentRecordId` types

### Development

- Migrate from pdm to uv
- Update minimum Python version requirement to 3.13
- Add GitHub workflow for CI
- Add build status badge

### Dependencies

- Update pydantic dependency from 2.11.5 to 2.12.3

### Fixes

- Fix description

## 0.0.7 (20250827)

- Fix: Removed the `CurrentTime` pattern that was causing pydantic to fail validation.

## 0.0.6 (20250821)

- Enhancement: Add support for dumping `airalogy.types` pattern to JSON schema.

## 0.0.5 (20250804)

### 1. Refactoring

Marked the `airalogy.built_in_types` module as deprecated. Future built-in types will be uniformly defined in the `airalogy.types` module. All types defined in this module now support `pydantic.BaseModel` validation and provide corresponding JSON Schema generation with `airalogy_type` attributes.

### 2. New Type Support

```py
from airalogy.types import (
    SnakeStr,
    VersionStr,
    ProtocolId,
    RecordId,
    ATCG,
    FileIdDna,
)
```

- `SnakeStr`: Validates strings to conform to Python's snake_case naming convention.
- `VersionStr`: Validates strings to conform to Semantic Versioning (SemVer) specification.
- `ProtocolId`: Validates strings to conform to Airalogy Protocol ID specification.
- `RecordId`: Validates strings to conform to Airalogy Record ID specification.
- `ATCG`: Validates DNA sequence strings and provides complementary sequence functionality.
- `FileIdDna`: Supports uploading SnapGene DNA files (with `.dna` file extension).

## 0.0.4 (20250711)

- Added `airalogy.iso` module for converting common Python complex data types to ISO format strings.
- Added `timedelta_to_iso` function for converting `timedelta` objects to ISO 8601 format strings.
