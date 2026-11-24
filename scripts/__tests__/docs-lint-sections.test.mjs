#!/usr/bin/env node
// Section skeleton of action/tools pages (scripts/docs-lint.mjs): the original
// English headings and their Russian translations are both accepted, presence
// and order are still enforced.
//
// Run with: node --test scripts/__tests__/docs-lint-sections.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actionSkeletonProblems } from '../docs-lint.mjs'

const errors = h => actionSkeletonProblems(h).filter(p => p.level === 'error')

test('English skeleton passes', () => {
  assert.deepEqual(actionSkeletonProblems(['## Overview', '## Method Signature', '## Examples', '## Error Handling', '## Alternatives and Recommendations']), [])
})

test('Russian skeleton passes', () => {
  assert.deepEqual(actionSkeletonProblems(['## Обзор', '## Сигнатура метода', '## Примеры', '## Обработка ошибок', '## Альтернативы и рекомендации']), [])
})

test('missing section fails in either language', () => {
  assert.equal(errors(['## Обзор', '## Примеры', '## Альтернативы и рекомендации']).length, 1)
  assert.equal(errors(['## Overview']).length, 3)
})

test('wrong order fails', () => {
  assert.equal(errors(['## Примеры', '## Обзор', '## Сигнатура метода', '## Альтернативы и рекомендации']).length, 1)
})

test('a translated-looking but different heading does not count', () => {
  assert.equal(errors(['## Обзор метода', '## Сигнатура метода', '## Примеры', '## Альтернативы и рекомендации']).length, 1)
})

test('missing recommended section is a warning', () => {
  const p = actionSkeletonProblems(['## Обзор', '## Сигнатура метода', '## Примеры', '## Альтернативы и рекомендации'])
  assert.deepEqual(p.map(x => x.level), ['warn'])
})
