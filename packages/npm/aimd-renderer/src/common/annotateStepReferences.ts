import type { Element, Root as HastRoot } from "hast"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type { AimdNode } from "@airalogy/aimd-core/types"
import type { AimdRendererOptions } from "./processor"
import { createAimdRendererMessages } from "../locales"

// ---------------------------------------------------------------------------
// Step sequence map
// ---------------------------------------------------------------------------

function buildStepSequenceMap(fields: ExtractedAimdFields): Map<string, string> {
  const sequenceMap = new Map<string, string>()

  for (const step of fields.step_hierarchy || []) {
    if (typeof step.id === "string" && step.id.trim() && typeof step.step === "string" && step.step.trim()) {
      sequenceMap.set(step.id, step.step)
    }
  }

  return sequenceMap
}

// ---------------------------------------------------------------------------
// HAST annotation pass
// ---------------------------------------------------------------------------

/**
 * Walk a HAST tree and inject the resolved step-sequence numbers into every
 * `ref_step` element so the rendered output shows e.g. "Step 2.1" instead of
 * the raw id.
 */
export function annotateStepReferenceSequence(
  tree: HastRoot,
  fields: ExtractedAimdFields,
  options: AimdRendererOptions,
): void {
  const stepSequenceMap = buildStepSequenceMap(fields)
  if (stepSequenceMap.size === 0) {
    return
  }

  const messages = createAimdRendererMessages(options.locale, options.messages)

  const visitNode = (node: HastRoot | Element): void => {
    if (node.type === "element") {
      const element = node as Element
      const aimdType = element.properties?.["data-aimd-type"] || element.properties?.dataAimdType

      if (aimdType === "ref_step") {
        const refTarget = element.properties?.["data-aimd-id"] || element.properties?.dataAimdId
        if (typeof refTarget === "string") {
          const stepSequence = stepSequenceMap.get(refTarget)
          if (stepSequence) {
            element.properties["data-aimd-step-sequence"] = stepSequence
            element.properties.title = refTarget

            const aimdData = (element.data as { aimd?: AimdNode } | undefined)?.aimd
            if (aimdData) {
              ;(aimdData as any).stepSequence = stepSequence
            }

            const jsonData = element.properties["data-aimd-json"]
            if (typeof jsonData === "string") {
              try {
                const parsed = JSON.parse(jsonData) as Record<string, unknown>
                parsed.stepSequence = stepSequence
                element.properties["data-aimd-json"] = JSON.stringify(parsed)
              }
              catch {
                // Ignore malformed fallback JSON and keep runtime metadata only.
              }
            }

            element.children = [{
              type: "element",
              tagName: "span",
              properties: { className: ["aimd-ref__content"] },
              children: [{
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field", "aimd-field--step", "aimd-field--readonly"] },
                children: [{
                  type: "element",
                  tagName: "span",
                  properties: { className: ["research-step__sequence"] },
                  children: [{ type: "text", value: messages.step.reference(stepSequence) }],
                } as Element],
              } as Element],
            } as Element]
          }
        }
      }

      for (const child of element.children || []) {
        if (child.type === "element") {
          visitNode(child)
        }
      }
      return
    }

    for (const child of node.children) {
      if (child.type === "element") {
        visitNode(child)
      }
    }
  }

  visitNode(tree)
}
