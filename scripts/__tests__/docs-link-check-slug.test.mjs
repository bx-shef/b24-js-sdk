#!/usr/bin/env node
// Anchors in scripts/docs-link-check.mjs must match the ids the site renders
// (github-slugger via @nuxtjs/mdc) — for Russian headings too. Expected values
// are github-slugger 2.0.0 output for the same strings.
//
// Run with: node --test scripts/__tests__/docs-link-check-slug.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slugifyHeading } from '../docs-link-check.mjs'

const SCRIPT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'docs-link-check.mjs')

const CASES = [
  ['Init', 'init'],
  ['Runtime: Node 20 was dropped in 3.0.0', 'runtime-node-20-was-dropped-in-300'],
  ['call_list & batch', 'call_list--batch'],
  ['A  B', 'a--b'],
  ['Инициализация', 'инициализация'],
  ['Как использовать: шаг 1', 'как-использовать-шаг-1'],
  ['Ёжик и «кавычки»', 'ёжик-и-кавычки'],
  ['Версия 3.0 — что нового', 'версия-30--что-нового'],
  ['🚀 Start', '-start'],
  ['Hello ✓', 'hello-'],
  ['a b', 'ab'],
  ['№ 1 в списке', '1-в-списке']
]

test('slugs match github-slugger', () => {
  for (const [heading, slug] of CASES) {
    assert.equal(slugifyHeading(heading), slug, heading)
  }
})

test('importing the module does not run the check; a symlinked launch does', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-link-check-'))
  try {
    const link = join(dir, 'link.mjs')
    symlinkSync(SCRIPT, link)
    const r = spawnSync(process.execPath, [link], { encoding: 'utf8' })
    assert.match(r.stdout + r.stderr, /docs-link-check:/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
