import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AimdRecorderWysiwygFieldHost from '../components/AimdRecorderWysiwygFieldHost.vue'
import { createEmptyProtocolRecordData } from '../types'
import type { RecorderMilkdownSurfaceState } from '../components/recorderMilkdownPlugin'

function createSurfaceState(): RecorderMilkdownSurfaceState {
  return {
    record: createEmptyProtocolRecordData(),
    readonly: false,
    submitted: false,
    choiceOptionExplanationMode: 'hidden',
    scaleGradeDisplayMode: 'hidden',
    stepDetailDisplay: 'auto',
    validationTriggers: ['change', 'blur'],
    validationEpoch: 0,
    onUpdateRecord: () => {},
  }
}

describe('AimdRecorderWysiwygFieldHost', () => {
  it('renders inline var fields with the real recorder input UI instead of AIMD chips', async () => {
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: {
        surfaceState: createSurfaceState(),
        rawContent: '{{var|sample_name: str}}',
        displayMode: 'inline',
      },
    })
    await vi.waitFor(() => {
      expect(wrapper.find('.aimd-rec-inline--var-stacked').exists()).toBe(true)
    })

    expect(wrapper.html()).toContain('aimd-rec-inline--var-stacked')
    expect(wrapper.html()).toContain('data-rec-focus-key="var:sample_name"')
    expect(wrapper.html()).not.toContain('aimd-field-chip')
  })

  it('forwards the shared validation contract into embedded recorders', () => {
    const schema = {
      vars: {
        type: 'object',
        required: ['sample_name'],
        properties: { sample_name: { type: 'string', minLength: 1 } },
      },
    }
    const surfaceState = createSurfaceState()
    surfaceState.validationSchema = schema
    surfaceState.validationTriggers = ['blur']

    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: {
        surfaceState,
        rawContent: '{{var|sample_name: str}}',
        displayMode: 'inline',
      },
    })
    const recorder = wrapper.getComponent({ name: 'AimdRecorder' })
    expect(recorder.props('validationSchema')).toEqual(schema)
    expect(recorder.props('validationTriggers')).toEqual(['blur'])
  })
})
