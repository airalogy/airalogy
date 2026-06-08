# Airalogy .aira Examples

These example archives are intended for quick Airalogy Reader testing.

| File | Archive kind | Contents |
| --- | --- | --- |
| `single-protocol.aira` | `protocol` | One Protocol, no Record |
| `protocols-bundle.aira` | `protocols` | Two Protocols, no Record |
| `records-with-protocol.aira` | `records` | One embedded Protocol and two Records |
| `multi-protocol-records.aira` | `records` | Two embedded Protocols and Records from both Protocols |

The source Protocol and Record fixtures live in `sources/` so these archives can be regenerated from the repository root when the `airalogy` CLI is available:

```bash
airalogy pack examples/aira/sources/protocols/contact-note -o examples/aira/single-protocol.aira -f
airalogy pack examples/aira/sources/protocols/contact-note examples/aira/sources/protocols/measurement-note -o examples/aira/protocols-bundle.aira -f
airalogy pack examples/aira/sources/records/contact-records.json -o examples/aira/records-with-protocol.aira --protocol-dir examples/aira/sources/protocols/contact-note -f
airalogy pack examples/aira/sources/records/mixed-records.json -o examples/aira/multi-protocol-records.aira --protocol-dir examples/aira/sources/protocols/contact-note --protocol-dir examples/aira/sources/protocols/measurement-note -f
```

Run Reader locally and open any of the generated `.aira` files:

```bash
pnpm dev:aira-reader
```
