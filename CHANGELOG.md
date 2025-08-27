# CHANGELOG

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
