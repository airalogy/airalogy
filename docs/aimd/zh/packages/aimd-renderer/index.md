# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` 用于将 AIMD 渲染为 HTML / Vue，同时支持字段提取。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；这些页面只描述前端渲染和提取行为。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 核心能力

- `renderToHtml(content)`：输出 HTML。
- `renderToVue(content)`：输出 Vue vnode。
- `renderReadonlyRecordToVue(content, recordData, { resolveAsset })`：输出带 Record 数据和文件资源的只读 Vue vnode，把数据嵌入匹配的 AIMD 字段。
- `parseAndExtract(content)`：提取 core 规范字段结构，包括 `fields.var_definitions` 中的普通 `var` 定义，以及 `fields.refs` 中的 BibTeX 文献条目。
- `var` 与 `var_table` 的默认预览会显示 AIMD `title`，保留规范字段 id，并且只在 hover 或键盘 focus 时展示 `description` 与 `example`/`examples` 详情。
- `{{cite|...}}` 与 fenced `refs` 代码块会渲染为带编号的引用标记、hover/focus 文献信息和文末参考文献列表。
- 支持宿主通过 `resolveAssetUrl` 渲染 protocol-local 图像资源，让 `fig` 源码保留干净的相对路径，同时在包、archive 或应用内映射成真实可访问 URL。
- `assignerVisibility`：用于作者视图或调试视图下切换 assigner 的可见性。
- 内建 quiz 预览控制。
- 支持通过 `locale` 切换渲染标签语言。

## 示例

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## 文献引用与参考文献

`renderToHtml` 和 `renderToVue` 会把 `{{cite|ref_id}}` 渲染成正文里的编号引用标记。正文可见引用标记按 refs 列表顺序显示为 `[1]` 这类编号，hover 和键盘 focus 会展示参考文献信息，并且不会改变页面 URL。fenced `refs` 代码块使用 BibTeX 语法，会被提取到 `fields.refs` 结构化条目中，并且无论源码中写在什么位置，渲染时都会统一显示在文档末尾。

````aimd
This protocol follows {{cite|yang2025airalogyaiempowereduniversaldata}}.

```refs
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
````

## Protocol-local 图像资源

`fig` 代码块可以保留 `src: files/workflow-diagram.svg` 这类干净的相对路径。宿主如果从 package、archive 或 registry 加载 AIMD，可以传入 `resolveAssetUrl`，在渲染时把该路径映射成可显示的 URL。

```ts
const { html } = await renderToHtml(content, {
  resolveAssetUrl(src, context) {
    if (context.kind === "fig" && src.startsWith("files/")) {
      return exampleAssetMap[src]
    }
    return null
  },
})
```

## 审阅标记

`renderToHtml`、`renderToVue` 和只读 `AiralogyMarkdown` 渲染支持普通 Markdown 文本中的 CriticMarkup 风格审阅标记。这些标记用于文档审阅展示，不会向 `parseAndExtract` 增加 AIMD 字段。

| 用途 | AIMD 源码 | 渲染元素 |
| --- | --- | --- |
| 添加 | `{++新增文字++}` | `<ins class="aimd-critic aimd-critic--addition">` |
| 删除 | `{--删除文字--}` | `<del class="aimd-critic aimd-critic--deletion">` |
| 替换 | `{~~旧表述~>新表述~~}` | `.aimd-critic--substitution` 内的删除和添加 |
| 注释 | `{>>审阅备注<<}` | 行内 `.aimd-critic--comment` 注释 |
| 高亮 | `{==重点文字==}` | `<mark class="aimd-critic aimd-critic--highlight">` |

行内代码和 fenced 代码块中的 CriticMarkup 会保留为原始文本。

## 只读 Record 渲染

```ts
import { renderReadonlyRecordToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderReadonlyRecordToVue(protocolContent, {
  data: {
    var: {
      sample_id: { value: "S-001" },
      site_photo: "airalogy.id.file.site-photo.png",
    },
    check: { prepared: { checked: true } },
  },
}, {
  resolveAsset: ({ fileId, fieldPath }) => assets.get(fileId ?? "") ?? assets.get(fieldPath) ?? null,
})
```

当查看器需要把已完成的 Protocol 展示成静态文档，而不是可编辑 Recorder 时，可以使用这个 helper。它既接受带 `data` 的 Record payload，也接受 `data` 对象本身，然后在只读字段上下文中渲染协议内容。

`resolveAsset` 是文件字段的宿主集成点。宿主应用把 Record 文件 id、字段路径或 archive manifest 条目映射成 `ReadonlyRecordAsset`；renderer 会把图片、音频、视频字段内嵌渲染，把普通文件渲染成只读链接，并解析指向 Airalogy file id 的 Markdown 图片 `src`。读取 `.aira` blob、创建 `blob:` URL 等存储细节应该留在宿主应用中。

只读 `AiralogyMarkdown` 值会通过 AIMD Vue renderer 渲染，因此标题、列表、嵌套 AIMD 预览 token，以及已解析的 Markdown 图片资源都会作为文档内容显示，而不是显示原始 Markdown 文本。

## Assigner 可见性

所有 `assigner` 代码块默认都不会出现在普通渲染输出中，但仍会在上游解析 / 提取阶段参与处理。

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "expanded",
})
```

支持的值：

- `"hidden"`：默认值，不渲染 assigner 代码块。
- `"collapsed"`：把 assigner 渲染为默认折叠的 `<details>`，并显示本地化摘要标题。
- `"expanded"`：直接把 assigner 渲染成可见代码块；server assigner 按 `python`，client assigner 按 `javascript` 显示。

## 本地化

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

只有在你需要自定义“步骤”“答案”“图注”这类渲染标签时，才需要覆盖 `messages`：

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{quiz|q1}}", {
  locale: "zh-CN",
  messages: {
    step: {
      reference: step => `步骤${step}`,
    },
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

## 相关页面

- [宿主集成](/zh/packages/aimd-renderer/host-integration)
