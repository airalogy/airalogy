import type { Root as HastRoot } from "hast"
import type { Plugin } from "unified"
import type { AimdNode } from "../types"
import { visit } from "unist-util-visit"

/**
 * Extended Element data type
 */
interface AimdElementData {
  aimd?: AimdNode
}

/**
 * rehype-aimd plugin
 * Converts AIMD nodes to HAST elements
 */
const rehypeAimd: Plugin<[], HastRoot> = () => {
  return (tree) => {
    visit(tree, (node: any) => {
      // Check if this is an AIMD node (converted from mdast)
      if (node.type === "aimd") {
        const aimdNode = node as AimdNode

        // Convert to HAST element
        const element = {
          type: "element",
          tagName: "span",
          properties: {
            className: [`aimd-${aimdNode.fieldType}`],
            dataAimdType: aimdNode.fieldType,
            dataAimdId: aimdNode.id,
            dataAimdScope: aimdNode.scope,
          },
          children: [],
          data: {
            aimd: aimdNode,
          } as AimdElementData,
        }

        // Replace node
        Object.assign(node, element)
      }
    })
  }
}

export default rehypeAimd
