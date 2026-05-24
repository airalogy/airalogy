import type {
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
} from "../types"

export const AIMD_DNA_SEQUENCE_FORMAT = "airalogy_dna_v1" as const

const ALLOWED_DNA_CHARACTERS = new Set("ACGTRYSWKMBDHVN".split(""))
const GENBANK_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const

function toPositiveInteger(value: unknown, fallback: number): number {
  const text = typeof value === "string" ? value.trim() : String(value ?? "")
  const parsed = Number.parseInt(text, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1"
}

function toStrand(value: unknown): 1 | -1 {
  return value === -1 || value === "-1" ? -1 : 1
}

export function normalizeDnaSequenceText(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.toUpperCase().replace(/\s+/g, "")
}

export function normalizeDnaSequenceName(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.replace(/\s+/g, " ").trim()
}

export function collectInvalidDnaSequenceCharacters(sequence: string): string[] {
  const invalid = new Set<string>()
  for (const char of sequence.toUpperCase()) {
    if (!ALLOWED_DNA_CHARACTERS.has(char)) {
      invalid.add(char)
    }
  }
  return [...invalid]
}

export function createEmptyDnaSequenceSegment(): AimdDnaSequenceSegment {
  return {
    start: 1,
    end: 1,
    partial_start: false,
    partial_end: false,
  }
}

export function createEmptyDnaSequenceQualifier(key = "note"): AimdDnaSequenceQualifier {
  return {
    key,
    value: "",
  }
}

export function createEmptyDnaSequenceAnnotation(id = "ann_1"): AimdDnaSequenceAnnotation {
  return {
    id,
    name: "Feature",
    type: "misc_feature",
    strand: 1,
    color: "#2563eb",
    segments: [createEmptyDnaSequenceSegment()],
    qualifiers: [],
  }
}

export function getNextDnaSequenceAnnotationId(annotations: AimdDnaSequenceAnnotation[]): string {
  const used = new Set(annotations.map(annotation => annotation.id))
  let index = 1
  while (used.has(`ann_${index}`)) {
    index += 1
  }
  return `ann_${index}`
}

export function normalizeDnaSequenceSegment(value: unknown): AimdDnaSequenceSegment {
  const fallback = createEmptyDnaSequenceSegment()
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback
  }

  const obj = value as Record<string, unknown>
  const start = toPositiveInteger(obj.start, fallback.start)
  const end = toPositiveInteger(obj.end, Math.max(start, fallback.end))

  return {
    start,
    end,
    partial_start: toBoolean(obj.partial_start),
    partial_end: toBoolean(obj.partial_end),
  }
}

export function normalizeDnaSequenceQualifier(
  value: unknown,
  index = 0,
): AimdDnaSequenceQualifier {
  const fallback = createEmptyDnaSequenceQualifier(index === 0 ? "note" : "qualifier")
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback
  }

  const obj = value as Record<string, unknown>
  return {
    key: typeof obj.key === "string" && obj.key.trim() ? obj.key.trim() : fallback.key,
    value: typeof obj.value === "string" ? obj.value : String(obj.value ?? ""),
  }
}

function normalizeLegacyQualifierValue(
  key: string,
  rawValue: unknown,
): AimdDnaSequenceQualifier[] {
  if (Array.isArray(rawValue)) {
    return rawValue.map(item => ({
      key,
      value: typeof item === "string" ? item : String(item ?? ""),
    }))
  }

  return [{
    key,
    value: typeof rawValue === "string" ? rawValue : String(rawValue ?? ""),
  }]
}

function normalizeDnaSequenceQualifiers(
  value: unknown,
  legacyNote?: unknown,
): AimdDnaSequenceQualifier[] {
  const qualifiers: AimdDnaSequenceQualifier[] = []

  if (Array.isArray(value)) {
    qualifiers.push(...value.map((item, index) => normalizeDnaSequenceQualifier(item, index)))
  }
  else if (value && typeof value === "object") {
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const key = rawKey.trim()
      if (!key) continue
      qualifiers.push(...normalizeLegacyQualifierValue(key, rawValue))
    }
  }

  if (legacyNote !== undefined && legacyNote !== null && String(legacyNote).trim()) {
    qualifiers.push({
      key: "note",
      value: typeof legacyNote === "string" ? legacyNote : String(legacyNote),
    })
  }

  return qualifiers
}

