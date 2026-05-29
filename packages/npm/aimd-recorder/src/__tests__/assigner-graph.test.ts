import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import AimdAssignerGraph from '../components/AimdAssignerGraph.vue'
import type { AimdAssignerGraphData } from '../types'

const assignerGraph: AimdAssignerGraphData = {
  nodes: [
    { name: 'seconds', type: 'dependent_field' },
    { name: 'calculate_duration', type: 'assigner' },
    { name: 'duration', type: 'assigned_field' },
  ],
  edges: [
    ['seconds', 'calculate_duration'],
    ['calculate_duration', 'duration'],
  ],
}

describe('AimdAssignerGraph', () => {
  it('renders assigner graph nodes, edges, and legend labels', () => {
    const wrapper = mount(AimdAssignerGraph, {
      props: {
        assignerGraph,
      },
    })

    expect(wrapper.findAll('.aimd-assigner-graph__node')).toHaveLength(3)
    expect(wrapper.findAll('.aimd-assigner-graph__edge')).toHaveLength(2)
    expect(wrapper.text()).toContain('Dependent field')
    expect(wrapper.text()).toContain('Assigner')
    expect(wrapper.text()).toContain('Assigned field')
    expect(wrapper.text()).toContain('calculate_duration')
  })

  it('toggles between field names and schema titles', async () => {
    const wrapper = mount(AimdAssignerGraph, {
      props: {
        assignerGraph,
        nodeSchemaMap: {
          duration: {
            title: 'Duration',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('duration')
    expect(wrapper.text()).not.toContain('Duration')

    await wrapper.find('.aimd-assigner-graph__mode-btn').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Duration')
  })

  it('highlights connected nodes and emits node clicks', async () => {
    const wrapper = mount(AimdAssignerGraph, {
      props: {
        assignerGraph,
      },
    })

    await wrapper.find('[aria-label="calculate_duration"]').trigger('click')
    await nextTick()

    expect(wrapper.emitted('nodeClick')?.[0]?.[0]).toBe('calculate_duration')
    expect(wrapper.emitted('nodeClick')?.[0]?.[1]).toBe('assigner')
    expect(wrapper.findAll('.aimd-assigner-graph__node--highlighted')).toHaveLength(3)
    expect(wrapper.findAll('.aimd-assigner-graph__edge--highlighted')).toHaveLength(2)
  })

  it('renders an empty state without graph data', () => {
    const wrapper = mount(AimdAssignerGraph, {
      props: {
        assignerGraph: null,
      },
    })

    expect(wrapper.text()).toContain('No assigner graph available')
    expect(wrapper.find('.aimd-assigner-graph__svg').exists()).toBe(false)
  })
})
