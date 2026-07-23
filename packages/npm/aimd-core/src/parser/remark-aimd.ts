import type { Code, PhrasingContent, Root, Text } from "mdast"
import type { Plugin } from "unified"
import type {
  AimdCheckNode,
  AimdCiteNode,
  AimdFieldType,
  AimdFigNode,
  AimdMediaNode,
  AimdNode,
  AimdRefsNode,
  AimdScope,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
} from "../types/nodes"
import type {
  AimdCollectorValidationContext,
  AimdVarField,
  ExtractedAimdFields,
} from "../types/aimd"
import {
  extractPythonAssignerGraphNodes,
  validateAssignerGraph,
  type AimdAssignerGraphNode,
} from "./assigner-graph"
import {
  createStepContext,
  isVarTable,
  parseClientAssignerContent,
  parseCheckContent,
  parseFenceMeta,
  parseFigContent,
  parseMediaContent,
  parseRefsContent,
  parseStepContent,
  parseTableColumns,
  parseVarDefinition,
  registerStep,
  type StepContext,
} from "./field-parsers"
import {
  restoreAimdInlineTemplates,
  type AimdInlineTemplateMap,
} from "./inline-template-protection"
import { findAimdInlineTemplates } from "./inline-template-scanner"
import {
  getAimdFieldDescription,
  getAimdFieldEnumValues,
  getAimdFieldExamples,
  getAimdFieldTitle,
} from "../utils/field-metadata"
import { parseConnectorsContent } from "./connectors-parser"
import { parseCollectorsContent } from "./collectors-parser"
import { parseQuizContent } from "./quiz-parser"
import { parseWorkflowContent } from "./workflow-parser"
import {
  validateAimdProtocolContract,
  validateAimdResourceFields,
  type AimdProtocolMetadata,
} from "../utils/protocol-contract"
import { SKIP, visit } from "unist-util-visit"

function validateCollectorReferences(fields: ExtractedAimdFields): void {
  const connectors = new Map<string, NonNullable<ExtractedAimdFields["connectors"]>[number]["connectors"][string]>()
  for (const registry of fields.connectors ?? []) {
    for (const [id, connector] of Object.entries(registry.connectors)) {
      if (connectors.has(id)) throw new Error(`Duplicate connector id: ${id}`)
      connectors.set(id, connector)
    }
  }

  const collectors = new Map<string, NonNullable<ExtractedAimdFields["collectors"]>[number]["collectors"][string]>()
  for (const registry of fields.collectors ?? []) {
    for (const [id, collector] of Object.entries(registry.collectors)) {
      if (collectors.has(id)) throw new Error(`Duplicate collector id: ${id}`)
      collectors.set(id, collector)
      const connector = connectors.get(collector.connector)
      if (!connector) {
        throw new Error(`Collector ${id} references unknown connector ${collector.connector}`)
      }
      if (connector.kind !== "data_source") {
        throw new Error(`Collector ${id} requires connector ${collector.connector} to use kind data_source`)
      }
      for (const trigger of [collector.lifecycle.start, collector.lifecycle.stop]) {
        if (typeof trigger === "object" && !fields.step.includes(trigger.step)) {
          throw new Error(`Collector ${id} references unknown step ${trigger.step}`)
        }
      }
    }
  }

  const collectorBindings = new Map<string, string>()
  for (const field of fields.var_definitions ?? []) {
    const rawCollector = field.kwargs?.collector
    if (rawCollector === undefined) continue
    if (typeof rawCollector !== "string" || !rawCollector.trim()) {
      throw new Error(`Variable ${field.id} collector metadata must be a non-empty string`)
    }
    const collectorId = rawCollector.trim()
    const collector = collectors.get(collectorId)
    if (!collector) throw new Error(`Variable ${field.id} references unknown collector ${collectorId}`)
    const previousField = collectorBindings.get(collectorId)
    if (previousField && previousField !== field.id) {
      throw new Error(`Collector ${collectorId} cannot write directly to both ${previousField} and ${field.id}`)
    }
    collectorBindings.set(collectorId, field.id)

    const normalizedType = String(field.type ?? "").replace(/\s+/g, "").toLowerCase()
    const observation = normalizedType.startsWith("observation[")
    const observationList = normalizedType.startsWith("list[observation[")
    const series = normalizedType.startsWith("observationseriesref[")
    if (!observation && !observationList && !series) {
      throw new Error(`Variable ${field.id} bound to Collector ${collectorId} must use Observation[T], list[Observation[T]], or ObservationSeriesRef[T]`)
    }
    if ((collector.mode === "polling" || collector.mode === "stream") && !observationList && !series) {
      throw new Error(`Variable ${field.id} must use list[Observation[T]] or ObservationSeriesRef[T] for ${collector.mode} Collector ${collectorId}`)
    }
  }
}

