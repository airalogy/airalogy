import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { AimdVarNode } from '@airalogy/aimd-core/types'

import AimdEntityRefField from '../components/AimdEntityRefField.vue'
import AimdResourceRefField from '../components/AimdResourceRefField.vue'
import { createAimdRecorderMessages } from '../locales'

const node: AimdVarNode = {
  type: 'aimd',
  fieldType: 'var',
  scope: 'var',
  id: 'plasmid',
  raw: '{{var|plasmid}}',
  definition: {
    id: 'plasmid',
    type: 'ResourceRef["plasmid"]',
    kwargs: {
      resource_role: 'input',
      container_required: true,
    },
  },
}

describe('AimdResourceRefField', () => {
  it('loads availability and enriches the draft with lot and container ids', async () => {
    const getAvailability = vi.fn(async () => ({
      available: '1.250',
      unit: 'mg',
      lots: [{ id: 'lot-1', label: 'Lot 1', available: '1.250', unit: 'mg' }],
      containers: [{ id: 'tube-1', lot_id: 'lot-1', label: 'Tube 1' }],
    }))
    const wrapper = mount(AimdResourceRefField, {
      props: {
        node,
        value: { entity: 'plasmid', id: 'resource-1', label: 'pUC19' },
        messages: createAimdRecorderMessages('en-US'),
        type: 'ResourceRef["plasmid"]',
        resourceConfig: {
          multiple: false,
          entity: 'plasmid',
          role: 'input',
          containerRequired: true,
          bookingRequired: false,
        },
        resourceResolvers: {
          plasmid: {
            search: async () => [],
            getAvailability,
          },
        },
        record: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    expect(getAvailability).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('1.250')

    const selects = wrapper.findAll('select')
    await selects[0].setValue('lot-1')
    const changes = wrapper.emitted('change') ?? []
    expect(changes[changes.length - 1]?.[0]).toEqual({
      value: expect.objectContaining({ lot_id: 'lot-1' }),
    })
    wrapper.unmount()
  })

  it('uses prepareOutput without committing inventory in the component', async () => {
    const prepareOutput = vi.fn(async () => ({
      id: 'resource-generated',
      value: {
        entity: 'sample',
        id: 'resource-generated',
        label: 'Derived sample',
      },
      payload: {
        name: 'Derived sample',
      },
    }))
    const wrapper = mount(AimdResourceRefField, {
      props: {
        node: {
          ...node,
          id: 'output_sample',
        },
        messages: createAimdRecorderMessages('en-US'),
        type: 'ResourceRef["sample"]',
        resourceConfig: {
          multiple: false,
          entity: 'sample',
          role: 'output',
          containerRequired: false,
          bookingRequired: false,
        },
        resourceResolvers: {
          sample: {
            search: async () => [],
            prepareOutput,
          },
        },
        record: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    wrapper.getComponent(AimdEntityRefField).vm.$emit('change', {
      value: { entity: 'sample', id: 'draft', label: 'Derived sample' },
    })
    await flushPromises()

    expect(prepareOutput).toHaveBeenCalledOnce()
    const changes = wrapper.emitted('change') ?? []
    expect(changes[changes.length - 1]?.[0]).toEqual({
      value: {
        entity: 'sample',
        id: 'resource-generated',
        label: 'Derived sample',
        prepared_output: {
          name: 'Derived sample',
        },
      },
    })
    wrapper.unmount()
  })
})
