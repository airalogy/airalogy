import type { ThemeRegistration } from "shiki"
import { AimdToken } from "./tokens"

/**
 * AIMD token color settings
 * These can be merged into any base theme
 */
export const aimdTokenColors = [
  // {{ and }} brackets - green
  {
    scope: [
      AimdToken.PUNCTUATION_DEFINITION_BEGIN_AIMD,
      AimdToken.PUNCTUATION_DEFINITION_END_AIMD,
    ],
    settings: {
      foreground: "#059669",
    },
  },
  // var keyword - blue italic
  {
    scope: [
      AimdToken.KEYWORD_VARIABLE_AIMD,
    ],
    settings: {
      foreground: "#2563EB",
      fontStyle: "italic",
    },
  },
  // var_table keyword - green italic
  {
    scope: [AimdToken.KEYWORD_VARIABLE_TABLE_AIMD],
    settings: {
      foreground: "#059669",
      fontStyle: "italic",
    },
  },
  // step, check keywords - orange italic
  {
    scope: [
      AimdToken.KEYWORD_STEP_AIMD,
      AimdToken.KEYWORD_CHECKPOINT_AIMD,
      AimdToken.KEYWORD_CONTROL_AIMD,
    ],
    settings: {
      foreground: "#D97706",
      fontStyle: "italic",
    },
  },
  // ref_var, ref_step reference keywords - cyan italic
  {
    scope: [
      AimdToken.KEYWORD_REFERENCE_VARIABLE_AIMD,
      AimdToken.KEYWORD_REFERENCE_STEP_AIMD,
    ],
    settings: {
      foreground: "#0891B2",
      fontStyle: "italic",
    },
  },
  // Variable names (title, name, age etc) - purple
  {
    scope: [AimdToken.VARIABLE_OTHER_AIMD],
    settings: {
      foreground: "#7C3AED",
    },
  },
  // Types (str, int, list[Student] etc) - dark purple italic
  {
    scope: [AimdToken.SUPPORT_TYPE_AIMD],
    settings: {
      foreground: "#6D28D9",
      fontStyle: "italic",
    },
  },
  // Parameter variables - purple bold
  {
    scope: [AimdToken.VARIABLE_PARAMETER_AIMD],
    settings: {
      foreground: "#7C3AED",
      fontStyle: "bold",
    },
  },
  // | pipe delimiter - gray
  {
    scope: [AimdToken.DELIMITER_PIPE_AIMD],
    settings: {
      foreground: "#6B7280",
    },
  },
  // : colon - gray
  {
    scope: [AimdToken.DELIMITER_COLON_AIMD],
    settings: {
      foreground: "#9CA3AF",
    },
  },
  // = , and other delimiters - gray
  {
    scope: [AimdToken.DELIMITER_PARAMETER_AIMD],
    settings: {
      foreground: "#9CA3AF",
    },
  },
  // Strings - green
  {
    scope: [AimdToken.STRING_QUOTED_AIMD],
    settings: {
      foreground: "#059669",
    },
  },
  // Numbers - teal
  {
    scope: [AimdToken.CONSTANT_NUMERIC_AIMD],
    settings: {
      foreground: "#0D9488",
    },
  },
  // Boolean/null - blue
  {
    scope: [AimdToken.CONSTANT_LANGUAGE_AIMD],
    settings: {
      foreground: "#1D4ED8",
    },
  },
  // subvars keyword - dark purple bold
  {
    scope: [AimdToken.KEYWORD_OTHER_SUBVARS_AIMD],
    settings: {
      foreground: "#5B21B6",
      fontStyle: "bold",
    },
  },
  // Brackets [] () - gray
  {
    scope: [AimdToken.DELIMITER_BRACKET_AIMD],
    settings: {
      foreground: "#6B7280",
    },
  },
]

/**
 * AIMD standalone theme
 * Use this when you want a complete theme with only AIMD colors
 */
export const aimdTheme: ThemeRegistration = {
  name: "aimd-theme",
  type: "light",
  settings: aimdTokenColors,
  colors: {},
}

/**
 * Create a theme that extends a base theme with AIMD token colors
 */
export function createAimdExtendedTheme(
  baseTheme: ThemeRegistration,
  name = "aimd-extended",
): ThemeRegistration {
  const baseSettings = baseTheme.settings || baseTheme.tokenColors || []
  return {
    ...baseTheme,
    name,
    settings: [...baseSettings, ...aimdTokenColors],
  }
}
