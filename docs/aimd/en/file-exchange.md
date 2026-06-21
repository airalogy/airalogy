# AIMD File Exchange With Local Figures

Plain AIMD is enough when the content only needs text, fields, tables, citations, quizzes, steps, and checks. It can be copied, pasted, or sent as any `.aimd` text file, such as `protocol.aimd`, `workflow.aimd`, or `lesson-01.aimd`. AIMD syntax itself does not require the file to be named `protocol.aimd`.

When an AIMD document includes a fixed local figure, the AIMD source still remains text, but the image bytes need a place to live. The `fig` block stores the relative asset path, not the image payload itself:

````aimd
## Figures and Citations

The protocol workflow is summarized in {{ref_fig|workflow_diagram}}.

```fig
id: workflow_diagram
src: files/workflow-diagram.svg
title: Workflow Diagram
legend: A compact local SVG figure used to demonstrate fig metadata and ref_fig links.
```
````

In this pattern, `src: files/workflow-diagram.svg` means “load this protocol-local file when rendering the figure.” It is not an `airalogy.id.file.*` Record value, and it is not a cloud upload reference. It is a fixed asset that belongs to the Protocol definition.

`legend` is optional semantic caption metadata. If `legend` is omitted, the figure can still be referenced and rendered through `id` and `src`; when present, it describes the figure content, not the original filename or local path.

## Recommended Exchange Structure

For local development, a protocol with figures can be a folder:

```text
my-protocol/
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

`protocol.aimd` is the default entrypoint filename used by Airalogy official tools. The outer `.aira` file can be named freely, such as `workflow-protocol.aira`, `my-protocol.aira`, or `lesson-01.aira`; the human-readable, shareable name lives on the outer filename and manifest `protocol_name`, while the package keeps a stable internal entrypoint.

For sharing, downloading, or sending the protocol through a file-transfer channel, prefer a single `.aira` file. The `.aira` file keeps the same conceptual layout, but wraps it in a ZIP-based Airalogy archive with a manifest:

```text
my-protocol.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

The manifest uses `kind: "protocol"`. It lists the AIMD entrypoint and every local file, and stores SHA-256 hashes so readers and tools can validate that the AIMD text and local figure files were not changed after packaging.

Use one of these to create `.aira`:

- Use the AIMD demo editor’s image button to insert local figures and download `.aira`.
- Use the Airalogy CLI packer for a local protocol folder.
- Use `createProtocolAiraArchive()` from `@airalogy/aira-core` inside a browser or app.

## Resource Path Rules

For interoperability, place protocol-local assets under `files/` by convention. `files/` is not a directory name enforced by AIMD syntax; the real binding comes from the `src` path in the `fig` block and the matching file paths listed in the `.aira` manifest. Airalogy official tools default to `files/`, so newly authored content uses that directory by default.

Resource paths must be safe relative paths from the Protocol root: they must not be absolute, contain `../`, or write into archive metadata directories such as `_airalogy_archive/`. Each path segment may contain Unicode letters and numbers, including Chinese characters, plus `-`, `_`, and `.`; spaces, colons, slashes, backslashes, and unstable punctuation are converted to `-` or removed. Resource paths do not need to be ASCII-only. Paths such as `files/图片.png` are valid because `.aira` archives are UTF-8 archives and manifest paths are strings.

These are good paths for newly authored content:

```aimd
src: files/reaction-rate-curve.png
src: files/图片.png
src: files/实验结果-第1组.png
```

## Lesson Example

The same structure can also package image-bearing teaching material. The outer filename names the lesson, while the archive keeps the stable internal `protocol.aimd` entrypoint:

```text
enzyme-kinetics-lesson.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
└─ files/
   ├─ reaction-rate-curve.png
   └─ michaelis-menten-diagram.svg
```

The AIMD lesson can reference those packaged images with `fig` blocks:

````aimd
## Enzyme Kinetics

The reaction rate curve is shown in {{ref_fig|reaction_rate_curve}}.

```fig
id: reaction_rate_curve
src: files/reaction-rate-curve.png
title: Reaction Rate Curve
legend: A local figure packaged with this lesson.
```
````

That means `.aira` is useful not only for experimental Protocols, but also for reusable AIMD lessons, handouts, and explanatory documents with fixed local images.

## Rendering Compatibility

