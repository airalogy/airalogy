import type { Element, Text as HastText, Root as HastRoot } from "hast"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import { buildCaptionedResourceCaption, createTextElement } from "./captionedResourceRendering"

export interface AimdMediaRenderInput {
  id: string
  kind: string
  src?: string
  mime?: string
  provider?: string
  poster?: string
  title?: string
  legend?: string
  sequence?: number | string
  captionTitle?: (sequence: number, title?: string, kind?: string) => string
  pinLabel?: string
  unpinLabel?: string
  pinSizeControlsLabel?: string
  pinSizeSmallLabel?: string
  pinSizeMediumLabel?: string
  pinSizeLargeLabel?: string
  pinSizeSmallTitle?: string
  pinSizeMediumTitle?: string
  pinSizeLargeTitle?: string
  showLegendLabel?: string
  hideLegendLabel?: string
  showLegendTitle?: string
  hideLegendTitle?: string
}

export interface AimdMediaSequenceInfo {
  sequence: number
  kind: string
  title?: string
}

export interface AimdMediaNumberingMessages {
  reference: (value: string | number, kind?: string) => string
  captionTitle: (sequence: number, title?: string, kind?: string) => string
}

export function normalizeMediaKind(kind: string | undefined): string {
  return (kind || "").trim().toLowerCase() || "file"
}

export function normalizeMediaNumberingKind(kind: string | undefined): "video" | "audio" | "file" {
  const normalized = normalizeMediaKind(kind)
  if (normalized === "video" || normalized === "audio") {
    return normalized
  }
  return "file"
}

export function isPinnableMediaKind(kind: string | undefined): boolean {
  const normalizedKind = normalizeMediaNumberingKind(kind)
  return normalizedKind === "video" || normalizedKind === "audio"
}

function buildPinnedMediaSizeControls(mediaNode: AimdMediaRenderInput): Element {
  const sizeOptions = [
    {
      size: "small",
      label: mediaNode.pinSizeSmallLabel || "S",
      title: mediaNode.pinSizeSmallTitle || "Small pinned size",
      pressed: "false",
    },
    {
      size: "medium",
      label: mediaNode.pinSizeMediumLabel || "M",
      title: mediaNode.pinSizeMediumTitle || "Medium pinned size",
      pressed: "true",
    },
    {
      size: "large",
      label: mediaNode.pinSizeLargeLabel || "L",
      title: mediaNode.pinSizeLargeTitle || "Large pinned size",
      pressed: "false",
    },
  ]

  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["aimd-media__size-controls"],
      "data-aimd-media-size-controls": mediaNode.id,
      "aria-label": mediaNode.pinSizeControlsLabel || "Pinned media size",
    },
    children: sizeOptions.map(option => ({
      type: "element",
      tagName: "button",
      properties: {
        type: "button",
        className: ["aimd-media__size"],
        "data-aimd-media-size-option": option.size,
        "aria-pressed": option.pressed,
        "aria-label": option.title,
        title: option.title,
      },
      children: [{ type: "text", value: option.label }],
    } as Element)),
  } as Element
}

function buildPinnedMediaLegendToggle(mediaNode: AimdMediaRenderInput): Element | undefined {
  if (!mediaNode.legend) {
    return undefined
  }

  const showTitle = mediaNode.showLegendTitle || "Show media description"
  return {
    type: "element",
    tagName: "button",
    properties: {
      type: "button",
      className: ["aimd-media__legend-toggle"],
      "data-aimd-media-legend-toggle": mediaNode.id,
      "data-aimd-media-show-legend-label": mediaNode.showLegendLabel || "Details",
      "data-aimd-media-hide-legend-label": mediaNode.hideLegendLabel || "Hide",
      "data-aimd-media-show-legend-title": showTitle,
      "data-aimd-media-hide-legend-title": mediaNode.hideLegendTitle || "Hide media description",
      "aria-expanded": "false",
      "aria-label": showTitle,
      title: showTitle,
    },
    children: [{ type: "text", value: mediaNode.showLegendLabel || "Details" }],
  } as Element
}

