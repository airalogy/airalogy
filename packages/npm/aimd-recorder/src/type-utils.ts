import { normalizeAimdTypeName as normalizeType, unwrapAimdNullableType } from '@airalogy/aimd-core/utils'

export function normalizeAimdTypeName(value: unknown, fallback = 'str'): string {
  return normalizeType(unwrapAimdNullableType(value), fallback)
}