The static AIMD rendering model is the same for plain AIMD and image-bearing AIMD. The renderer parses the same AIMD source and sees the same `fig` node; the only extra requirement is asset resolution.

- If the host renders a plain `.aimd` string with no local assets, no resolver is needed.
- If the host renders an AIMD folder, `src: files/workflow-diagram.svg` can be resolved against that folder.
- If the host renders a `.aira` archive, the reader opens the archive, reads the AIMD entrypoint declared by the manifest, and maps `files/workflow-diagram.svg` to a displayable URL or Blob URL through the renderer asset resolver.

That means adding local figures does not create a different AIMD syntax. It only changes the exchange format from “one text file is enough” to “use `.aira` so the text and its referenced assets travel together.”

## In The Demo

The online editor starts from a blank AIMD document by default. If users want a reference structure, they can choose an example template and load it as a starting point before editing. The demo editor’s image button supports two insertion paths. Inserting a remote image creates a `fig` block with an `https://...` URL in `src`; that image is not stored in `.aira` `files/`, so rendering still depends on the URL staying reachable. Uploading a local image creates a `fig` block with a `src: files/...` path and keeps the image as a protocol-local file.

When downloading, the demo chooses the exchange format from the current content: if there are no protocol-local files, it downloads a plain `.aimd` text file; if local images have been uploaded, it downloads a `kind: "protocol"` `.aira` archive containing both `protocol.aimd` and those local files. The demo derives a safe, readable resource path from the uploaded local filename. For example, `Reaction Rate Curve.png` is packaged as `files/reaction-rate-curve.png`, `图片.png` as `files/图片.png`, and `实验结果：第1组.png` as `files/实验结果-第1组.png`; if the filename cannot be converted into a safe path, the demo falls back to an automatic name such as `files/uploaded-figure-1.png`. The image insertion popover first lets users choose “local image” or “image URL,” then shows the matching input. `title` and `legend` are optional figure metadata shared by both modes and omitted when left blank. `legend` is a caption, not a filename note.

## Recommended AIMD Site Structure

This section describes the recommended organization for multi-page documentation sites. It is not a requirement of the current `.aira` packaging format. AIMD works well as the page foundation for a documentation site, but the whole site does not need to become one large AIMD file. The recommended model is “one AIMD file or page directory maps to one page,” while a separate site manifest describes routes, navigation, locales, and page order.

Recommended source layout:

```text
docs/
├─ aimd-site.json
├─ zh/
│  ├─ index/
│  │  ├─ protocol.aimd
│  │  └─ files/
│  │     └─ overview.svg
│  ├─ about.aimd
│  └─ guide/
│     ├─ index.aimd
│     ├─ install/
│     │  ├─ protocol.aimd
│     │  └─ files/
│     │     └─ install-step.png
│     └─ advanced/
│        └─ security/
│           └─ protocol.aimd
└─ en/
   ├─ index.aimd
   └─ guide/
      ├─ install/
      │  ├─ protocol.aimd
      │  └─ files/
      │     └─ install-step.png
      └─ faq.aimd
```

In this layout, pages without local assets can use shorthand files such as `about.aimd`, `guide/index.aimd`, or `guide/faq.aimd`; this is close to common documentation-site practice and easy to browse manually. Pages with local figures or other page assets are better represented as directories, such as `install/protocol.aimd` and `install/files/install-step.png`. In that form, the page directory is a small Protocol. `src: files/workflow.svg` is always resolved relative to the current page directory, so assets from different pages do not conflict.

Both forms can coexist:

```text
about.aimd              # Single AIMD page without local assets
about/protocol.aimd     # Entrypoint AIMD for a self-contained page directory
about/files/...         # Page-local assets
```

`protocol.aimd` is not used because `about.aimd` would be invalid. It is used to signal that the directory can be packaged and reused as an independent Protocol root. Page names, routes, and titles are managed by the directory name or `aimd-site.json`; the directory’s internal entrypoint stays stable for future single-page `.aira` packaging.

Site-level information lives in a separate site manifest such as `aimd-site.json`:

```json
{
  "format": "airalogy.aimd.site",
  "version": 1,
  "title": "AIMD Docs",
  "locales": ["zh", "en"],
  "pages": [
    {
      "id": "zh.about",
      "route": "/zh/about/",
      "file": "zh/about.aimd",
      "title": "关于"
    },
    {
      "id": "zh.guide.install",
      "route": "/zh/guide/install/",
      "root": "zh/guide/install/",
      "entrypoint": "protocol.aimd",
      "title": "安装"
    }
  ]
}
```

