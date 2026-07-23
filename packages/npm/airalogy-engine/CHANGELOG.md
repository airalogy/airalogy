# @airalogy/airalogy-engine

## 0.0.4

### Patch Changes

- a6ca7a6: Execute Protocol schema migration manifests and verified pure transforms inside
  the Airalogy Engine sandbox without network access or injected secrets.

## 0.0.3

### Patch Changes

- 682ddf5: Add AIMD workflow runtime helpers for Node.js, including workflow YAML parsing, transition assignment execution, sandboxed workflow-level Python assigners, trusted local workflow assigner execution, transition output namespaces, Record draft updates, and `workflow_data.path_data.steps` Path timelines alongside the current Record snapshot.

## 0.0.2

### Patch Changes

- 4c57620: Point package homepage and documentation metadata at the unified Airalogy Pages docs.
- 5f318e1: Refine recorder var-field presentation by normalizing value typography across text, numeric, date/time, and select controls, clipping plain stacked-field corners consistently, and keeping table-cell input text upright.

  Add built-in file-like var controls for CSV, image, audio, video, and document types, including native file pickers, accept-type inference, serializable local file metadata, reusable file-card previews, and `uploadFile`/`resolveFileInfo` hooks so host apps can return Airalogy file IDs while the recorder renders filenames, sizes, download links, image previews, and compact CSV previews.

  Allow the Python `Airalogy` client to be configured with an explicit `base_url` while preserving environment-variable defaults, so local demos and self-hosted Airalogy-compatible services can use the same file APIs as hosted Airalogy. `AIRALOGY_BASE_URL` is the preferred environment variable; `AIRALOGY_ENDPOINT` remains supported as a deprecated fallback.

  Add a local file bridge for sandboxed engine runs so assigners can read uploaded Airalogy file IDs and write generated file outputs without requiring the sandbox to reach the host demo server over HTTP.

  Move generic assigner UI orchestration into `@airalogy/aimd-recorder` through a `serverAssigners` metadata prop and `runServerAssigner` hook, letting host apps provide only the execution transport while the recorder handles dependency filtering, loading/error state, and `assigned_fields` record updates.

  Surface server assigner business failures returned as `success: false` / `error_message` through the shared recorder assigner state, so built-in plugin fields such as `AiralogyMarkdown` show the same inline error UI as regular var fields.

  Limit engine assigner validation to each assigner's declared `dependent_fields`, so unrelated empty output fields in a record do not fail Pydantic validation before the selected assigner runs.

  Validate local engine rootfs directories as OCI layouts and export the generated rootfs with Docker Buildx OCI output, preventing incomplete rootfs directories from being treated as runnable sandboxes. The local rootfs build now installs the workspace `airalogy` Python package and includes that source in the rootfs fingerprint.