export function inferMediaMimeType(src: string | undefined, kind?: string): string | undefined {
  const normalizedKind = normalizeMediaNumberingKind(kind)
  const normalizedSrc = (src || "").split(/[?#]/, 1)[0]?.trim().toLowerCase() || ""
  const extension = normalizedSrc.match(/\.([a-z0-9]+)$/)?.[1]
  if (!extension) {
    return undefined
  }

  if (normalizedKind === "video") {
    switch (extension) {
      case "mp4":
      case "m4v":
        return "video/mp4"
      case "webm":
        return "video/webm"
      case "ogv":
      case "ogg":
        return "video/ogg"
      case "mov":
        return "video/quicktime"
      case "m3u8":
        return "application/vnd.apple.mpegurl"
      default:
        return undefined
    }
  }

  if (normalizedKind === "audio") {
    switch (extension) {
      case "mp3":
        return "audio/mpeg"
      case "m4a":
        return "audio/mp4"
      case "aac":
        return "audio/aac"
      case "wav":
        return "audio/wav"
      case "oga":
      case "ogg":
        return "audio/ogg"
      case "flac":
        return "audio/flac"
      case "opus":
        return "audio/ogg"
      default:
        return undefined
    }
  }

  return undefined
}

export function buildMediaSequenceInfoMap(fields: ExtractedAimdFields): Map<string, AimdMediaSequenceInfo> {
  const sequenceMap = new Map<string, AimdMediaSequenceInfo>()
  const nextSequenceByKind = new Map<string, number>()
  const mediaItems = fields.media || []
  for (const media of mediaItems) {
    const id = typeof media === "string" ? media : (media as any)?.id
    if (typeof id !== "string" || !id.trim() || sequenceMap.has(id)) {
      continue
    }

    const kind = normalizeMediaNumberingKind(typeof media === "string" ? undefined : (media as any)?.kind)
    const sequence = nextSequenceByKind.get(kind) ?? 1
    nextSequenceByKind.set(kind, sequence + 1)
    sequenceMap.set(id, {
      sequence,
      kind,
      title: typeof media === "string" ? undefined : (media as any)?.title,
    })
  }
  return sequenceMap
}

export function buildMediaSequenceMap(fields: ExtractedAimdFields): Map<string, number> {
  const sequenceMap = new Map<string, number>()
  for (const [id, info] of buildMediaSequenceInfoMap(fields)) {
    sequenceMap.set(id, info.sequence)
  }
  return sequenceMap
}

export function buildMediaChildren(mediaNode: AimdMediaRenderInput): (Element | HastText)[] {
  const kind = normalizeMediaNumberingKind(mediaNode.kind)
  const src = mediaNode.src || ""
  const title = mediaNode.title || mediaNode.id
  const mime = mediaNode.mime || inferMediaMimeType(src, kind)
  const provider = mediaNode.provider?.trim()
  const children: (Element | HastText)[] = []

  const mediaBodyChildren: (Element | HastText)[] = []
  if (kind === "video") {
    if (provider) {
      mediaBodyChildren.push({
        type: "element",
        tagName: "iframe",
        properties: {
          src,
          title,
          loading: "lazy",
          allow: "fullscreen; picture-in-picture",
          allowFullScreen: true,
          className: ["aimd-media__embed"],
        },
        children: [],
      } as Element)
    }
    else {
      mediaBodyChildren.push({
        type: "element",
        tagName: "video",
        properties: {
          src,
          poster: mediaNode.poster,
          controls: true,
          preload: "metadata",
          className: ["aimd-media__video"],
        },
        children: mime
          ? [{
              type: "element",
              tagName: "source",
              properties: {
                src,
                type: mime,
              },
              children: [],
            } as Element]
          : [],
      } as Element)
    }
  }
  else if (kind === "audio") {
    mediaBodyChildren.push({
      type: "element",
      tagName: "audio",
      properties: {
        src,
        controls: true,
        preload: "metadata",
        className: ["aimd-media__audio"],
      },
      children: mime
        ? [{
            type: "element",
            tagName: "source",
            properties: {
              src,
              type: mime,
            },
            children: [],
          } as Element]
        : [],
    } as Element)
  }
  else {
    mediaBodyChildren.push({
      type: "element",
      tagName: "a",
      properties: {
        href: src,
        target: "_blank",
        rel: "noopener noreferrer",
        className: ["aimd-media__file-link"],
      },
      children: [{ type: "text", value: title || src }],
    } as Element)
  }

  children.push({
    type: "element",
    tagName: "div",
    properties: { className: ["aimd-media__body", `aimd-media__body--${kind}`] },
    children: mediaBodyChildren,
  } as Element)

  const sequenceNumber = typeof mediaNode.sequence === "number"
    ? mediaNode.sequence
    : (typeof mediaNode.sequence === "string" && mediaNode.sequence.trim() ? Number(mediaNode.sequence) : undefined)
  const captionTitle = Number.isFinite(sequenceNumber)
    ? (mediaNode.captionTitle?.(sequenceNumber as number, mediaNode.title, kind) ?? (mediaNode.title ? `Media ${sequenceNumber}: ${mediaNode.title}` : `Media ${sequenceNumber}`))
    : mediaNode.title

  const captionActions: Element[] = []
  if (isPinnableMediaKind(kind)) {
    const actionChildren: Element[] = []
    const legendToggle = buildPinnedMediaLegendToggle(mediaNode)
    if (legendToggle) {
      actionChildren.push(legendToggle)
    }
    actionChildren.push(
      buildPinnedMediaSizeControls(mediaNode),
      {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["aimd-media__pin"],
          "data-aimd-media-pin": mediaNode.id,
          "data-aimd-media-pin-label": mediaNode.pinLabel || "Pin",
          "data-aimd-media-unpin-label": mediaNode.unpinLabel || "Unpin",
          "aria-pressed": "false",
        },
        children: [{ type: "text", value: mediaNode.pinLabel || "Pin" }],
      } as Element,
    )

    captionActions.push({
      type: "element",
      tagName: "span",
      properties: {
        className: ["aimd-media__actions"],
      },
      children: actionChildren,
    } as Element)
  }

  const caption = buildCaptionedResourceCaption({
    captionTagName: "div",
    captionClassName: ["aimd-media__caption"],
    title: captionTitle,
    titleClassName: ["aimd-media__title"],
    legend: mediaNode.legend,
    legendClassName: ["aimd-media__legend"],
    actions: captionActions,
  })
  if (caption) {
    children.push(caption)
  }

  return children
}

export function assignMediaSequenceNumbers(
  tree: HastRoot,
  fields: ExtractedAimdFields,
  messages?: AimdMediaNumberingMessages,
): void {
  const sequenceMap = buildMediaSequenceInfoMap(fields)
  if (sequenceMap.size === 0) {
    return
  }

  const hasClass = (el: Element, className: string): boolean => {
    const classes = el.properties?.className
    return Array.isArray(classes) && classes.includes(className)
  }

  const getProperty = (el: Element, kebabKey: string, camelKey: string): unknown => {
    return el.properties?.[kebabKey] ?? el.properties?.[camelKey]
  }

  const findChildElementByClass = (el: Element, className: string): Element | undefined => {
    return (el.children || []).find(child => child.type === "element" && hasClass(child as Element, className)) as Element | undefined
  }

  const ensureMediaCaption = (el: Element): Element => {
    const existing = findChildElementByClass(el, "aimd-media__caption")
    if (existing) {
      return existing
    }

    const caption: Element = {
      type: "element",
      tagName: "div",
      properties: { className: ["aimd-media__caption"] },
      children: [],
    }
    el.children = [...(el.children || []), caption]
    return caption
  }

  const upsertMediaCaptionTitle = (el: Element, info: AimdMediaSequenceInfo): void => {
    if (!messages) {
      return
    }
    const caption = ensureMediaCaption(el)
    const label = messages.captionTitle(info.sequence, info.title, info.kind)
    const titleEl = findChildElementByClass(caption, "aimd-media__title")
    if (titleEl) {
      titleEl.children = [{ type: "text", value: label }]
      return
    }
    caption.children = [
      createTextElement("div", ["aimd-media__title"], label),
      ...(caption.children || []),
    ]
  }

  const replaceMediaReferenceLabel = (el: Element, info: AimdMediaSequenceInfo): void => {
    if (!messages) {
      return
    }
    const label = messages.reference(info.sequence, info.kind)
    el.children = [
      createTextElement("span", ["aimd-ref__content"], label),
    ]
  }

  const visit = (node: HastRoot | Element): void => {
    if (node.type === "element") {
      const el = node as Element
      const aimdType = getProperty(el, "data-aimd-type", "dataAimdType")
      if (aimdType === "media") {
        const mediaId = getProperty(el, "data-aimd-media-id", "dataAimdMediaId") as string | undefined
        if (mediaId && sequenceMap.has(mediaId)) {
          const info = sequenceMap.get(mediaId)!
          el.properties["data-aimd-media-sequence"] = String(info.sequence)
          el.properties["data-aimd-media-numbering-kind"] = info.kind
          upsertMediaCaptionTitle(el, info)
        }
      }
      else if (aimdType === "ref_media") {
        const mediaId = getProperty(el, "data-aimd-ref-target", "dataAimdRefTarget") as string | undefined
        if (mediaId && sequenceMap.has(mediaId)) {
          const info = sequenceMap.get(mediaId)!
          el.properties["data-aimd-media-sequence"] = String(info.sequence)
          el.properties["data-aimd-ref-media-kind"] = info.kind
          replaceMediaReferenceLabel(el, info)
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
