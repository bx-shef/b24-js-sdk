#!/usr/bin/env node
// Снимок версий зависимостей родителя (bitrix24/b24jssdk) и сверка с нашими.
//
//   node .sync/dep-parity.mjs --write    — обновляет dep-parity.json: снимок версий родителя на `cursor` из b24jssdk.json
//   node .sync/dep-parity.mjs --check    — сравнивает наши package.json со снимком; код 1 при дрейфе без исключения
//
// Режим обязателен: без флага или с неизвестным — подсказка и код 2.
// В снимок попадают только зависимости, которые родитель И мы объявляем в одной секции
// (то, чего у нас нет, в снимок не попадает и не сверяется).
//
// Родитель берётся из ремоута `upstream` (git fetch upstream main). Исключения
// (`exceptions` в dep-parity.json) сохраняются: --write обновляет только версии родителя.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const here = path => new URL(path, import.meta.url)
const read = path => JSON.parse(readFileSync(here(path), 'utf-8'))
const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies']
const existing = read('./dep-parity.json')
const sync = read('./b24jssdk.json')
const usage = 'Использование: node .sync/dep-parity.mjs --write | --check'
const args = process.argv.slice(2)
if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
  console.error(usage)
  process.exit(2)
}
const check = args[0] === '--check'

// Значения из b24jssdk.json / dep-parity.json уходят в команду и в чтение файлов — проверяем формат.
if (!/^[0-9a-f]{40}$/.test(String(sync.cursor))) {
  console.error(`b24jssdk.json: cursor должен быть полным sha (40 hex), получено: ${sync.cursor}`)
  process.exit(2)
}
for (const path of Object.keys(existing.manifests ?? {})) {
  if (!/^[\w./-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/')) {
    console.error(`dep-parity.json: недопустимый путь манифеста: ${path}`)
    process.exit(2)
  }
}

// `catalog:` — протокол pnpm; раскрываем через блок `catalog:` в pnpm-workspace.yaml (плоский каталог).
const catalogOf = (text) => {
  const out = {}
  let inside = false
  for (const line of text.split('\n')) {
    if (/^catalog:\s*$/.test(line)) {
      inside = true
      continue
    }
    if (inside) {
      const m = line.match(/^ {2}['"]?([^'":\s]+)['"]?:\s*['"]?([^'"\s#]+)['"]?\s*$/)
      if (m) out[m[1]] = m[2]
      else if (/^\S/.test(line)) inside = false
    }
  }
  return out
}
const resolve = (spec, name, catalog, where) => {
  if (typeof spec !== 'string' || !spec.startsWith('catalog:')) return spec
  const value = catalog[name]
  if (value === undefined) throw new Error(`${where}: не раскрыть "${spec}" для ${name}`)
  return value
}

const showUpstream = path => execFileSync('git', ['show', `${sync.cursor}:${path}`], { encoding: 'utf-8' })
const ours = path => JSON.parse(readFileSync(here(`../${path}`), 'utf-8'))
const ourCatalog = catalogOf(readFileSync(here('../pnpm-workspace.yaml'), 'utf-8'))

if (!check) {
  const upstreamCatalog = catalogOf(showUpstream('pnpm-workspace.yaml'))
  const manifests = {}
  for (const path of Object.keys(existing.manifests)) {
    const them = JSON.parse(showUpstream(path))
    const us = ours(path)
    const perSection = {}
    for (const section of SECTIONS) {
      const shared = {}
      for (const name of Object.keys(them[section] ?? {}).sort()) {
        // сравниваем только то, что обе стороны объявляют в ОДНОЙ секции
        if (us[section]?.[name] === undefined) continue
        // пакеты монорепозитория (`workspace:`) — свои у каждой стороны, у нас под другим scope
        if (String(them[section][name]).startsWith('workspace:')) continue
        shared[name] = resolve(them[section][name], name, upstreamCatalog, `upstream ${path}`)
      }
      if (Object.keys(shared).length) perSection[section] = shared
    }
    manifests[path] = perSection
  }
  // Пишем файл сами: `> dep-parity.json` обнулил бы его до того, как скрипт прочтёт исключения.
  writeFileSync(new URL('./dep-parity.json', import.meta.url), `${JSON.stringify({ ...existing, cursor: sync.cursor, manifests }, null, 2)}\n`)
  console.log('dep-parity.json обновлён')
  process.exit(0)
}

const nums = spec => String(spec).replace(/^\D*/, '').split(/[.\s|-]/).map(n => Number.parseInt(n, 10) || 0)
// Префикс диапазона (^, ~, ничего): «новее» — только при том же префиксе и строго больших числах.
const prefix = spec => String(spec).match(/^\D*/)[0]
const older = (a, b) => {
  if (prefix(a) !== prefix(b)) return true
  const [x, y] = [nums(a), nums(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  }
  return false
}

// --check: наши версии против снимка из dep-parity.json (git и сеть не нужны).
let drift = 0
let ahead = 0
for (const [path, sections] of Object.entries(existing.manifests)) {
  const us = ours(path)
  for (const [section, deps] of Object.entries(sections)) {
    for (const [name, want] of Object.entries(deps)) {
      const have = resolve(us[section]?.[name], name, ourCatalog, path)
      if (have === want) continue
      if (have === undefined) {
        console.log(`НЕТ У НАС ${path} ${section} ${name}: у родителя ${want}`)
        drift++
        continue
      }
      const held = existing.exceptions?.[`${path}:${section}:${name}`]
      // Мы новее родителя (наши deps-PR) — не дрейф назад, только справка; старее или иной диапазон — дрейф.
      if (!held && !older(have, want) && !/workspace:|[|<>]/.test(`${have}${want}`)) {
        ahead++
        continue
      }
      console.log(`${held ? 'ИСКЛЮЧЕНИЕ' : 'ДРЕЙФ'} ${path} ${section} ${name}: у нас ${have}, у родителя ${want}${held ? ` — ${held}` : ''}`)
      if (!held) drift++
    }
  }
}
if (ahead) console.log(`Новее родителя (не дрейф): ${ahead}`)
console.log(drift ? `\nБез исключения: ${drift}` : 'Версии совпадают со снимком родителя (или расхождения объявлены исключениями).')
process.exit(drift ? 1 : 0)
