/**
 * Pure helper logic extracted from AimdDnaSequenceField.
 *
 * Contains viewer-annotation ID helpers, selection/segment conversion,
 * import/export utilities, and file-download logic. None of the functions
 * here touch Vue reactivity — they are plain, testable functions.
 */
import type {
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
} from "../types"
import {
  collectInvalidDnaSequenceCharacters,
  normalizeDnaSequenceName,
  serializeDnaSequenceToGenBank,
} from "./useDnaSequence"

// ---- Types shared between sub-components ----

export type DnaEditorMode = "interactive" | "raw"

export interface ViewerAnnotation {
  id: string
  name: string
  start: number
  end: number
  direction?: 1 | -1
  color?: string
}

export interface ViewerSelection {
  clockwise?: boolean
  direction?: number
  end?: number
  id?: string
  length?: number
  name?: string
  start?: number
  type: string
  viewer?: "LINEAR" | "CIRCULAR"
}

export interface ViewerExternalSelection {
  clockwise?: boolean
  end: number
  start: number
}

// ---- Constants ----

export const VIEWER_ANNOTATION_PREFIX = "dna_annotation"

// ---- Viewer annotation ID helpers ----

export function buildViewerAnnotationId(annotationId: string, segmentIndex: number): string {
  return `${VIEWER_ANNOTATION_PREFIX}:${annotationId}:${segmentIndex}`
}

export function parseViewerAnnotationId(id: string | undefined): { annotationId: string; segmentIndex: number } | null {
  if (!id || !id.startsWith(`${VIEWER_ANNOTATION_PREFIX}:`)) {
    return null
  }

  const [, annotationId = "", rawSegmentIndex = "0"] = id.split(":")
  const segmentIndex = Number.parseInt(rawSegmentIndex, 10)
  if (!annotationId || !Number.isFinite(segmentIndex) || segmentIndex < 0) {
    return null
  }

  return {
    annotationId,
    segmentIndex,
  }
}

// ---- Numeric guard ----

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

// ---- Segment / Selection formatting & conversion ----

export function formatSegment(segment: AimdDnaSequenceSegment): string {
  const start = segment.partial_start ? `<${segment.start}` : String(segment.start)
  const end = segment.partial_end ? `>${segment.end}` : String(segment.end)
  return `${start}..${end}`
}

export function annotationSegmentsLabel(annotation: AimdDnaSequenceAnnotation): string {
  return annotation.segments.map(formatSegment).join(", ")
}

export function normalizeViewerSelection(value: unknown): ViewerSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const selection = value as Record<string, unknown>
  const hasRange = isFiniteNumber(selection.start) && isFiniteNumber(selection.end)
  const type = typeof selection.type === "string" && selection.type
    ? selection.type
    : hasRange
      ? "SEQ"
      : ""
  if (!type) {
    return null
  }

  return {
    type,
    clockwise: selection.clockwise === true,
    direction: isFiniteNumber(selection.direction) ? selection.direction : undefined,
    end: isFiniteNumber(selection.end) ? selection.end : undefined,
    id: typeof selection.id === "string" ? selection.id : undefined,
    length: isFiniteNumber(selection.length) ? selection.length : undefined,
    name: typeof selection.name === "string" ? selection.name : undefined,
    start: isFiniteNumber(selection.start) ? selection.start : undefined,
    viewer: selection.viewer === "CIRCULAR" ? "CIRCULAR" : selection.viewer === "LINEAR" ? "LINEAR" : undefined,
  }
}

export function createSegmentsFromSelection(
  nextSelection: ViewerSelection | null,
  topology: "linear" | "circular",
  totalLength: number,
): AimdDnaSequenceSegment[] {
  if (!nextSelection || totalLength <= 0) {
    return []
  }

  if (!isFiniteNumber(nextSelection.start) || !isFiniteNumber(nextSelection.end)) {
    return []
  }

  const rawStart = Math.max(0, Math.min(nextSelection.start, totalLength - 1))
  const rawEnd = Math.max(0, Math.min(nextSelection.end, totalLength))

  if (rawEnd === rawStart) {
    return []
  }

  if (topology === "circular" && rawEnd < rawStart) {
    const segments: AimdDnaSequenceSegment[] = []

    if (rawStart < totalLength) {
      segments.push({
        start: rawStart + 1,
        end: totalLength,
        partial_start: false,
        partial_end: false,
      })
    }

    if (rawEnd > 0) {
      segments.push({
        start: 1,
        end: rawEnd,
        partial_start: false,
        partial_end: false,
      })
    }

    return segments.filter(segment => segment.end >= segment.start)
  }

  const start = Math.min(rawStart, rawEnd)
  const end = Math.max(rawStart, rawEnd)
  return [{
    start: start + 1,
    end,
    partial_start: false,
    partial_end: false,
  }]
}

