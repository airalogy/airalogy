import { describe, expect, it } from 'vitest'

import {
  AimdToken,
  AimdTokenDefinition,
  AimdSuffix,
  MarkupDefinition,
  KeywordDefinition,
  DelimiterDefinition,
  scopeName,
} from '../tokens'
import { aimdTheme, aimdTokenColors } from '../theme'
import {
  getDefaultAimdFields,
  buildAimdSyntax,
  createAimdFieldTypes,
  createMdToolbarItems,
  createAimdVarTypePresets,
  AIMD_FIELD_TYPE_DEFINITIONS,
  MD_TOOLBAR_ITEM_DEFINITIONS,
} from '../vue/types'
import { resolveAimdEditorLocale, createAimdEditorMessages } from '../vue/locales'

// ---------------------------------------------------------------------------
// Token definitions
// ---------------------------------------------------------------------------

describe('AimdToken definitions', () => {
  it('has markup tokens', () => {
    expect(AimdToken).toHaveProperty('MARKUP_AIMD_VARIABLE')
    expect(AimdToken).toHaveProperty('MARKUP_AIMD_STEP')
    expect(AimdToken).toHaveProperty('MARKUP_AIMD_CHECKPOINT')
  })

  it('has keyword tokens', () => {
    expect(AimdToken).toHaveProperty('KEYWORD_VARIABLE_AIMD')
    expect(AimdToken).toHaveProperty('KEYWORD_STEP_AIMD')
  })

  it('has delimiter tokens', () => {
    expect(AimdToken).toHaveProperty('DELIMITER_PIPE_AIMD')
    expect(AimdToken).toHaveProperty('DELIMITER_COLON_AIMD')
  })

  it('token suffix is "aimd"', () => {
    expect(AimdSuffix).toBe('aimd')
  })

  it('scope name follows TextMate convention', () => {
    expect(scopeName).toBe('text.html.markdown.aimd')
  })

  it('MarkupDefinition has variable and step entries', () => {
    expect(MarkupDefinition).toHaveProperty('MARKUP_AIMD_VARIABLE')
    expect(MarkupDefinition).toHaveProperty('MARKUP_AIMD_STEP')
  })

  it('KeywordDefinition has entries', () => {
    expect(Object.keys(KeywordDefinition).length).toBeGreaterThan(0)
  })

  it('DelimiterDefinition has entries', () => {
    expect(Object.keys(DelimiterDefinition).length).toBeGreaterThan(0)
  })

  it('AimdTokenDefinition has type tokens', () => {
    expect(AimdTokenDefinition).toHaveProperty('KEYWORD_CONTROL_AIMD')
    expect(AimdTokenDefinition).toHaveProperty('VARIABLE_PARAMETER_AIMD')
  })
})

// ---------------------------------------------------------------------------
// Theme (no Monaco dependency)
// ---------------------------------------------------------------------------

describe('AIMD theme', () => {
  it('aimdTheme has proper structure', () => {
    expect(aimdTheme).toHaveProperty('name')
    expect(aimdTheme).toHaveProperty('settings')
  })

  it('aimdTokenColors is an array', () => {
    expect(Array.isArray(aimdTokenColors)).toBe(true)
    expect(aimdTokenColors.length).toBeGreaterThan(0)
  })

  it('token colors have scope and settings', () => {
    for (const color of aimdTokenColors) {
      expect(color).toHaveProperty('scope')
      expect(color).toHaveProperty('settings')
    }
  })
})

// ---------------------------------------------------------------------------
// getDefaultAimdFields
// ---------------------------------------------------------------------------

describe('getDefaultAimdFields', () => {
  it('returns var defaults', () => {
    const fields = getDefaultAimdFields('var')
    expect(fields).toHaveProperty('name')
    expect(fields).toHaveProperty('type')
    expect(fields.type).toBe('str')
  })

  it('returns step defaults with level 1', () => {
    const fields = getDefaultAimdFields('step')
    expect(fields).toHaveProperty('name')
    expect(fields).toHaveProperty('level')
    expect(fields.level).toBe('1')
  })

  it('returns check defaults', () => {
    const fields = getDefaultAimdFields('check')
    expect(fields).toHaveProperty('name')
  })

  it('returns quiz defaults', () => {
    const fields = getDefaultAimdFields('quiz')
    expect(fields).toHaveProperty('id')
    expect(fields).toHaveProperty('quizType')
    expect(fields.quizType).toBe('choice')
  })

  it('returns var_table defaults', () => {
    const fields = getDefaultAimdFields('var_table')
    expect(fields).toHaveProperty('name')
    expect(fields).toHaveProperty('subvars')
  })

  it('returns generic defaults for unknown type', () => {
    const fields = getDefaultAimdFields('unknown')
    expect(fields).toHaveProperty('name')
  })
})

// ---------------------------------------------------------------------------
// buildAimdSyntax
// ---------------------------------------------------------------------------