/**
 * Create AIMD node.
 */
function createAimdNode(
  fieldType: AimdFieldType,
  content: string,
  raw: string,
  stepContext?: StepContext,
): AimdNode {
  switch (fieldType) {
    case "var": {
      if (isVarTable(content)) {
        const { id, columns, definition } = parseTableColumns(content)
        return {
          type: "aimd",
          fieldType: "var_table",
          id,
          scope: "var_table",
          raw,
          columns,
          definition,
        } as AimdVarTableNode
      }

      const definition = parseVarDefinition(content)
      return {
        type: "aimd",
        fieldType: "var",
        id: definition.id,
        scope: "var",
        raw,
        definition,
      } as AimdVarNode
    }

    case "var_table": {
      const { id, columns, definition } = parseTableColumns(content)
      return {
        type: "aimd",
        fieldType: "var_table",
        id,
        scope: "var_table",
        raw,
        columns,
        definition,
      } as AimdVarTableNode
    }

    case "step": {
      const { id, level, check, title, subtitle, checked_message, estimated_duration_ms, timer_mode, result, props } = parseStepContent(content)
      const stepNode: AimdStepNode = {
        type: "aimd",
        fieldType: "step",
        id,
        scope: "step",
        raw,
        level,
        sequence: 0,
        step: "1",
        has_children: false,
        check,
        props,
      }

      if (title) {
        stepNode.title = title
      }
      if (subtitle) {
        stepNode.subtitle = subtitle
      }
      if (checked_message) {
        stepNode.checked_message = checked_message
      }
      if (estimated_duration_ms !== undefined) {
        stepNode.estimated_duration_ms = estimated_duration_ms
      }
      if (timer_mode) {
        stepNode.timer_mode = timer_mode
      }
      if (result) {
        stepNode.result = true
      }

      if (stepContext) {
        registerStep(stepNode, stepContext)
      }

      return stepNode
    }

    case "check": {
      const { id, checked_message, label } = parseCheckContent(content)
      const checkNode: AimdCheckNode = {
        type: "aimd",
        fieldType: "check",
        id,
        scope: "check",
        raw,
        label,
      }

      if (checked_message) {
        checkNode.checked_message = checked_message
      }

      return checkNode
    }

    case "ref_step":
    case "ref_var":
    case "ref_fig":
    case "ref_media":
      return {
        type: "aimd",
        fieldType,
        id: content.trim(),
        scope: fieldType as AimdScope,
        raw,
        refTarget: content.trim(),
      }

    case "cite": {
      const refs = content.split(",").map(r => r.trim()).filter(Boolean)
      return {
        type: "aimd",
        fieldType: "cite",
        id: refs[0] || content.trim(),
        scope: "cite",
        raw,
        refs,
      } as AimdCiteNode
    }

    case "quiz":
      throw new Error("Inline quiz syntax is not supported. Use a quiz code block instead.")

    case "fig":
      throw new Error("Inline fig syntax is not supported. Use a fig code block instead.")

    case "media":
      throw new Error("Inline media syntax is not supported. Use a media code block instead.")

    case "refs":
      throw new Error("Inline refs syntax is not supported. Use a refs code block instead.")

    default: {
      const exhaustiveCheck: never = fieldType
      throw new Error(`Unsupported AIMD field type: ${String(exhaustiveCheck)}`)
    }
  }
}

function createExtractedVarField(node: AimdVarNode): AimdVarField {
  const def = node.definition
  const field: AimdVarField = {
    id: node.id,
  }

  if (def?.type) {
    field.type = def.type
  }
  if (def && Object.prototype.hasOwnProperty.call(def, "default")) {
    field.default = def.default
  }
  const enumValues = getAimdFieldEnumValues(def)
  if (enumValues.length > 0) {
    field.enum = enumValues
  }

  const title = getAimdFieldTitle(def)
  const description = getAimdFieldDescription(def)
  const examples = getAimdFieldExamples(def)

  if (title) {
    field.title = title
  }
  if (description) {
    field.description = description
  }
  if (examples.length > 0) {
    field.examples = examples
  }
  if (def?.kwargs) {
    field.kwargs = def.kwargs
  }

  return field
}

