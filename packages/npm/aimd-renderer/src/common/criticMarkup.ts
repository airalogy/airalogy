import type { Element, Text as HastText } from "hast"
import type {
  AimdCriticMarkupBaseNode,
  AimdCriticMarkupChild,
  AimdCriticMarkupNode,
  AimdCriticSubstitutionNode,
} from "@airalogy/aimd-core/types"

function createTextHast(value: string): HastText {
  return { type: "text", value }
}

function isCriticMarkupNode(node: AimdCriticMarkupChild): node is AimdCriticMarkupNode {
  return typeof node.type === "string" && node.type.startsWith("critic")
}

function renderInlineChildren(state: any, children: AimdCriticMarkupChild[] = []): Array<Element | HastText> {
  return children.flatMap((child) => {
    if (child.type === "text") {
      return [createTextHast(child.value ?? "")] as Array<Element | HastText>
    }

    if (isCriticMarkupNode(child)) {
      const handler = criticMarkupHandlers[child.type as keyof typeof criticMarkupHandlers] as
        | ((state: any, node: any) => Element)
        | undefined
      if (handler) {
        return [handler(state, child)]
      }
    }

    const rendered = typeof state.one === "function" ? state.one(child, undefined) : null
    return rendered ? [rendered as Element | HastText] : []
  })
}

function createCriticElement(
  tagName: string,
  kind: string,
  children: Array<Element | HastText>,
  extraClassNames: string[] = [],
): Element {
  return {
    type: "element",
    tagName,
    properties: {
      className: ["aimd-critic", `aimd-critic--${kind}`, ...extraClassNames],
      "data-critic-kind": kind,
    },
    children,
  }
}

export const criticMarkupHandlers = {
  criticAddition(state: any, node: AimdCriticMarkupBaseNode): Element {
    return createCriticElement("ins", "addition", renderInlineChildren(state, node.children))
  },

  criticDeletion(state: any, node: AimdCriticMarkupBaseNode): Element {
    return createCriticElement("del", "deletion", renderInlineChildren(state, node.children))
  },

  criticHighlight(state: any, node: AimdCriticMarkupBaseNode): Element {
    return createCriticElement("mark", "highlight", renderInlineChildren(state, node.children))
  },

  criticComment(_state: any, node: AimdCriticMarkupBaseNode): Element {
    const value = node.value.trim()
    return createCriticElement("span", "comment", [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-critic__comment-label"] },
        children: [createTextHast("Comment")],
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-critic__comment-body"] },
        children: [createTextHast(value)],
      },
    ], value ? [] : ["aimd-critic--empty-comment"])
  },

  criticSubstitution(state: any, node: AimdCriticSubstitutionNode): Element {
    return createCriticElement("span", "substitution", [
      createCriticElement("del", "deletion", renderInlineChildren(state, node.oldChildren), ["aimd-critic--substitution-old"]),
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-critic__replacement-arrow"], "aria-hidden": "true" },
        children: [createTextHast("->")],
      },
      createCriticElement("ins", "addition", renderInlineChildren(state, node.newChildren), ["aimd-critic--substitution-new"]),
    ])
  },
}
