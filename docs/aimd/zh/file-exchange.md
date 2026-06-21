# 带本地图片的 AIMD 文件交换

如果内容只包含文本、字段、表格、文献引用、题目、步骤和检查点，那么一个纯文本 AIMD 就足够了。它可以直接复制粘贴，也可以保存成任意 `.aimd` 文件发送，例如 `protocol.aimd`、`workflow.aimd` 或 `lesson-01.aimd`。AIMD 语法本身不要求文件名必须是 `protocol.aimd`。

当 AIMD 中包含固定的本地图片时，AIMD 源码仍然是文本，但图片字节本身需要有地方存放。`fig` 块里保存的是相对资源路径，不是图片内容本身：

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

在这个模式里，`src: files/workflow-diagram.svg` 的含义是“渲染这个 figure 时读取这个 Protocol 本地文件”。它不是 `airalogy.id.file.*` Record 值，也不是云端上传引用；它是属于 Protocol 定义的一份固定资源。

`legend` 是可选的语义图注字段。省略 `legend` 时，figure 仍然可以通过 `id` 和 `src` 被引用和渲染；写入 `legend` 时，它用于描述图片内容，而不是记录原始文件名或本地路径。

## 推荐交换结构

在本地开发时，一个含图 Protocol 可以是一个文件夹：

```text
my-protocol/
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

`protocol.aimd` 是 Airalogy 官方工具默认使用的入口文件名。外层 `.aira` 文件可以自由命名，例如 `workflow-protocol.aira`、`my-protocol.aira` 或 `lesson-01.aira`；对人可读、可分享的名称放在外层文件名和 manifest 的 `protocol_name` 上，包内入口文件保持稳定。

如果要下载、发送或通过文件传输渠道共享，推荐使用单个 `.aira` 文件。`.aira` 会保留同样的概念结构，但用带 manifest（清单）的 Airalogy 归档把它封装起来：

```text
my-protocol.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

这个 manifest 使用 `kind: "protocol"`。它会列出入口 AIMD 文件和每一个本地文件，并保存 SHA-256 哈希，方便 Airalogy 读取器或其他工具校验 AIMD 文本和图片文件在打包后没有被篡改。

可以使用下面几种方式创建 `.aira`：

- 在 AIMD demo 编辑器里通过图片按钮插入本地 figure，然后下载 `.aira`。
- 用 Airalogy CLI packer 打包本地 Protocol 文件夹。
- 在浏览器或应用里调用 `@airalogy/aira-core` 的 `createProtocolAiraArchive()`。

## 资源路径规则

为了便于交换和复用，推荐将 Protocol 本地资源放在 `files/` 目录下。`files/` 不是 AIMD 语法强制绑定的目录名；真正的绑定来自 `fig` 块里的 `src` 路径和 `.aira` manifest 中列出的文件路径。Airalogy 官方工具默认使用 `files/`，因此新建内容优先采用这个目录。

资源路径必须是相对于 Protocol 根目录的安全相对路径，不能是绝对路径，不能包含 `../`，也不能写入 `_airalogy_archive/` 这样的归档元数据目录。每个路径片段可以包含 Unicode 字母和数字（包括中文）、`-`、`_` 和 `.`；空格、冒号、斜杠、反斜杠和其他不稳定标点转换成 `-` 或直接移除。资源路径不需要限制为 ASCII，`files/图片.png` 这样的中文路径可以直接使用，因为 `.aira` 是 UTF-8 归档，manifest 中的路径也是字符串。

这些都是适合新建内容的路径：

```aimd
src: files/reaction-rate-curve.png
src: files/图片.png
src: files/实验结果-第1组.png
```

## 教学课件示例

同样的结构也可以用于含图的教学课件。外层文件名表达课件名称，内部仍使用稳定的 `protocol.aimd` 入口：

```text
enzyme-kinetics-lesson.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
└─ files/
   ├─ reaction-rate-curve.png
   └─ michaelis-menten-diagram.svg
```

对应的 AIMD 中可以用 `fig` 块引用这些课件图片：

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

因此，`.aira` 不只适合实验 Protocol，也适合打包可复用的 AIMD 教学材料、讲义或带固定图片的说明文档。

## 渲染兼容性

纯文本 AIMD 和带图片 AIMD 的静态渲染模型是兼容的。Renderer 解析的是同一份 AIMD 源码，也会得到同样的 `fig` 节点；唯一额外需要的是资源解析。