export function normalizeDnaSequenceAnnotation(
  value: unknown,
  index = 0,
): AimdDnaSequenceAnnotation {
  const fallback = createEmptyDnaSequenceAnnotation(`ann_${index + 1}`)
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback
  }

  const obj = value as Record<string, unknown>
  const segments = Array.isArray(obj.segments) && obj.segments.length > 0
    ? obj.segments.map(segment => normalizeDnaSequenceSegment(segment))
    : ("start" in obj || "end" in obj)
      ? [normalizeDnaSequenceSegment({
          start: obj.start,
          end: obj.end,
          partial_start: obj.partial_start,
          partial_end: obj.partial_end,
        })]
      : fallback.segments

  return {
    id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : fallback.id,
    name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : fallback.name,
    type: typeof obj.type === "string" && obj.type.trim() ? obj.type.trim() : fallback.type,
    strand: toStrand(obj.strand),
    color: typeof obj.color === "string" && obj.color.trim() ? obj.color.trim() : fallback.color,
    segments,
    qualifiers: normalizeDnaSequenceQualifiers(obj.qualifiers, obj.note),
  }
}

export function normalizeDnaSequenceValue(value: unknown): AimdDnaSequenceValue {
  if (typeof value === "string") {
    return {
      format: AIMD_DNA_SEQUENCE_FORMAT,
      name: "",
      sequence: normalizeDnaSequenceText(value),
      topology: "linear",
      annotations: [],
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      format: AIMD_DNA_SEQUENCE_FORMAT,
      name: "",
      sequence: "",
      topology: "linear",
      annotations: [],
    }
  }

  const obj = value as Record<string, unknown>
  return {
    format: AIMD_DNA_SEQUENCE_FORMAT,
    name: normalizeDnaSequenceName(obj.name),
    sequence: normalizeDnaSequenceText(obj.sequence),
    topology: obj.topology === "circular" ? "circular" : "linear",
    annotations: Array.isArray(obj.annotations)
      ? obj.annotations.map((annotation, index) => normalizeDnaSequenceAnnotation(annotation, index))
      : [],
  }
}

export function calculateDnaSequenceGcPercent(sequence: string): number | null {
  let canonicalBases = 0
  let gcBases = 0

  for (const char of sequence.toUpperCase()) {
    if (char === "A" || char === "T" || char === "C" || char === "G") {
      canonicalBases += 1
      if (char === "C" || char === "G") {
        gcBases += 1
      }
    }
  }

  if (canonicalBases === 0) {
    return null
  }

  return (gcBases / canonicalBases) * 100
}

export function getDnaSequenceSegmentIssue(
  segment: AimdDnaSequenceSegment,
  sequenceLength: number,
): "requires_sequence" | "range" | "out_of_bounds" | null {
  if (segment.end < segment.start) {
    return "range"
  }
  if (sequenceLength <= 0) {
    return "requires_sequence"
  }
  if (segment.end > sequenceLength) {
    return "out_of_bounds"
  }
  return null
}

function sanitizeGenBankIdentifier(value: string): string {
  const normalized = value.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.-]/g, "_")
  return normalized || "DNA_SEQUENCE"
}

function formatGenBankDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = GENBANK_MONTHS[date.getMonth()] ?? "JAN"
  const year = String(date.getFullYear())
  return `${day}-${month}-${year}`
}

function wrapGenBankText(prefix: string, value: string, continuationPrefix = prefix, width = 79): string[] {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return [prefix.trimEnd()]
  }

  const lines: string[] = []
  let remaining = normalized
  let currentPrefix = prefix

  while (remaining.length > 0) {
    const available = Math.max(width - currentPrefix.length, 12)
    if (remaining.length <= available) {
      lines.push(`${currentPrefix}${remaining}`)
      break
    }

    let splitIndex = remaining.lastIndexOf(" ", available)
    if (splitIndex <= 0) {
      splitIndex = available
    }

    lines.push(`${currentPrefix}${remaining.slice(0, splitIndex)}`)
    remaining = remaining.slice(splitIndex).trimStart()
    currentPrefix = continuationPrefix
  }

  return lines
}