describe('buildAimdSyntax', () => {
  it('builds simple var syntax', () => {
    const syntax = buildAimdSyntax('var', { name: 'temperature', type: 'float', default: '36.5', title: '' })
    expect(syntax).toBe('{{var|temperature: float = 36.5}}')
  })

  it('builds var with title', () => {
    const syntax = buildAimdSyntax('var', { name: 'temp', type: 'float', default: '', title: 'Temperature' })
    expect(syntax).toContain('title = "Temperature"')
  })

  it('builds var without type or default', () => {
    const syntax = buildAimdSyntax('var', { name: 'note', type: '', default: '', title: '' })
    expect(syntax).toBe('{{var|note}}')
  })

  it('uses fallback name when empty', () => {
    const syntax = buildAimdSyntax('var', { name: '', type: '', default: '', title: '' })
    expect(syntax).toContain('my_var')
  })

  it('builds step syntax', () => {
    const syntax = buildAimdSyntax('step', { name: 'wash_hands', level: '1' })
    expect(syntax).toBe('{{step|wash_hands}}')
  })

  it('builds step with level > 1', () => {
    const syntax = buildAimdSyntax('step', { name: 'substep', level: '2' })
    expect(syntax).toBe('{{step|substep, 2}}')
  })

  it('builds var_table syntax', () => {
    const syntax = buildAimdSyntax('var_table', { name: 'measurements', subvars: 'temp, pressure' })
    expect(syntax).toContain('var_table|measurements')
    expect(syntax).toContain('subvars=[temp, pressure]')
  })

  it('builds check syntax', () => {
    const syntax = buildAimdSyntax('check', { name: 'verify_result' })
    expect(syntax).toBe('{{check|verify_result}}')
  })

  it('builds ref_step syntax', () => {
    const syntax = buildAimdSyntax('ref_step', { name: 'step1' })
    expect(syntax).toContain('ref_step')
    expect(syntax).toContain('step1')
  })

  it('builds quiz syntax', () => {
    const syntax = buildAimdSyntax('quiz', {
      id: 'q1',
      quizType: 'choice',
      mode: 'single',
      stem: 'What is 1+1?',
      options: 'A:One, B:Two',
      answer: 'B',
      blanks: '',
      rubric: '',
      score: '',
    })
    expect(syntax).toContain('```quiz')
    expect(syntax).toContain('id: q1')
    expect(syntax).toContain('type: choice')
    expect(syntax).toContain('mode: single')
    expect(syntax).toContain('What is 1+1?')
  })
})

// ---------------------------------------------------------------------------
// Locale helpers
// ---------------------------------------------------------------------------

describe('resolveAimdEditorLocale', () => {
  it('defaults to en-US', () => {
    expect(resolveAimdEditorLocale()).toBe('en-US')
  })

  it('resolves zh to zh-CN', () => {
    expect(resolveAimdEditorLocale('zh')).toBe('zh-CN')
    expect(resolveAimdEditorLocale('zh-CN')).toBe('zh-CN')
  })

  it('resolves en to en-US', () => {
    expect(resolveAimdEditorLocale('en')).toBe('en-US')
  })
})

describe('createAimdEditorMessages', () => {
  it('creates messages with expected sections', () => {
    const messages = createAimdEditorMessages('en-US')
    expect(messages).toHaveProperty('defaults')
    expect(messages).toHaveProperty('fieldTypes')
    expect(messages).toHaveProperty('mdToolbar')
  })

  it('merges custom overrides', () => {
    const messages = createAimdEditorMessages('en-US', {
      defaults: { questionStem: 'Custom stem' },
    })
    expect(messages.defaults.questionStem).toBe('Custom stem')
  })
})

// ---------------------------------------------------------------------------
// Field type and toolbar definitions
// ---------------------------------------------------------------------------

describe('AIMD field type definitions', () => {
  it('has expected field types', () => {
    const types = AIMD_FIELD_TYPE_DEFINITIONS.map(d => d.type)
    expect(types).toContain('var')
    expect(types).toContain('step')
    expect(types).toContain('check')
    expect(types).toContain('quiz')
  })

  it('createAimdFieldTypes localizes definitions', () => {
    const messages = createAimdEditorMessages('en-US')
    const types = createAimdFieldTypes(messages)
    expect(types.length).toBe(AIMD_FIELD_TYPE_DEFINITIONS.length)
    expect(types[0]).toHaveProperty('label')
  })
})

describe('MD toolbar item definitions', () => {
  it('has expected toolbar actions', () => {
    const actions = MD_TOOLBAR_ITEM_DEFINITIONS.map(d => d.action)
    expect(actions).toContain('h1')
    expect(actions).toContain('bold')
  })

  it('createMdToolbarItems localizes items', () => {
    const messages = createAimdEditorMessages('en-US')
    const items = createMdToolbarItems(messages)
    expect(items.length).toBe(MD_TOOLBAR_ITEM_DEFINITIONS.length)
    const nonSeparator = items.find(i => !i.action.startsWith('sep'))
    expect(nonSeparator).toHaveProperty('title')
  })
})

describe('AIMD var type presets', () => {
  it('includes built-in recorder-aware code string presets', () => {
    const messages = createAimdEditorMessages('en-US')
    const presets = createAimdVarTypePresets(messages)
    const presetValues = presets.map(preset => preset.value)

    expect(presetValues).toContain('CodeStr')
    expect(presetValues).toContain('PyStr')
    expect(presetValues).toContain('JsStr')
    expect(presetValues).toContain('TsStr')
    expect(presetValues).toContain('JsonStr')
    expect(presetValues).toContain('TomlStr')
    expect(presetValues).toContain('YamlStr')
  })
})
