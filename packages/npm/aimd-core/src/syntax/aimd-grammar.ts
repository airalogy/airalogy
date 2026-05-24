import type { LanguageRegistration, ThemeRegistration } from "shiki"

/**
 * AIMD TextMate Syntax Scope Names
 */
export const AIMD_SCOPES = {
  // Punctuation
  BRACKET_OPEN: "punctuation.definition.aimd.begin",
  BRACKET_CLOSE: "punctuation.definition.aimd.end",
  DELIMITER_PIPE: "punctuation.separator.pipe.aimd",
  DELIMITER_COLON: "punctuation.separator.colon.aimd",
  DELIMITER_COMMA: "punctuation.separator.comma.aimd",

  // Keywords
  KEYWORD_VAR: "keyword.control.var.aimd",
  KEYWORD_VAR_TABLE: "keyword.control.var-table.aimd",
  KEYWORD_STEP: "keyword.control.step.aimd",
  KEYWORD_CHECK: "keyword.control.check.aimd",
  KEYWORD_REF_STEP: "keyword.control.ref-step.aimd",
  KEYWORD_REF_VAR: "keyword.control.ref-var.aimd",

  // Variables and types
  VARIABLE_NAME: "variable.other.aimd",
  TYPE_ANNOTATION: "support.type.aimd",
  CONSTANT_STRING: "string.quoted.aimd",
  CONSTANT_NUMBER: "constant.numeric.aimd",
  CONSTANT_BOOLEAN: "constant.language.aimd",

  // Overall markup
  MARKUP_VAR: "markup.aimd.variable",
  MARKUP_VAR_TABLE: "markup.aimd.variable-table",
  MARKUP_STEP: "markup.aimd.step",
  MARKUP_CHECK: "markup.aimd.check",
  MARKUP_REF: "markup.aimd.reference",
} as const

/**
 * AIMD grammar rule repository
 */
const aimdRepository = {
  // Variable definition content parsing
  "aimd-content": {
    patterns: [
      // Type annotation: : str, : int, : list[Student]
      {
        match: "(:)\\s*([\\w_]+(?:\\[[\\w_,\\s]+\\])?)",
        captures: {
          1: { name: AIMD_SCOPES.DELIMITER_COLON },
          2: { name: AIMD_SCOPES.TYPE_ANNOTATION },
        },
      },
      // Strings
      {
        match: "\"[^\"]*\"",
        name: AIMD_SCOPES.CONSTANT_STRING,
      },
      {
        match: "'[^']*'",
        name: AIMD_SCOPES.CONSTANT_STRING,
      },
      // Numbers
      {
        match: "-?\\d+\\.?\\d*",
        name: AIMD_SCOPES.CONSTANT_NUMBER,
      },
      // Boolean values
      {
        match: "\\b(true|false|True|False|null|None)\\b",
        name: AIMD_SCOPES.CONSTANT_BOOLEAN,
      },
      // Comma
      {
        match: ",",
        name: AIMD_SCOPES.DELIMITER_COMMA,
      },
      // Variable names
      {
        match: "\\b[\\w_]+\\b",
        name: AIMD_SCOPES.VARIABLE_NAME,
      },
    ],
  },

  // {{var|...}}
  "aimd-var": {
    begin: "(\\{\\{)\\s*(var)\\s*(\\|)",
    end: "(\\}\\})",
    name: AIMD_SCOPES.MARKUP_VAR,
    beginCaptures: {
      1: { name: AIMD_SCOPES.BRACKET_OPEN },
      2: { name: AIMD_SCOPES.KEYWORD_VAR },
      3: { name: AIMD_SCOPES.DELIMITER_PIPE },
    },
    endCaptures: {
      1: { name: AIMD_SCOPES.BRACKET_CLOSE },
    },
    patterns: [{ include: "#aimd-content" }],
  },

  // {{var_table|...}}
  "aimd-var-table": {
    begin: "(\\{\\{)\\s*(var_table)\\s*(\\|)",
    end: "(\\}\\})",
    name: AIMD_SCOPES.MARKUP_VAR_TABLE,
    beginCaptures: {
      1: { name: AIMD_SCOPES.BRACKET_OPEN },
      2: { name: AIMD_SCOPES.KEYWORD_VAR_TABLE },
      3: { name: AIMD_SCOPES.DELIMITER_PIPE },
    },
    endCaptures: {
      1: { name: AIMD_SCOPES.BRACKET_CLOSE },
    },
    patterns: [{ include: "#aimd-content" }],
  },

  // {{step|...}}
  "aimd-step": {
    match: "(\\{\\{)\\s*(step)\\s*(\\|)\\s*([^}]+?)\\s*(\\}\\})",
    name: AIMD_SCOPES.MARKUP_STEP,
    captures: {
      1: { name: AIMD_SCOPES.BRACKET_OPEN },
      2: { name: AIMD_SCOPES.KEYWORD_STEP },
      3: { name: AIMD_SCOPES.DELIMITER_PIPE },
      4: { name: AIMD_SCOPES.VARIABLE_NAME },
      5: { name: AIMD_SCOPES.BRACKET_CLOSE },
    },
  },

  // {{check|...}}
  "aimd-check": {
    match: "(\\{\\{)\\s*(check)\\s*(\\|)\\s*([^}]+?)\\s*(\\}\\})",
    name: AIMD_SCOPES.MARKUP_CHECK,
    captures: {
      1: { name: AIMD_SCOPES.BRACKET_OPEN },
      2: { name: AIMD_SCOPES.KEYWORD_CHECK },
      3: { name: AIMD_SCOPES.DELIMITER_PIPE },
      4: { name: AIMD_SCOPES.VARIABLE_NAME },
      5: { name: AIMD_SCOPES.BRACKET_CLOSE },
    },
  },

  // {{ref_step|...}} and {{ref_var|...}}
  "aimd-ref": {
    patterns: [
      {
        match: "(\\{\\{)\\s*(ref_step)\\s*(\\|)\\s*([^}]+?)\\s*(\\}\\})",
        name: AIMD_SCOPES.MARKUP_REF,
        captures: {
          1: { name: AIMD_SCOPES.BRACKET_OPEN },
          2: { name: AIMD_SCOPES.KEYWORD_REF_STEP },
          3: { name: AIMD_SCOPES.DELIMITER_PIPE },
          4: { name: AIMD_SCOPES.VARIABLE_NAME },
          5: { name: AIMD_SCOPES.BRACKET_CLOSE },
        },
      },
      {
        match: "(\\{\\{)\\s*(ref_var)\\s*(\\|)\\s*([^}]+?)\\s*(\\}\\})",
        name: AIMD_SCOPES.MARKUP_REF,
        captures: {
          1: { name: AIMD_SCOPES.BRACKET_OPEN },
          2: { name: AIMD_SCOPES.KEYWORD_REF_VAR },
          3: { name: AIMD_SCOPES.DELIMITER_PIPE },
          4: { name: AIMD_SCOPES.VARIABLE_NAME },
          5: { name: AIMD_SCOPES.BRACKET_CLOSE },
        },
      },
    ],
  },
}

