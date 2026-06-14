import type { Element, Root as HastRoot, RootContent, Text as HastText } from "hast"
import type { AimdNode, ExtractedAimdFields } from "@airalogy/aimd-core/types"

export interface AimdCitationReferenceDisplay {
  id: string
  label: string
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

function isCitationElement(element: Element): boolean {
  const properties = element.properties || {}
  const aimdType = properties["data-aimd-type"] || properties.dataAimdType
  const aimdData = (element.data as { aimd?: AimdNode } | undefined)?.aimd
  return aimdType === "cite" || aimdData?.fieldType === "cite" || hasClass(element, "aimd-cite")
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

function buildCitationRefs(refIds: string[], labelByRefId: Map<string, string>): AimdCitationReferenceDisplay[] {
  return refIds.map(id => ({
    id,
    label: labelByRefId.get(id) || id,
  }))
}

function createCitationChildren(citationRefs: AimdCitationReferenceDisplay[]): Array<Element | HastText> {
  const children: Array<Element | HastText> = [createTextNode("[")]

  citationRefs.forEach((citationRef, index) => {
    if (index > 0) {
      children.push(createTextNode(", "))
    }

    children.push({
      type: "element",
      tagName: "a",
      properties: {
        className: ["aimd-cite__ref"],
        href: `#ref-${citationRef.id}`,
        title: citationRef.id,
        "data-aimd-ref-id": citationRef.id,
        "aria-label": citationRef.label === citationRef.id
          ? `Reference ${citationRef.id}`
          : `Reference ${citationRef.label}: ${citationRef.id}`,
      },
      children: [createTextNode(citationRef.label)],
    } as Element)
  })

  children.push(createTextNode("]"))
  return children
}

function annotateCitationElement(element: Element, citationRefs: AimdCitationReferenceDisplay[]): void {
  const properties = element.properties || {}
  element.properties = {
    ...properties,
    "data-aimd-citation-labels": citationRefs.map(ref => ref.label).join(","),
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

export function annotateCitationReferenceLabels(tree: HastRoot, fields: ExtractedAimdFields): void {
  const labelByRefId = buildCitationLabelMap(fields)

  walk(tree, (element) => {
    if (!isCitationElement(element)) {
      return
    }

    const refIds = getCitationRefIds(element)
    if (refIds.length === 0) {
      return
    }

    annotateCitationElement(element, buildCitationRefs(refIds, labelByRefId))
  })
}
