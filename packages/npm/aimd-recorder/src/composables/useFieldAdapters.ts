import type { VNode } from "vue"
import type { AimdRecorderMessages } from "../locales"
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  AimdRecorderFieldAdapterContext,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldNodeMap,
  AimdRecorderFieldType,
} from "../types"

export interface RecorderFieldAdapterResolverOptions {
  fieldAdapters?: AimdRecorderFieldAdapters
  wrapField?: ((fieldKey: string, fieldType: string, defaultVNode: VNode) => VNode) | undefined
  readonly: boolean
  locale: string
  messages: AimdRecorderMessages
  record: AimdProtocolRecordData
  fieldMeta?: Record<string, AimdFieldMeta>
  fieldState?: Record<string, AimdFieldState>
}

export function buildAimdRecorderFieldAdapterContext<TFieldType extends AimdRecorderFieldType>(
  fieldType: TFieldType,
  fieldKey: string,
  node: AimdRecorderFieldNodeMap[TFieldType],
  value: unknown,
  defaultVNode: VNode,
  options: RecorderFieldAdapterResolverOptions,
): AimdRecorderFieldAdapterContext<TFieldType> {
  return {
    fieldType,
    fieldKey,
    node,
    value,
    defaultVNode,
    readonly: options.readonly,
    locale: options.locale,
    messages: options.messages,
    record: options.record,
    fieldMeta: options.fieldMeta,
    fieldState: options.fieldState,
  }
}

export function resolveAimdRecorderFieldVNode<TFieldType extends AimdRecorderFieldType>(
  fieldType: TFieldType,
  fieldKey: string,
  node: AimdRecorderFieldNodeMap[TFieldType],
  value: unknown,
  defaultVNode: VNode,
  options: RecorderFieldAdapterResolverOptions,
): VNode {
  const context = buildAimdRecorderFieldAdapterContext(fieldType, fieldKey, node, value, defaultVNode, options)
  const adapter = options.fieldAdapters?.[fieldType]
  const adaptedVNode = adapter ? adapter(context as never) : undefined
  const finalVNode = adaptedVNode ?? defaultVNode

  return options.wrapField ? options.wrapField(fieldKey, fieldType, finalVNode) : finalVNode
}
