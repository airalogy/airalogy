---
"@airalogy/aimd-recorder": minor
"airalogy": patch
---

Refine recorder var-field presentation by normalizing value typography across text, numeric, date/time, and select controls, clipping plain stacked-field corners consistently, and keeping table-cell input text upright.

Add built-in file-like var controls for CSV, image, audio, video, and document types, including native file pickers, accept-type inference, serializable local file metadata, and an `uploadFile` hook for host apps to return Airalogy file IDs.

Allow the Python `Airalogy` client to be configured with an explicit `base_url` while preserving environment-variable defaults, so local demos and self-hosted Airalogy-compatible services can use the same file APIs as hosted Airalogy. `AIRALOGY_BASE_URL` is the preferred environment variable; `AIRALOGY_ENDPOINT` remains supported as a deprecated fallback.
