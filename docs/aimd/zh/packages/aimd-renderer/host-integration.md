# 宿主集成

当 AIMD 需要通过你自己的预览组件来渲染，而不是使用默认 HTML 输出时，使用这些宿主集成 API。

## 宿主自定义元素

当 AIMD 需要接入宿主应用自己的预览组件时，可以通过 `aimdElementRenderers` 把特定 AIMD 节点的默认 HTML 替换成自定义元素：

```ts
import {
  createCustomElementAimdRenderer,
  renderToHtml,
} from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{step|verify, 2, title='Verify Output', check=True}}", {
  groupStepBodies: true,
  aimdElementRenderers: {
    step: createCustomElementAimdRenderer("step-card", (node) => {
      const stepNode = node as any
      return {
        "step-id": stepNode.id,
        "step-number": stepNode.step,
        title: stepNode.title,
        level: String(stepNode.level),
        "has-check": stepNode.check ? "true" : undefined,
      }
    }, {
      container: true,
      stripDefaultChildren: true,
    }),
  },
})
```

如果希望宿主元素把后续块级正文当作 slot / body 内容接收，请启用 `groupStepBodies: true`。默认 AIMD 元数据（`data-aimd-*`）仍会保留，步骤节点的 `title`、`subtitle`、`checked_message`、`result` 等 kwargs 也会保存在节点元数据中，供宿主自定义渲染读取。

## 可复用 Step Card UI

如果你不想自己映射自定义元素，而是希望直接拿到一套可用的 Vue 步骤卡片渲染，可以把 `createStepCardRenderer()` 与 `renderToVue` 配合使用：

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

它会生成带编号徽标、标题、副标题、结果 / 勾选徽标以及步骤正文分组内容的 step-card。宿主应用后续仍然可以通过自定义 AIMD renderer 或 element renderer 覆盖它。

## 样式

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载公式样式。

如果你需要完全控制样式加载，也可以手动引入 `@airalogy/aimd-renderer/styles`。
