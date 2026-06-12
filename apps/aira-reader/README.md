# Airalogy Reader

Browser and desktop app for reading `.aira` archives locally.

The app reads archive contents in the browser, renders AIMD protocol content with `@airalogy/aimd-renderer`, injects Record data into matching protocol fields when records are present, and does not upload file content to a server.

The default Document view is content-first: record-backed archives open as a rendered AIMD document with captured values and embedded files resolved into the protocol. A compact Data summary remains available below the document, while the full Data view and archive details such as the manifest, protocols, records, file references, offline blobs, member files, and validation results remain available for validation and debugging.

## Browser build

```bash
pnpm dev:aira-reader
pnpm --filter @airalogy/aira-reader test
pnpm build:aira-reader
```

The Reader test suite opens the repository `.aira` examples, validates each archive, builds document views, and smoke-renders renderable AIMD content.

## Desktop app

The Tauri desktop wrapper reuses the same Vue/Vite app, `@airalogy/aira-core` parser, and `@airalogy/aimd-renderer` document renderer while adding startup-file handling and `.aira` file association metadata.

The desktop app keeps system-opened `.aira` paths in a Recent list, rejects non-ZIP `.aira` candidates before parsing, and caps direct IPC reads at 512 MB until the reader grows a streaming path.

```bash
pnpm dev:aira-reader:desktop
pnpm build:aira-reader:desktop
```

On macOS, the default desktop build produces a verified `.app` bundle:

```text
apps/aira-reader/src-tauri/target/release/bundle/macos/Airalogy Reader.app
```

Install it into Applications:

```bash
ditto "apps/aira-reader/src-tauri/target/release/bundle/macos/Airalogy Reader.app" "/Applications/Airalogy Reader.app"
```

If macOS blocks the first launch because the local build is unsigned, open it once with Finder's right-click `Open` action. After installation, `.aira` files can be opened with Airalogy Reader through Finder's `Open With` menu.

Additional package targets:

```bash
pnpm build:aira-reader:desktop:all
pnpm build:aira-reader:desktop:dmg
```

Example archives for quick testing are available in `examples/aira/`.

The GitHub Pages workflow builds this app into `/aira-reader/`. `pnpm build:aira-reader:desktop:dmg` requests the DMG bundler, and `pnpm build:aira-reader:desktop:all` delegates to the full Tauri target set for environments where installer tooling is available.