function formatGenBankSegmentLocation(segment: AimdDnaSequenceSegment): string {
  const start = `${segment.partial_start ? "<" : ""}${segment.start}`
  const end = `${segment.partial_end ? ">" : ""}${segment.end}`
  return `${start}..${end}`
}

function formatGenBankAnnotationLocation(annotation: AimdDnaSequenceAnnotation): string {
  const joined = annotation.segments.map(formatGenBankSegmentLocation).join(",")
  const location = annotation.segments.length > 1 ? `join(${joined})` : joined
  return annotation.strand === -1 ? `complement(${location})` : location
}

function formatGenBankQualifier(key: string, value: string): string[] {
  const safeKey = key.trim() || "note"
  const safeValue = value.replace(/"/g, "'").trim()
  if (!safeValue) {
    return [`                     /${safeKey}`]
  }

  return wrapGenBankText(
    "                     ",
    `/${safeKey}="${safeValue}"`,
    "                     ",
  )
}

function getExportQualifiers(annotation: AimdDnaSequenceAnnotation): AimdDnaSequenceQualifier[] {
  const qualifiers = [...annotation.qualifiers]
  const hasLabel = qualifiers.some(qualifier => qualifier.key.trim().toLowerCase() === "label")
  if (!hasLabel && annotation.name.trim()) {
    qualifiers.unshift({
      key: "label",
      value: annotation.name.trim(),
    })
  }
  return qualifiers
}

export function serializeDnaSequenceToGenBank(
  value: AimdDnaSequenceValue,
  options?: {
    name?: string
    definition?: string
    date?: Date
  },
): string {
  const sequence = normalizeDnaSequenceText(value.sequence)
  const rawName = normalizeDnaSequenceName(value.name) || normalizeDnaSequenceName(options?.name) || "DNA_SEQUENCE"
  const locusName = sanitizeGenBankIdentifier(rawName)
  const accession = locusName.slice(0, 16) || "DNA_SEQUENCE"
  const topology = value.topology === "circular" ? "circular" : "linear"
  const definition = options?.definition?.trim() || rawName || `${locusName} exported from Airalogy AIMD recorder.`
  const locusLine = [
    "LOCUS".padEnd(12, " "),
    accession.padEnd(16, " "),
    String(sequence.length).padStart(11, " "),
    "bp".padEnd(6, " "),
    "DNA".padEnd(8, " "),
    topology.padEnd(9, " "),
    formatGenBankDate(options?.date),
  ].join("")

  const lines: string[] = [
    locusLine,
    ...wrapGenBankText("DEFINITION  ", definition, "            "),
    `ACCESSION   ${accession}`,
    `VERSION     ${accession}.1`,
    "KEYWORDS    .",
    "SOURCE      synthetic construct",
    "  ORGANISM  synthetic construct",
    "            other sequences; artificial sequences.",
    "FEATURES             Location/Qualifiers",
  ]

  for (const annotation of value.annotations) {
    lines.push(`     ${(annotation.type.trim() || "misc_feature").slice(0, 16).padEnd(16, " ")}${formatGenBankAnnotationLocation(annotation)}`)
    for (const qualifier of getExportQualifiers(annotation)) {
      lines.push(...formatGenBankQualifier(qualifier.key, qualifier.value))
    }
  }

  lines.push("ORIGIN")

  for (let index = 0; index < sequence.length; index += 60) {
    const chunk = sequence.slice(index, index + 60).toLowerCase()
    const grouped = chunk.match(/.{1,10}/g)?.join(" ") ?? chunk
    lines.push(`${String(index + 1).padStart(9, " ")} ${grouped}`)
  }

  lines.push("//")
  return `${lines.join("\n")}\n`
}
