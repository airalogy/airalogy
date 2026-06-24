export interface AimdAssetUrlResolveContext {
  kind: "fig" | "media" | "media_poster"
  id?: string
  title?: string
  mediaKind?: string
}

export type AimdAssetUrlResolver = (
  src: string,
  context: AimdAssetUrlResolveContext,
) => string | null | undefined

export function resolveAimdAssetUrl(
  src: string | undefined,
  resolver: AimdAssetUrlResolver | undefined,
  context: AimdAssetUrlResolveContext,
): string | undefined {
  if (!src || !resolver) {
    return src
  }

  return resolver(src, context) || src
}
