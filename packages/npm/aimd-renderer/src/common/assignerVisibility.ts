import type { Plugin } from "unified"
import type { AimdRendererOptions } from "./processor"
import type { AimdAssignerVisibility } from "./processor"
import { createAimdRendererMessages } from "../locales"

/**
 * Internal markdown AST node shape used during remark processing.
 */
export interface MarkdownNode {
  type: string
  children?: MarkdownNode[]
  lang?: string | null
  meta?: string | null
  value?: string
}

export type MarkdownParent = MarkdownNode & { children: MarkdownNode[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveAssignerVisibility(
  visibility: AimdRendererOptions["assignerVisibility"],
): AimdAssignerVisibility {
  switch (visibility) {
    case "collapsed":
    case "expanded":
      return visibility
    default:
      return "hidden"
  }
}

export function isAssignerCodeNode(node: MarkdownNode): boolean {
  return node.type === "code" && (node.lang || "").trim().toLowerCase() === "assigner"
}

export function getAssignerRuntime(meta: string | null | undefined): "client" | "server" {
  const runtime = String((meta || "").match(/\bruntime\s*=\s*([^\s]+)/)?.[1] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase()
  return runtime === "client" ? "client" : "server"
}

export function getRenderedAssignerLanguage(runtime: "client" | "server"): "javascript" | "python" {
  return runtime === "client" ? "javascript" : "python"
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildInlineStyle(declarations: Record<string, string>): string {
  return Object.entries(declarations)
    .map(([property, value]) => `${property}:${value}`)
    .join(";")
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

interface AssignerPreviewPresentation {
  badge: string
  containerStyle: string
  headerStyle: string
  titleStyle: string
  badgeStyle: string
  preStyle: string
  codeStyle: string
}

function getCollapsedAssignerPresentation(runtime: "client" | "server"): AssignerPreviewPresentation {
  const isClient = runtime === "client"
  const accent = isClient ? "#0f766e" : "#9a3412"
  const accentSoft = isClient ? "rgba(15, 118, 110, 0.08)" : "rgba(154, 52, 18, 0.08)"
  const border = "rgba(148, 163, 184, 0.26)"
  const codeBackground = "#f8fafc"
  const codeForeground = "#0f172a"
  const ruleColor = "rgba(148, 163, 184, 0.18)"

  return {
    badge: isClient ? "JS" : "PY",
    containerStyle: buildInlineStyle({
      margin: "0.85rem 0",
      border: `1px solid ${border}`,
      "border-radius": "12px",
      overflow: "hidden",
      background: "rgba(255, 255, 255, 0.92)",
    }),
    headerStyle: buildInlineStyle({
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "0.7rem",
      padding: "0.6rem 0.8rem",
      "list-style": "none",
      background: "rgba(248, 250, 252, 0.92)",
      color: "#64748b",
      "font-weight": "600",
      "font-size": "0.86rem",
    }),
    titleStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      gap: "0.45rem",
      "letter-spacing": "0.01em",
    }),
    badgeStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "0.12rem 0.44rem",
      "min-width": "2rem",
      "border-radius": "999px",
      border: `1px solid ${accentSoft}`,
      background: accentSoft,
      color: accent,
      "font-size": "0.72rem",
      "font-weight": "700",
      "letter-spacing": "0.08em",
    }),
    preStyle: buildInlineStyle({
      margin: "0",
      padding: "0.8rem 0.85rem 0.9rem",
      overflow: "auto",
      background: codeBackground,
      border: "0",
      "border-top": `1px solid ${ruleColor}`,
      "tab-size": "2",
    }),
    codeStyle: buildInlineStyle({
      display: "block",
      color: codeForeground,
      background: "transparent",
      "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      "font-size": "0.88rem",
      "line-height": "1.6",
      "white-space": "pre",
      padding: "0",
    }),
  }
}

function getExpandedAssignerPresentation(runtime: "client" | "server"): AssignerPreviewPresentation {
  const presentation = getCollapsedAssignerPresentation(runtime)
  return {
    ...presentation,
    containerStyle: buildInlineStyle({
      ...Object.fromEntries(presentation.containerStyle.split(";").filter(Boolean).map(rule => {
        const [property, value] = rule.split(":")
        return [property, value]
      })),
      margin: "1rem 0",
    }),
    headerStyle: buildInlineStyle({
      ...Object.fromEntries(presentation.headerStyle.split(";").filter(Boolean).map(rule => {
        const [property, value] = rule.split(":")
        return [property, value]
      })),
      cursor: "default",
    }),
  }
}

function createAssignerHeaderHtml(summary: string, presentation: AssignerPreviewPresentation): string {
  return `<span style="${presentation.titleStyle}">${escapeHtml(summary)}</span>`
    + `<span aria-hidden="true" style="${presentation.badgeStyle}">${presentation.badge}</span>`
}

// ---------------------------------------------------------------------------
// Assigner AST node builders
// ---------------------------------------------------------------------------

function buildExpandedAssignerNode(
  value: string,
  runtime: "client" | "server",
  options: AimdRendererOptions,
): MarkdownNode {
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const language = getRenderedAssignerLanguage(runtime)
  const summary = runtime === "client"
    ? messages.assigner.clientSummary
    : messages.assigner.serverSummary
  const presentation = getExpandedAssignerPresentation(runtime)

  return {
    type: "html",
    value:
      `<div class="aimd-assigner-preview aimd-assigner-preview--expanded aimd-assigner-preview--${runtime}" data-aimd-assigner-runtime="${runtime}" style="${presentation.containerStyle}">`
      + `<div style="${presentation.headerStyle}">`
      + createAssignerHeaderHtml(summary, presentation)
      + "</div>"
      + `<pre style="${presentation.preStyle}"><code class="language-${language}" style="${presentation.codeStyle}">${escapeHtml(value)}</code></pre>`
      + "</div>",
  }
}

function buildCollapsedAssignerNode(
  value: string,
  runtime: "client" | "server",
  options: AimdRendererOptions,
): MarkdownNode {
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const language = getRenderedAssignerLanguage(runtime)
  const summary = runtime === "client"
    ? messages.assigner.clientSummary
    : messages.assigner.serverSummary
  const presentation = getCollapsedAssignerPresentation(runtime)

  return {
    type: "html",
    value:
      `<details class="aimd-assigner-preview aimd-assigner-preview--collapsed aimd-assigner-preview--${runtime}" data-aimd-assigner-runtime="${runtime}" style="${presentation.containerStyle}">`
      + `<summary style="${presentation.headerStyle}">`
      + createAssignerHeaderHtml(summary, presentation)
      + "</summary>"
      + `<pre style="${presentation.preStyle}"><code class="language-${language}" style="${presentation.codeStyle}">${escapeHtml(value)}</code></pre>`
      + "</details>",
  }
}

// ---------------------------------------------------------------------------
// Tree visitor
// ---------------------------------------------------------------------------

export function visitMarkdownParents(node: MarkdownNode, visitor: (parent: MarkdownParent) => void): void {
  if (!Array.isArray(node.children)) {
    return
  }

  const parent = node as MarkdownParent
  visitor(parent)

  for (const child of parent.children) {
    visitMarkdownParents(child, visitor)
  }
}

// ---------------------------------------------------------------------------
// Remark plugins
// ---------------------------------------------------------------------------

/**
 * Remark plugin that inserts visible assigner preview nodes (collapsed or
 * expanded) next to each assigner code block in the markdown AST.
 */
export const remarkInsertVisibleAssigners: Plugin<[AimdRendererOptions?], MarkdownNode> = (options = {}) => {
  return (tree) => {
    const visibility = resolveAssignerVisibility(options.assignerVisibility)
    if (visibility === "hidden") {
      return
    }

    visitMarkdownParents(tree, (parent) => {
      for (let index = 0; index < parent.children.length; index++) {
        const child = parent.children[index]
        if (!isAssignerCodeNode(child)) {
          continue
        }

        const runtime = getAssignerRuntime(child.meta)
        const replacement = visibility === "expanded"
          ? buildExpandedAssignerNode(child.value || "", runtime, options)
          : buildCollapsedAssignerNode(child.value || "", runtime, options)

        parent.children.splice(index, 0, replacement)
        index += 1
      }
    })
  }
}

/**
 * Remark plugin that strips all assigner code blocks from the markdown AST.
 */
export const remarkStripAssignerCodeBlocks: Plugin<[], MarkdownNode> = () => {
  return (tree) => {
    visitMarkdownParents(tree, (parent) => {
      parent.children = parent.children.filter(child => !isAssignerCodeNode(child))
    })
  }
}
