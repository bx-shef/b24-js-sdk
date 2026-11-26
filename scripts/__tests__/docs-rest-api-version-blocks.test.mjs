#!/usr/bin/env node
// Страницы действий v2 и v3 объединены: одна страница на действие, различия — в блоках
// `::::rest-api-version-only` со слотами `#rest-api-ver2` / `#rest-api-ver3`.
// Тест держит правила такой раскладки:
//   1. у действия нет «двойников» …-rest-api-ver2.md / …-rest-api-ver3.md — их заменяет одна страница;
//   2. блок открыт и закрыт (4 двоеточия), слоты только ver2/ver3 и не повторяются;
//   3. страница с блоком не помечена `restApiVersion` (иначе навигация спрятала бы её целиком
//      для одной из версий, а блок говорит, что страница нужна обеим);
//   4. `restApiVersion` на странице разрешён только у действий, у которых есть лишь одна версия.
//
// Run with: node --test scripts/__tests__/docs-rest-api-version-blocks.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const DOCS = join(ROOT, 'docs/content/docs')

/** Все .md под docs/content/docs: [относительный путь, текст]. */
function pages(dir = DOCS, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix + e.name
    if (e.isDirectory()) return pages(join(dir, e.name), `${rel}/`)
    return e.name.endsWith('.md') ? [[rel, readFileSync(join(dir, e.name), 'utf8')]] : []
  })
}

const split = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/)
  return { fm: m ? m[1] : '', body: m ? text.slice(m[0].length) : text }
}

/** Строки тела вне блоков кода. */
function proseLines(body) {
  const out = []
  let fence = null
  for (const line of body.split('\n')) {
    const m = line.match(/^(`{3,}|~{3,})/)
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null
      continue
    }
    if (m) {
      fence = m[1]
      continue
    }
    out.push(line)
  }
  return out
}

/** Блоки `::::rest-api-version-only … ::::`: список слотов каждого; бросает при разбалансировке. */
export function versionBlocks(body) {
  const blocks = []
  let cur = null
  let colons = 0
  for (const line of proseLines(body)) {
    const open = line.match(/^(:{2,})rest-api-version-only\s*$/)
    if (open) {
      if (cur) throw new Error('вложенный rest-api-version-only')
      cur = []
      colons = open[1].length
    } else if (cur && line.trim() === ':'.repeat(colons)) {
      blocks.push(cur)
      cur = null
    } else if (cur) {
      const slot = line.match(/^#(rest-api-ver\S*)\s*$/)
      if (slot) cur.push(slot[1])
    }
  }
  if (cur) throw new Error('блок rest-api-version-only не закрыт')
  return blocks
}

const all = pages()

test('у действия нет двойников …-rest-api-ver2/3: одна страница на действие', () => {
  const twins = all.map(([p]) => p).filter(p => /^2\.actions\/.*-rest-api-ver[23]\.md$/.test(p))
  assert.deepEqual(twins, [], `страницы-двойники нужно слить в одну: ${twins.join(', ')}`)
})

test('блоки rest-api-version-only: закрыты, слоты ver2/ver3, без повторов', () => {
  for (const [path, text] of all) {
    const { body } = split(text)
    let blocks
    try {
      blocks = versionBlocks(body)
    } catch (e) {
      assert.fail(`${path}: ${e.message}`)
    }
    for (const slots of blocks) {
      assert.ok(slots.length > 0, `${path}: блок без слотов`)
      for (const s of slots) assert.ok(['rest-api-ver2', 'rest-api-ver3'].includes(s), `${path}: неизвестный слот #${s}`)
      assert.equal(new Set(slots).size, slots.length, `${path}: слот повторён в одном блоке`)
    }
  }
})

test('страница с блоками версий не помечена restApiVersion', () => {
  for (const [path, text] of all) {
    const { fm, body } = split(text)
    if (!/^restApiVersion:/m.test(fm)) continue
    const bothSlots = versionBlocks(body).some(slots => slots.length === 2)
    assert.ok(!bothSlots, `${path}: restApiVersion скрыл бы страницу для одной версии, а блоки описывают обе`)
  }
})

test('restApiVersion — только у страниц действий одной версии', () => {
  const marked = all.filter(([, t]) => /^restApiVersion:/m.test(split(t).fm)).map(([p]) => p)
  for (const p of marked) assert.match(p, /^2\.actions\//, `${p}: restApiVersion вне раздела действий`)
  assert.ok(marked.length > 0, 'ожидались страницы только v3 (call-tail, fetch-tail, deferred-batch)')
})

test('versionBlocks: разбор (проверка самого теста)', () => {
  assert.deepEqual(versionBlocks('::::rest-api-version-only\n#rest-api-ver2\na\n\n#rest-api-ver3\nb\n::::\n'), [['rest-api-ver2', 'rest-api-ver3']])
  assert.deepEqual(versionBlocks('```\n::::rest-api-version-only\n```\n'), [])
  assert.throws(() => versionBlocks('::::rest-api-version-only\n#rest-api-ver2\n'), /не закрыт/)
})
