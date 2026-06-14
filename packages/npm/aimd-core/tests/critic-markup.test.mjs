import assert from 'node:assert/strict'
import { test } from 'node:test'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY,
  protectCriticMarkupSubstitutions,
  remarkCriticMarkup,
} from '../dist/parser.js'

function parseCriticMarkup(content) {
  const { content: protectedContent, substitutions } = protectCriticMarkupSubstitutions(content)
  const file = {
    data: {
      [CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY]: substitutions,
    },
  }
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCriticMarkup)
  const tree = processor.parse(protectedContent)
  return processor.runSync(tree, file)
}

function collectNodesByType(node, type, matches = []) {
  if (Array.isArray(node)) {
    node.forEach(child => collectNodesByType(child, type, matches))
    return matches
  }

  if (!node || typeof node !== 'object') {
    return matches
  }

  if (node.type === type) {
    matches.push(node)
  }

  if (Array.isArray(node.children)) {
    collectNodesByType(node.children, type, matches)
  }
  if (Array.isArray(node.oldChildren)) {
    collectNodesByType(node.oldChildren, type, matches)
  }
  if (Array.isArray(node.newChildren)) {
    collectNodesByType(node.newChildren, type, matches)
  }

  return matches
}

function collectTextValues(node, values = []) {
  if (Array.isArray(node)) {
    node.forEach(child => collectTextValues(child, values))
    return values
  }

  if (!node || typeof node !== 'object') {
    return values
  }

  if (node.type === 'text') {
    values.push(node.value)
  }

  if (Array.isArray(node.children)) {
    collectTextValues(node.children, values)
  }
  if (Array.isArray(node.oldChildren)) {
    collectTextValues(node.oldChildren, values)
  }
  if (Array.isArray(node.newChildren)) {
    collectTextValues(node.newChildren, values)
  }

  return values
}

test('remarkCriticMarkup produces AST nodes for all review mark kinds', () => {
  const tree = parseCriticMarkup('Add {++new++}, delete {--old--}, replace {~~old~>new~~}, comment {>>check units<<}, highlight {==important==}.')

  const additions = collectNodesByType(tree, 'criticAddition')
  const deletions = collectNodesByType(tree, 'criticDeletion')
  const substitutions = collectNodesByType(tree, 'criticSubstitution')
  const comments = collectNodesByType(tree, 'criticComment')
  const highlights = collectNodesByType(tree, 'criticHighlight')

  assert.equal(additions[0]?.kind, 'addition')
  assert.equal(additions[0]?.value, 'new')
  assert.equal(deletions[0]?.kind, 'deletion')
  assert.equal(deletions[0]?.value, 'old')
  assert.equal(substitutions[0]?.kind, 'substitution')
  assert.equal(substitutions[0]?.oldValue, 'old')
  assert.equal(substitutions[0]?.newValue, 'new')
  assert.equal(comments[0]?.kind, 'comment')
  assert.equal(comments[0]?.value, 'check units')
  assert.equal(highlights[0]?.kind, 'highlight')
  assert.equal(highlights[0]?.value, 'important')
  assert.equal(collectNodesByType(tree, 'delete').length, 0)
})

test('remarkCriticMarkup keeps review marks literal inside inline code and fenced code', () => {
  const tree = parseCriticMarkup([
    'Literal `{++code++}` and `{~~old~>new~~}` stay code.',
    '',
    '```',
    '{==not highlighted==}',
    '```',
  ].join('\n'))

  assert.equal(collectNodesByType(tree, 'criticAddition').length, 0)
  assert.equal(collectNodesByType(tree, 'criticSubstitution').length, 0)
  assert.equal(collectNodesByType(tree, 'criticHighlight').length, 0)
  assert.deepEqual(
    collectNodesByType(tree, 'inlineCode').map(node => node.value),
    ['{++code++}', '{~~old~>new~~}'],
  )
  assert.equal(collectNodesByType(tree, 'code')[0]?.value, '{==not highlighted==}')
})

test('remarkCriticMarkup does not consume literal placeholder-like text', () => {
  const literal = '\uE000AIMDCRITICMARKUPSUBSTITUTION0\uE001'
  const tree = parseCriticMarkup(`${literal} {~~old~>new~~}`)

  assert.equal(collectNodesByType(tree, 'criticSubstitution').length, 1)
  assert.ok(collectTextValues(tree).some(value => value.includes(literal)))
})
