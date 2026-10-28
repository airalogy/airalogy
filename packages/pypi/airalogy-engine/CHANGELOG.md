# Changelog

## 0.0.10

### Patch Changes

- 0bde6d6: Track the Python core dependency in Changesets so core minor releases also update the engine package. Keep runtime and development dependency constraints, the Engine image version, and Python/Node/demo default image tags aligned when preparing release versions. Include both engine clients in this release so they use the updated core image.
- Updated dependencies [d983aca]
- Updated dependencies [d983aca]
- Updated dependencies [d983aca]
- Updated dependencies [d983aca]
  - airalogy@0.17.0

## 0.0.9

### Patch Changes

- bfc2add: Use the versioned official multi-architecture Airalogy Engine image from GHCR by default instead of legacy architecture-specific Docker Hub tags.

## 0.0.8

### Patch Changes

- a6ca7a6: Execute Protocol schema migration manifests and verified pure transforms inside
  the Airalogy Engine sandbox without network access or injected secrets.

## 0.0.7

### Patch Changes

- Publish the engine package with its Airalogy 0.16 compatibility constraint so downstream applications can upgrade without bypassing dependency resolution.

## 0.0.6

### Patch Changes

- c13e771: Add `AiralogyWorkflowEngine` for executing AIMD workflow transition assignments, including workflow-level Python assigners, transition output namespaces, target Record drafts, conditions, and iteration limits.

## 0.0.4

### Patch Changes

- 4c57620: Point package homepage and documentation metadata at the unified Airalogy Pages docs.

## 0.0.3

### Patch Changes

- Move the Python Airalogy Engine package into the Airalogy monorepo.
