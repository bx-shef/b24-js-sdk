#!/usr/bin/env node
// Форк bx-shef/b24-js-sdk: автоматика bitrix24 (ночной smoke, GitHub Pages, PR Dependabot)
// здесь выключена условием github.repository и нулевыми лимитами. Слияние из bitrix24 может молча снять
// защиту при разрешении конфликта — этот тест краснеет, если условие пропало.
//
// Run with: node --test scripts/__tests__/fork-guards.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')
const GUARD = 'github.repository == \'bitrix24/b24jssdk\''
const count = (s, sub) => s.split(sub).length - 1

// Выпуск в npm — наш (@bxshefby/*), но только в этом репозитории и по переменной NPM_RELEASE.
const RELEASE_GUARD = 'github.repository == \'bx-shef/b24-js-sdk\' && vars.NPM_RELEASE == \'true\''
const RELEASE = [
  '.github/workflows/release-please.yml',
  '.github/workflows/npm-publish-js-sdk.yml',
  '.github/workflows/npm-publish-js-sdk-nuxt.yml'
]

for (const file of RELEASE) {
  test(`${file}: выпуск только в bx-shef/b24-js-sdk и при NPM_RELEASE`, () => {
    const s = read(file)
    assert.equal(count(s, RELEASE_GUARD), 1)
    assert.equal(count(s, GUARD), 0)
  })
}

for (const file of RELEASE.filter(f => f.includes('npm-publish'))) {
  test(`${file}: публикация только из окружения npm-release`, () => {
    // Trusted Publisher на npmjs.com привязан к этому окружению: без него публиковать мог бы любой с правом push.
    assert.match(read(file), /^ {2}publish:\n(?: {4}.*\n)*? {4}environment: npm-release\n/m)
  })
}

const EXPECTED = {
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

// Пакеты форка выходят как @bxshefby/*. Имя bitrix24 при переносе их коммитов возвращается
// в тексты незаметно — оно законно только в главе о переходе, в CHANGELOG (история),
// в ключе localStorage Pull-клиента (совместимость), в правилах выпуска и переноса и в этом тесте.
const OLD_NAME = '@bitrix24/b24jssdk'
const OLD_NAME_ALLOWED = new Set([
  'docs/content/docs/1.getting-started/3.migration/0.from-bitrix24.md',
  'packages/jssdk/src/pullClient/storage-manager.ts',
  'scripts/__tests__/fork-guards.test.mjs',
  '.claude/owner-questions.md',
  'RELEASING.md',
  '.sync/PORTING.md'
])

test('имя @bitrix24/b24jssdk осталось только там, где оно нужно', () => {
  const out = execFileSync('git', ['grep', '-l', '--fixed-strings', OLD_NAME], { cwd: ROOT, encoding: 'utf8' })
  const files = out.split('\n').filter(Boolean)
    .filter(f => !/(?:^|\/)CHANGELOG\.md$/.test(f) && !f.startsWith('.sync/log/'))
    .filter(f => !OLD_NAME_ALLOWED.has(f))
  assert.deepEqual(files, [], `замените ${OLD_NAME} на @bxshefby/b24jssdk (.sync/PORTING.md)`)
})
