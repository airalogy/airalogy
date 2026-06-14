import { describe, expect, it } from 'vitest'

import { parseAndExtract, renderToHtml } from '@airalogy/aimd-renderer'
import { getTutorialLessons, type TutorialEvaluationState } from './tutorialLessons'
import type { DemoLocale } from './demoI18n'

const LOCALES: DemoLocale[] = ['en-US', 'zh-CN']

describe('tutorialLessons', () => {
  it.each(LOCALES)('keeps every %s solution passing its lesson checks', async (locale) => {
    for (const lesson of getTutorialLessons(locale)) {
      const fields = parseAndExtract(lesson.solution)
      const { html } = await renderToHtml(lesson.solution, { locale })
      const state: TutorialEvaluationState = {
        content: lesson.solution,
        normalizedContent: lesson.solution.replace(/\r\n?/g, '\n'),
        fields,
        html,
        parseError: '',
        renderError: '',
      }

      for (const check of lesson.checks) {
        expect(check.evaluate(state), `${lesson.id}:${check.id}`).toBe(true)
      }
    }
  })
})
