# 多媒体

AIMD 使用 `media` 代码块描述视频、音频和普通附件，并使用 <code v-pre>{{ref_media|...}}</code> 在正文中引用这些媒体。它适合需要把教学视频、讲解音频、PDF、补充材料或本地打包资源放进同一个 Protocol 的场景。静态图片应使用 [`fig`](./fig.md)，这样可以保留图号、图题、图例和 <code v-pre>{{ref_fig|...}}</code> 引用语义。

## 基本语法

一个媒体块至少需要 `id` 和 `src`：

````aimd
本节讲解视频见 {{ref_media|lecture_video}}。

```media
id: lecture_video
kind: video
src: files/videos/lecture-demo.mp4
poster: files/images/lecture-demo-poster.png
title: 讲解视频
legend: 这段视频可以配合后续步骤一起观看。
```
````

<code v-pre>{{ref_media|lecture_video}}</code> 会渲染为指向该媒体块的引用。引用和标题会根据 `kind` 使用具体类型标签，例如 `kind: video` 显示为“视频 1”，`kind: audio` 显示为“音频 1”，`kind: file` 显示为“附件 1”。`media` 块本身会渲染成对应的媒体播放器或附件链接。

## 字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `id` | 必填 | 媒体 ID，用于媒体引用。 |
| `src` | 必填 | 媒体资源路径，可以是 Protocol 内的相对路径，也可以是网络 URL。 |
| `kind` | 可选 | 媒体类型。支持 `video`、`audio`、`file`。未填写时按 `file` 处理。不使用 `kind: image`；静态图片请使用独立的 `fig` 代码块。 |
| `mime` | 可选 | MIME 类型，例如 `video/mp4`、`audio/mpeg`。通常可以由 renderer 或宿主应用根据 `src` 后缀自动推断；只有当 `src` 无法推断或需要覆盖默认判断时才需要填写。 |
| `poster` | 可选 | 直连或本地视频的封面图路径；平台视频通常由 provider 播放器自行处理封面。 |
| `provider` | 可选 | 外部视频服务标识，例如 `youtube`、`bilibili`，供宿主应用选择播放器或应用安全策略。普通本地/直连视频不需要填写。 |
| `title` | 可选 | 媒体标题。 |
| `legend` | 可选 | 媒体说明或图注。 |

`fig` 是 AIMD 的静态图片语义，写法是 fenced `fig` 代码块，并通过 <code v-pre>{{ref_fig|...}}</code> 引用；`media` 不承担图片语义。

`kind: file` 用于可下载或可打开的附件资料，例如 PDF、讲义、补充表格或示例数据。它不是图片语义，也不用于 `fig`、`video`、`audio` 内部已经引用到的资源文件。

标准 AIMD 校验会把 `media.kind: image` 或其他非标准 `kind` 视为错误。`media` 只应使用上表中的标准 `kind`；静态图片必须使用 `fig`。

对于 `files/videos/lecture-demo.mp4`、`files/audio/narration.mp3` 这类带明确扩展名的本地路径，通常不需要写 `mime`。如果 `src` 是不带扩展名的动态 URL，或者资源类型需要明确覆盖，才建议写 `mime`：

````aimd
```media
id: online_intro
kind: video
src: https://example.com/media?id=intro
mime: video/mp4
title: 在线介绍视频
```
````

## 本地文件路径

本地媒体文件推荐放在当前 Protocol 目录的 `files/` 下：

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

在 AIMD 中写相对于 `protocol.aimd` 的路径：

````aimd
```media
id: worksheet
kind: file
src: files/handouts/worksheet.pdf
title: 课堂练习 PDF
```
````

`files/` 是推荐约定，不是语法关键字。真正需要满足的是：`src` 使用安全的相对路径，并且 `.aira` 归档中存在同一路径的文件。不要把本机绝对路径、`../` 路径或归档元数据目录写进 `src`。

## 网络视频和平台视频

直连的视频或音频文件可以使用 `video` 或 `audio`：

````aimd
```media
id: online_intro
kind: video
src: https://example.com/media/intro.mp4
title: 在线介绍视频
```
````

如果资源是 YouTube、Bilibili 或其他平台视频，也继续使用 `kind: video`，并额外填写 `provider` 和可嵌入的播放器 URL：

````aimd
```media
id: youtube_demo
kind: video
provider: youtube
src: https://www.youtube.com/embed/VIDEO_ID
title: YouTube 演示
```
````

这类平台视频在引用和标题中仍然按“视频 1 / 视频 2”编号。renderer 或宿主应用可以根据 `provider` 把它渲染为受控 iframe，并根据自己的安全策略限制允许的 provider 或 URL 域名。普通 `.mp4`、`.webm`、`.mp3` 这类直连文件不需要写 `provider`。

## 固定展示

固定展示是 renderer 或课件播放器的交互能力，不需要作者在 AIMD 中逐个声明。默认情况下，`video` 和 `audio` 媒体可以显示“固定”按钮，让用户一边持续观看或收听当前媒体，一边继续阅读后续内容；`file` 附件通常只作为链接展示，不显示固定按钮。

Vue renderer 会为可固定媒体显示紧凑的“固定”按钮。用户点击后，该媒体会切换为 sticky 状态并在滚动阅读时固定在课件顶部；同一视图中始终只保留一个固定媒体，固定新的媒体会自动取消之前固定的媒体。固定状态下会默认收起较长的说明文字，并显示“说明 / 收起”和“小 / 中 / 大”尺寸切换按钮，让用户在持续观看和阅读空间之间自行取舍。再次点击“取消”会取消固定。静态 HTML renderer 会输出 `data-aimd-media-pin`、`data-aimd-media-legend-toggle`、`data-aimd-media-legend`、`data-aimd-media-size-option`、`aria-pressed` 和 pinned class 钩子，宿主应用可以自行接管点击行为、说明展开状态、尺寸状态或实现更复杂的悬浮播放器。

## 与普通 Markdown 的关系

普通 Markdown 图片、链接和原生 HTML `<video>`、`<audio>`、`<iframe>` 可以作为通用 Markdown/HTML 内容使用。需要被 AIMD 稳定识别、引用、编号、打包或由课件播放器增强交互时，静态图片使用 `fig`，视频、音频和附件使用 `media`；平台视频也写作 `kind: video`，再用 `provider` 表明来源。结构化 `fig` 和 `media` 块能被 parser、renderer、`.aira` 打包器和未来的课件播放器稳定识别，也更容易支持引用编号、资源校验、固定展示和跨工具复用。
