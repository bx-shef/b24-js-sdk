#!/usr/bin/env node
// The skip marker above a ```ts fence: `// @check-ignore` outside a fence is shown on the
// page as text, so in Markdown it is written `<!-- @check-ignore: … -->`. Both forms
// must keep skipping the block; the visible form must be caught by docs-lint.
//
// Run with: node --test scripts/__tests__/docs-check-ignore-marker.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { findVisibleCheckIgnore } from '../docs-lint.mjs'
import { isCheckIgnoreMarker } from '../_typecheck-blocks.mjs'

const fence = '```'

test('both marker forms skip a block', () => {
  assert.equal(isCheckIgnoreMarker('// @check-ignore: reason'), true)
  assert.equal(isCheckIgnoreMarker('  <!-- @check-ignore: reason -->'), true)
  assert.equal(isCheckIgnoreMarker('<!-- just a comment -->'), false)
  assert.equal(isCheckIgnoreMarker('text @check-ignore'), false)
})

test('a // marker outside a fence is reported with its line', () => {
  const raw = ['# T', '', '// @check-ignore: x', `${fence}ts`, 'a()', fence].join('\n')
  assert.deepEqual(findVisibleCheckIgnore(raw), [3])
})

test('the HTML-comment marker is not reported', () => {
  const raw = ['<!-- @check-ignore: x -->', `${fence}ts`, 'a()', fence].join('\n')
  assert.deepEqual(findVisibleCheckIgnore(raw), [])
})

test('a // marker inside a fence is code, not page text', () => {
  const raw = [`${fence}ts`, '  // @check-ignore: x', 'a()', fence, `${fence}${fence[0]}md`, '// @check-ignore: y', `${fence}${fence[0]}`].join('\n')
  assert.deepEqual(findVisibleCheckIgnore(raw), [])
})

test('a fence opener with an info string does not close the fence', () => {
  const raw = [`${fence}md`, `${fence}ts`, '// @check-ignore: inside', fence].join('\n')
  assert.deepEqual(findVisibleCheckIgnore(raw), [])
})
