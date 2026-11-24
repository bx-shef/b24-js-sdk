#!/usr/bin/env node
// GHSA-mrhx-c7xc-m3w5 is ignored in pnpm-workspace.yaml (auditConfig.ignoreGhsas)
// because zod 3 has no fix and @nuxt/content needs it at build time. The ignore is
// global, so `pnpm audit` would also stay silent about a vulnerable zod 4 — and
// zod 4 validates untrusted input (MCP tools, /api/ai). This test is the guard the
// audit no longer is: no zod 4 below 4.6.6 in the lock, the override in place,
// and zod 3 reachable only through @nuxt/content.
//
// Run with: node --test scripts/__tests__/zod-lock-guard.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')
const workspace = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8')

const zodVersions = [...new Set([...lock.matchAll(/^ {2}zod@(\d+)\.(\d+)\.(\d+):/gm)].map(m => m.slice(1, 4).map(Number)))]

test('the lock lists zod versions at all (the pattern still matches)', () => {
  assert.ok(zodVersions.length > 0)
})

test('no zod 4 below 4.6.6 in the lock', () => {
  for (const [major, minor, patch] of zodVersions) {
    if (major !== 4) continue
    const below = minor < 6 || (minor === 6 && patch < 6)
    assert.ok(!below, `zod@${major}.${minor}.${patch} is vulnerable to GHSA-mrhx-c7xc-m3w5`)
  }
})

test('the zod 4 override is in place', () => {
  assert.match(workspace, /^ {2}'zod@>=4 <4\.6\.6': '>=4\.6\.6 <5'$/m)
})

test('zod 3 is pulled only by @nuxt/content and zod-to-json-schema', () => {
  // Each snapshot block: a two-space key line, then its dependency lines.
  const blocks = lock.split(/\n(?= {2}\S)/)
  const users = blocks
    .filter(b => /^ {6}zod: 3\./m.test(b) || /\(zod@3\./.test(b.split('\n')[0]))
    .map(b => b.split('\n')[0].trim())
    .filter(key => !/^zod@3\./.test(key))
  for (const key of users) {
    assert.match(key, /^'?(@nuxt\/content|zod-to-json-schema)@/, `${key} depends on zod 3 — the audit ignore no longer covers only @nuxt/content`)
  }
})
