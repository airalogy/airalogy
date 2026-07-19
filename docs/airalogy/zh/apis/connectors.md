# Connectors API

`airalogy.connectors` 提供显式启用的运行时 helper，用于执行 fenced [`connectors` 代码块](/zh/syntax/connectors) 中声明的 connector metadata。AIMD parser 本身仍然是离线、metadata-only 的；只有后端工具或可信运行时主动调用这些 helper 时，才会加载 descriptor 并请求 endpoint。

## Entity Source Connectors

```py
from airalogy.connectors import (
    EntitySourceConnector,
    create_entity_source_connectors_from_aimd,
    load_connector_env_file,
)
```

如果手上已经有 AIMD 内容，可以用 `create_entity_source_connectors_from_aimd()` 把每个 `kind: entity_source` connector 暴露成一个可执行对象：

```py
connectors = create_entity_source_connectors_from_aimd(
    protocol_aimd,
    base_dir=protocol_dir,
    env_file=protocol_dir / ".env",
)

options = connectors["lab_plasmid_registry"].search("pUC")
parent = connectors["lab_plasmid_registry"].resolve("pUC19")
```

如果宿主已经解析好了 connector metadata，也可以直接使用 `EntitySourceConnector`：

```py
connector = EntitySourceConnector(
    parsed_connector,
    base_dir=protocol_dir,
    env={"LAB_PLASMID_TOKEN": token},
)
```

`search()` 和 `resolve()` 都会返回兼容 `EntityRef` 的字典，例如 `{ "entity": "plasmid", "source": "lab_plasmid_registry", "id": "pUC19", "label": "pUC19 cloning vector" }`。

## Descriptor 结构

当前支持的 descriptor 结构有意保持小而声明式：

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

`search.query_param` 默认是 `q`。`resolve.url` 可以包含 `{id}`；如果没有包含 `{id}`，可以用 `resolve.id_param` 指定查询参数名。响应可以是数组、包含 `items`、`results`、`records` 或 `data` 的对象，也可以是单个对象。`items_path` 可以指向类似 `data.items` 这样的嵌套数组。

## Secret

Connector descriptor 和 AIMD 文件都不能包含 token 或 password。运行时 helper 会从 `env`、`env_file`，或在没有显式传 `env` 时从进程环境读取 `auth.token_env`：

```py
connector = EntitySourceConnector(
    parsed_connector,
    env_file=protocol_dir / ".env",
)
```

`auth.type: bearer` 会发送 `Authorization: Bearer <token>`。`auth.type: api_key` 默认用 `X-API-Key` 发送 token，也可以通过 `auth.header` 指定其他 header。加载 descriptor 本身不会要求 endpoint token；只有执行 `search()` 或 `resolve()` 请求时才会读取 token。
