# AIMD 发布与 Changesets 说明

本文面向中文开发者，说明本仓库里 `Changesets` 的用途、日常使用方式，以及自动发布的大致机制。

## 为什么要用 Changesets

本仓库是一个 `pnpm` monorepo，包含多个可发布包：

- `@airalogy/aimd-core`
- `@airalogy/aimd-editor`
- `@airalogy/aimd-renderer`
- `@airalogy/aimd-recorder`

这些包之间存在依赖关系。一个功能或修复经常会同时改动多个包，如果继续手动维护每个包的版本号和 changelog，容易出现：

- 漏改某个包的版本
- 内部依赖版本范围没有同步
- changelog 和实际改动不一致
- 一个 PR 改多个包时，很难统一决定 release 影响

`Changesets` 的作用，就是把“这次改动将来该怎么发版”提前记录成一个可审阅文件，然后在真正 release 时统一计算版本、更新 changelog 并发布。

## Changeset 文件是什么

每次一个 PR 如果影响了已发布包的外部行为，就新增一个 `.changeset/*.md` 文件，例如：

```md
---
'@airalogy/aimd-core': minor
'@airalogy/aimd-renderer': minor
'@airalogy/aimd-recorder': patch
---

Add quiz grading support across parser, renderer, and recorder.
```

这个文件记录两件事：

1. 哪些包受影响
2. 每个包该做 `major` / `minor` / `patch` 哪种版本变更

下面那段摘要文字会在 release 时用于生成 changelog。

这个文件不会立刻发布 npm，它只是 release 意图记录。等 release PR 生成并消费它之后，这个文件通常会被删除。

## 日常开发流程

正常功能开发时：

1. 完成代码改动
2. 判断是否影响 publishable package 的已发布行为
3. 如果影响，请运行：

```bash
corepack pnpm changeset:add
```

4. 选择所有受影响的 publishable package
5. 为每个包选择合适的 SemVer bump 级别
6. 写一段简短 summary
7. 将生成的 `.changeset/*.md` 文件和代码一起提交

## 什么时候需要加 changeset

通常需要：

- Public API 或导出类型变化
- 用户可观察到的运行时行为变化
- parser / renderer 输出变化
- 下游真实消费到的构建产物变化
- 新增向后兼容能力、props、选项、入口或组件

通常不需要：

- 只改测试
- 只改文档
- 纯内部重构且不影响外部行为
- 不影响包运行时/API 的 CI、tooling、配置改动

## 怎么判断 major / minor / patch

`patch`

- 修 bug，但不改公开 API
- 样式、文案、交互修正
- 现有行为更稳定，但语义不变

`minor`

- 新增向后兼容能力
- 新增导出
- 新增可选 props / options / 支持的新语法能力

`major`

- 删除或重命名公开 API
- 改了现有行为并且会破坏下游
- 改 parser / renderer 输出结构，导致调用方需要改代码
- 改 package entry / exports，导致原有 import 失效

## 多包改动怎么处理

在这个仓库里，一个功能同时影响多个包是正常情况。

例如你同时改了：

- `aimd-core` 的解析结构
- `aimd-renderer` 对这个结构的渲染
- `aimd-recorder` 对这个结构的 UI 展示

那通常应该写成一个多包 changeset，而不是分散成多个不相关的版本调整。

经验上，可以这样判断：

- 哪个 npm 包的用户能感知到变化，就把哪个包列进 changeset
- 一个功能如果是同一个发布单元，优先使用一个多包 changeset

## 内部依赖怎么联动

仓库内的 `@airalogy/aimd-*` 包之间使用 workspace 依赖。

开发时它们仍然走本地 workspace 链接；发布时，pnpm 会把这些 workspace 依赖转换成正常 semver 范围。

因此日常开发时：

- 不要手动频繁改内部依赖版本号
- 不要在正常功能 PR 里手动维护 changelog
- 让 `Changesets` 在 release 阶段统一处理版本号、内部依赖范围和 changelog

## 自动发布机制

仓库已经配置了 GitHub Actions release workflow。

整体流程是：

1. 功能 PR 合并到 `main`
2. 如果仓库里存在未消费的 changesets，Action 自动创建或更新 release PR
3. release PR 中会统一更新：
   - 各包 `package.json` 的 `version`
   - 各包 `CHANGELOG.md`
   - 需要联动的内部依赖范围
4. 合并 release PR
5. workflow 自动将待发布包发布到 npm

## 常用命令

新增 changeset：

```bash
corepack pnpm changeset:add
```

查看当前 release 计划：

```bash
corepack pnpm changeset:status
```

本地生成版本与 changelog（通常只在 release 维护场景下使用）：

```bash
corepack pnpm changeset:version
```

本地执行发布（通常由 CI 完成）：

```bash
corepack pnpm release
```

## 对 AI / 开发者最重要的规则

- 正常功能开发时，不要手动 bump 包版本
- 正常功能开发时，不要手动编辑包 changelog
- 一个功能可以同时影响多个 publishable package
- 如果影响已发布行为，就补一个 changeset
- 如果一个功能同时影响多个包，优先用一个多包 changeset 表达整个 release 单元