/**
 * Find and replace AIMD syntax in text nodes.
 * Pattern: {{type|content}}
 */
type InlineContentNode = PhrasingContent | AimdNode

function processTextNode(
  node: Text,
  stepContext: StepContext,
  templates?: AimdInlineTemplateMap,
): InlineContentNode[] {
  const value = restoreAimdInlineTemplates(node.value, templates)
  const result: InlineContentNode[] = []
  let lastIndex = 0
  const matches = findAimdInlineTemplates(value)

  for (const match of matches) {
    const startIndex = match.start
    if (startIndex > lastIndex) {
      result.push({
        type: "text",
        value: value.slice(lastIndex, startIndex),
      })
    }

    const aimdNode = createAimdNode(match.type, match.content, match.raw, stepContext)
    result.push(aimdNode)

    lastIndex = match.end
  }

  if (lastIndex < value.length) {
    result.push({
      type: "text",
      value: value.slice(lastIndex),
    })
  }

  if (result.length === 0 && value !== node.value) {
    return [{ type: "text", value }]
  }

  return result.length > 0 ? result : [node]
}

export interface RemarkAimdOptions {
  /**
   * Whether to extract field information to VFile data.
   * @default true
   */
  extractFields?: boolean
  /**
   * Typed configuration for field properties.
   */
  typed?: Record<string, Record<string, any>>
  /** Protocol-level Collector metadata used to validate an isolated fragment. */
  collectorContext?: AimdCollectorValidationContext
  /** Protocol metadata used for kind-specific publishing validation. */
  protocolMetadata?: AimdProtocolMetadata
}

/**
 * remark-aimd plugin.
 * Processes AIMD custom syntax {{type|content}}
 *
 * Supported syntax:
 * - {{var|id}} - Simple variable
 * - {{var|id: type}} - Typed variable
 * - {{var|id: type = default}} - Variable with default
 * - {{var|id, subvars=[a, b]}} - Variable table
 * - {{step|id}} - Step (level 1)
 * - {{step|id, 2}} - Step with level
 * - {{step|id, 2, check=True}} - Step with check
 * - {{check|id}} - Checkpoint
 * - {{ref_step|id}} - Step reference
 * - {{ref_var|id}} - Variable reference
 * - ```quiz blocks - Quiz definitions (choice / blank / open)
 * - ```fig blocks - Figure definitions
 * - ```media blocks - Media definitions
 * - ```refs blocks - BibTeX reference definitions
 * - ```connectors blocks - Connector metadata definitions
 */
