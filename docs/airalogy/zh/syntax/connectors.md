# Connectors 代码块

`connectors` 代码块用于声明 Protocol 级别的连接器 metadata，适合描述当前 Record 之外的数据来源，例如质粒库、样本库存、LIMS 表，或另一个 Protocol 下的 Records。

这个代码块只保存 metadata。Parser 只解析和校验声明，不会拉取 descriptor、不调用 API、不解析 id、不执行代码，也不会读取 secret。具体如何把一个 connector 绑定到真实服务，由运行时工具或宿主应用决定。

## 语法

使用 fenced `connectors` 代码块，块内内容为 YAML：

````aimd
```connectors
lab_plasmid_registry:
  kind: entity_source
  entity: plasmid
  descriptor: https://lims.example.com/airalogy/entity-sources/plasmid.json
  auth:
    token_env: LAB_PLASMID_TOKEN
```

来源质粒：{{var|parent_plasmids: list[EntityRef] | None, title="来源质粒", entity="plasmid", source="lab_plasmid_registry"}}
````

connector id（例如 `lab_plasmid_registry`）是 Protocol 内稳定使用的名字。字段通过 `source="lab_plasmid_registry"` 引用这个 connector，通过 `entity="plasmid"` 告诉 recorder UI 这个字段保存的是哪类实体。

`version` 是可选字段，不写时默认为 `1`。旧文档里如果把 connector 条目包在顶层 `connectors:` 下，parser 仍然兼容；新 Protocol 建议把 connector id 直接写在这个 block 的顶层。

## EntityRef 字段

单个关联实体使用 `EntityRef`，多个关联实体使用 `list[EntityRef]`：

```md
来源质粒：{{var|parent_plasmid: EntityRef | None, entity="plasmid", source="lab_plasmid_registry"}}
来源质粒列表：{{var|parent_plasmids: list[EntityRef] | None, entity="plasmid", source="lab_plasmid_registry"}}
```

推荐把 `entity` 和 `source` 写成 AIMD 字段 metadata，因为 parser、recorder 和宿主应用都可以直接读取这些 metadata，不需要求值 Python 类型表达式。`EntityRef["plasmid"]` 也可以作为兼容和便利写法，但 Protocol 作者应优先使用上面的 metadata 写法。

`EntityRef` 的保存值是一个 JSON 对象：

```json
{
  "entity": "plasmid",
  "source": "lab_plasmid_registry",
  "id": "pUC19",
  "label": "pUC19 cloning vector"
}
```

保存值里只有 `entity` 和 `id` 是引用结构的必需字段。`source` 用于记录解析出这个 id 的 connector；`label` 是可选的显示快照，缺失时 recorder UI 应回退显示 `id`；`snapshot` 也可以作为可选 JSON 对象保存更多当时从数据源拿到的展示上下文。

## 安全规则

不要把 token、password、API key 或 bearer 值直接写入 AIMD。如果 connector 需要认证，只声明保存 secret 的环境变量名：

```yaml
auth:
  token_env: LAB_PLASMID_TOKEN
  # type: bearer
```

当存在 `auth.token_env` 但省略 `auth.type` 时，parser 会把认证方式归一化为 `bearer`。`token`、`password`、`api_key`、`client_secret` 这类内联 secret key 会被拒绝。`.env` 文件或部署环境的 secret manager 可以提供 `LAB_PLASMID_TOKEN`，但 Protocol 本身仍然可以安全共享。

## 带 `.env` 的文件结构

一个需要连接外部质粒库的 Protocol 可以使用这样的文件结构：

```text
plasmid-modification-protocol/
├─ protocol.aimd
├─ .env.example
└─ connectors/
   └─ plasmid.yaml
```

`protocol.aimd` 声明 connector 和字段引用：

````aimd
```connectors
lab_plasmid_registry:
  kind: entity_source
  entity: plasmid
  descriptor: ./connectors/plasmid.yaml
  auth:
    token_env: LAB_PLASMID_TOKEN
```

# 质粒改造记录

来源质粒：
{{var|parent_plasmids: list[EntityRef] | None, title="来源质粒", entity="plasmid", source="lab_plasmid_registry"}}
````

`.env.example` 可以提交和分享，用来告诉协作者需要哪些环境变量：

```bash
LAB_PLASMID_TOKEN=
```

本地运行时复制一份 `.env`，并填入真实 token：

```bash
LAB_PLASMID_TOKEN=your-real-token
```

`connectors/plasmid.yaml` 保存可共享的 connector descriptor，不包含 secret：

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

运行时工具或宿主应用决定如何执行这个 descriptor。解析出来的候选项应归一化成兼容 `EntityRef` 的对象，至少提供 `id`；`label` 和 `snapshot` 是可选展示数据。运行时执行 API 不在语法页展开；Python 工具见 [Connectors API](/zh/apis/connectors)，npm resolver helper 见 [@airalogy/aimd-core](https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-core/)。

`protocol.aimd`、`connectors/plasmid.yaml` 和 `.env.example` 可以提交和分享；真实 `.env` 不应该提交，也不应该默认打进公开 `.aira` 包。需要认证时，由具体运行环境提供 `LAB_PLASMID_TOKEN`。

如果打包成 `.aira`，公开包内也只应包含非 secret 文件：

```text
plasmid-modification.aira
├─ protocol.aimd
├─ connectors/
│  └─ plasmid.yaml
└─ .env.example
```

真实 `.env` 仍然留在运行环境外部。

## 宿主绑定边界

`connectors` 不要求 Airalogy 内置支持无限多实体类型。`entity: plasmid` 是用户自定义 metadata，不是 Airalogy 写死的类型。宿主应用可以把这个 connector 绑定到自己的 search/resolve 实现，并据此为 `EntityRef` 字段渲染实体选择控件。

这样 Protocol 可以保持可移植：没有网络访问时也能正常解析；更完整的宿主工具则可以接入实时数据库选择体验。
