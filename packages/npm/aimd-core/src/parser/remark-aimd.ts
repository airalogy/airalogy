import type { Code, PhrasingContent, Root, Text } from "mdast"
import type { Plugin } from "unified"
import type {
  AimdCheckNode,
  AimdCiteNode,
  AimdFieldType,
  AimdFigNode,
  AimdNode,
  AimdScope,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
} from "../types/nodes"
import type { AimdVarField, ExtractedAimdFields } from "../types/aimd"
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
import { parseQuizContent } from "./quiz-parser"
import { SKIP, visit } from "unist-util-visit"

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

  const title = typeof def?.kwargs?.title === "string" ? def.kwargs.title : undefined
  const description = typeof def?.kwargs?.description === "string" ? def.kwargs.description : undefined

  if (title) {
    field.title = title
  }
  if (description) {
    field.description = description
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

  const pattern = /\{\{(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\s*\|\s*([^}]+)\}\}/g

  let match: RegExpExecArray | null = pattern.exec(value)
  while (match !== null) {
    const [fullMatch, type, rawContent] = match
    const content = rawContent.trim()
    const startIndex = match.index

    if (startIndex > lastIndex) {
      result.push({
        type: "text",
        value: value.slice(lastIndex, startIndex),
      })
    }

    const aimdNode = createAimdNode(type as AimdFieldType, content, fullMatch, stepContext)
    result.push(aimdNode)

    lastIndex = startIndex + fullMatch.length
    match = pattern.exec(value)
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
      quiz: [],
      step: [],
      check: [],
      ref_step: [],
      ref_var: [],
      ref_fig: [],
      cite: [],
      fig: [],
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

    // First pass: process fig/quiz code blocks.
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
                    const title = typeof subDef?.kwargs?.title === "string" ? subDef.kwargs.title : undefined
                    const description = typeof subDef?.kwargs?.description === "string" ? subDef.kwargs.description : undefined
                    return subDef
                      ? {
                          id: name,
                          type: subDef.type,
                          default: subDef.default,
                          title: title || name,
                          description,
                          kwargs: subDef.kwargs,
                        }
                      : { id: name }
                  })
                  fields.var_table.push({
                    id: aimdNode.id,
                    scope: "var_table",
                    subvars,
                    type_annotation: def?.type,
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
      file.data.aimdFields = fields
    }

    file.data.stepContext = {
      byId: Object.fromEntries(stepContext.byId),
      allSteps: stepContext.allSteps,
    }
  }
}

export default remarkAimd
