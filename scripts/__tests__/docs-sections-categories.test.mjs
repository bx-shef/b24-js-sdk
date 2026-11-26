#!/usr/bin/env node
// Раскладка разделов документации: actions / entry-points / tools.
//
// Боковая навигация (docs/app/composables/useNavigation.ts) группирует страницы раздела по
// frontmatter-полю `category` и показывает ТОЛЬКО страницы из известных ей категорий — страница
// с неизвестной категорией молча пропадает из меню (так выпадали Helper, Pull, Core, Types).
// Обзорная страница раздела (0.index.md) строит карточки по тем же категориям через
// `:pages-list{section category}`. Тест держит три вещи согласованными:
//   1. у каждой страницы раздела (кроме 0.index.md) есть category из списка раздела в useNavigation;
//   2. у каждой категории раздела на обзорной странице есть блок :pages-list;
//   3. на обзорной странице нет блока для категории, которой нет в навигации.
//
// Run with: node --test scripts/__tests__/docs-sections-categories.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const DOCS = join(ROOT, 'docs/content/docs')
const SECTIONS = { 'actions': '2.actions', 'entry-points': '3.entry-points', 'tools': '4.tools' }

/** `categories` из useNavigation.ts: { section: [category id, ...] } — разбор текста, без импорта Nuxt-кода. */
function navigationCategories() {
  const text = readFileSync(join(ROOT, 'docs/app/composables/useNavigation.ts'), 'utf8')
  const start = text.indexOf('const categories = {')
  const end = text.indexOf('function groupChildrenByCategory')
  assert.ok(start !== -1 && end > start, 'не найден блок `categories` в useNavigation.ts')
  const result = {}
  let section = null
  for (const line of text.slice(start, end).split('\n')) {
    const s = line.match(/^ {2}'?([a-z-]+)'?: \[/)
    if (s) {
      section = s[1]
      result[section] = []
      continue
    }
    const id = line.match(/^ {6}id: '([^']+)'/)
    if (id && section) result[section].push(id[1])
  }
  return result
}

const frontmatterCategory = (file) => {
  const fm = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)
  return fm?.[1].match(/^category: *['"]?([A-Za-z0-9-]+)['"]? *$/m)?.[1]
}

const nav = navigationCategories()

for (const [section, dir] of Object.entries(SECTIONS)) {
  test(`${section}: у каждой страницы категория, известная навигации`, () => {
    const known = nav[section]
    assert.ok(known?.length, `useNavigation.ts не знает раздел ${section}`)
    const pages = readdirSync(join(DOCS, dir)).filter(f => f.endsWith('.md') && !f.startsWith('0.index'))
    assert.ok(pages.length > 0)
    const bad = pages
      .map(f => [f, frontmatterCategory(join(DOCS, dir, f))])
      .filter(([, c]) => !c || !known.includes(c))
    assert.deepEqual(bad, [], `страницы без известной категории выпадут из меню: ${JSON.stringify(bad)}; допустимо: ${known.join(', ')}`)
  })

  test(`${section}: обзорная страница показывает карточки каждой категории`, () => {
    const index = readFileSync(join(DOCS, dir, '0.index.md'), 'utf8')
    const shown = [...index.matchAll(new RegExp(`:pages-list\\{section="${section}" category="([^"]+)"\\}`, 'g'))].map(m => m[1])
    const used = new Set(readdirSync(join(DOCS, dir)).filter(f => f.endsWith('.md') && !f.startsWith('0.index')).map(f => frontmatterCategory(join(DOCS, dir, f))))
    for (const category of used) {
      assert.ok(shown.includes(category), `на обзоре ${section} нет :pages-list для категории ${category}`)
    }
    for (const category of shown) {
      assert.ok(nav[section].includes(category), `на обзоре ${section} блок для неизвестной навигации категории ${category}`)
      assert.ok(used.has(category), `на обзоре ${section} блок для пустой категории ${category}`)
    }
  })
}
