import type { PhrasingContent, Root, Text } from "mdast"
import type { Plugin } from "unified"
import type {
  AimdCriticAdditionNode,
  AimdCriticCommentNode,
  AimdCriticDeletionNode,
  AimdCriticHighlightNode,
  AimdCriticMarkupChild,
  AimdCriticMarkupNode,
  AimdCriticMarkupNodeType,
  AimdCriticSubstitutionNode,
} from "../types/nodes"

export const CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY = "criticMarkupSubstitutions"

export interface ProtectedCriticMarkupSubstitution {
  placeholder: string
  node: AimdCriticSubstitutionNode
}

type MarkdownNode = PhrasingContent | Root | AimdCriticMarkupNode

type MarkdownParent = MarkdownNode & { children: MarkdownNode[] }

const SKIPPED_PARENT_TYPES = new Set([
  "code",
  "inlineCode",
  "html",
  "yaml",
  "toml",
  "definition",
  "footnoteDefinition",
  "aimd",
])

const SUBSTITUTION_PLACEHOLDER_PREFIX = "\uE000AIMDCRITICMARKUPSUBSTITUTION"
const SUBSTITUTION_PLACEHOLDER_SUFFIX = "\uE001"

function isParentNode(node: MarkdownNode): node is MarkdownParent {
  return Array.isArray((node as MarkdownParent).children)
}

