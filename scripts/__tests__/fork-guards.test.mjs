#!/usr/bin/env node
// Форк bx-shef/b24-js-sdk: автоматика bitrix24 (релизы, npm, ночной smoke, GitHub Pages, PR Dependabot)
// здесь выключена условием github.repository и нулевыми лимитами. Слияние из bitrix24 может молча снять
// защиту при разрешении конфликта — этот тест краснеет, если условие пропало.
//
// Run with: node --test scripts/__tests__/fork-guards.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')
const GUARD = 'github.repository == \'bitrix24/b24jssdk\''
const count = (s, sub) => s.split(sub).length - 1

const EXPECTED = {
  '.github/workflows/release-please.yml': 1,
  '.github/workflows/npm-publish-js-sdk.yml': 1,
  '.github/workflows/npm-publish-js-sdk-nuxt.yml': 1,
  '.github/workflows/smoke-retry.yml': 1,
  '.github/workflows/ci.yml': 4 // Setup Pages, Create и Upload Pages artifact, deploy
}

for (const [file, n] of Object.entries(EXPECTED)) {
  test(`${file}: автоматика bitrix24 выключена в форке`, () => {
    assert.equal(count(read(file), GUARD), n)
  })
}

test('dependabot.yml: свои PR Dependabot выключены', () => {
  const s = read('.github/dependabot.yml')
  const ecosystems = count(s, 'package-ecosystem:')
  assert.ok(ecosystems > 0)
  assert.equal((s.match(/^\s+open-pull-requests-limit: 0\s*$/gm) ?? []).length, ecosystems)
  assert.doesNotMatch(s, /open-pull-requests-limit:\s*[1-9]/)
})
