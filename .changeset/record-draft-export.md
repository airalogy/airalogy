---
"@airalogy/aira-core": minor
---

Add `createRecordsAiraArchive` to package records with a shared embedded protocol snapshot, record hashes, and deduplicated attachment blobs. Callers retain ownership of record identity, versions, and protocol validation.

The AIMD demo now restores template and record drafts together, separates saving templates from saving records, and exports the current filled record as a portable `.aira` archive.
