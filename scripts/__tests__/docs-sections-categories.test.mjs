#!/usr/bin/env node
// Раскладка разделов документации: actions / entry-points / tools.
//
// Боковая навигация (docs/app/composables/useNavigation.ts, категории — docs/app/utils/navigation-categories.ts) группирует страницы раздела по
// frontmatter-полю `category` и показывает страницы известных категорий по группам, а страницу
// с неизвестной категорией — в группе «Прочее» (раньше такие молча пропадали: Helper, Pull, Core, Types). Тест всё равно требует известную категорию.
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
// Разделы без обзорной страницы с карточками: категория у страницы необязательна, но если задана — известна навигации
const OTHER_SECTIONS = { 'getting-started': '1.getting-started', 'examples': '99.examples' }

/**
 * Категории из docs/app/utils/navigation-categories.ts: { section: [category id, ...] }.
 * Разбор текста (строка `{ id: '…', … }` на категорию), без импорта TS-кода.
 */
function navigationCategories() {
  const text = readFileSync(join(ROOT, 'docs/app/utils/navigation-categories.ts'), 'utf8')
  const start = text.indexOf('export const navigationCategories')
  assert.ok(start !== -1, 'не найден `navigationCategories` в navigation-categories.ts')
  const result = {}
  let section = null
  for (const line of text.slice(start).split('\n')) {
    const s = line.match(/^ {2}'?([a-z-]+)'?: \[/)
    if (s) {
      section = s[1]
      result[section] = []
      continue
    }
    const id = line.match(/^ {4}\{ id: '([^']+)'/)
    if (id && section) result[section].push(id[1])
  }
  assert.ok(Object.values(result).every(list => list.length > 0) && Object.keys(result).length >= 5,
    'разбор navigation-categories.ts дал пустой результат: формат — по одной строке `{ id: \'…\', … }` на категорию')
  return result
}

/** Все .md раздела (рекурсивно), кроме обзорной 0.index.md в корне раздела. */
function sectionPages(dir) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.md')) out.push(full)
    }
  }
  walk(join(DOCS, dir))
  return out.filter(f => f !== join(DOCS, dir, '0.index.md'))
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
    const pages = sectionPages(dir)
    assert.ok(pages.length > 0)
    const bad = pages
      .map(f => [f, frontmatterCategory(f)])
      .filter(([, c]) => !c || !known.includes(c))
    assert.deepEqual(bad, [], `страницы без известной категории выпадут из меню: ${JSON.stringify(bad)}; допустимо: ${known.join(', ')}`)
  })

  test(`${section}: обзорная страница показывает карточки каждой категории`, () => {
    const index = readFileSync(join(DOCS, dir, '0.index.md'), 'utf8')
    const shown = [...index.matchAll(new RegExp(`:pages-list\\{section="${section}" category="([^"]+)"\\}`, 'g'))].map(m => m[1])
    const used = new Set(sectionPages(dir).map(f => frontmatterCategory(f)))
    for (const category of used) {
      assert.ok(shown.includes(category), `на обзоре ${section} нет :pages-list для категории ${category}`)
    }
    for (const category of shown) {
      assert.ok(nav[section].includes(category), `на обзоре ${section} блок для неизвестной навигации категории ${category}`)
      assert.ok(used.has(category), `на обзоре ${section} блок для пустой категории ${category}`)
    }
  })
}

for (const [section, dir] of Object.entries(OTHER_SECTIONS)) {
  test(`${section}: заданная category известна навигации`, () => {
    const known = nav[section]
    assert.ok(known?.length, `navigation-categories.ts не знает раздел ${section}`)
    const pages = sectionPages(dir)
    assert.ok(pages.length > 0)
    const bad = pages
      .map(f => [f, frontmatterCategory(f)])
      .filter(([, c]) => c && !known.includes(c))
    assert.deepEqual(bad, [], `страницы с неизвестной категорией попадут в группу «Прочее»: ${JSON.stringify(bad)}; допустимо: ${known.join(', ')}`)
  })
}
