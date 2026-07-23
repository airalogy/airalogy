import type {
  AimdResourceRefOption,
  AimdResourceResolverMap,
} from '@airalogy/aimd-recorder'

const RESOURCES: AimdResourceRefOption[] = [
  {
    entity: 'plasmid',
    id: 'resource-plasmid-puc19',
    source: 'demo-resource-library',
    label: 'pUC19',
    code: 'PLASMID-0001',
    status: 'active',
  },
  {
    entity: 'plasmid',
    id: 'resource-plasmid-pbr322',
    source: 'demo-resource-library',
    label: 'pBR322',
    code: 'PLASMID-0002',
    status: 'active',
  },
  {
    entity: 'reagent',
    id: 'resource-buffer-te',
    source: 'demo-resource-library',
    label: 'TE buffer',
    code: 'REAGENT-0001',
    status: 'active',
  },
  {
    entity: 'equipment',
    id: 'resource-centrifuge-01',
    source: 'demo-resource-library',
    label: 'Centrifuge 01',
    code: 'EQUIPMENT-0001',
    status: 'active',
  },
]

let outputSerial = 1

function resolverFor(entity: string): AimdResourceResolverMap[string] {
  return {
    async search(query) {
      const normalized = query.trim().toLowerCase()
      return RESOURCES.filter(item => (
        item.entity === entity
        && [item.label, item.id, item.code].some(value => String(value ?? '').toLowerCase().includes(normalized))
      ))
    },
    async resolve(id) {
      return RESOURCES.find(item => item.entity === entity && item.id === id)
    },
    async getAvailability(resource) {
      if (entity === 'equipment') {
        return {
          equipment_slots: [
            {
              id: 'booking-demo-morning',
              starts_at: '2026-07-24T09:00:00+08:00',
              ends_at: '2026-07-24T10:00:00+08:00',
              label: '09:00–10:00',
              available: true,
            },
            {
              id: 'booking-demo-afternoon',
              starts_at: '2026-07-24T14:00:00+08:00',
              ends_at: '2026-07-24T15:00:00+08:00',
              label: '14:00–15:00',
              available: true,
            },
          ],
        }
      }
      const unit = entity === 'plasmid' ? 'mg' : 'mL'
      return {
        available: entity === 'plasmid' ? '1.250' : '250.0',
        unit,
        lots: [
          { id: `${resource.id}-lot-01`, label: 'Lot 01', available: entity === 'plasmid' ? '1.250' : '250.0', unit },
        ],
        containers: [
          {
            id: `${resource.id}-container-01`,
            lot_id: `${resource.id}-lot-01`,
            label: 'Container 01',
            location: 'Freezer A / Shelf 2',
            available: entity === 'plasmid' ? '1.250' : '250.0',
            unit,
          },
        ],
      }
    },
    async prepareOutput(draft) {
      const id = `demo-output-${outputSerial++}`
      return {
        id,
        value: {
          ...draft,
          entity,
          id,
          source: 'demo-resource-library',
          label: draft.label || `Derived ${entity}`,
        },
        payload: {
          client_id: id,
          name: draft.label || `Derived ${entity}`,
          resource_type: entity,
        },
      }
    },
  }
}

export const demoResourceResolvers: AimdResourceResolverMap = {
  plasmid: resolverFor('plasmid'),
  reagent: resolverFor('reagent'),
  equipment: resolverFor('equipment'),
  sample: resolverFor('sample'),
}
