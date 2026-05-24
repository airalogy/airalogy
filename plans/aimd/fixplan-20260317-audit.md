# AIMD Monorepo Fix Plan (2026-03 Audit Archive)

> Based on code audit conducted on 2026-03-17
> Repository: https://github.com/airalogy/airalogy
> Status: Historical maintenance plan retained for reference

---

## Progress Tracker

### P0 — Critical (Security / Correctness)

| # | Task | Package | Status | Branch |
|---|------|---------|--------|--------|
| 1.1 | Client assigner: 用 acorn AST 替换正则做 forbidden pattern 验证 | core | `[x]` | |
| 1.2 | Client assigner: 补充 Unicode escape 绕过的测试用例 | core + recorder | `[x]` | |
| 1.3 | ReDoS: 修复 `remark-aimd.ts:184` 内联模板正则 | core | `[x]` | |

### P1 — High (Test Coverage)

| # | Task | Package | Status | Branch |
|---|------|---------|--------|--------|
| 2.1 | 补 field-parsers 单元测试 (var/var_table/subvar 边界) | core | `[x]` | |
| 2.2 | 补 quiz-parser 测试 (YAML 校验/placeholder 匹配/类型分支) | core | `[x]` | |
| 2.3 | 补 step hierarchy 测试 (层级/兄弟链接/display indent) | core | `[x]` | |
| 2.4 | 补 fig-parser 测试 | core | `[x]` | |
| 2.5 | 补 client-assigner 编译+执行+沙箱逃逸测试 | recorder | `[x]` | vitest 22 tests |
| 2.6 | 补 useRecordState / useVarHelpers 测试 | recorder | `[x]` | vitest 167 tests |
| 2.7 | 补 useDnaSequence 测试 (GenBank export / GC% / circular) | recorder | `[x]` | vitest 53 tests |
| 2.8 | 补 editor UI 交互测试 (模式切换/内容同步) | editor | `[x]` | vitest 37 tests |
| 2.9 | 补 renderer custom renderer factory 测试 | renderer | `[x]` | vitest 23 tests |
| 2.10 | 配置 CI：vitest + coverage 阈值 gate | monorepo | `[x]` | vitest.config.ts + ci.yml |

### P2 — Medium (Code Quality)

| # | Task | Package | Status | Branch |
|---|------|---------|--------|--------|
| 3.1 | 拆分 `AimdRecorder.vue` (1523L) → composables + 子组件 | recorder | `[x]` | 952L + 6 files |
| 3.2 | 拆分 `AimdDnaSequenceField.vue` (1792L) → viewer/editor/toolbar | recorder | `[x]` | 983L + 5 files |
| 3.3 | 拆分 `AimdEditor.vue` (1491L) → source/wysiwyg/toolbar 子组件 | editor | `[x]` | 708L + 5 files |
| 3.4 | 拆分 `processor.ts` (1373L) → annotation/highlighting/step 模块 | renderer | `[x]` | 873L + 4 files |
| 3.5 | `hastToVue()` async renderer 静默丢弃 → 返回 Promise 或 dev warning | renderer | `[x]` | |
| 3.6 | Quiz preview context 逻辑三处重复 → 提取 `resolveQuizPreviewOptions()` | renderer | `[x]` | |
| 3.7 | Monaco language 重复注册 → 加 dedup guard | editor | `[x]` | 已有 guard |

### P3 — Low (Robustness / Polish)

| # | Task | Package | Status | Branch |
|---|------|---------|--------|--------|
| 4.1 | field-parsers: kwargs 支持转义引号 `\"` | core | `[x]` | |
| 4.2 | 默认值类型校验 (e.g. `int = "abc"` 应报错) | core | `[x]` | |
| 4.3 | Step hierarchy: 校验连续层级 (不允许 1→3 跳级) | core | `[-]` | 保持宽容 |
| 4.4 | assigner graph: 扩展到 runtime 内循环检测 | core | `[x]` | 已有 DFS |
| 4.5 | SeqViz viewer: debounce deep watch 防过度渲染 | recorder | `[x]` | |
| 4.6 | Textarea height sync: 用 `nextTick()` 后再读 `scrollHeight` | recorder | `[-]` | 已是标准模式 |
| 4.7 | 导出内部类型 `AimdElementData`、`FigureContext` 供外部扩展 | renderer | `[x]` | |
| 4.8 | Assigner syntax highlighting theme 允许自定义 (目前 hardcoded github-light) | renderer | `[-]` | 低优先级 |
| 4.9 | Block menu 组件卸载时 click listener 泄漏修复 | editor | `[x]` | |
| 4.10 | `monacoOptions` prop 添加 key 黑名单校验 | editor | `[x]` | |

### P4 — Documentation