/**
 * AIMD main language definition
 * Based on Markdown, extended with AIMD-specific syntax
 */
export const aimdLanguage: LanguageRegistration = {
  name: "aimd",
  scopeName: "text.html.markdown.aimd",
  patterns: [
    { include: "#aimd-var" },
    { include: "#aimd-var-table" },
    { include: "#aimd-step" },
    { include: "#aimd-check" },
    { include: "#aimd-ref" },
    // Inherit Markdown syntax
    { include: "text.html.markdown" },
  ],
  repository: aimdRepository,
}

/**
 * AIMD injection syntax
 * Can be injected into regular Markdown files
 */
export const aimdInjection: LanguageRegistration = {
  name: "aimd-injection",
  scopeName: "aimd.injection",
  injectTo: ["text.html.markdown"],
  injectionSelector: "L:text.html.markdown -comment -string",
  patterns: [
    { include: "#aimd-var" },
    { include: "#aimd-var-table" },
    { include: "#aimd-step" },
    { include: "#aimd-check" },
    { include: "#aimd-ref" },
  ],
  repository: aimdRepository,
}

/**
 * AIMD theme definition
 */
export const aimdTheme: ThemeRegistration = {
  name: "aimd-theme",
  type: "light",
  settings: [
    // Brackets - gray
    {
      scope: [AIMD_SCOPES.BRACKET_OPEN, AIMD_SCOPES.BRACKET_CLOSE],
      settings: { foreground: "#6B7280" },
    },
    // Delimiters - gray
    {
      scope: [AIMD_SCOPES.DELIMITER_PIPE, AIMD_SCOPES.DELIMITER_COLON, AIMD_SCOPES.DELIMITER_COMMA],
      settings: { foreground: "#9CA3AF" },
    },
    // var keyword - blue
    {
      scope: AIMD_SCOPES.KEYWORD_VAR,
      settings: { foreground: "#2563EB", fontStyle: "italic" },
    },
    // var_table keyword - green
    {
      scope: AIMD_SCOPES.KEYWORD_VAR_TABLE,
      settings: { foreground: "#059669", fontStyle: "italic" },
    },
    // step keyword - orange
    {
      scope: AIMD_SCOPES.KEYWORD_STEP,
      settings: { foreground: "#D97706", fontStyle: "italic" },
    },
    // check keyword - pink
    {
      scope: AIMD_SCOPES.KEYWORD_CHECK,
      settings: { foreground: "#DB2777", fontStyle: "italic" },
    },
    // Reference keywords - cyan
    {
      scope: [AIMD_SCOPES.KEYWORD_REF_STEP, AIMD_SCOPES.KEYWORD_REF_VAR],
      settings: { foreground: "#0891B2", fontStyle: "italic" },
    },
    // Variable names - purple
    {
      scope: AIMD_SCOPES.VARIABLE_NAME,
      settings: { foreground: "#7C3AED" },
    },
    // Types - deep purple
    {
      scope: AIMD_SCOPES.TYPE_ANNOTATION,
      settings: { foreground: "#6D28D9", fontStyle: "italic" },
    },
    // Strings - green
    {
      scope: AIMD_SCOPES.CONSTANT_STRING,
      settings: { foreground: "#059669" },
    },
    // Numbers - teal
    {
      scope: AIMD_SCOPES.CONSTANT_NUMBER,
      settings: { foreground: "#0D9488" },
    },
    // Boolean values - blue
    {
      scope: AIMD_SCOPES.CONSTANT_BOOLEAN,
      settings: { foreground: "#1D4ED8" },
    },
  ],
  colors: {},
}

/**
 * Export all language definitions
 */
export default [aimdLanguage, aimdInjection]
