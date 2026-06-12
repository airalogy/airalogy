import { defineComponent, h, type PropType, type VNodeChild } from 'vue'

export default defineComponent({
  name: 'RenderedAimdDocument',
  props: {
    nodes: {
      type: Array as PropType<VNodeChild[]>,
      required: true,
    },
    showFieldIds: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () => h('div', {
      class: [
        'rendered-aimd-document',
        { 'rendered-aimd-document--show-field-ids': props.showFieldIds },
      ],
    }, props.nodes)
  },
})
