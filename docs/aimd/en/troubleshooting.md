# Troubleshooting / FAQ

Common issues and solutions when working with the AIMD monorepo.

## Build Errors

### `Cannot find module '@airalogy/aimd-core'` (or any workspace package)

Workspace packages reference each other with `workspace:*`. If resolution fails:

1. Make sure all dependencies are installed:
   ```bash
   pnpm install
   ```
2. Build all packages so that output files exist for `node:test` suites:
   ```bash
   pnpm build
   ```
3. Confirm `pnpm-workspace.yaml` lists `packages/*` and `demo` in its `packages` array.

### Vite build fails with type errors

Each package has its own `type-check` script. Run:

```bash
pnpm type-check
```

If only one package fails, run it in isolation:

```bash
pnpm --filter @airalogy/aimd-core type-check
```

`aimd-recorder` uses `vue-tsc` instead of plain `tsc` because it contains `.vue` single-file components.

### `ERR_MODULE_NOT_FOUND` during build

All packages use `"type": "module"`. Make sure:

- Import paths include the file extension where required by Node.js ESM resolution.
- `vite-tsconfig-paths` is listed as a dev dependency in the package that needs path aliases.

### Out-of-memory during docs build

The docs build (`pnpm docs:build`) also builds the demo and copies it into the VitePress output. If you run out of memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm docs:build
```

## Test Failures

### `node:test` tests fail with missing modules

`aimd-core`, `aimd-editor`, and `aimd-renderer` run their `node:test` suites against built output (`dist/`). Always build before testing:

```bash
pnpm build
pnpm test
```

### Vitest tests fail with DOM-related errors

Vitest is configured with `happy-dom` as the test environment. If a test needs a real browser API not covered by `happy-dom`, you may need to mock it. Check the root `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    environment: "happy-dom",
  },
})
```

### Tests pass locally but fail in CI

- Ensure the Node.js version matches (20+).
- Run `pnpm install --frozen-lockfile` in CI so the lockfile is not modified.
- Run `pnpm build` before `pnpm test` because `node:test` suites depend on built output.

## Editor Integration Issues

### Monaco language registration does not work

The AIMD Monaco integration requires explicit registration. Make sure you call all three setup functions:

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

If syntax highlighting still does not appear, verify that the editor model uses `"aimd"` as its language ID.

### AimdEditor component does not render

`AimdEditor` is a Vue 3 component. It requires:

- `vue` 3.3 or later as a peer dependency.
- `monaco-editor` 0.50 or later as an optional peer dependency (needed for source mode).

If using the WYSIWYG mode only, `monaco-editor` is not required.

### Milkdown WYSIWYG mode shows raw markdown

The WYSIWYG mode uses Milkdown with custom AIMD plugins. If AIMD fields display as raw `{{var|...}}` text:

- Confirm `@airalogy/aimd-editor` is at the expected version.
- Check that you are not accidentally importing from `@airalogy/aimd-editor/monaco` instead of the root entry or `/vue`.

## Type Resolution Issues Across Packages

### Types from `@airalogy/aimd-core/types` are not found

`aimd-core` exports several subpath entries. For type-only imports, use:

```ts
import type { AimdVarField, ExtractedAimdFields } from "@airalogy/aimd-core"
```

Or the explicit subpath:

```ts
import type { ProcessorOptions, RenderContext } from "@airalogy/aimd-core/types"
```

Make sure your `tsconfig.json` has `"moduleResolution": "bundler"` or `"node16"` so that `exports` map conditions are respected.

### TypeScript cannot resolve `workspace:*` dependencies

pnpm `workspace:*` protocol is replaced at publish time. During development, TypeScript resolves through the `exports` map in each package's `package.json`, which points directly at source `.ts` files. If resolution fails:

1. Make sure `pnpm install` has been run.
2. Check that the consuming package's `tsconfig.json` includes the workspace root in its `references` or uses `vite-tsconfig-paths`.
3. Restart the TypeScript language server in your editor.

### Mismatched Vue types between packages

All packages pin `vue` to `^3.5.17`. If you see type conflicts:

- Run `pnpm install` to ensure a single hoisted Vue version.
- Avoid installing `vue` as a direct dependency in application code if it already comes through the workspace.

## Monaco Editor Setup

### Monaco workers fail to load

Monaco editor requires web workers for language features. In a Vite project, use the `monaco-editor` Vite plugin or manually configure worker URLs:

```ts
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"

self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
}
```

### AIMD theme does not apply

The AIMD theme is provided via `createAimdExtendedTheme`:

```ts
import { createAimdExtendedTheme } from "@airalogy/aimd-editor/monaco"

const theme = createAimdExtendedTheme("vs") // or "vs-dark"
monaco.editor.defineTheme("aimd-theme", theme)
monaco.editor.setTheme("aimd-theme")
```

### Monaco + Vite production build issues

If Monaco assets are missing in production:

- Use `@codingame/monaco-vscode-editor-api` (already a dependency of `aimd-editor`) for a pre-bundled Monaco build that works well with Vite.
- Make sure `optimizeDeps.include` in your Vite config lists `monaco-editor` if you import it directly.

## Docs Site

### VitePress dev server shows 404 for package pages

The docs site uses locale-prefixed routes (`/en/packages/...`, `/zh/packages/...`). Access pages at `http://localhost:5173/en/packages/` rather than the root.

### Demo iframe does not load in docs dev mode

In development, the demo runs on a separate port (`http://localhost:5188`). Start both servers:

```bash
# Terminal 1
pnpm docs:dev

# Terminal 2
pnpm dev:demo
```

## Still Stuck?

- Search existing GitHub issues for similar problems.
- Open a new issue with reproduction steps, your Node.js version, pnpm version, and the full error output.
