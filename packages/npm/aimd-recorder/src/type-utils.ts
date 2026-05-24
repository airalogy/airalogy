export function normalizeAimdTypeName(type: string | undefined): string {
  return (type || 'str').trim().toLowerCase().replace(/[\s_-]/g, '')
}