export function createExternalSelectionFromSegment(segment: AimdDnaSequenceSegment): ViewerExternalSelection {
  return {
    start: Math.max(segment.start - 1, 0),
    end: segment.end,
    clockwise: true,
  }
}

export function createExternalSelectionFromSelection(nextSelection: ViewerSelection | null): ViewerExternalSelection | null {
  if (!nextSelection || !isFiniteNumber(nextSelection.start) || !isFiniteNumber(nextSelection.end)) {
    return null
  }

  return {
    start: nextSelection.start,
    end: nextSelection.end,
    clockwise: nextSelection.clockwise,
  }
}

// ---- Viewer annotations builder ----

export function buildViewerAnnotations(
  annotations: AimdDnaSequenceAnnotation[],
  totalLength: number,
): ViewerAnnotation[] {
  const result: ViewerAnnotation[] = []

  for (const annotation of annotations) {
    annotation.segments.forEach((segment, segmentIndex) => {
      const start = Math.max(segment.start - 1, 0)
      const end = Math.min(segment.end, totalLength)
      if (totalLength <= 0 || end <= start) {
        return
      }

      result.push({
        id: buildViewerAnnotationId(annotation.id, segmentIndex),
        name: annotation.segments.length > 1
          ? `${annotation.name} ${segmentIndex + 1}/${annotation.segments.length}`
          : annotation.name,
        start,
        end,
        direction: annotation.strand,
        color: annotation.color,
      })
    })
  }

  return result
}

// ---- Import helpers ----

export function detectImportedTopology(text: string): "linear" | "circular" | null {
  const normalized = text.replace(/\r\n?/g, "\n")
  const locusLine = normalized.match(/(?:^|\n)LOCUS[^\n]*/i)?.[0]
  if (!locusLine) {
    return null
  }
  if (/\bcircular\b/i.test(locusLine)) {
    return "circular"
  }
  if (/\blinear\b/i.test(locusLine)) {
    return "linear"
  }
  return null
}

export function stripFileExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "")
}

export function detectImportedName(text: string, fallbackName = ""): string {
  const normalized = text.replace(/\r\n?/g, "\n")
  const locusMatch = normalized.match(/(?:^|\n)LOCUS\s+([^\s]+)/i)
  if (locusMatch?.[1]) {
    return normalizeDnaSequenceName(locusMatch[1])
  }

  const fastaMatch = normalized.match(/^\s*>(.+)$/m)
  if (fastaMatch?.[1]) {
    return normalizeDnaSequenceName(fastaMatch[1])
  }

  return normalizeDnaSequenceName(fallbackName)
}

export function normalizeImportedSequenceText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n")
  const genBankMatch = normalized.match(/(?:^|\n)ORIGIN\b([\s\S]*?)(?:\n\/\/|\s*$)/i)
  if (genBankMatch?.[1]) {
    return genBankMatch[1].replace(/[^A-Za-z]/g, "").toUpperCase()
  }

  if (/^\s*>/m.test(normalized)) {
    return normalized
      .split("\n")
      .filter(line => !line.trimStart().startsWith(">"))
      .join("")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
  }

  return normalized.replace(/[^A-Za-z]/g, "").toUpperCase()
}

// ---- Export / download helpers ----

export function sanitizeDownloadBaseName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.-]/g, "_")
  return normalized || "dna_sequence"
}

export function downloadGenBankFile(
  sequenceValue: AimdDnaSequenceValue,
  varId: string,
): void {
  if (sequenceValue.sequence.length <= 0 || typeof document === "undefined" || typeof URL === "undefined") {
    return
  }

  const content = serializeDnaSequenceToGenBank(sequenceValue, {
    name: sequenceValue.name || varId,
  })
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = `${sanitizeDownloadBaseName(sequenceValue.name || varId)}.gbk`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}
