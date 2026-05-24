# Host Integration

Use the host-integration APIs when AIMD needs to render through your own preview components instead of the default HTML output.

## Host Custom Elements

When integrating AIMD into a host application with its own preview components, use `aimdElementRenderers` to replace the default HTML for specific AIMD nodes:

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

Set `groupStepBodies: true` when the host element should receive following block content as slot/body children. Default AIMD metadata (`data-aimd-*`) is preserved, and step nodes keep parsed kwargs such as `title`, `subtitle`, `checked_message`, and `result` for host-side adapters.

## Reusable Step Card UI

If you want a ready-made Vue rendering surface instead of mapping to your own custom element, use `createStepCardRenderer()` together with `renderToVue`:

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

This gives you a renderer-level step card with number badge, title, subtitle, result/check badges, and grouped body content. Host apps can still override it later with a custom AIMD renderer or element renderer.

## Styles

Math styles are loaded automatically when calling async render APIs (`renderToHtml` / `renderToVue`) in browser environments.

If you need full control of style loading, import `@airalogy/aimd-renderer/styles` manually.
