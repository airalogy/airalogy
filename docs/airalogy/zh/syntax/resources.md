# 资源、库存与 Protocol 版本

Airalogy 定义可移植的资源数据契约；Airalogy Platform 这类宿主负责库存事务。这样，一个 AIMD Protocol 就可以描述质粒、试剂、样本、设备或其他学科资源，而不需要为每种资源动态创建数据库表。

## 资源定义 Protocol

在 `protocol.toml` 中设置 `kind = "resource_definition"`：

```toml
[airalogy_protocol]
id = "plasmid_resource_definition"
version = "1.0.0"
kind = "resource_definition"
name = "质粒资源定义"
```

`kind` 缺省为 `experiment`。资源定义可以包含 Markdown、`var`、`var_table`、文件字段、`EntityRef` 和确定性校验；不能包含实验步骤、quiz、workflow、Collector、client assigner 或 Python/云端 assigner。归档校验会拒绝违反这些规则的包。

资源定义 Protocol 只描述可版本化的学科字段。稳定资源 ID、资源状态、修订、批次、容器、位置、余额、数量预约、设备预约、权限与审计事件都属于宿主库存引擎。

## ResourceRef

实验 Protocol 在消耗、产出、引用或预约受管资源时使用 `ResourceRef[T]`：

```aimd
来源质粒：{{var|source_plasmid: ResourceRef["plasmid"], resource_role="input", quantity_field="plasmid_amount", container_required=True}}
用量：{{var|plasmid_amount: Decimal, ge=0}} mg
离心机：{{var|centrifuge: ResourceRef["equipment"], resource_role="equipment", booking_required=True}}
产出样本：{{var|output_sample: ResourceRef["sample"], resource_role="output"}}
```

每个 ResourceRef 字段都要用 `resource_role` 声明 `input`、`output`、`reference` 或 `equipment`。`quantity_field` 必须指向数值变量；`container_required` 用于库存资源；`booking_required` 用于设备。Python 与 npm parser 会共同校验这些引用。

保存值包含稳定的 `entity` 和 `id`，并可包含 `lot_id`、`container_id`、精确十进制 `quantity`、UCUM 兼容 `unit`、`reservation_id`、`booking_id`、显示用 `label`/`snapshot` 和资源修订 `version`。Python 使用 `Decimal`，并将数量序列化为 JSON 字符串，避免进入 JavaScript 后损失精度。

## Resolver 与事务边界

`AimdRecorder` 接受 `resourceResolvers`。Resolver 可以搜索和解析资源、返回批次/容器/设备时段等可用情况，并准备客户端生成 ID 的产出资源：

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

Recorder 只暂存 ResourceRef，不会自行扣减库存或创建持久化产出。宿主必须在同一个事务中验证引用、锁定库存、保存 Record、建立 Record-资源关联、追加消耗/产出事件并创建产出资源。

## 兼容性报告

发布新版本前比较两个生成的 JSON Schema：

```python
from airalogy.schema_compatibility import compare_json_schemas

report = compare_json_schemas(previous_schema, current_schema)
```

```ts
import { compareAimdJsonSchemas } from "@airalogy/aimd-core"

const report = compareAimdJsonSchemas(previousSchema, currentSchema)
```

结果为 `compatible`、`conditional`、`breaking` 或 `unknown`，包含字段级差异和 `patch`、`minor`、`major` 建议。仅文案/展示变化可用 patch；兼容的可选字段可用 minor；breaking、conditional 和 unknown 在宿主证明存在更安全的迁移路径前，都保守要求 major。

## Migration Manifest

Protocol 包可以通过 `migrations/*.json` 声明一个或多个版本迁移边，并使用有序规则完成字段改名、复制、删除和默认值填充：

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

创建 archive 时会校验每个 manifest、拒绝重复版本边，并验证包内相对路径 `transform.entrypoint` 所指源码的 SHA-256 是否与 `code_hash` 一致。核心库不会把函数导入应用进程；宿主必须在无网络、无密钥的沙箱中执行，并记录 manifest hash、代码 hash、源/目标版本、状态和问题。

迁移会创建新的 Record 或资源修订，永远不覆盖原始版本。历史数据始终按自己的 Protocol 版本有效。跨版本报表应使用派生 projection；旧版本没有采集的字段必须标为 `not_collected`，不能用默认值伪造历史数据。
