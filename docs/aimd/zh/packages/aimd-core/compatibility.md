# 迁移说明

从 `@airalogy/aimd-core` 2.0.0 开始，解析后的 AIMD 节点和字段提取结果不再暴露旧的 `name` 别名。

## 对应替换关系

- `AimdNode.name` -> `AimdNode.id`
- `AimdVarTableField.name` -> `AimdVarTableField.id`
- `AimdSubvar.name` -> `AimdSubvar.id`
- `AimdStepField.name` -> `AimdStepField.id`
- `AimdStepField.parentName` -> `AimdStepField.parent_id`
- `AimdStepField.prevName` -> `AimdStepField.prev_id`
- `AimdStepField.nextName` -> `AimdStepField.next_id`
- `AimdTemplateEnv.record.byName` -> `AimdTemplateEnv.record.byId`
- `renderer data-aimd-name` -> `renderer data-aimd-id`

## 升级时需要修改的地方

1. 所有标识符统一改为读取 `id`。
2. 层级关系查询统一改为 `parent_id` / `prev_id` / `next_id`。
3. 如果你依赖 renderer 的 DOM 元数据，选择器和读取逻辑都改成 `data-aimd-id`。
4. 如果你封装过 template env，`record.byName` 也要同步改成 `record.byId`。