- 如果宿主渲染的是不含本地资源的纯 `.aimd` 字符串，不需要额外 resolver。
- 如果宿主渲染的是 AIMD 文件夹，`src: files/workflow-diagram.svg` 可以按这个文件夹解析。
- 如果宿主渲染的是 `.aira` 归档，读取器先打开归档、按 manifest 的 `entrypoint` 读取入口 AIMD，再把 `files/workflow-diagram.svg` 映射成可展示的 URL 或 Blob URL，并交给 renderer 的 asset resolver。

因此，加入本地图片并不会产生另一套 AIMD 语法；它只是把交换形式从“一个文本文件足够”变成“使用 `.aira`，让文本和它引用的资源一起流转”。

## Demo 中的行为

在线编辑器默认从空白 AIMD 文档开始；如果需要参考语法或结构，可以先选择一个案例模板并加载为基础再修改。Demo 中的图片按钮提供两种插入方式。插入网络图片时，Demo 会生成一个 `fig` 块，并把 `src` 写成 `https://...` 这样的 URL；这种图片不进入 `.aira` 的 `files/`，渲染时仍依赖网络可访问性。上传本地图片时，Demo 会生成一个带 `src: files/...` 的 `fig` 块，把图片作为 Protocol 本地文件保存。

下载时，Demo 会根据当前内容自动选择交换格式：如果没有 Protocol 本地文件，下载普通 `.aimd` 文本文件；如果已经上传了本地图片，下载 `kind: "protocol"` 的 `.aira` 归档，里面同时包含 `protocol.aimd` 和这些本地文件。Demo 会根据上传图片的本地文件名生成安全、可读的资源路径。例如 `Reaction Rate Curve.png` 会进入 `.aira` 里的 `files/reaction-rate-curve.png`，`图片.png` 会进入 `files/图片.png`，`实验结果：第1组.png` 会进入 `files/实验结果-第1组.png`；如果文件名无法转换成安全路径，则回退为 `files/uploaded-figure-1.png` 这样的自动编号。图片插入弹窗会先让用户选择“本地图片”或“网络图片”，再填写对应输入；`title` 和 `legend` 是两种模式共享的可选图元信息，留空时不会写入对应字段。`legend` 是图注，不是文件名备注。

## 多 AIMD 文档站的推荐结构

本节说明面向多页面文档站的推荐组织方式，不属于当前 `.aira` 打包格式的强制要求。AIMD 适合作为文档站的页面基座，但整个文档站不需要写成一个巨大的 AIMD 文件。推荐模型是“一个 AIMD 文件或页面目录对应一个页面”，文档站再用单独的站点索引描述路由、导航、语言和页面顺序。

推荐的源文件结构如下：

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

在这个结构中，无本地资源的页面可以直接使用 `about.aimd`、`guide/index.aimd` 或 `guide/faq.aimd` 这样的简写形式；这更接近普通文档站的写法，也方便人工浏览。含本地图片或其他页面资源的页面更推荐使用目录形式，例如 `install/protocol.aimd` 和 `install/files/install-step.png`。这时页面目录就是一个小 Protocol，`src: files/workflow.svg` 永远相对于当前页面目录解析，因此不同页面的图片不会互相冲突。

两种形式可以并存：

```text
about.aimd              # 无本地资源的单 AIMD 页面
about/protocol.aimd     # 自包含页面目录的入口 AIMD
about/files/...         # 页面本地资源
```

`protocol.aimd` 不是因为 `about.aimd` 不合法，而是为了表达这个目录可以独立作为 Protocol root 打包和复用。页面名称、路由和标题由目录名或 `aimd-site.json` 管理；目录内部入口文件保持稳定，方便未来单篇打包为 `.aira`。

站点层信息放在单独的 site manifest 中，例如 `aimd-site.json`：

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

这个 manifest 属于文档站层，不属于 AIMD 语法本身。无本地资源页面可以直接用 `file` 指向一个 `.aimd` 文件；自包含页面目录可以用 `root` 和 `entrypoint` 指向目录入口。导航、路由、语言、搜索索引、重定向等信息由站点层管理；单篇 AIMD 只负责自己的正文和本地资源。

## FAQ

### 单独 `.aimd` 文件名可以自由选择吗？

