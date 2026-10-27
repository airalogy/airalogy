---
"airalogy-engine": patch
"@airalogy/airalogy-engine": patch
---

Track the Python core dependency in Changesets so core minor releases also update the engine package. Keep runtime and development dependency constraints, the Engine image version, and Python/Node/demo default image tags aligned when preparing release versions. Include both engine clients in this release so they use the updated core image.
