import type { Element, Text as HastText, Root as HastRoot } from "hast"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"

// ---------------------------------------------------------------------------
// Figure numbering helpers
// ---------------------------------------------------------------------------

/**
 * Build a map from figure id to its sequence number based on the
 * extracted fields. The sequence is assigned in document order (1-based).
 */
export function buildFigureSequenceMap(fields: ExtractedAimdFields): Map<string, number> {
  const sequenceMap = new Map<string, number>()
  const figs = fields.fig || []
  let seq = 1
  for (const fig of figs) {
    const id = typeof fig === "string" ? fig : (fig as any)?.id
    if (typeof id === "string" && id.trim() && !sequenceMap.has(id)) {
      sequenceMap.set(id, seq++)
    }
  }
  return sequenceMap
}

/**
 * Build the HAST children array for a figure AIMD node.
 *
 * Returns `[imgElement]` or `[imgElement, figcaptionElement]` depending on
 * whether a title or legend is present.
 */
export function buildFigureChildren(figNode: {
  id: string
  src?: string
  title?: string
  legend?: string
  sequence?: number | string
}): (Element | HastText)[] {
  const figSrc = figNode.src || ""
  const figTitle = figNode.title
  const figLegend = figNode.legend

  const children: (Element | HastText)[] = []

  // Create img element
  children.push({
    type: "element",
    tagName: "img",
    properties: {
      src: figSrc,
      alt: figTitle || figNode.id,
      className: ["aimd-figure__image"],
    },
    children: [],
  } as Element)

  // Create figcaption if title or legend exists
  if (figTitle || figLegend) {
    const captionChildren: (Element | HastText)[] = []

    if (figTitle) {
      captionChildren.push({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-figure__title"] },
        children: [{ type: "text", value: figTitle }],
      } as Element)
    }

    if (figLegend) {
      captionChildren.push({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-figure__legend"] },
        children: [{ type: "text", value: figLegend }],
      } as Element)
    }

    children.push({
      type: "element",
      tagName: "figcaption",
      properties: { className: ["aimd-figure__caption"] },
      children: captionChildren,
    } as Element)
  }

  return children
}

/**
 * Walk the HAST tree and stamp each `[data-aimd-type="fig"]` element with
 * its 1-based sequence number as `data-aimd-fig-sequence`.
 *
 * This is a post-processing pass that runs after the initial HAST is built
 * so that figure numbers are consistent with document order regardless of
 * any reordering caused by rehype plugins.
 */
export function assignFigureSequenceNumbers(
  tree: HastRoot,
  fields: ExtractedAimdFields,
): void {
  const sequenceMap = buildFigureSequenceMap(fields)
  if (sequenceMap.size === 0) {
    return
  }

  const visit = (node: HastRoot | Element): void => {
    if (node.type === "element") {
      const el = node as Element
      if (el.properties?.["data-aimd-type"] === "fig") {
        const figId = el.properties["data-aimd-fig-id"] as string | undefined
        if (figId && sequenceMap.has(figId)) {
          el.properties["data-aimd-fig-sequence"] = String(sequenceMap.get(figId))
        }
      }
    }

    const children = "children" in node ? node.children : []
    for (const child of children) {
      if (child.type === "element") {
        visit(child)
      }
    }
  }

  visit(tree)
}