function textNode(value: string): Text {
  return { type: "text", value }
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function findUnescaped(value: string, token: string, fromIndex: number): number {
  let index = value.indexOf(token, fromIndex)
  while (index >= 0) {
    if (!isEscaped(value, index)) {
      return index
    }
    index = value.indexOf(token, index + token.length)
  }
  return -1
}

function findNextOpening(value: string, fromIndex: number): number {
  let index = value.indexOf("{", fromIndex)
  while (index >= 0) {
    if (
      !isEscaped(value, index)
      && (
        value.startsWith("{++", index)
        || value.startsWith("{--", index)
        || value.startsWith("{~~", index)
        || value.startsWith("{>>", index)
        || value.startsWith("{==", index)
      )
    ) {
      return index
    }
    index = value.indexOf("{", index + 1)
  }
  return -1
}

function getInlineNodeKind(type: Exclude<AimdCriticMarkupNodeType, "criticSubstitution">) {
  switch (type) {
    case "criticAddition":
      return "addition"
    case "criticDeletion":
      return "deletion"
    case "criticComment":
      return "comment"
    case "criticHighlight":
      return "highlight"
  }
}

function createInlineNode(
  type: "criticAddition",
  raw: string,
  value: string,
): AimdCriticAdditionNode
function createInlineNode(
  type: "criticDeletion",
  raw: string,
  value: string,
): AimdCriticDeletionNode
function createInlineNode(
  type: "criticComment",
  raw: string,
  value: string,
): AimdCriticCommentNode
function createInlineNode(
  type: "criticHighlight",
  raw: string,
  value: string,
): AimdCriticHighlightNode
function createInlineNode(
  type: Exclude<AimdCriticMarkupNodeType, "criticSubstitution">,
  raw: string,
  value: string,
): AimdCriticAdditionNode | AimdCriticDeletionNode | AimdCriticCommentNode | AimdCriticHighlightNode {
  return {
    type,
    kind: getInlineNodeKind(type),
    raw,
    value,
    children: splitCriticMarkupText(value),
  } as AimdCriticAdditionNode | AimdCriticDeletionNode | AimdCriticCommentNode | AimdCriticHighlightNode
}

function parseCriticMarkupAt(value: string, startIndex: number): { node: AimdCriticMarkupNode, endIndex: number } | null {
  if (value.startsWith("{++", startIndex)) {
    const closeIndex = findUnescaped(value, "++}", startIndex + 3)
    if (closeIndex < 0) {
      return null
    }
    const inner = value.slice(startIndex + 3, closeIndex)
    return {
      node: createInlineNode("criticAddition", value.slice(startIndex, closeIndex + 3), inner),
      endIndex: closeIndex + 3,
    }
  }

  if (value.startsWith("{--", startIndex)) {
    const closeIndex = findUnescaped(value, "--}", startIndex + 3)
    if (closeIndex < 0) {
      return null
    }
    const inner = value.slice(startIndex + 3, closeIndex)
    return {
      node: createInlineNode("criticDeletion", value.slice(startIndex, closeIndex + 3), inner),
      endIndex: closeIndex + 3,
    }
  }

  if (value.startsWith("{==", startIndex)) {
    const closeIndex = findUnescaped(value, "==}", startIndex + 3)
    if (closeIndex < 0) {
      return null
    }
    const inner = value.slice(startIndex + 3, closeIndex)
    return {
      node: createInlineNode("criticHighlight", value.slice(startIndex, closeIndex + 3), inner),
      endIndex: closeIndex + 3,
    }
  }

  if (value.startsWith("{>>", startIndex)) {
    const closeIndex = findUnescaped(value, "<<}", startIndex + 3)
    if (closeIndex < 0) {
      return null
    }
    const inner = value.slice(startIndex + 3, closeIndex)
    return {
      node: createInlineNode("criticComment", value.slice(startIndex, closeIndex + 3), inner),
      endIndex: closeIndex + 3,
    }
  }

  if (value.startsWith("{~~", startIndex)) {
    const closeIndex = findUnescaped(value, "~~}", startIndex + 3)
    if (closeIndex < 0) {
      return null
    }
    const separatorIndex = findUnescaped(value, "~>", startIndex + 3)
    if (separatorIndex < 0 || separatorIndex > closeIndex) {
      return null
    }
    const oldValue = value.slice(startIndex + 3, separatorIndex)
    const newValue = value.slice(separatorIndex + 2, closeIndex)
    const raw = value.slice(startIndex, closeIndex + 3)
    return {
      node: {
        type: "criticSubstitution",
        kind: "substitution",
        raw,
        value: `${oldValue}${newValue}`,
        oldValue,
        newValue,
        oldChildren: splitCriticMarkupText(oldValue),
        newChildren: splitCriticMarkupText(newValue),
      },
      endIndex: closeIndex + 3,
    }
  }

  return null
}

function getLineEnd(value: string, index: number): number {
  const nextNewline = value.indexOf("\n", index)
  return nextNewline < 0 ? value.length : nextNewline + 1
}

function getFenceMarkerAtLineStart(value: string, index: number): { marker: string, length: number } | null {
  let cursor = index
  let spaces = 0
  while (spaces < 4 && value[cursor] === " ") {
    spaces += 1
    cursor += 1
  }
  if (spaces > 3) {
    return null
  }

  const marker = value[cursor]
  if (marker !== "`" && marker !== "~") {
    return null
  }

  let length = 0
  while (value[cursor + length] === marker) {
    length += 1
  }

  return length >= 3 ? { marker, length } : null
}

function copyInlineCodeSpan(value: string, index: number): { raw: string, endIndex: number } | null {
  if (value[index] !== "`") {
    return null
  }

  let tickCount = 0
  while (value[index + tickCount] === "`") {
    tickCount += 1
  }

  const closing = "`".repeat(tickCount)
  const closeIndex = value.indexOf(closing, index + tickCount)
  if (closeIndex < 0) {
    return null
  }

  return {
    raw: value.slice(index, closeIndex + tickCount),
    endIndex: closeIndex + tickCount,
  }
}

function createSubstitutionPlaceholder(
  source: string,
  output: string,
  substitutions: ProtectedCriticMarkupSubstitution[],
): string {
  const usedPlaceholders = new Set(substitutions.map(substitution => substitution.placeholder))
  let index = substitutions.length
  let placeholder = `${SUBSTITUTION_PLACEHOLDER_PREFIX}${index}${SUBSTITUTION_PLACEHOLDER_SUFFIX}`

  while (source.includes(placeholder) || output.includes(placeholder) || usedPlaceholders.has(placeholder)) {
    index += 1
    placeholder = `${SUBSTITUTION_PLACEHOLDER_PREFIX}${index}${SUBSTITUTION_PLACEHOLDER_SUFFIX}`
  }

  return placeholder
}

export function protectCriticMarkupSubstitutions(content: string): {
  content: string
  substitutions: ProtectedCriticMarkupSubstitution[]
} {
  const substitutions: ProtectedCriticMarkupSubstitution[] = []
  let output = ""
  let cursor = 0
  let atLineStart = true
  let fence: { marker: string, length: number } | null = null

  while (cursor < content.length) {
    if (atLineStart) {
      const marker = getFenceMarkerAtLineStart(content, cursor)
      if (marker && (!fence || (marker.marker === fence.marker && marker.length >= fence.length))) {
        fence = fence ? null : marker
        const lineEnd = getLineEnd(content, cursor)
        output += content.slice(cursor, lineEnd)
        cursor = lineEnd
        atLineStart = true
        continue
      }
    }

    if (fence) {
      const lineEnd = getLineEnd(content, cursor)
      output += content.slice(cursor, lineEnd)
      cursor = lineEnd
      atLineStart = true
      continue
    }

    const codeSpan = copyInlineCodeSpan(content, cursor)
    if (codeSpan) {
      output += codeSpan.raw
      cursor = codeSpan.endIndex
      atLineStart = false
      continue
    }

    if (content.startsWith("{~~", cursor)) {
      const parsed = parseCriticMarkupAt(content, cursor)
      if (parsed?.node.type === "criticSubstitution") {
        const placeholder = createSubstitutionPlaceholder(content, output, substitutions)
        substitutions.push({
          placeholder,
          node: parsed.node,
        })
        output += placeholder
        cursor = parsed.endIndex
        atLineStart = false
        continue
      }
    }

    const char = content[cursor]
    output += char
    cursor += 1
    atLineStart = char === "\n"
  }

  return { content: output, substitutions }
}

function pushText(nodes: AimdCriticMarkupChild[], value: string): void {
  if (!value) {
    return
  }

  const previous = nodes[nodes.length - 1]
  if (previous?.type === "text") {
    previous.value = `${previous.value ?? ""}${value}`
    return
  }

  nodes.push(textNode(value))
}

function cloneMarkdownNode<T extends AimdCriticMarkupChild>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T
}

