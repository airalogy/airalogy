import { describe, expect, it } from "vitest"
import { h } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"

import {
  buildAimdRecorderFieldAdapterContext,
  resolveAimdRecorderFieldVNode,
} from "../useFieldAdapters"
import { createAimdRecorderMessages } from "../../locales"
import { createEmptyProtocolRecordData } from "../../types"

function createVarNode(): AimdVarNode {
  return {
    type: "aimd",
    fieldType: "var",
    id: "temperature",
    scope: "var",
    raw: "{{var|temperature: float}}",
    definition: {
      id: "temperature",
      type: "float",
    },
  }
}

describe("useFieldAdapters", () => {
  it("builds recorder adapter context with host-facing metadata", () => {
    const record = createEmptyProtocolRecordData()
    record.var.temperature = 36.5
    const defaultVNode = h("div", { id: "default" }, "Default")
    const context = buildAimdRecorderFieldAdapterContext(
      "var",
      "var:temperature",
      createVarNode(),
      36.5,
      defaultVNode,
      {
        readonly: false,
        locale: "en-US",
        messages: createAimdRecorderMessages("en-US"),
        record,
        fieldMeta: {
          "var:temperature": {
            placeholder: "Temp",
          },
        },
        fieldState: {
          "var:temperature": {
            loading: true,
          },
        },
      },
    )

    expect(context.fieldType).toBe("var")
    expect(context.fieldKey).toBe("var:temperature")
    expect(context.node.id).toBe("temperature")
    expect(context.value).toBe(36.5)
    expect(context.record.var.temperature).toBe(36.5)
    expect(context.fieldMeta?.["var:temperature"]?.placeholder).toBe("Temp")
    expect(context.fieldState?.["var:temperature"]?.loading).toBe(true)
    expect(context.defaultVNode).toBe(defaultVNode)
  })

  it("lets field adapters replace the default vnode before wrapField", () => {
    const defaultVNode = h("div", { id: "default" }, "Default")
    const result = resolveAimdRecorderFieldVNode(
      "var",
      "var:temperature",
      createVarNode(),
      36.5,
      defaultVNode,
      {
        readonly: false,
        locale: "en-US",
        messages: createAimdRecorderMessages("en-US"),
        record: createEmptyProtocolRecordData(),
        fieldAdapters: {
          var: (context) => h("section", { id: "adapter", "data-field-key": context.fieldKey }, [
            context.defaultVNode,
          ]),
        },
        wrapField: (fieldKey, fieldType, vnode) => h("article", { "data-wrap-key": `${fieldType}:${fieldKey}` }, [vnode]),
      },
    )

    expect(result.type).toBe("article")
    expect((result.props as any)["data-wrap-key"]).toBe("var:var:temperature")
    const resultChildren = result.children as any[]
    const inner = resultChildren[0] as any
    expect(inner.type).toBe("section")
    expect(inner.props.id).toBe("adapter")
    const innerChildren = inner.children as any[]
    expect(innerChildren[0]).toBe(defaultVNode)
  })

  it("falls back to the default vnode when no adapter is registered", () => {
    const defaultVNode = h("div", { id: "default" }, "Default")
    const result = resolveAimdRecorderFieldVNode(
      "var",
      "var:temperature",
      createVarNode(),
      36.5,
      defaultVNode,
      {
        readonly: false,
        locale: "en-US",
        messages: createAimdRecorderMessages("en-US"),
        record: createEmptyProtocolRecordData(),
      },
    )

    expect(result).toBe(defaultVNode)
  })
})
