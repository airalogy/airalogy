import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseConnectorsContent } from '../dist/parser.js'
import {
  createAimdEntityResolversFromConnectors,
  loadAimdConnectorDescriptor,
  resolveAimdEntityConnector,
  searchAimdEntityConnector,
} from '../dist/utils.js'

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async text() {
      return JSON.stringify(value)
    },
  }
}

test('createAimdEntityResolversFromConnectors returns recorder-compatible entity resolvers', async () => {
  const block = parseConnectorsContent([
    'lab_plasmid_registry:',
    '  kind: entity_source',
    '  entity: plasmid',
    '  descriptor: ./connectors/plasmid.yaml',
    '  auth:',
    '    token_env: LAB_PLASMID_TOKEN',
  ].join('\n'))
  const requests = []
  const resolvers = createAimdEntityResolversFromConnectors(block, {
    getSecret(name) {
      assert.equal(name, 'LAB_PLASMID_TOKEN')
      return 'secret-token'
    },
    loadDescriptor(descriptor, context) {
      assert.equal(descriptor, './connectors/plasmid.yaml')
      assert.deepEqual(context.headers, {})
      return [
        'entity: plasmid',
        'search:',
        '  method: GET',
        '  url: https://lims.example.com/api/plasmids',
        '  query_param: q',
        '  field_map:',
        '    id: plasmid_id',
        '    label: display',
        'resolve:',
        '  method: GET',
        '  url: https://lims.example.com/api/plasmids/{id}',
      ].join('\n')
    },
    async fetch(input, init) {
      requests.push({ input, init })
      return jsonResponse({
        items: [
          {
            plasmid_id: 'pUC19',
            display: 'pUC19 cloning vector',
            description: 'High-copy cloning vector',
          },
        ],
      })
    },
  })

  assert.equal(typeof resolvers.lab_plasmid_registry, 'object')
  assert.equal(resolvers.plasmid, resolvers.lab_plasmid_registry)

  const result = await resolvers.lab_plasmid_registry.search('puc', {
    entity: 'plasmid',
    source: 'lab_plasmid_registry',
  })

  assert.deepEqual(requests, [
    {
      input: 'https://lims.example.com/api/plasmids?q=puc',
      init: {
        method: 'GET',
        headers: {
          Authorization: 'Bearer secret-token',
        },
        body: undefined,
      },
    },
  ])
  assert.deepEqual(result, [
    {
      plasmid_id: 'pUC19',
      display: 'pUC19 cloning vector',
      description: 'High-copy cloning vector',
      entity: 'plasmid',
      source: 'lab_plasmid_registry',
      id: 'pUC19',
      label: 'pUC19 cloning vector',
    },
  ])
})

test('resolveAimdEntityConnector resolves an id with URL encoding', async () => {
  const requests = []
  const result = await resolveAimdEntityConnector({
    id: 'lab_plasmid_registry',
    kind: 'entity_source',
    entity: 'plasmid',
    resolve: {
      url: 'https://lims.example.com/api/plasmids/{id}',
    },
  }, 'pUC 19', {
    async fetch(input, init) {
      requests.push({ input, init })
      return jsonResponse({ id: 'pUC 19', name: 'pUC 19 vector' })
    },
  })

  assert.deepEqual(requests.map(request => request.input), [
    'https://lims.example.com/api/plasmids/pUC%2019',
  ])
  assert.equal(requests[0].init.method, 'GET')
  assert.deepEqual(result, {
    id: 'pUC 19',
    name: 'pUC 19 vector',
    entity: 'plasmid',
    source: 'lab_plasmid_registry',
    label: 'pUC 19 vector',
  })
})

test('connector auth secret is required only when executing endpoint requests', async () => {
  const connector = {
    id: 'lab_plasmid_registry',
    kind: 'entity_source',
    entity: 'plasmid',
    descriptor: './connectors/plasmid.yaml',
    auth: {
      token_env: 'LAB_PLASMID_TOKEN',
    },
  }

  await loadAimdConnectorDescriptor(connector, {
    loadDescriptor() {
      return {
        entity: 'plasmid',
        search: {
          url: 'https://lims.example.com/api/plasmids',
        },
      }
    },
  })

  await assert.rejects(
    () => searchAimdEntityConnector(connector, 'puc', {
      loadDescriptor() {
        return {
          entity: 'plasmid',
          search: {
            url: 'https://lims.example.com/api/plasmids',
          },
        }
      },
    }),
    /requires getSecret/,
  )
})

test('loadAimdConnectorDescriptor rejects entity mismatches', async () => {
  await assert.rejects(
    () => loadAimdConnectorDescriptor({
      id: 'lab_plasmid_registry',
      kind: 'entity_source',
      entity: 'plasmid',
      descriptor: './connectors/plasmid.yaml',
    }, {
      loadDescriptor() {
        return {
          entity: 'sample',
          search: {
            url: 'https://lims.example.com/api/samples',
          },
        }
      },
    }),
    /does not match connector entity/,
  )
})