const remarkAimd: Plugin<[RemarkAimdOptions?], Root> = (options = {}) => {
  const { extractFields = true } = options

  return (tree, file) => {
    const inlineTemplates = file.data?.aimdInlineTemplates as AimdInlineTemplateMap | undefined
    const fields: ExtractedAimdFields = {
      var: [],
      var_definitions: [],
      var_table: [],
      client_assigner: [],
      connectors: [],
      collectors: [],
      workflow: [],
      quiz: [],
      step: [],
      check: [],
      ref_step: [],
      ref_var: [],
      ref_fig: [],
      ref_media: [],
      cite: [],
      fig: [],
      media: [],
      refs: [],
    }

    const stepContext = createStepContext()
    const graphAssigners: AimdAssignerGraphNode[] = []

    visit(tree, (node: any) => {
      if (
        (node.type === "code" || node.type === "inlineCode" || node.type === "html")
        && typeof node.value === "string"
      ) {
        node.value = restoreAimdInlineTemplates(node.value, inlineTemplates)
      }
    })

    // First pass: process fenced AIMD code blocks.
    visit(tree, "code", (node: Code, index, parent) => {
      if (index === undefined || !parent)
        return

      const lang = (node.lang || "").trim().toLowerCase()
      const meta = parseFenceMeta(node.meta)

      if (lang === "assigner" && meta.runtime === "client") {
        const assigner = parseClientAssignerContent(node.value)
        fields.client_assigner.push(assigner)
        graphAssigners.push(assigner)
        parent.children.splice(index, 1)
        return [SKIP, index] as const
      }

      if (lang === "assigner") {
        graphAssigners.push(...extractPythonAssignerGraphNodes(node.value))
      }

      if (lang === "connectors" && extractFields) {
        try {
          const connectors = parseConnectorsContent(node.value)
          fields.connectors?.push(connectors)
          parent.children.splice(index, 1)
          return [SKIP, index] as const
        }
        catch (error) {
          console.error("Failed to parse connectors block:", error)
        }
      }

      if (lang === "collectors" && extractFields) {
        const collectors = parseCollectorsContent(node.value)
        fields.collectors?.push(collectors)
        parent.children.splice(index, 1)
        return [SKIP, index] as const
      }

      if (lang === "workflow" && extractFields) {
        const workflow = parseWorkflowContent(node.value)
        fields.workflow?.push(workflow)
      }

      if (lang === "fig") {
        try {
          const figData = parseFigContent(node.value)

          const figNode: AimdFigNode = {
            type: "aimd",
            fieldType: "fig",
            id: figData.id,
            scope: "fig",
            raw: node.value,
            src: figData.src,
            title: figData.title,
            legend: figData.legend,
          }

          parent.children[index] = figNode as any

          if (extractFields && fields.fig) {
            const existingFig = fields.fig.find(f => f.id === figData.id)
            if (!existingFig) {
              fields.fig.push({
                id: figData.id,
                src: figData.src,
                title: figData.title,
                legend: figData.legend,
              })
            }
          }
        }
        catch (error) {
          console.error("Failed to parse fig block:", error)
        }
      }

      if (lang === "media") {
        try {
          const mediaData = parseMediaContent(node.value)

          const mediaNode: AimdMediaNode = {
            type: "aimd",
            fieldType: "media",
            id: mediaData.id,
            scope: "media",
            raw: node.value,
            kind: mediaData.kind,
            src: mediaData.src,
            mime: mediaData.mime,
            provider: mediaData.provider,
            poster: mediaData.poster,
            title: mediaData.title,
            legend: mediaData.legend,
          }

          parent.children[index] = mediaNode as any

          if (extractFields && fields.media) {
            const existingMedia = fields.media.find(media => media.id === mediaData.id)
            if (!existingMedia) {
              fields.media.push(mediaData)
            }
          }
        }
        catch (error) {
          console.error("Failed to parse media block:", error)
        }
      }

      if (lang === "refs") {
        try {
          const entries = parseRefsContent(node.value)

          const refsNode: AimdRefsNode = {
            type: "aimd",
            fieldType: "refs",
            id: entries[0]?.id ?? "refs",
            scope: "refs",
            raw: node.value,
            entries,
          }

          parent.children[index] = refsNode as any

          if (extractFields && fields.refs) {
            for (const entry of entries) {
              const existingRef = fields.refs.find(ref => ref.id === entry.id)
              if (!existingRef) {
                fields.refs.push(entry)
              }
            }
          }
        }
        catch (error) {
          console.error("Failed to parse refs block:", error)
        }
      }

      if (lang === "quiz") {
        try {
          const quizData = parseQuizContent(node.value)

          parent.children[index] = quizData.node as any

          if (extractFields) {
            const existingQuiz = fields.quiz.find(q => q.id === quizData.field.id)
            if (!existingQuiz) {
              fields.quiz.push(quizData.field)
            }
          }
        }
        catch (error) {
          console.error("Failed to parse quiz block:", error)
        }
      }
    })

    visit(tree, "text", (node, index, parent) => {
      if (index === undefined || !parent)
        return

      const processed = processTextNode(node, stepContext, inlineTemplates)

      if (processed.length === 1 && processed[0] === node)
        return

      parent.children.splice(index, 1, ...(processed as unknown as PhrasingContent[]))

      if (extractFields) {
        for (const child of processed) {
          if (child.type === "aimd") {
            const aimdNode = child as AimdNode
            switch (aimdNode.fieldType) {
              case "var":
                if (!fields.var.includes(aimdNode.id)) {
                  fields.var.push(aimdNode.id)
                }
                if (!fields.var_definitions?.find(field => field.id === aimdNode.id)) {
                  fields.var_definitions?.push(createExtractedVarField(aimdNode as AimdVarNode))
                }
                break
              case "var_table": {
                if (!fields.var_table.find(t => t.id === aimdNode.id)) {
                  const tableNode = aimdNode as AimdVarTableNode
                  const def = tableNode.definition
                  const subvarDefs = def?.subvars
                  const names = subvarDefs ? Object.keys(subvarDefs) : tableNode.columns
                  const subvars = names.map((name: string) => {
                    const subDef = subvarDefs?.[name]
                    const title = getAimdFieldTitle(subDef)
                    const description = getAimdFieldDescription(subDef)
                    const examples = getAimdFieldExamples(subDef)
                    const enumValues = getAimdFieldEnumValues(subDef)
                    if (!subDef) {
                      return { id: name }
                    }
                    return {
                      id: name,
                      type: subDef.type,
                      default: subDef.default,
                      ...(enumValues.length > 0 ? { enum: enumValues } : {}),
                      title: title || name,
                      description,
                      examples: examples.length > 0 ? examples : undefined,
                      kwargs: subDef.kwargs,
                    }
                  })
                  const title = getAimdFieldTitle(def)
                  const description = getAimdFieldDescription(def)
                  const examples = getAimdFieldExamples(def)
                  const tableField: ExtractedAimdFields["var_table"][number] = {
                    id: aimdNode.id,
                    scope: "var_table",
                    subvars,
                    type_annotation: def?.type,
                    title,
                    description,
                    examples: examples.length > 0 ? examples : undefined,
                    kwargs: def?.kwargs,
                  }
                  if (def && Object.prototype.hasOwnProperty.call(def, "default")) {
                    tableField.default = def.default
                    tableField.defaultRaw = def.defaultRaw
                  }
                  fields.var_table.push({
                    ...tableField,
                  })
                }
                break
              }
              case "quiz":
                // quiz is collected from fenced code blocks in the first pass
                break
              case "step":
                if (!fields.step.includes(aimdNode.id)) {
                  fields.step.push(aimdNode.id)
                }
                break
              case "check":
                if (!fields.check.includes(aimdNode.id)) {
                  fields.check.push(aimdNode.id)
                }
                break
              case "ref_step":
                if (!fields.ref_step.includes(aimdNode.id)) {
                  fields.ref_step.push(aimdNode.id)
                }
                break
              case "ref_var":
                if (!fields.ref_var.includes(aimdNode.id)) {
                  fields.ref_var.push(aimdNode.id)
                }
                break
              case "ref_fig":
                if (!fields.ref_fig) fields.ref_fig = []
                if (!fields.ref_fig.includes(aimdNode.id)) {
                  fields.ref_fig.push(aimdNode.id)
                }
                break
              case "ref_media":
                if (!fields.ref_media) fields.ref_media = []
                if (!fields.ref_media.includes(aimdNode.id)) {
                  fields.ref_media.push(aimdNode.id)
                }
                break
              case "cite":
                if (!fields.cite) fields.cite = []
                if ("refs" in aimdNode) {
                  for (const ref of (aimdNode as AimdCiteNode).refs) {
                    if (!fields.cite.includes(ref)) {
                      fields.cite.push(ref)
                    }
                  }
                }
                break
            }
          }
        }
      }

      return [SKIP, index + processed.length] as const
    })

    if (extractFields && stepContext.allSteps.length > 0) {
      fields.step_hierarchy = stepContext.allSteps.map(step => ({
        id: step.id,
        level: step.level,
        sequence: step.sequence,
        step: step.step,
        estimated_duration_ms: step.estimated_duration_ms,
        timer_mode: step.timer_mode,
        has_check: step.check,
        parent_id: step.parent_id,
        prev_id: step.prev_id,
        next_id: step.next_id,
        has_children: step.has_children,
      }))
    }

    if (extractFields) {
      validateAssignerGraph(graphAssigners)
      const collectorValidationFields = options.collectorContext
        ? {
            ...fields,
            connectors: [
              ...(options.collectorContext.connectors ?? []),
              ...(fields.connectors ?? []),
            ],
            collectors: [
              ...(options.collectorContext.collectors ?? []),
              ...(fields.collectors ?? []),
            ],
            step: Array.from(new Set([
              ...(options.collectorContext.step ?? []),
              ...fields.step,
            ])),
          }
        : fields
      validateCollectorReferences(collectorValidationFields)
      const resourceIssues = options.protocolMetadata
        ? validateAimdProtocolContract(options.protocolMetadata, fields)
        : validateAimdResourceFields(fields)
      if (resourceIssues.length > 0) {
        throw new Error(resourceIssues.map(issue => issue.message).join("; "))
      }
      file.data.aimdFields = fields
    }

    file.data.stepContext = {
      byId: Object.fromEntries(stepContext.byId),
      allSteps: stepContext.allSteps,
    }
  }
}

export default remarkAimd
