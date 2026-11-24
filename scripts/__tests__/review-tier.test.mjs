#!/usr/bin/env node
// Уровни ревью PR (tools/review-tier.sh): правила tools/review-tier.rules сходятся с таблицей случаев,
// а таблица с неверным уровнем обязана краснеть.
//
// Run with: node --test scripts/__tests__/review-tier.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

const selfTest = rules => spawnSync('bash', ['tools/review-tier.sh', '--self-test'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, ...(rules ? { REVIEW_TIER_RULES: rules } : {}) }
})

test('правила уровней ревью сходятся с таблицей случаев', () => {
  const r = selfTest()
  assert.equal(r.status, 0, r.stderr)
})

test('таблица случаев с неверным уровнем краснеет', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-tier-'))
  try {
    const src = readFileSync(join(ROOT, 'tools/review-tier.rules'), 'utf8')
    const broken = src.replace(/^case 2 /m, 'case 0 ')
    assert.notEqual(broken, src)
    const file = join(dir, 'broken.rules')
    writeFileSync(file, broken)
    assert.notEqual(selfTest(file).status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
