#!/usr/bin/env node
// Снимок версий зависимостей родителя (bitrix24/b24jssdk) и сверка с нашими.
//
//   node .sync/dep-parity.mjs            — печатает снимок на `cursor` из b24jssdk.json (перенаправьте в dep-parity.json)
//   node .sync/dep-parity.mjs --check    — сравнивает наши package.json со снимком; код 1 при дрейфе без исключения
//
// Родитель берётся из ремоута `upstream` (git fetch upstream main). Исключения
// (`exceptions` в dep-parity.json) сохраняются: скрипт обновляет только версии родителя.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const here = path => new URL(path, import.meta.url)
const read = path => JSON.parse(readFileSync(here(path), 'utf-8'))
const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies']
const existing = read('./dep-parity.json')
const sync = read('./b24jssdk.json')
const check = process.argv.includes('--check')

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
        shared[name] = resolve(them[section][name], name, upstreamCatalog, `upstream ${path}`)
      }
      if (Object.keys(shared).length) perSection[section] = shared
    }
    manifests[path] = perSection
  }
  console.log(JSON.stringify({ ...existing, cursor: sync.cursor, manifests }, null, 2))
  process.exit(0)
}

const nums = spec => String(spec).replace(/^\D*/, '').split(/[.\s|-]/).map(n => Number.parseInt(n, 10) || 0)
const older = (a, b) => {
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
