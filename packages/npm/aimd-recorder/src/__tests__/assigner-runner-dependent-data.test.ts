import { describe, expect, it } from 'vitest'
import { buildAimdAssignerDependentData } from '../composables/useAssignerRunner'

describe('assigner dependent data normalization', () => {
  it('drops empty placeholder rows from dependent var tables', () => {
    const dependentData = buildAimdAssignerDependentData(
      {
        var: {
          manual_edges: [
            {},
            { from_site_id: '', to_site_id: '', note: '' },
            { from_site_id: 'S01', to_site_id: 'S02', note: '' },
          ],
          blocked_edges: [{}],
        },
        step: {},
        check: {},
        quiz: {},
      },
      {
        dependentFields: ['manual_edges', 'blocked_edges'],
      },
    )

    expect(dependentData).toEqual({
      manual_edges: [
        { from_site_id: 'S01', to_site_id: 'S02' },
      ],
      blocked_edges: [],
    })
  })
})
