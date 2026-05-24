type Join<T extends readonly string[], D extends string> =
  T extends readonly [infer F, ...infer R]
    ? F extends string
      ? R extends readonly string[]
        ? R["length"] extends 0
          ? F
          : `${F}${D}${Join<R, D>}`
        : never
      : never
    : ""

type UpperCaseReplace<T extends string, S extends string, R extends string> = T extends `${infer P}${S}${infer REST}` ? `${P}${R}${UpperCaseReplace<REST, S, R>}` : T
type ToUpperSnake<T extends string> = UpperCaseReplace<UpperCaseReplace<Uppercase<T>, "-", "_">, ".", "_">

type ToUpperSnakeArray<T extends readonly string[]> =
  T extends readonly [infer F, ...infer R]
    ? F extends string
      ? R extends readonly string[]
        ? [ToUpperSnake<F>, ...ToUpperSnakeArray<R>]
        : []
      : []
    : []

export const AimdSuffix = "aimd"

/**
 * @docs https://microsoft.github.io/monaco-editor/monarch.html
 * Standard CSS token classes include:
 * identifier         entity           constructor
 * operators          tag              namespace
 * keyword            info-token       type
 * string             warn-token       predefined
 * string.escape      error-token      invalid
 * comment            debug-token
 * comment.doc        regexp
 * constant           attribute
 * delimiter .[curly,square,parenthesis,angle,array,bracket]
 * number    .[hex,octal,binary,float]
 * variable  .[name,value]
 * meta      .[content]
 */
function tokenFactory<const T extends string[]>(...parts: T): {
  [K in Join<ToUpperSnakeArray<T>, "_">]: Join<T, ".">
} {
  const key = parts.map(p => p.toUpperCase().replace(/-/g, "_").replace(/\./g, "_")).join("_")
  const value = parts.join(".")
  return { [key]: value } as any
}

function markupFactory<const T extends string>(type: T) {
  return tokenFactory("markup", AimdSuffix, type)
}
function keywordFactory<const T extends string>(type: T) {
  return tokenFactory("keyword", type, AimdSuffix)
}
// export const PunctuationDefinition = {
//   ...punctuationFactory("variable"),
//   ...punctuationFactory("variable-table"),
//   ...punctuationFactory("checkpoint"),
//   ...punctuationFactory("step"),
//   ...punctuationFactory("reference"),
// } as const

export const MarkupDefinition = {
  ...markupFactory("variable"),
  ...markupFactory("variable-table"),
  ...markupFactory("checkpoint"),
  ...markupFactory("step"),
  ...markupFactory("reference.step"),
  ...markupFactory("reference.variable"),
} as const

export const KeywordDefinition = {
  ...keywordFactory("variable"),
  ...keywordFactory("variable-table"),
  ...keywordFactory("checkpoint"),
  ...keywordFactory("step"),
  ...keywordFactory("reference.step"),
  ...keywordFactory("reference.variable"),
} as const

export const DelimiterDefinition = {
  ...tokenFactory("delimiter", "pipe", AimdSuffix),
  ...tokenFactory("delimiter", "parameter", AimdSuffix),
  ...tokenFactory("delimiter", "colon", AimdSuffix),
  ...tokenFactory("delimiter", "bracket", AimdSuffix),
} as const

// export const EntityDefinition = {
//   ...tokenFactory("entity", "name", "function", AimdSuffix),
//   ...tokenFactory("entity", "name", "tag", AimdSuffix),
// } as const

export const AimdTokenDefinition = {
  ...tokenFactory("keyword", "control", AimdSuffix),
  ...tokenFactory("variable", "parameter", AimdSuffix),
  ...tokenFactory("metatag", "link", AimdSuffix),
  ...tokenFactory("string", "link", "description", AimdSuffix),
  ...tokenFactory("string", "link", "url", AimdSuffix),
  ...tokenFactory("metatag", "image", AimdSuffix),
  // Type syntax tokens - using standard TextMate scopes for better theme compatibility
  ...tokenFactory("support", "type", AimdSuffix), // Types like str, int, list[Student] - usually colored as types
  ...tokenFactory("constant", "numeric", AimdSuffix), // Numbers like 18, 3.14
  ...tokenFactory("string", "quoted", AimdSuffix), // Strings like "Alice"
  ...tokenFactory("constant", "language", AimdSuffix), // true, false, null
  ...tokenFactory("variable", "other", AimdSuffix), // Variable names like name, age
  ...tokenFactory("keyword", "other", "subvars", AimdSuffix), // subvars keyword
} as const

export const AimdToken = {
  ...tokenFactory("punctuation", "definition", "begin", AimdSuffix),
  ...tokenFactory("punctuation", "definition", "end", AimdSuffix),
  ...MarkupDefinition,
  ...KeywordDefinition,
  ...DelimiterDefinition,
  ...AimdTokenDefinition,
} as const

// ScopeName based on markdown
export const scopeName = "text.html.markdown.aimd"
