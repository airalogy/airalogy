# Airalogy Spec Fixtures

This directory contains protocol fixtures shared by the Python, npm, and runtime packages.

Every compatibility-sensitive AIMD syntax or record behavior should land here first, then be
validated by the relevant implementation packages.

## Layout

- `fixtures/`: concrete protocol directories with `protocol.aimd`, optional `protocol.toml`,
  and expected machine-readable outputs.
- `fixtures/protocols/`: complete Airalogy Protocol fixtures migrated from the former
  standalone `airalogy/protocols` repository for regression and compatibility coverage.
- `contract-tests/`: reserved for cross-package orchestration that does not naturally belong
  to a single package test suite.
