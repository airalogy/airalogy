# Connectors Blocks

`connectors` blocks declare protocol-level connector metadata for fields that reference data outside the current Record, such as a plasmid registry, a sample inventory, a LIMS table, or Records from another Protocol.

The block is metadata only. Parsers read and validate the declaration, but they do not fetch descriptors, call APIs, resolve ids, execute code, or read secrets. Runtime tools decide how to bind a declared connector to an actual service.

## Syntax

Use a fenced `connectors` block whose body is YAML:

````aimd
```connectors
lab_plasmid_registry:
  kind: entity_source
  entity: plasmid
  descriptor: https://lims.example.com/airalogy/entity-sources/plasmid.json
  auth:
    token_env: LAB_PLASMID_TOKEN
```

Source plasmids: {{var|parent_plasmids: list[EntityRef] | None, title="Source plasmids", entity="plasmid", source="lab_plasmid_registry"}}
````

The connector id (`lab_plasmid_registry`) is a stable protocol-local name. The field references that connector through `source="lab_plasmid_registry"`, while `entity="plasmid"` tells recorder UIs what kind of entity the field stores.

`version` is optional and defaults to `1`. Older documents that wrap entries under a top-level `connectors:` mapping are still accepted, but new protocols should put connector ids directly at the top level of the block.

## Entity Reference Fields

Use `EntityRef` for a single related entity and `list[EntityRef]` for multiple related entities:

```md
Parent plasmid: {{var|parent_plasmid: EntityRef | None, entity="plasmid", source="lab_plasmid_registry"}}
Parent plasmids: {{var|parent_plasmids: list[EntityRef] | None, entity="plasmid", source="lab_plasmid_registry"}}
```

The recommended form keeps `entity` and `source` as AIMD field metadata because that metadata is easy for parsers, recorders, and host apps to inspect without evaluating Python type expressions. `EntityRef["plasmid"]` is accepted as a convenience type annotation, but protocol authors should prefer the metadata form above.

An `EntityRef` value is stored as a JSON object:

```json
{
  "entity": "plasmid",
  "source": "lab_plasmid_registry",
  "id": "pUC19",
  "label": "pUC19 cloning vector"
}
```

Only `entity` and `id` are required by the reference value. `source` records the connector that resolved the id when available. `label` is an optional display snapshot, and recorder UIs should fall back to `id` when `label` is missing. `snapshot` may be included as an optional JSON object when a host wants to preserve more display context from the source.

## Security

Do not put tokens, passwords, API keys, or bearer values inside AIMD. If a connector needs authentication, declare the environment variable name that contains the secret:

```yaml
auth:
  token_env: LAB_PLASMID_TOKEN
  # type: bearer
```

When `auth.token_env` is present and `auth.type` is omitted, parsers normalize the auth scheme to `bearer`. Inline secret keys such as `token`, `password`, `api_key`, and `client_secret` are rejected. A `.env` file or deployment secret manager can provide `LAB_PLASMID_TOKEN` to the runtime, but the protocol itself remains shareable.

## Package Layout With `.env`

A protocol that connects to an external plasmid registry can use this layout:

```text
plasmid-modification-protocol/
├─ protocol.aimd
├─ .env.example
└─ connectors/
   └─ plasmid.yaml
```

`protocol.aimd` declares the connector and the field that uses it:

````aimd
```connectors
lab_plasmid_registry:
  kind: entity_source
  entity: plasmid
  descriptor: ./connectors/plasmid.yaml
  auth:
    token_env: LAB_PLASMID_TOKEN
```

# Plasmid Modification Record

Source plasmids:
{{var|parent_plasmids: list[EntityRef] | None, title="Source plasmids", entity="plasmid", source="lab_plasmid_registry"}}
````

`.env.example` can be committed and shared so collaborators know which variables they need to define:

```bash
LAB_PLASMID_TOKEN=
```

For local use, copy it to `.env` and provide the real token:

```bash
LAB_PLASMID_TOKEN=your-real-token
```

`connectors/plasmid.yaml` stores the shareable connector descriptor and does not contain secrets:

```yaml
entity: plasmid
search:
  method: GET
  url: https://lims.example.com/api/plasmids
  query_param: q
resolve:
  method: GET
  url: https://lims.example.com/api/plasmids/{id}
```

Runtime tools or host applications decide how to execute this descriptor. Resolved options should be normalized to `EntityRef`-compatible objects with at least `id`; `label` and `snapshot` are optional display data.

`protocol.aimd`, `connectors/plasmid.yaml`, and `.env.example` can be committed and shared. The real `.env` should not be committed and should not be included by default in a public `.aira` archive. Runtime tools can read `LAB_PLASMID_TOKEN` from `.env` or a deployment secret manager, then attach the token to connector requests according to the auth settings.

For `.aira` archives, the public package should still contain only non-secret files:

```text
plasmid-modification.aira
├─ protocol.aimd
├─ connectors/
│  └─ plasmid.yaml
└─ .env.example
```

The real `.env` remains outside the runtime package.

## Runtime Binding

`connectors` does not require every Airalogy installation to support every possible entity type. `entity: plasmid` is user-defined metadata, not a hard-coded Airalogy type. A host application can bind the declared connector to a search/resolve implementation, and `@airalogy/aimd-recorder` can use that binding to render an entity picker for `EntityRef` fields.

This keeps the protocol portable: the same AIMD can be parsed without network access, while richer hosts can attach live database-backed selection UI.