function restoreProtectedSubstitutions(
  value: string,
  substitutions: ProtectedCriticMarkupSubstitution[] = [],
): AimdCriticMarkupChild[] {
  if (substitutions.length === 0) {
    return [textNode(value)]
  }

  const nodes: AimdCriticMarkupChild[] = []
  let cursor = 0

  while (cursor < value.length) {
    let match: ProtectedCriticMarkupSubstitution | null = null
    let matchIndex = -1

    for (const substitution of substitutions) {
      const index = value.indexOf(substitution.placeholder, cursor)
      if (index >= 0 && (matchIndex < 0 || index < matchIndex)) {
        match = substitution
        matchIndex = index
      }
    }

    if (!match || matchIndex < 0) {
      pushText(nodes, value.slice(cursor))
      break
    }

    pushText(nodes, value.slice(cursor, matchIndex))
    nodes.push(cloneMarkdownNode(match.node))
    cursor = matchIndex + match.placeholder.length
  }

  return nodes
}

export function splitCriticMarkupText(
  value: string,
  substitutions: ProtectedCriticMarkupSubstitution[] = [],
): AimdCriticMarkupChild[] {
  const restoredNodes = restoreProtectedSubstitutions(value, substitutions)
  if (restoredNodes.some(node => node.type !== "text")) {
    return restoredNodes.flatMap(node => (
      node.type === "text"
        ? splitCriticMarkupText(node.value ?? "")
        : [node]
    ))
  }

  const nodes: AimdCriticMarkupChild[] = []
  let cursor = 0

  while (cursor < value.length) {
    const openingIndex = findNextOpening(value, cursor)
    if (openingIndex < 0) {
      pushText(nodes, value.slice(cursor))
      break
    }

    pushText(nodes, value.slice(cursor, openingIndex))

    const parsed = parseCriticMarkupAt(value, openingIndex)
    if (!parsed) {
      pushText(nodes, value.slice(openingIndex, openingIndex + 1))
      cursor = openingIndex + 1
      continue
    }

    nodes.push(parsed.node)
    cursor = parsed.endIndex
  }

  return nodes
}

function transformCriticMarkupInParent(
  parent: MarkdownNode,
  substitutions: ProtectedCriticMarkupSubstitution[] = [],
): void {
  if (!isParentNode(parent)) {
    return
  }

  const nextChildren: MarkdownNode[] = []
  for (const child of parent.children) {
    if (child.type === "text") {
      nextChildren.push(...splitCriticMarkupText(child.value ?? "", substitutions))
      continue
    }

    if (!SKIPPED_PARENT_TYPES.has(child.type)) {
      transformCriticMarkupInParent(child, substitutions)
    }

    nextChildren.push(child)
  }

  parent.children = nextChildren as typeof parent.children
}

export const remarkCriticMarkup: Plugin<[], Root> = () => {
  return (tree, file) => {
    const substitutions = (
      file.data[CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY] as ProtectedCriticMarkupSubstitution[] | undefined
    ) ?? []
    transformCriticMarkupInParent(tree as Root, substitutions)
  }
}

export default remarkCriticMarkup