| # | Task | Package | Status | Branch |
|---|------|---------|--------|--------|
| 5.1 | 补 API Reference 文档 (类型/接口/函数签名) | docs | `[x]` | docs/en/api-reference.md |
| 5.2 | 补跨包集成示例 (editor + renderer + recorder 联动) | docs | `[x]` | docs/en/integration.md |
| 5.3 | 补 troubleshooting / FAQ 页面 | docs | `[x]` | docs/en/troubleshooting.md |
| 5.4 | 补 CONTRIBUTING.md (开发/测试/发布流程) | monorepo | `[x]` | CONTRIBUTING.md |

---

## Detailed Descriptions

### P0 — Critical

#### 1.1 Client assigner AST 验证

**现状**: `aimd-core/src/parser/client-assigner-syntax.ts` 用正则匹配 `eval`、`window`、`fetch` 等 forbidden patterns。
**问题**: Unicode escape (`e\u0076al()`) 可绕过正则检测。
**方案**: `acorn` 已在 dependencies 中但未用于验证。改为：
1. 用 acorn 解析 function source 为 AST
2. 遍历 AST 检查 `CallExpression` / `MemberExpression` 中是否出现 forbidden identifiers
3. 保留正则作为 fast-path 初筛，AST 作为 final validation

**文件**:
- `packages/aimd-core/src/parser/client-assigner-syntax.ts`

#### 1.3 ReDoS 修复

**现状**: `remark-aimd.ts:184` 的正则 `\{\{(var_table|var|...)\\s*\\|\\s*([^}]+?)\\s*\}\}` 有 `eslint-disable regexp/no-super-linear-backtracking`。
**方案**:
- 将 `([^}]+?)` 改为 `([^}]+)` (贪婪匹配，因为后面是 `\}\}` 不会误匹配)
- 或者改用两阶段匹配：先找 `{{...}}`，再内部解析 keyword|content

**文件**:
- `packages/aimd-core/src/parser/remark-aimd.ts`

---

### P1 — Test Coverage

#### 2.10 CI 配置

**方案**:
1. 根目录添加 `vitest.workspace.ts` 配置
2. 各包添加 `vitest.config.ts`
3. GitHub Actions workflow: `pnpm test` + coverage report
4. 设置 coverage 阈值 (初始 statements 50%，逐步提高)

**文件**:
- `.github/workflows/ci.yml`
- `vitest.workspace.ts`
- `packages/*/vitest.config.ts`

---

### P2 — Code Quality

#### 3.1 AimdRecorder.vue 拆分

**现状**: 1523 行单文件，混合了渲染逻辑、client assigner 调度、table drag-drop、focus management。
**方案**:
```
AimdRecorder.vue (入口, ~300L)
├── composables/useClientAssignerRunner.ts (assigner 调度)
├── composables/useVarTableDragDrop.ts (table 拖拽)
├── composables/useFieldRendering.ts (field VNode 构建)
└── components/
    ├── AimdVarField.vue (单变量渲染)
    ├── AimdVarTableField.vue (表格渲染)
    └── AimdStepCheckField.vue (步骤/检查)
```

#### 3.4 processor.ts 拆分

**现状**: 1373 行，混合了 markdown pipeline 构建、HAST annotation、assigner code highlighting、step sequence 注入。
**方案**:
```
processor.ts (~400L, pipeline 构建 + 导出)
├── annotateStepReferences.ts (step sequence 注入)
├── assignerHighlighting.ts (Shiki 代码高亮)
├── assignerVisibility.ts (hidden/collapsed/expanded 策略)
└── figureNumbering.ts (fig 序号分配)
```

---

### P3 — Robustness

#### 4.2 默认值类型校验

**现状**: `parseVarDefinition()` 不校验 default 值与声明类型的匹配。
**方案**: 添加可选 `strict` 参数：
- `int` → 检查 `Number.isInteger()`
- `float` → 检查 `!isNaN()`
- `bool` → 检查 `true/false/0/1`
- `date` → 检查 ISO date pattern
- 不匹配时收集到 warnings 数组（不 throw，向后兼容）

---

## How to Use This Plan

### Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done
- `[-]` — Won't fix / Deferred

### Workflow

1. 按 P0 → P1 → P2 → P3 → P4 优先级推进
2. 每个 task 开一个 branch，完成后 PR 到 main
3. PR title 格式: `fix(core): #1.1 use acorn AST for assigner validation`
4. 完成后在 Status 列打 `[x]`，填写 Branch 列

### Estimated Effort

| Priority | Tasks | Estimated Days |
|----------|-------|----------------|
| P0 Critical | 3 | 2-3 |
| P1 Tests | 10 | 5-7 |
| P2 Refactor | 7 | 4-5 |
| P3 Polish | 10 | 3-4 |
| P4 Docs | 4 | 2-3 |
| **Total** | **34** | **16-22** |
