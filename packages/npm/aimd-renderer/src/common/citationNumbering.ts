import type { Element, Root as HastRoot, RootContent, Text as HastText } from "hast"
import type { AimdNode, AimdReferenceEntry, ExtractedAimdFields } from "@airalogy/aimd-core/types"

export interface AimdCitationReferenceDisplay {
  id: string
  label: string
  summary: string
}

type AimdCitationNodeWithDisplay = AimdNode & {
  refs?: string[]
  citationRefs?: AimdCitationReferenceDisplay[]
}

function isElementNode(node: RootContent | HastRoot): node is Element {
  return node.type === "element"
}

function createTextNode(value: string): HastText {
  return { type: "text", value }
}

function readStringProperty(properties: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === "string") {
      return value
    }
  }
  return undefined
}

function splitCsv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
}

function hasClass(element: Element, className: string): boolean {
  const value = element.properties?.className ?? element.properties?.class
  if (Array.isArray(value)) {
    return value.includes(className)
  }
  if (typeof value === "string") {
    return value.split(/\s+/).includes(className)
  }
  return false
}

function isReferenceSectionElement(element: Element): boolean {
  const properties = element.properties || {}
  const aimdType = properties["data-aimd-type"] || properties.dataAimdType
  const aimdData = (element.data as { aimd?: AimdNode } | undefined)?.aimd
  return aimdType === "refs" || aimdData?.fieldType === "refs" || hasClass(element, "aimd-refs")
}

function isCitationElement(element: Element): boolean {
  const properties = element.properties || {}
  const aimdType = properties["data-aimd-type"] || properties.dataAimdType
  const aimdData = (element.data as { aimd?: AimdNode } | undefined)?.aimd
  return aimdType === "cite" || aimdData?.fieldType === "cite" || hasClass(element, "aimd-cite")
}

function getReferenceContainer(entry: AimdReferenceEntry): string | undefined {
  return entry.journal || entry.booktitle || entry.publisher
}

export function formatCitationReferenceSummary(entry: AimdReferenceEntry | undefined, fallbackId: string): string {
  if (!entry) {
    return fallbackId
  }

  const parts = [
    entry.author,
    entry.year ? `(${entry.year})` : undefined,
    entry.title,
    getReferenceContainer(entry),
    entry.doi ? `doi:${entry.doi}` : undefined,
    entry.url,
  ]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(" ") : fallbackId
}

function getCitationRefIds(element: Element): string[] {
  const aimdData = (element.data as { aimd?: AimdCitationNodeWithDisplay } | undefined)?.aimd
  if (aimdData?.fieldType === "cite" && Array.isArray(aimdData.refs)) {
    return aimdData.refs.map(ref => String(ref).trim()).filter(Boolean)
  }

  const properties = element.properties || {}
  const refs = readStringProperty(properties as Record<string, unknown>, ["data-aimd-refs", "dataAimdRefs"])
  const parsedRefs = splitCsv(refs)
  if (parsedRefs.length > 0) {
    return parsedRefs
  }

  const id = readStringProperty(properties as Record<string, unknown>, ["data-aimd-id", "dataAimdId"])
  return id ? [id] : []
}

function buildCitationLabelMap(fields: ExtractedAimdFields): Map<string, string> {
  const labels = new Map<string, string>()
  for (const [index, entry] of (fields.refs || []).entries()) {
    const id = entry.id?.trim()
    if (id && !labels.has(id)) {
      labels.set(id, String(index + 1))
    }
  }
  return labels
}

function buildCitationSummaryMap(fields: ExtractedAimdFields): Map<string, string> {
  const summaries = new Map<string, string>()
  for (const entry of fields.refs || []) {
    const id = entry.id?.trim()
    if (id && !summaries.has(id)) {
      summaries.set(id, formatCitationReferenceSummary(entry, id))
    }
  }
  return summaries
}

function buildCitationRefs(
  refIds: string[],
  labelByRefId: Map<string, string>,
  summaryByRefId: Map<string, string>,
): AimdCitationReferenceDisplay[] {
  return refIds.map(id => ({
    id,
    label: labelByRefId.get(id) || id,
    summary: summaryByRefId.get(id) || id,
  }))
}

function createCitationReferenceElement(citationRef: AimdCitationReferenceDisplay): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["aimd-cite__ref"],
      role: "doc-noteref",
      tabIndex: 0,
      title: citationRef.summary,
      "data-aimd-ref-id": citationRef.id,
      "data-aimd-ref-summary": citationRef.summary,
      "aria-label": citationRef.label === citationRef.id
        ? `Reference ${citationRef.summary}`
        : `Reference ${citationRef.label}: ${citationRef.summary}`,
    },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-cite__label"] },
        children: [createTextNode(citationRef.label)],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: {
          className: ["aimd-cite__popover"],
          role: "tooltip",
        },
        children: [createTextNode(citationRef.summary)],
      } as Element,
    ],
  } as Element
}

function createCitationChildren(citationRefs: AimdCitationReferenceDisplay[]): Array<Element | HastText> {
  const children: Array<Element | HastText> = [createTextNode("[")]

  citationRefs.forEach((citationRef, index) => {
    if (index > 0) {
      children.push(createTextNode(", "))
    }

    children.push(createCitationReferenceElement(citationRef))
  })

  children.push(createTextNode("]"))
  return children
}

function annotateCitationElement(element: Element, citationRefs: AimdCitationReferenceDisplay[]): void {
  const properties = element.properties || {}
  element.properties = {
    ...properties,
    "data-aimd-citation-labels": citationRefs.map(ref => ref.label).join(","),
    "data-aimd-citation-summaries": JSON.stringify(citationRefs.map(ref => ref.summary)),
  }

  const data = ((element as any).data || {}) as { aimd?: AimdCitationNodeWithDisplay }
  if (data.aimd?.fieldType === "cite") {
    data.aimd.citationRefs = citationRefs
    data.aimd.refs = citationRefs.map(ref => ref.id)
    ;(element as any).data = data
  }

  element.children = createCitationChildren(citationRefs)
}

function walk(node: HastRoot | RootContent, visitor: (element: Element) => void): void {
  if (!isElementNode(node) && node.type !== "root") {
    return
  }

  if (isElementNode(node)) {
    visitor(node)
  }

  const children = node.children || []
  for (const child of children) {
    walk(child, visitor)
  }
}

function extractReferenceSections(children: RootContent[], sections: Element[]): RootContent[] {
  const nextChildren: RootContent[] = []

  for (const child of children) {
    if (isElementNode(child)) {
      if (isReferenceSectionElement(child)) {
        sections.push(child)
        continue
      }

      child.children = extractReferenceSections(child.children || [], sections) as Element["children"]
    }

    nextChildren.push(child)
  }

  return nextChildren
}

export function moveReferenceSectionsToEnd(tree: HastRoot): void {
  const sections: Element[] = []
  tree.children = extractReferenceSections(tree.children, sections)
  if (sections.length > 0) {
    tree.children.push(...sections)
  }
}

export function annotateCitationReferenceLabels(tree: HastRoot, fields: ExtractedAimdFields): void {
  const labelByRefId = buildCitationLabelMap(fields)
  const summaryByRefId = buildCitationSummaryMap(fields)

  walk(tree, (element) => {
    if (!isCitationElement(element)) {
      return
    }

    const refIds = getCitationRefIds(element)
    if (refIds.length === 0) {
      return
    }

    annotateCitationElement(element, buildCitationRefs(refIds, labelByRefId, summaryByRefId))
  })
}
