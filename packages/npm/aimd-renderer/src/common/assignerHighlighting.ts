import type { Element, Root as HastRoot, Text as HastText } from "hast"
import type { ShikiHighlighter } from "../vue/vue-renderer"
import type { AimdRendererOptions } from "./processor"
import { buildInlineStyle, resolveAssignerVisibility } from "./assignerVisibility"

let assignerHighlighterLoadPromise: Promise<ShikiHighlighter | null> | null = null
const ASSIGNER_HIGHLIGHT_THEME = "github-light"

// ---------------------------------------------------------------------------
// HAST helpers (also used by the pipeline coordinator)
// ---------------------------------------------------------------------------

export function getClassNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim().split(/\s+/)
  }
  return []
}

export function hasClassName(node: Element, className: string): boolean {
  return getClassNames(node.properties?.className).includes(className)
}

export function getCodeLanguage(node: Element): string | null {
  const languageClass = getClassNames(node.properties?.className).find(name => name.startsWith("language-"))
  return languageClass ? languageClass.replace("language-", "") : null
}

export function collectTextContent(node: Element): string {
  return node.children.map((child) => {
    if (child.type === "text") {
      return child.value
    }
    if (child.type === "element") {
      return collectTextContent(child)
    }
    return ""
  }).join("")
}

export function visitHastElements(node: HastRoot | Element, visitor: (element: Element) => void): void {
  if (node.type === "element") {
    visitor(node)
  }

  const children = "children" in node ? node.children : []
  for (const child of children) {
    if (child.type === "element") {
      visitHastElements(child, visitor)
    }
  }
}

export function findDescendantElement(node: Element, predicate: (element: Element) => boolean): Element | null {
  for (const child of node.children) {
    if (child.type !== "element") {
      continue
    }
    if (predicate(child)) {
      return child
    }
    const nested = findDescendantElement(child, predicate)
    if (nested) {
      return nested
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Shiki highlighting for assigner code blocks
// ---------------------------------------------------------------------------

function createHighlightedLineChildren(
  tokens: Array<{ content: string, variants: Record<string, { color: string }> }>,
): Array<Element | HastText> {
  if (tokens.length === 0) {
    return [{ type: "text", value: "\u00A0" }]
  }

  return tokens.map((token) => {
    const color = Object.values(token.variants || {}).find(variant => typeof variant?.color === "string")?.color
    return {
      type: "element",
      tagName: "span",
      properties: color ? { style: buildInlineStyle({ color }) } : {},
      children: [{ type: "text", value: token.content || " " }],
    } as Element
  })
}

async function getAssignerHighlighter(): Promise<ShikiHighlighter | null> {
  if (!assignerHighlighterLoadPromise) {
    assignerHighlighterLoadPromise = import("shiki")
      .then(async ({ createHighlighter }) => {
        const highlighter = await createHighlighter({
          themes: [ASSIGNER_HIGHLIGHT_THEME],
          langs: ["javascript", "python"],
        })
        return highlighter as unknown as ShikiHighlighter
      })
      .catch(() => null)
  }

  return assignerHighlighterLoadPromise
}

/**
 * Walk a HAST tree and apply Shiki syntax highlighting to every visible
 * assigner code block (`<code>` inside `.aimd-assigner-preview`).
 */
export async function highlightVisibleAssigners(tree: HastRoot, options: AimdRendererOptions): Promise<void> {
  if (resolveAssignerVisibility(options.assignerVisibility) === "hidden") {
    return
  }

  const highlighter = await getAssignerHighlighter()
  if (!highlighter?.codeToTokensWithThemes) {
    return
  }

  visitHastElements(tree, (element) => {
    if (!hasClassName(element, "aimd-assigner-preview")) {
      return
    }

    const codeNode = findDescendantElement(element, candidate => candidate.tagName === "code")
    if (!codeNode || codeNode.properties?.["data-aimd-highlighted"] === "true") {
      return
    }

    const lang = getCodeLanguage(codeNode) || "text"
    const codeContent = collectTextContent(codeNode)
    const lines = highlighter.codeToTokensWithThemes?.(codeContent, {
      lang,
      themes: { light: ASSIGNER_HIGHLIGHT_THEME },
    }) || []

    codeNode.children = lines.map((lineTokens) => {
      return {
        type: "element",
        tagName: "span",
        properties: {
          className: ["aimd-assigner-code__line"],
          style: buildInlineStyle({ display: "block" }),
        },
        children: createHighlightedLineChildren(lineTokens),
      } as Element
    })
    codeNode.properties = {
      ...codeNode.properties,
      className: [...getClassNames(codeNode.properties?.className), "aimd-assigner-code"],
      "data-aimd-highlighted": "true",
    }
  })
}
