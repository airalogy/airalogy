# Connectors API

`airalogy.connectors` provides opt-in runtime helpers for connector metadata declared in fenced [`connectors` blocks](/en/syntax/connectors). The AIMD parser remains offline and metadata-only; these helpers are used only by backend tools or trusted runtimes that explicitly choose to load descriptors and call endpoints.

## Entity Source Connectors

```py
from airalogy.connectors import (
    EntitySourceConnector,
    create_entity_source_connectors_from_aimd,
    load_connector_env_file,
)
```

Use `create_entity_source_connectors_from_aimd()` when you already have AIMD content and want every `kind: entity_source` connector exposed as a small executable object:

```py
connectors = create_entity_source_connectors_from_aimd(
    protocol_aimd,
    base_dir=protocol_dir,
    env_file=protocol_dir / ".env",
)

options = connectors["lab_plasmid_registry"].search("pUC")
parent = connectors["lab_plasmid_registry"].resolve("pUC19")
```

Use `EntitySourceConnector` directly when a host has already parsed connector metadata:

```py
connector = EntitySourceConnector(
    parsed_connector,
    base_dir=protocol_dir,
    env={"LAB_PLASMID_TOKEN": token},
)
```

Both `search()` and `resolve()` return `EntityRef`-compatible dictionaries such as `{ "entity": "plasmid", "source": "lab_plasmid_registry", "id": "pUC19", "label": "pUC19 cloning vector" }`.

## Descriptor Shape

The supported descriptor shape is intentionally small and declarative:

```yaml
entity: plasmid
search:
  method: GET
  url: https://lims.example.com/api/plasmids
  query_param: q
  items_path: data.items
  field_map:
    id: plasmid_id
    label: display_name
resolve:
  method: GET
  url: https://lims.example.com/api/plasmids/{id}
```

`search.query_param` defaults to `q`. `resolve.url` may include `{id}`; if it does not, `resolve.id_param` can name the query parameter. Responses may be arrays, objects with `items`, `results`, `records`, or `data`, or a single object. `items_path` can point to a nested array such as `data.items`.

## Secrets

Connector descriptors and AIMD files must not contain tokens or passwords. Runtime helpers read `auth.token_env` from `env`, `env_file`, or the process environment when no explicit `env` is passed:

```py
connector = EntitySourceConnector(
    parsed_connector,
    env_file=protocol_dir / ".env",
)
```

`auth.type: bearer` sends `Authorization: Bearer <token>`. `auth.type: api_key` sends the token in `X-API-Key` unless `auth.header` names a different header. Descriptor loading itself does not require the endpoint token; the token is read only when `search()` or `resolve()` executes a request.
