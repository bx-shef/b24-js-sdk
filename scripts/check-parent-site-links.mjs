#!/usr/bin/env node
// Проверка перед первой публикацией нашего сайта документации (.sync/PORTING.md,
// «Перед первой публикацией сайта»): абсолютные ссылки на сайт родителя
// (`bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/...`) в skills/**,
// packages/jssdk/README-AI.md, JSDoc (packages/jssdk/src/**) и SECURITY.md нужно заменить
// на адреса нашего сайта по .sync/docs-map.json. До публикации они валидны на сайте
// родителя, поэтому скрипт НЕ входит в CI: запускается вручную и печатает список замен.
//
//   node scripts/check-parent-site-links.mjs   — код 1, если ссылки на сайт родителя остались
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const TARGETS = ['skills', 'packages/jssdk/README-AI.md', 'packages/jssdk/src', 'SECURITY.md']
const SKIP = new Set(['node_modules', 'dist', '.nuxt', '.output'])
const PATTERN = /https:\/\/bitrix24\.github\.io\/b24jssdk\/docs\/working-with-the-rest-api\/[^\s)>\]"'`]*/g

function* files(path) {
  const stat = statSync(path)
  if (stat.isFile()) {
    yield path
    return
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    yield* files(join(path, entry.name))
  }
}

const found = []
for (const target of TARGETS) {
  for (const file of files(join(ROOT, target))) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(PATTERN)) {
      found.push(`${relative(ROOT, file)}: ${match[0]}`)
    }
  }
}

if (found.length) {
  console.log(`Ссылок на сайт родителя: ${found.length}`)
  for (const line of found) console.log(`  ${line}`)
  process.exit(1)
}
console.log('Ссылок на сайт родителя (working-with-the-rest-api) нет.')
