/**
 * DOM attribute names used in AIMD rendering
 */
export const DOM_ATTR_NAME = {
  SOURCE_LINE_START: "data-source-line",
  SOURCE_LINE_END: "data-source-line-end",
  ORIGIN_SRC: "origin-src",
  TARGET_REPO: "target-repo",
  TARGET_PATH: "target-path",
  LOCAL_IMAGE: "local-image",
  ONLY_CHILD: "auto-center",
  TOKEN_IDX: "data-token-idx",
  DISPLAY_NONE: "display-none",
  WIKI_LINK: "wiki-link",
  WIKI_RESOURCE: "wiki-resource",
  IS_ANCHOR: "is-anchor",
  SKIP_EXPORT: "skip-export",
  DATA_HASHTAG: "data-hashtag",
} as const

export type DomAttrName = typeof DOM_ATTR_NAME[keyof typeof DOM_ATTR_NAME]
