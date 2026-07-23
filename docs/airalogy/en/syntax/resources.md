# Resources, Inventory, and Protocol Versions

Airalogy defines the portable contract for resource data; a host such as Airalogy Platform owns inventory transactions. This separation lets one AIMD Protocol describe plasmids, reagents, samples, equipment, or another discipline-specific resource without creating a new database table for every type.

## Resource Definition Protocols

Set `kind = "resource_definition"` in `protocol.toml`:

```toml
[airalogy_protocol]
id = "plasmid_resource_definition"
version = "1.0.0"
kind = "resource_definition"
name = "Plasmid Resource Definition"
```

The default kind is `experiment`. A resource definition may contain Markdown, `var`, `var_table`, file fields, `EntityRef`, and deterministic validation. It must not contain experimental steps, quiz blocks, workflows, Collectors, client assigners, or Python/cloud assigners. Archive validation rejects packages that violate these rules.

Resource definition Protocols only describe versioned discipline fields. Stable resource ids, resource status, revisions, lots, containers, locations, balances, reservations, bookings, permissions, and audit events belong to the host inventory engine.

## ResourceRef

Use `ResourceRef[T]` in an experimental Protocol when a Record consumes, produces, references, or books a managed resource:

```aimd
Source plasmid: {{var|source_plasmid: ResourceRef["plasmid"], resource_role="input", quantity_field="plasmid_amount", container_required=True}}
Amount: {{var|plasmid_amount: Decimal, ge=0}} mg
Centrifuge: {{var|centrifuge: ResourceRef["equipment"], resource_role="equipment", booking_required=True}}
Output sample: {{var|output_sample: ResourceRef["sample"], resource_role="output"}}
```

Every ResourceRef field declares `resource_role` as `input`, `output`, `reference`, or `equipment`. `quantity_field` must name a numeric variable. `container_required` is valid for inventory resources; `booking_required` is valid for equipment. Python and npm parsers validate these references.

A stored value contains a stable `entity` and `id`, with optional `lot_id`, `container_id`, exact decimal `quantity`, UCUM-compatible `unit`, `reservation_id`, `booking_id`, display `label`/`snapshot`, and a resource revision `version`. Python exposes quantity as `Decimal` and serializes it as a JSON string so JavaScript cannot truncate it.

## Host Resolver and Transaction Boundary

`AimdRecorder` accepts `resourceResolvers`. A resolver can search and resolve resources, return availability with lots, containers, and equipment slots, and prepare a client-generated output resource:

```ts
const resourceResolvers = {
  plasmid: {
    search: query => api.searchResources("plasmid", query),
    resolve: id => api.getResource(id),
    getAvailability: resource => api.getAvailability(resource.id),
  },
  sample: {
    search: query => api.searchResources("sample", query),
    prepareOutput: draft => api.prepareOutput(draft),
  },
}
```

The Recorder only stages ResourceRef values. It never decrements inventory or creates a durable output by itself. The host must validate references, lock inventory, save the Record, create Record-resource links, append consumption/production events, and create output resources in one transaction.

## Compatibility Reports

Compare two generated JSON Schemas before publishing:

```python
from airalogy.schema_compatibility import compare_json_schemas

report = compare_json_schemas(previous_schema, current_schema)
```

```ts
import { compareAimdJsonSchemas } from "@airalogy/aimd-core"

const report = compareAimdJsonSchemas(previousSchema, currentSchema)
```

The result is `compatible`, `conditional`, `breaking`, or `unknown`, includes field-level changes, and recommends `patch`, `minor`, or `major`. Annotation-only changes are patch candidates; optional compatible fields are minor candidates; breaking, conditional, and unknown changes conservatively require a major release until a host proves a safer migration path.

## Migration Manifests

A Protocol package may declare one or more version edges as `migrations/*.json`, using ordered rename, copy, remove, and default rules:

```json
{
  "version": "airalogy.migration.v1",
  "from": "1.0.0",
  "to": "2.0.0",
  "operations": [
    { "op": "rename", "from": "var.old_name", "to": "var.name" },
    { "op": "set_default", "field": "var.status", "value": "active" }
  ]
}
```

Archive creation validates every manifest, rejects duplicate version edges, and verifies a declared package-relative `transform.entrypoint` against the source file's SHA-256 `code_hash`. The core library does not import that function into the application process. Hosts must execute it in a sandbox without network or secrets, then record the manifest hash, code hash, source and target versions, status, and issues.

Migration creates a new Record or resource revision; it never overwrites the original. Historical data remains valid under its original Protocol version. Cross-version reporting should use derived projections and represent fields that did not exist as `not_collected`, not as invented defaults.
