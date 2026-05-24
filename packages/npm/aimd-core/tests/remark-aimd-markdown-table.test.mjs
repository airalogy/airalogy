import assert from 'node:assert/strict'
import { test } from 'node:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
  restoreAimdInlineTemplates,
} from '../dist/parser.js'

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return {
    tree,
    fields: file.data.aimdFields,
  }
}

function findAimdNode(node) {
  if (!node || typeof node !== 'object') {
    return null
  }

  if (node.type === 'aimd') {
    return node
  }

  if (!Array.isArray(node.children)) {
    return null
  }

  for (const child of node.children) {
    const found = findAimdNode(child)
    if (found) {
      return found
    }
  }

  return null
}

function countNodesByType(node, type) {
  if (!node || typeof node !== 'object') {
    return 0
  }

  let count = node.type === type ? 1 : 0
  if (!Array.isArray(node.children)) {
    return count
  }

  for (const child of node.children) {
    count += countNodesByType(child, type)
  }

  return count
}

test('typed inline var inside markdown table is parsed as AIMD node', () => {
  const { tree, fields } = parseAimd(`
| Ingredient | Amount |
| --- | --- |
| Water | {{var|water_volume_ml: float}} mL |
`)

  const aimdNode = findAimdNode(tree)

  assert.equal(aimdNode?.fieldType, 'var')
  assert.equal(aimdNode?.id, 'water_volume_ml')
  assert.equal(aimdNode?.definition?.type, 'float')
  assert.equal(aimdNode?.definition?.id, 'water_volume_ml')
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('template protection does not break normal inline vars', () => {
  const { tree, fields } = parseAimd('Water amount: {{var|water_volume_ml: float}} mL')
  const aimdNode = findAimdNode(tree)

  assert.equal(aimdNode?.fieldType, 'var')
  assert.equal(aimdNode?.id, 'water_volume_ml')
  assert.equal(aimdNode?.definition?.id, 'water_volume_ml')
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('float defaults preserve their original literal for UI display', () => {
  const { tree } = parseAimd('Temperature: {{var|temperature: float = 25.0}}')
  const aimdNode = findAimdNode(tree)

  assert.equal(aimdNode?.fieldType, 'var')
  assert.equal(aimdNode?.definition?.id, 'temperature')
  assert.equal(aimdNode?.definition?.default, 25)
  assert.equal(aimdNode?.definition?.defaultRaw, '25.0')
})

test('protected AIMD tokens can be restored without external template map', () => {
  const raw = '| Water | {{var|water_volume_ml: float}} mL |'
  const { content: protectedContent } = protectAimdInlineTemplates(raw)

  assert.notEqual(protectedContent, raw)
  assert.equal(restoreAimdInlineTemplates(protectedContent), raw)
})

test('extracted fields expose canonical id properties only', () => {
  const { fields } = parseAimd(`
{{var_table|samples, subvars=[sample_id, concentration, volume]}}

{{step|sample_preparation}}
{{step|buffer_setup, 2}}
{{step|data_analysis}}
`)

  assert.equal(fields.var_table[0]?.id, 'samples')
  assert.equal(fields.var_table[0]?.subvars?.[0]?.id, 'sample_id')

  assert.equal(fields.step_hierarchy?.[0]?.id, 'sample_preparation')
  assert.equal(fields.step_hierarchy?.[0]?.step, '1')
  assert.equal(fields.step_hierarchy?.[1]?.id, 'buffer_setup')
  assert.equal(fields.step_hierarchy?.[1]?.step, '1.1')
  assert.equal(fields.step_hierarchy?.[2]?.id, 'data_analysis')
  assert.equal(fields.step_hierarchy?.[2]?.prev_id, 'sample_preparation')
})

test('client assigner blocks are extracted and hidden from the markdown tree', () => {
  const { tree, fields } = parseAimd(`
Input A: {{var|var_1: float}}
Input B: {{var|var_2: float}}
Output: {{var|var_3: float}}

\`\`\`assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["var_1", "var_2"],
    assigned_fields: ["var_3"],
  },
  function calculate_var_3({ var_1, var_2 }) {
    return {
      var_3: var_1 + var_2,
    };
  }
);
\`\`\`
`)

  assert.equal(fields.client_assigner.length, 1)
  assert.deepEqual(fields.client_assigner[0], {
    id: 'calculate_var_3',
    runtime: 'client',
    mode: 'auto',
    dependent_fields: ['var_1', 'var_2'],
    assigned_fields: ['var_3'],
    function_source: `function calculate_var_3({ var_1, var_2 }) {
    return {
      var_3: var_1 + var_2,
    };
  }`,
  })
  assert.equal(countNodesByType(tree, 'code'), 0)
})

test('assigner graph validation rejects duplicate assigned fields across runtimes', () => {
  assert.throws(() => parseAimd(`
Input A: {{var|var_1: float}}
Output: {{var|var_3: float}}

\`\`\`assigner
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["var_3"],
    dependent_fields=["var_1"],
    mode="auto",
)
def assign_var_3(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"var_3": dep["var_1"]})
\`\`\`

\`\`\`assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["var_1"],
    assigned_fields: ["var_3"],
  },
  function calculate_var_3_client({ var_1 }) {
    return {
      var_3: var_1,
    };
  }
);
\`\`\`
`), /assigned field "var_3" is already handled by server assigner "assign_var_3"/)
})

test('assigner graph validation rejects cross-runtime cycles', () => {
  assert.throws(() => parseAimd(`
Field A: {{var|field_a: float}}
Field B: {{var|field_b: float}}

\`\`\`assigner
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["field_a"],
    dependent_fields=["field_b"],
    mode="auto",
)
def assign_field_a(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"field_a": dep["field_b"]})
\`\`\`

\`\`\`assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["field_a"],
    assigned_fields: ["field_b"],
  },
  function assign_field_b({ field_a }) {
    return {
      field_b: field_a,
    };
  }
);
\`\`\`
`), /circular assigner dependency detected: server:assign_field_a -> client:assign_field_b -> server:assign_field_a/)
})

test('manual client assigners may declare empty dependent fields', () => {
  const { fields } = parseAimd(`
Output: {{var|refresh_token: str}}

\`\`\`assigner runtime=client
assigner(
  {
    mode: "manual",
    dependent_fields: [],
    assigned_fields: ["refresh_token"],
  },
  function issue_refresh_token(_) {
    return {
      refresh_token: "token-1",
    };
  }
);
\`\`\`
`)

  assert.deepEqual(fields.client_assigner[0], {
    id: 'issue_refresh_token',
    runtime: 'client',
    mode: 'manual',
    dependent_fields: [],
    assigned_fields: ['refresh_token'],
    function_source: `function issue_refresh_token(_) {
    return {
      refresh_token: "token-1",
    };
  }`,
  })
})

test('client assigner functions must accept exactly one dependent_fields parameter', () => {
  assert.throws(() => parseAimd(`
Output: {{var|refresh_token: str}}

\`\`\`assigner runtime=client
assigner(
  {
    mode: "manual",
    dependent_fields: [],
    assigned_fields: ["refresh_token"],
  },
  function issue_refresh_token(a, b) {
    return {
      refresh_token: a,
    };
  }
);
\`\`\`
`), /function must accept exactly one dependent_fields parameter/)
})
