#!/usr/bin/env node
// Section skeleton of action/tools pages (scripts/docs-lint.mjs): the original
// English headings and their Russian translations are both accepted, presence
// and order are still enforced.
//
// Run with: node --test scripts/__tests__/docs-lint-sections.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actionSkeletonProblems } from '../docs-lint.mjs'

const SCRIPT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'docs-lint.mjs')

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

test('mixing languages is accepted on purpose', () => {
  assert.deepEqual(errors(['## Overview', '## Сигнатура метода', '## Examples', '## Альтернативы и рекомендации']), [])
})

// The real script on a fixture tree: the skeleton check is wired into the run.
function runLint(pages) {
  const root = mkdtempSync(join(tmpdir(), 'docs-lint-sections-'))
  try {
    const dir = join(root, '2.actions')
    mkdirSync(dir, { recursive: true })
    for (const [name, headings] of Object.entries(pages)) {
      writeFileSync(join(dir, name), ['---', `title: ${name}`, 'description: Fixture page', 'category: \'actions\'', 'links: []', '---', '', ...headings.flatMap(h => [h, '', 'Text.', ''])].join('\n'))
    }
    return spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, DOCS_LINT_ROOT: root } })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('docs-lint run: a Russian page with every section passes', () => {
  const r = runLint({ 'ok.md': ['## Обзор', '## Сигнатура метода', '## Примеры', '## Обработка ошибок', '## Альтернативы и рекомендации'] })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

test('docs-lint run: a page missing sections exits 1', () => {
  const r = runLint({ 'bad.md': ['## Обзор'] })
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stdout + r.stderr, /missing required section/)
})