可以。单独发送 `.aimd` 文本文件时，文件名可以自由选择。只要工具读取到了 AIMD 文本，`xxx.aimd`、`demo.aimd` 和 `protocol.aimd` 都可以被解析。

### `.aira` 里的入口文件一定叫 `protocol.aimd` 吗？

新建 Protocol 内容默认使用 `protocol.aimd`，这样人工查看、CLI 打包、示例文档和未来文档站页面目录都会保持一致。`.aira` 的底层归档格式并不要求读取器永远硬编码读取 `protocol.aimd`；合法 `.aira` 通过 `_airalogy_archive/manifest.json` 中的 `entrypoint` 字段声明入口文件，如果没有显式声明，读取器可以把 `protocol.aimd` 作为默认入口。自定义入口名主要用于兼容已有文件或特殊导入场景。

### `src` 加了引号，为什么仍然不是安全路径？

`fig` 块里的字段使用 YAML 风格的 `key: value` 写法，因此 `src` 可以写成带引号的字符串。但引号只影响字段解析，不会把任意字符串变成安全、可移植的 `.aira` 资源路径。不要把上传前的本地路径或未规范化文件名直接写进 `src`：

```aimd
src: "/Users/xxx/Desktop/Reaction Rate Curve.png"
src: "C:\Users\xxx\Desktop\图 1.png"
src: "../secret.png"
src: "files/实验结果：第1组.png"
```

前两个路径绑定了作者机器上的绝对位置，第三个会越过 Protocol 本地资源边界，最后一个虽然在字段解析时可能被当作普通字符串接受，但包含未规范化的冒号等标点。新建内容推荐把上传文件转换成 `files/reaction-rate-curve.png`、`files/图片.png` 或 `files/实验结果-第1组.png` 这样的安全、可读、可移植的相对路径。

### 如果 `fig.src` 指向的图片文件不存在，会怎么显示？

AIMD 文本仍然可以被解析，`fig` 节点和 `ref_fig` 引用也仍然存在；失败的是图片资源解析。渲染时，宿主会尝试把 `src` 解析成可显示的 URL。如果找不到对应文件，基础 renderer 会保留原始 `src` 并渲染出一个 `<figure>` 和 `<img>`，浏览器通常会显示破图状态或图片的替代文本；figure 的标题和 `legend` 仍然可以显示。

因此，不建议让缺失图片静默失败。面向用户的 Reader 或文档站可以在资源解析失败时显示更明确的占位提示，例如“图片文件缺失：`files/workflow-diagram.svg`”。在 `.aira` 交换场景中，打包器和读取器也应该尽早通过 manifest 文件列表和哈希校验发现缺失资源，而不是等到页面渲染时才暴露问题。

### 能不能直接压缩文件夹再改成 `.aira`？

不能。普通 ZIP 里如果只有下面这种结构，人可以理解，但它缺少 Airalogy manifest：

```text
my-protocol.zip
├─ protocol.aimd
└─ files/
   └─ workflow-diagram.svg
```

把这个文件重命名为 `my-protocol.aira` 并不会让它成为合法 Airalogy 归档，因为读取器和工具会依赖 `_airalogy_archive/manifest.json` 判断归档类型、入口文件、文件列表和文件哈希。没有这个 manifest，就不能可靠校验，也不能稳定路由给兼容工具。`.aira` 读取器会拒绝这种改名后的 ZIP，而不是猜测 `protocol.aimd` 就是入口文件。

如果双方都知道要先解压再打开 `protocol.aimd`，普通 ZIP 文件夹可以作为临时人工交换方式；但它属于文件夹包，不属于 `.aira` 标准交换格式。这种情况下，宿主解析的是解压后的 AIMD 文件夹，不是在打开 `.aira` 归档。

### 多 AIMD 文档站以后如何打包？

未来工具可以按三层演进：单篇页面继续打包为 `kind: "protocol"` 的 `.aira`；多篇页面集合可以打包为 `kind: "protocols"` 的 `.aira`，每个页面目录对应一个独立 `archive_root`；完整文档站如果需要作为一个可交换对象流转，可以再引入 `kind: "site"`，把 site manifest、多篇 AIMD 页面和站点公共资源一起封装。

为了保持单篇页面可复用，页面内容默认不要跨页面引用其他页面的 `files/`。全站共享的 logo、主题图或公共素材可以放在未来的站点资源目录中，例如 `_site/files/` 或 `_shared/`，并由站点构建器负责解析。