This manifest belongs to the site layer, not AIMD syntax. A page without local assets can use `file` to point directly to a `.aimd` file; a self-contained page directory can use `root` and `entrypoint` to point to the directory entrypoint. Navigation, routes, locales, search indexes, redirects, and page ordering are managed by the site layer; each AIMD page owns only its content and local assets.

## FAQ

### Can a standalone `.aimd` file use any filename?

Yes. When sending a standalone `.aimd` text file, the filename can be chosen freely. As long as a tool reads the AIMD text, `xxx.aimd`, `demo.aimd`, and `protocol.aimd` can all be parsed.

### Must the entrypoint inside `.aira` be named `protocol.aimd`?

Newly authored Protocol content uses `protocol.aimd` by default so manual inspection, CLI packaging, examples, and future documentation-site page directories stay consistent. The lower-level `.aira` archive format does not require Readers to always hard-code `protocol.aimd`; a valid `.aira` declares the entrypoint through the `entrypoint` field in `_airalogy_archive/manifest.json`, and Readers may use `protocol.aimd` as the default if no explicit entrypoint is declared. Custom entrypoint names are mainly for compatibility with existing files or special import workflows.

### Why is a quoted `src` value not automatically a safe path?

Fields inside a `fig` block use YAML-style `key: value` syntax, so `src` can be written as a quoted string. Quoting only affects field parsing; it does not turn an arbitrary string into a safe, portable `.aira` resource path. Do not write the pre-upload local path or an unnormalized filename directly into `src`:

```aimd
src: "/Users/xxx/Desktop/Reaction Rate Curve.png"
src: "C:\Users\xxx\Desktop\图 1.png"
src: "../secret.png"
src: "files/实验结果：第1组.png"
```

The first two paths bind the document to the author’s local machine, the third crosses the protocol-local asset boundary, and the last may still parse as a plain string but contains unnormalized punctuation such as a colon. Newly authored content uses safe, readable, portable relative paths such as `files/reaction-rate-curve.png`, `files/图片.png`, or `files/实验结果-第1组.png`.

### What happens if `fig.src` points to a missing image file?

The AIMD text can still be parsed, and the `fig` node and `ref_fig` references still exist; the failure is in asset resolution. At render time, the host tries to resolve `src` into a displayable URL. If no matching file is found, the base renderer keeps the original `src` and still renders a `<figure>` with an `<img>` element, so the browser usually shows a broken-image state or the image alt text; the figure title and `legend` can still be displayed.

Missing images should not fail silently. User-facing Readers or documentation sites can show a clearer placeholder such as “missing image file: `files/workflow-diagram.svg`” when asset resolution fails. In `.aira` exchange workflows, packers and Readers should also catch missing resources as early as possible through the manifest file list and hash validation, instead of leaving the problem to page rendering.

### Can I zip a folder and rename it to `.aira`?

No. A normal ZIP file containing only this layout is easy for humans to understand, but it is missing the Airalogy manifest:

```text
my-protocol.zip
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

Renaming that file to `my-protocol.aira` does not make it a valid Airalogy archive, because Readers and tools expect `_airalogy_archive/manifest.json` to declare the archive kind, entrypoint, file list, and file hashes. Without that manifest, the package cannot be reliably validated or routed. A `.aira` Reader rejects this renamed ZIP instead of guessing that `protocol.aimd` is the entrypoint.

It is fine to exchange a plain ZIP folder informally if both sides know how to unpack and open `protocol.aimd`, but that is a folder bundle, not the `.aira` interchange format. In that case, the host is parsing an unpacked AIMD folder, not opening an `.aira` archive.

### How can multi-AIMD documentation sites be packaged in the future?

Future tooling can progress in three layers: a single page continues to package as a `kind: "protocol"` `.aira`; a multi-page collection can package as a `kind: "protocols"` `.aira`, with each page directory mapped to its own `archive_root`; a complete documentation site could later introduce `kind: "site"` if the whole site needs to travel as one exchange object containing the site manifest, AIMD pages, and site-level shared assets.

To keep each page reusable on its own, page content does not reference another page’s `files/` by default. Shared site assets such as logos, theme images, or common media can live in a future site asset directory such as `_site/files/` or `_shared/`, and the site builder resolves them.
