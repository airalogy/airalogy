import { languages } from "@codingame/monaco-vscode-editor-api"

// @ts-ignore - No type definitions available
import { type languages as languagesNS, conf as markdownConf, language as markdownLanguage } from "@codingame/monaco-vscode-standalone-languages/markdown/markdown"
import { AimdToken } from "./tokens"

const autoClosingPairs: languages.IAutoClosingPairConditional[] = [
  ...(markdownConf.autoClosingPairs as any[] || []),
]
const surroundingPairs = autoClosingPairs

function getTokens(tokens: string, divider = "|"): string[] {
  return tokens.split(divider)
}
const keywords: string[] = getTokens("var|var_table|check|step|ref_step|ref_var|ref_table|table_link")

export const language: languagesNS.IMonarchLanguage = {
  ...markdownLanguage,
  tokenPostfix: ".aimd",
  keywords,
  tokenizer: {
    ...markdownLanguage.tokenizer!,
    root: [
      [/^\s*(```|~~~)\s*quiz(?:\s+.*)?\s*$/, {
        token: "string",
        next: "@quizCodeblock",
        nextEmbedded: "yaml",
      }],
      [/^\s*(```|~~~)\s*assigner(?:\s+.*\bruntime\s*=\s*(?:"client"|'client'|client)\b.*)\s*$/, {
        token: "string",
        next: "@assignerCodeblock",
        nextEmbedded: "javascript",
      }],
      [/^\s*(```|~~~)\s*assigner(?:\s+.*)?\s*$/, {
        token: "string",
        next: "@assignerCodeblock",
        nextEmbedded: "python",
      }],
      ...markdownLanguage.tokenizer.root,
      { include: "@aimd" },
    ],
    table_body: [...markdownLanguage.tokenizer.table_body, { include: "@aimd" }],
    assignerCodeblock: [
      [/^\s*(```|~~~)\s*$/, { token: "string", next: "@pop", nextEmbedded: "@pop" }],
      [/.*$/, ""],
    ],
    quizCodeblock: [
      [/^\s*(```|~~~)\s*$/, { token: "string", next: "@pop", nextEmbedded: "@pop" }],
      [/.*$/, ""],
    ],
    aimd: [
      // 1. AIMD Protocol Fields: {{keyword|content}}
      // This rule finds the opening '{{' and switches to the 'protocol' state
      // to handle the special syntax. This has the highest priority.
      [/\{\{/, {
        token: AimdToken.PUNCTUATION_DEFINITION_BEGIN_AIMD,
        bracket: "@open",
        next: "@protocol",
      }],

      // Links: [text](url)
      [/\[([^\]]+)\]\s*\(([^)]+)\)/, [
        { token: AimdToken.METATAG_LINK_AIMD }, // [
        { token: AimdToken.STRING_LINK_DESCRIPTION_AIMD }, // text
        { token: AimdToken.METATAG_LINK_AIMD }, // ](
        { token: AimdToken.STRING_LINK_URL_AIMD }, // url
        { token: AimdToken.METATAG_LINK_AIMD }, // )
      ]],

      // Images: ![alt](src)
      [/!\[([^\]]+)\]\s*\(([^)]+)\)/, [
        { token: AimdToken.METATAG_IMAGE_AIMD }, // ![
        { token: AimdToken.STRING_LINK_DESCRIPTION_AIMD }, // alt
        { token: AimdToken.METATAG_IMAGE_AIMD }, // ](
        { token: AimdToken.STRING_LINK_URL_AIMD }, // src
        { token: AimdToken.METATAG_IMAGE_AIMD }, // )
      ]],
    ],
    // This state is active inside {{ ... }}
    protocol: [
      // Match the keywords from your regexes
      // [/(var_table|var|quiz|step|check|ref_step|ref_var|ref_fig|cite|fig)/, AimdToken.KEYWORD_CONTROL_AIMD],
      [/var(\s*\|)/, AimdToken.KEYWORD_VARIABLE_AIMD],
      [/var_table(\s*\|)/, AimdToken.KEYWORD_VARIABLE_TABLE_AIMD],
      [/step(\s*\|)/, AimdToken.KEYWORD_STEP_AIMD],
      [/check(\s*\|)/, AimdToken.KEYWORD_CHECKPOINT_AIMD],
      [/ref_var(\s*\|)/, AimdToken.KEYWORD_REFERENCE_VARIABLE_AIMD],
      [/ref_step(\s*\|)/, AimdToken.KEYWORD_REFERENCE_STEP_AIMD],
      // Match the pipe delimiter
      [/\|/, { token: AimdToken.DELIMITER_PIPE_AIMD, next: "@protocolContent" }],
      // Match the closing '}}' and pop back to the root state
      [/\}\}/, { token: AimdToken.PUNCTUATION_DEFINITION_END_AIMD, bracket: "@close", next: "@pop" }],
    ],
    // Content inside protocol after the pipe delimiter - supports type syntax
    protocolContent: [
      // Match the closing '}}' and pop back to the root state
      [/\}\}/, { token: AimdToken.PUNCTUATION_DEFINITION_END_AIMD, bracket: "@close", next: "@popall" }],
      // Match subvars keyword
      [/\bsubvars\b/, AimdToken.KEYWORD_OTHER_SUBVARS_AIMD],
      // Match var keyword (for nested var() calls in subvars)
      [/\bvar\b/, AimdToken.KEYWORD_VARIABLE_AIMD],
      // Match type annotations after colon (e.g., : str, : int, : list[Student])
      [/:/, { token: AimdToken.DELIMITER_COLON_AIMD, next: "@typeAnnotation" }],
      // Match string literals (double or single quoted)
      [/"([^"\\]|\\.)*"/, AimdToken.STRING_QUOTED_AIMD],
      [/'([^'\\]|\\.)*'/, AimdToken.STRING_QUOTED_AIMD],
      // Match numbers (integer and float)
      [/-?\d+\.?\d*/, AimdToken.CONSTANT_NUMERIC_AIMD],
      // Match boolean/null literals
      [/\b(true|false|True|False|null|None)\b/, AimdToken.CONSTANT_LANGUAGE_AIMD],
      // Match equals signs and commas used for parameters
      [/=/, AimdToken.DELIMITER_PARAMETER_AIMD],
      [/,/, AimdToken.DELIMITER_PARAMETER_AIMD],
      // Match brackets for subvars and type params
      [/[[\]()]/, AimdToken.DELIMITER_BRACKET_AIMD],
      // Match variable name (identifier at start)
      [/\b\w+\b/, AimdToken.VARIABLE_OTHER_AIMD],
      // Skip whitespace
      [/\s+/, ""],
    ],
    // Type annotation state (after colon)
    typeAnnotation: [
      // Match type with generic params like list[Student]
      [/\w+(?:\[[\w,\s]+\])?/, { token: AimdToken.SUPPORT_TYPE_AIMD, next: "@pop" }],
      // Skip whitespace
      [/\s+/, ""],
      // Pop on other characters
      [/./, { token: "@rematch", next: "@pop" }],
    ],
  },
}

export const conf: languagesNS.LanguageConfiguration = {
  ...markdownConf,
  autoClosingPairs,
  surroundingPairs,
}

export const completionItemProvider: languagesNS.CompletionItemProvider = {
  provideCompletionItems: (doc: any, position: any) => {
    const suggestions = keywords.map((value) => {
      return {
        label: value,
        kind: languages.CompletionItemKind.Keyword,
        insertText: value,
        insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
      } as languagesNS.CompletionItem
    })

    return { suggestions } as languagesNS.ProviderResult<languagesNS.CompletionList>
  },
}
