import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateClientAssignerFunctionSource } from '../dist/parser.js'

// Helper: wrap a body in a valid assigner function shape
function wrapFunction(body) {
  return `function test_fn(deps) {\n  ${body}\n}`
}

// ── Valid function passes validation ──────────────────────────────────────────

test('valid assigner function passes validation', () => {
  const source = wrapFunction('return { x: deps.a + deps.b };')
  assert.doesNotThrow(() => validateClientAssignerFunctionSource(source, 'test'))
})

// ── Unicode escape bypass tests ──────────────────────────────────────────────

test('Unicode escape: e\\u0076al is caught as "eval"', () => {
  const source = wrapFunction('return { x: e\\u0076al("1+1") };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('Unicode escape: \\u0077indow is caught as "window"', () => {
  const source = wrapFunction('return { x: \\u0077indow.location };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('Unicode escape: \\u0046unction is caught as "Function"', () => {
  const source = wrapFunction('return { x: \\u0046unction("return 1")() };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('Unicode escape: globalTh\\u0069s is caught as "globalThis"', () => {
  const source = wrapFunction('return { x: globalTh\\u0069s };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('Unicode escape: \\u0044ate is caught as "Date"', () => {
  const source = wrapFunction('return { x: \\u0044ate.now() };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /must not use time-dependent APIs/,
  )
})

test('Unicode escape: __pro\\u0074o__ is caught', () => {
  const source = wrapFunction('var o = {}; o.__pro\\u0074o__ = null; return { x: 1 };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked object metaprogramming features/,
  )
})

// ── Computed member access bypass tests ──────────────────────────────────────

test('computed member access: obj["eval"] is caught', () => {
  const source = wrapFunction('var g = deps; return { x: g["eval"]("1") };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('computed member access: obj["constructor"] is caught', () => {
  const source = wrapFunction('return { x: deps["constructor"] };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked object metaprogramming features/,
  )
})

test('computed member access: obj["__proto__"] is caught', () => {
  const source = wrapFunction('return { x: deps["__proto__"] };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked object metaprogramming features/,
  )
})

// ── Direct forbidden identifiers ─────────────────────────────────────────────

test('direct eval() is caught', () => {
  const source = wrapFunction('return { x: eval("1+1") };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('direct window access is caught', () => {
  const source = wrapFunction('return { x: window.location.href };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('direct fetch() is caught', () => {
  const source = wrapFunction('return { x: fetch("/api") };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked runtime globals/,
  )
})

test('this expression is caught', () => {
  const source = wrapFunction('return { x: this.secret };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /uses blocked object metaprogramming features/,
  )
})

test('Math.random is caught', () => {
  const source = wrapFunction('return { x: Math.random() };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /must not use randomness/,
  )
})

test('Date is caught', () => {
  const source = wrapFunction('return { x: Date.now() };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /must not use time-dependent APIs/,
  )
})

// ── Forbidden syntax constructs ──────────────────────────────────────────────

test('arrow functions are caught', () => {
  const source = wrapFunction('var f = () => 1; return { x: f() };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /does not allow arrow functions/,
  )
})

test('new expression is caught', () => {
  const source = wrapFunction('return { x: new Array(3) };')
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /contains unsupported control-flow or module syntax/,
  )
})

test('multiple function definitions are caught', () => {
  const src = `function test_fn(deps) {
    function inner() { return 1; }
    return { x: inner() };
  }`
  assert.throws(
    () => validateClientAssignerFunctionSource(src, 'test'),
    /must contain exactly one function definition/,
  )
})

test('missing return is caught', () => {
  const source = 'function test_fn(deps) { deps.x = 1; }'
  assert.throws(
    () => validateClientAssignerFunctionSource(source, 'test'),
    /must return an object/,
  )
})

// ── Math operations that are allowed ─────────────────────────────────────────

test('Math.floor and other Math methods are allowed', () => {
  const source = wrapFunction('return { x: Math.floor(deps.a) };')
  assert.doesNotThrow(() => validateClientAssignerFunctionSource(source, 'test'))
})

test('Math.round is allowed', () => {
  const source = wrapFunction('return { x: Math.round(deps.a * 100) / 100 };')
  assert.doesNotThrow(() => validateClientAssignerFunctionSource(source, 'test'))
})
