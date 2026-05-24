# 故障排查 / FAQ

整理 AIMD monorepo 中常见问题与对应处理方式。

## 构建错误

### `Cannot find module '@airalogy/aimd-core'`（或任意 workspace 包）

workspace 包之间通过 `workspace:*` 相互引用。如果解析失败：

1. 先确认依赖已安装：
   ```bash
   pnpm install
   ```
2. 构建所有包，确保测试依赖的输出文件存在：
   ```bash
   pnpm build
   ```
3. 确认 `pnpm-workspace.yaml` 的 `packages` 数组包含 `packages/*` 和 `demo`。

### Vite 构建时报类型错误

每个包都有自己的 `type-check` 脚本。直接运行：

```bash
pnpm type-check
```

如果只想排查某一个包：

```bash
pnpm --filter @airalogy/aimd-core type-check
```

`aimd-recorder` 因为包含 `.vue` 单文件组件，所以使用的是 `vue-tsc` 而不是普通 `tsc`。

### 构建时出现 `ERR_MODULE_NOT_FOUND`

所有包都使用 `"type": "module"`。请确认：

- 在 Node.js ESM 解析场景里，必要时补齐文件扩展名。
- 需要路径别名的包里已把 `vite-tsconfig-paths` 列为 dev dependency。

### 构建 docs 时内存不足

`pnpm docs:build` 会同时构建 demo，并把它复制进 VitePress 输出。如果遇到内存不足：

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm docs:build
```

## 测试失败

### `node:test` 测试提示缺少模块

`aimd-core`、`aimd-editor`、`aimd-renderer` 的 `node:test` 都依赖构建后的 `dist/` 输出。先构建再测试：

```bash
pnpm build
pnpm test
```

### Vitest 测试报 DOM 相关错误

Vitest 默认使用 `happy-dom`。如果测试依赖 `happy-dom` 未覆盖的浏览器 API，你需要手动 mock。根配置见 `vitest.config.ts`：

```ts
export default defineConfig({
  test: {
    environment: "happy-dom",
  },
})
```

### 本地通过，CI 失败

- 确认 Node.js 版本一致（20+）。
- 在 CI 中使用 `pnpm install --frozen-lockfile`，避免 lockfile 被修改。
- 在 `pnpm test` 之前先执行 `pnpm build`，因为 `node:test` 依赖构建输出。

## 编辑器集成问题

### Monaco 语言注册无效

AIMD 的 Monaco 集成需要显式注册，确保这三步都做了：

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

如果仍然没有高亮，再确认 editor model 的语言 ID 确实是 `"aimd"`。

### AimdEditor 组件不渲染

`AimdEditor` 是 Vue 3 组件，依赖：

- `vue` 3.3+ 作为 peer dependency
- `monaco-editor` 0.50+ 作为可选 peer dependency（源码模式需要）

如果只使用 WYSIWYG 模式，则不需要 `monaco-editor`。

### Milkdown WYSIWYG 模式显示原始 Markdown

WYSIWYG 模式基于 Milkdown 与自定义 AIMD 插件。如果 AIMD 字段显示成原始 `{{var|...}}` 文本：

- 确认 `@airalogy/aimd-editor` 版本符合预期。
- 确认没有误从 `@airalogy/aimd-editor/monaco` 导入，而不是 root entry 或 `/vue`。

## 跨包类型解析问题

### 找不到 `@airalogy/aimd-core/types` 里的类型

`aimd-core` 暴露了多个 subpath。类型导入既可以走 root entry：

```ts
import type { AimdVarField, ExtractedAimdFields } from "@airalogy/aimd-core"
```

也可以走显式 subpath：

```ts
import type { ProcessorOptions, RenderContext } from "@airalogy/aimd-core/types"
```

另外确认 `tsconfig.json` 使用了 `"moduleResolution": "bundler"` 或 `"node16"`，这样 TypeScript 才会尊重 `exports` map。

### TypeScript 无法解析 `workspace:*` 依赖

pnpm 的 `workspace:*` 在发布时才会被替换。开发期里，TypeScript 是通过各包 `package.json` 里的 `exports` map 直接解析到源码 `.ts` 文件。如果失败：

1. 先执行 `pnpm install`
2. 检查消费方包的 `tsconfig.json` 是否正确包含 workspace root，或是否启用了 `vite-tsconfig-paths`
3. 重启编辑器里的 TypeScript language server

### 多个包之间的 Vue 类型冲突

所有包都固定使用 `vue: ^3.5.17`。如果看到类型冲突：

- 先执行 `pnpm install`，确保只提升出一个 Vue 版本
- 应用侧如果已经通过 workspace 获得 Vue，就不要再重复安装不同版本

## Monaco Editor 配置

### Monaco worker 无法加载

Monaco 需要 web worker 提供语言能力。在 Vite 项目里，可以使用 `monaco-editor` 的 Vite worker 方案，或手动指定 worker URL：

```ts
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"

self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
}
```

### AIMD 主题不生效

AIMD 主题通过 `createAimdExtendedTheme` 提供：

```ts
import { createAimdExtendedTheme } from "@airalogy/aimd-editor/monaco"

const theme = createAimdExtendedTheme("vs") // 或 "vs-dark"
monaco.editor.defineTheme("aimd-theme", theme)
monaco.editor.setTheme("aimd-theme")
```

### Monaco + Vite 生产构建问题

如果 Monaco 静态资源在生产环境缺失：

- 优先使用 `@codingame/monaco-vscode-editor-api`（`aimd-editor` 已依赖），它对 Vite 更友好
- 如果你直接导入了 `monaco-editor`，请确认 Vite 配置中的 `optimizeDeps.include` 已包含它

## 文档站点

### VitePress 开发服务器访问包页面是 404

文档站使用 locale 前缀路由（`/en/packages/...`、`/zh/packages/...`）。开发时请访问 `http://localhost:5173/en/packages/` 或 `http://localhost:5173/zh/packages/`，而不是直接访问根路径。

### docs 开发模式里 demo iframe 无法加载

开发环境下 demo 跑在单独端口（`http://localhost:5188`）。需要同时启动两个服务：

```bash
# 终端 1
pnpm docs:dev

# 终端 2
pnpm dev:demo
```

## 还是卡住？

- 先搜索 GitHub issues，看是否已有相同问题
- 如果没有，请提交一个新 issue，并附上复现步骤、Node.js 版本、pnpm 版本以及完整报错输出
