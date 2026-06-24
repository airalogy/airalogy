import type { Element, Text as HastText } from "hast"

export type CaptionedResourceChild = Element | HastText

export interface CaptionedResourceCaptionInput {
  captionTagName?: string
  captionClassName: string[]
  title?: string
  titleClassName: string[]
  legend?: string
  legendClassName: string[]
  actions?: Element[]
}

export function createTextElement(
  tagName: string,
  className: string[],
  value: string,
): Element {
  return {
    type: "element",
    tagName,
    properties: { className },
    children: [{ type: "text", value }],
  } as Element
}

export function buildCaptionedResourceCaption(
  input: CaptionedResourceCaptionInput,
): Element | undefined {
  const captionChildren: CaptionedResourceChild[] = []

  if (input.title) {
    captionChildren.push(createTextElement("div", input.titleClassName, input.title))
  }

  if (Array.isArray(input.actions) && input.actions.length > 0) {
    captionChildren.push(...input.actions)
  }

  if (input.legend) {
    captionChildren.push(createTextElement("div", input.legendClassName, input.legend))
  }

  if (captionChildren.length === 0) {
    return undefined
  }

  return {
    type: "element",
    tagName: input.captionTagName || "figcaption",
    properties: { className: input.captionClassName },
    children: captionChildren,
  } as Element
}
