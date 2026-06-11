# Airalogy Reader

Browser and desktop app for opening `.aira` archives locally.

The app reads archive contents in the browser, displays the manifest, protocols, records, file references, offline blobs, member files, and validation results, and does not upload file content to a server.

## Browser build

```bash
pnpm dev:aira-reader
pnpm build:aira-reader
```

## Desktop app

The Tauri desktop wrapper reuses the same Vue/Vite app and `@airalogy/aira-core` parser while adding startup-file handling and `.aira` file association metadata.

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
