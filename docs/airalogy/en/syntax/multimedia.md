# Multimedia

AIMD uses fenced `media` blocks to describe videos, audio, and ordinary attachments, and uses <code v-pre>{{ref_media|...}}</code> to reference those media entries from prose. This is useful for protocols, lessons, and reusable courseware that need local videos, narration, PDFs, handouts, or packaged assets. Static images should use [`fig`](./fig.md) so figure numbering, titles, legends, and <code v-pre>{{ref_fig|...}}</code> references stay intact.

## Basic Syntax

A media block requires at least `id` and `src`:

````aimd
See {{ref_media|lecture_video}} for the walkthrough video.

```media
id: lecture_video
kind: video
src: files/videos/lecture-demo.mp4
poster: files/images/lecture-demo-poster.png
title: Lecture Video
legend: Watch this video while reading the following steps.
```
````

<code v-pre>{{ref_media|lecture_video}}</code> renders as a reference to the media block. References and captions use the concrete `kind` label, such as “Video 1” for `kind: video`, “Audio 1” for `kind: audio`, and “Attachment 1” for `kind: file`. The `media` block itself renders as the corresponding player or attachment link.

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | Required | Media ID used by media references. |
| `src` | Required | Media source path, either a Protocol-local relative path or a network URL. |
| `kind` | Optional | Media type. Supported values are `video`, `audio`, and `file`. Missing values are treated as `file`. Do not use `kind: image`; static images should use the dedicated `fig` fenced block. |
| `mime` | Optional | MIME type, such as `video/mp4` or `audio/mpeg`. Renderers or hosts can usually infer it from the `src` extension; set it only when `src` cannot be inferred reliably or when you need to override the default. |
| `poster` | Optional | Poster image path for direct or local video media; platform videos are usually handled by the provider player. |
| `provider` | Optional | External video provider hint, such as `youtube` or `bilibili`, for host-specific player selection or security policy. Plain local/direct videos do not need this field. |
| `title` | Optional | Media title. |
| `legend` | Optional | Media caption or description. |

`fig` is AIMD's static image semantic. It is written as a fenced `fig` block and referenced with <code v-pre>{{ref_fig|...}}</code>; `media` does not carry image semantics.

`kind: file` is for downloadable or openable attachment materials, such as PDFs, handouts, supplemental tables, or example data. It is not an image semantic, and it is not used for resource files already referenced by `fig`, `video`, or `audio`.

Standard AIMD validation treats `media.kind: image` and other non-standard `kind` values as errors. `media` should use only the standard `kind` values above; static images must use `fig`.

For local paths with clear extensions, such as `files/videos/lecture-demo.mp4` or `files/audio/narration.mp3`, authors usually do not need to write `mime`. Use `mime` when `src` is a dynamic URL without a reliable extension, or when the resource type needs to be overridden:

````aimd
```media
id: online_intro
kind: video
src: https://example.com/media?id=intro
mime: video/mp4
title: Online Intro Video
```
````

## Local File Paths

Local media files should be placed under `files/` in the current Protocol directory:

```text
protocol/
├─ protocol.aimd
└─ files/
   ├─ videos/
   │  └─ lecture-demo.mp4
   ├─ images/
   │  └─ lecture-demo-poster.png
   └─ handouts/
      └─ worksheet.pdf
```

Write paths relative to `protocol.aimd`:

````aimd
```media
id: worksheet
kind: file
src: files/handouts/worksheet.pdf
title: Worksheet PDF
```
````

`files/` is a recommended convention, not a syntax keyword. The real requirements are that `src` is a safe relative path and that the `.aira` archive contains a file at the same path. Do not place local absolute paths, `../` paths, or archive metadata paths in `src`.

## Network Video and Platform Video

Direct video or audio URLs can use `video` or `audio`:

````aimd
```media
id: online_intro
kind: video
src: https://example.com/media/intro.mp4
title: Online Intro Video
```
````

For YouTube, Bilibili, or other platform videos, still use `kind: video`, then add `provider` and an embeddable player URL:

````aimd
```media
id: youtube_demo
kind: video
provider: youtube
src: https://www.youtube.com/embed/VIDEO_ID
title: YouTube Demo
```
````

These platform videos are still numbered and referenced as “Video 1 / Video 2”. Renderers or host applications can use `provider` to render them as controlled iframes and apply their own provider or domain allowlists. Plain direct files such as `.mp4`, `.webm`, or `.mp3` do not need `provider`.

## Pinning

Pinning is a renderer or lesson-player interaction capability, not a field authors need to declare on each media block. By default, `video` and `audio` media can show a pin button so users can keep watching or listening while reading later content; `file` attachments are usually rendered as links and do not show a pin button.

The Vue renderer shows a compact pin button for media types that can be pinned. Clicking it toggles sticky mode so the media remains visible at the top of the scrollable lesson while the user continues reading; only one media item remains pinned in the same view, so pinning another item automatically unpins the previous one. Once pinned, longer description text is collapsed by default, and Details / Hide plus small / medium / large size buttons let the user choose between continuous viewing and more reading space. Clicking Unpin exits sticky mode. The static HTML renderer emits `data-aimd-media-pin`, `data-aimd-media-legend-toggle`, `data-aimd-media-legend`, `data-aimd-media-size-option`, `aria-pressed`, and pinned-class hooks, so host applications can attach their own click behavior, description expansion state, size state, or richer floating-player behavior.

## Relationship to Plain Markdown

Plain Markdown images, Markdown links, and raw HTML `<video>`, `<audio>`, and `<iframe>` can be used as general Markdown/HTML content. When a resource should be reliably recognized, referenced, numbered, packaged, or enhanced by a lesson player, use `fig` for static images and `media` for video, audio, and attachments; platform videos are also written as `kind: video` with `provider` indicating the source. Structured `fig` and `media` blocks let parsers, renderers, `.aira` packers, and future lesson players recognize resources reliably and provide reference labels, asset validation, pinning, and cross-tool reuse.
