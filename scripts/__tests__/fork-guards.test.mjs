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

// Текст job верхнего уровня: от `  name:` до следующей job (или конца файла), без комментариев
// перед следующей job; `code()` — без строк-комментариев (в них имена инструментов не в счёт).
const job = (s, name) => {
  const m = s.match(new RegExp(`^ {2}${name}:\\n((?: {4}.*\\n| {2}#.*\\n|[ \\t]*\\n)*)`, 'm'))
  return m ? m[1].replace(/(?: {2}#.*\n|[ \t]*\n)+$/, '') : null
}
const code = j => j.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')

for (const file of RELEASE.filter(f => f.includes('npm-publish'))) {
  test(`${file}: сборка без токена публикации, публикация без install-скриптов (#51)`, () => {
    const s = read(file)
    const build = job(s, 'build')
    const publish = job(s, 'publish')
    assert.ok(build, 'job build')
    assert.ok(publish, 'job publish')

    // цепочка: ci → build → publish
    assert.match(job(s, 'ci'), /uses: \.\/\.github\/workflows\/ci\.yml\n/)
    assert.match(build, /^ {4}needs: ci\n/m)
    assert.match(publish, /^ {4}needs: build\n/m)

    // build ставит зависимости (их install-скрипты выполняются здесь) — и токена публикации у него нет
    assert.match(build, /pnpm install --frozen-lockfile/)
    assert.match(build, /permissions:\n {6}contents: read\n {4}\S/)
    assert.doesNotMatch(code(build), /id-token/)
    assert.doesNotMatch(build, /environment:/)
    assert.match(build, /pnpm pack --pack-destination/)
    assert.match(build, /tar -xzOf "\$TGZ" package\/package\.json/)
    assert.match(build, /startsWith\('catalog:'\) \|\| String\(range\)\.startsWith\('workspace:'\)/)
    assert.match(build, /uses: actions\/upload-artifact@[0-9a-f]{40} /)
    assert.match(build, /persist-credentials: false/)
    // tarball доходит до publish тем же путём: артефакт npm-tarball → runner.temp/npm-tarball/<имя из build>
    assert.match(build, /name: npm-tarball\n/)
    assert.match(publish, /name: npm-tarball\n {10}path: \$\{\{ runner\.temp \}\}\/npm-tarball\n/)
    assert.match(publish, /TGZ: \$\{\{ runner\.temp \}\}\/npm-tarball\/\$\{\{ needs\.build\.outputs\.tarball \}\}/)

    // publish: только готовый tarball, без кода проекта и без pnpm
    assert.match(publish, /^ {4}environment: npm-release\n/m)
    assert.match(publish, /permissions:\n {6}contents: read\n {6}id-token: write\n/)
    assert.match(publish, /uses: actions\/download-artifact@[0-9a-f]{40} /)
    assert.match(publish, /sha256sum -c/)
    assert.match(publish, /npm install -g --ignore-scripts npm@\d+\.\d+\.\d+\n/)
    assert.match(publish, /npm publish "\$TGZ" --provenance --access public --ignore-scripts "\$\{TAG_ARGS\[@\]\}"/)
    assert.doesNotMatch(code(publish), /actions\/checkout@/)
    assert.doesNotMatch(code(publish), /pnpm/)
    assert.doesNotMatch(code(publish), /npm (?:install|ci)(?! -g --ignore-scripts npm@)/)

    // запуск — как был: release или ручной с main или тега v*
    for (const j of [build, publish]) {
      assert.match(j, /github\.event_name == 'release' \|\|\n {6}\(github\.event_name == 'workflow_dispatch' &&\n {8}\(github\.ref == 'refs\/heads\/main' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\)\)\)/)
    }

    // id-token есть только у publish и у вызова ci.yml (его требует deploy в ci.yml, сам deploy пропускается)
    const jobs = [...s.matchAll(/^ {2}([\w-]+):\n/gm)].map(m => m[1])
    for (const name of jobs.filter(n => !['ci', 'publish'].includes(n))) {
      assert.doesNotMatch(code(job(s, name)), /id-token/, `${file}: id-token у job ${name}`)
    }
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
// в правилах выпуска и переноса и в этом тесте.
const OLD_NAME = '@bitrix24/b24jssdk'
// Имя tarball из `pnpm pack`: scope превращается в префикс (`bitrix24-b24jssdk-3.0.0.tgz`).
const OLD_TARBALL = 'bitrix24-b24jssdk-'
const MIGRATION_PAGE = '/docs/getting-started/migration/from-bitrix24'
const OLD_NAME_ALLOWED = new Set([
  'docs/content/docs/1.getting-started/3.migration/0.from-bitrix24.md',
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
    // Ссылка на главу о переходе (#114): строка со старым именем законна, только если в ней же — адрес главы.
    .filter(f => read(f).split('\n').some(line => line.includes(OLD_NAME) && !line.includes(MIGRATION_PAGE)))
  assert.deepEqual(files, [], `замените ${OLD_NAME} на @bxshefby/b24jssdk (.sync/PORTING.md); вне разрешённых файлов — только в строке со ссылкой на ${MIGRATION_PAGE}`)
})

// У форка свой сайт документации (https://b24-js-sdk.bx-shef.by) с другой раскладкой страниц и
// русскими якорями. Адрес сайта родителя возвращается при переносе его коммитов (JSDoc, навыки,
// README) — переводить по .sync/docs-map.json. Законен он только в CHANGELOG (история), в .sync/**
// (правила переноса и журналы) и в этом тесте.
const PARENT_SITE = 'bitrix24.github.io/b24jssdk'

test('адрес сайта родителя bitrix24.github.io/b24jssdk остался только там, где он нужен', () => {
  let out = ''
  try {
    out = execFileSync('git', ['grep', '-l', '--fixed-strings', PARENT_SITE], { cwd: ROOT, encoding: 'utf8' })
  } catch (error) {
    // git grep без совпадений выходит с кодом 1 — это и есть успех
    if (error.status !== 1) throw error
  }
  const files = out.split('\n').filter(Boolean)
    .filter(f => !/(?:^|\/)CHANGELOG\.md$/.test(f) && !f.startsWith('.sync/'))
    .filter(f => f !== 'scripts/__tests__/fork-guards.test.mjs')
  assert.deepEqual(files, [], 'замените адрес сайта родителя на https://b24-js-sdk.bx-shef.by/… (.sync/PORTING.md, .sync/docs-map.json)')
})

// Ссылки на файлы репозитория родителя (blob/tree) после смены GITHUB_SOURCE_PREFIX в docs-lint.mjs
// проверка audited и целей ссылок молча пропускает — переводить на bx-shef/b24-js-sdk (.sync/PORTING.md).
test('ссылки на файлы репозитория родителя github.com/bitrix24/b24jssdk/(blob|tree)/ не вернулись', () => {
  let out = ''
  try {
    out = execFileSync('git', ['grep', '-lE', 'github\\.com/bitrix24/b24jssdk/(blob|tree)/'], { cwd: ROOT, encoding: 'utf8' })
  } catch (error) {
    if (error.status !== 1) throw error
  }
  const files = out.split('\n').filter(Boolean)
    .filter(f => !/(?:^|\/)CHANGELOG\.md$/.test(f) && !f.startsWith('.sync/'))
    .filter(f => f !== 'scripts/__tests__/fork-guards.test.mjs')
  assert.deepEqual(files, [], 'замените github.com/bitrix24/b24jssdk/blob|tree/… на github.com/bx-shef/b24-js-sdk/… (.sync/PORTING.md)')
})

test('имя tarball bitrix24-b24jssdk-*.tgz не осталось в workflow и скриптах', () => {
  let out = ''
  try {
    out = execFileSync('git', ['grep', '-l', '--fixed-strings', OLD_TARBALL, '--', '.github', 'scripts', 'package.json'], { cwd: ROOT, encoding: 'utf8' })
  } catch (error) {
    // git grep без совпадений выходит с кодом 1 — это и есть успех
    if (error.status !== 1) throw error
  }
  const files = out.split('\n').filter(Boolean).filter(f => f !== 'scripts/__tests__/fork-guards.test.mjs')
  assert.deepEqual(files, [], 'pnpm pack называет tarball bxshefby-b24jssdk-*.tgz')
})

test('выпуск сам запускает публикацию: release-please → SDK → Nuxt, на теге выпуска', () => {
  // Release от GITHUB_TOKEN не запускает workflow по событию release; workflow_dispatch — запускает.
  const rp = read('.github/workflows/release-please.yml')
  assert.match(rp, /- name: Propose or cut the release\n {8}id: release\n {8}uses: googleapis\/release-please-action@/)
  assert.match(rp, /release_created: \$\{\{ steps\.release\.outputs\.release_created \}\}/)
  assert.match(rp, /tag_name: \$\{\{ steps\.release\.outputs\.tag_name \}\}/)
  // dispatch — в отдельной job, у release-please-action нет actions: write
  const [cut, chain] = rp.split(/^ {2}publish:\n/m)
  assert.ok(chain, 'job publish в release-please.yml')
  assert.match(cut, /permissions:\n {6}contents: write\n {6}pull-requests: write\n {4}outputs:/)
  assert.match(chain, /if: needs\.release-please\.outputs\.release_created == 'true'/)
  assert.match(chain, /permissions:\n {6}actions: write\n/)
  assert.match(chain, /gh workflow run npm-publish-js-sdk\.yml --repo "\$GITHUB_REPOSITORY" --ref "\$TAG"/)

  const sdk = read('.github/workflows/npm-publish-js-sdk.yml')
  const nuxtJob = sdk.split(/^ {2}publish-nuxt:\n/m)[1]
  assert.ok(nuxtJob, 'job publish-nuxt в npm-publish-js-sdk.yml')
  assert.match(nuxtJob, /^ {4}needs: publish\n/)
  assert.match(nuxtJob, /if: github\.event_name == 'workflow_dispatch'/)
  assert.match(nuxtJob, /permissions:\n {6}actions: write\n/)
  assert.doesNotMatch(nuxtJob, /id-token/)
  assert.match(nuxtJob, /gh workflow run npm-publish-js-sdk-nuxt\.yml --repo "\$GITHUB_REPOSITORY" --ref "\$GITHUB_REF_NAME"/)

  // публикация с тега сверяет версию с тегом
  for (const file of ['.github/workflows/npm-publish-js-sdk.yml', '.github/workflows/npm-publish-js-sdk-nuxt.yml']) {
    const s = read(file)
    assert.match(s, /startsWith\(github\.ref, 'refs\/tags\/v'\)\)\)/, file)
    assert.match(s, /if: github\.event_name == 'release' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\)/, file)
    assert.match(s, /TAG: \$\{\{ github\.event\.release\.tag_name \|\| github\.ref_name \}\}/, file)
  }
})

test('npm-publish-js-sdk-nuxt.yml: модуль закреплён на точной версии ядра', () => {
  assert.match(read('.github/workflows/npm-publish-js-sdk-nuxt.yml'), /CORE=\$\(jq -r '\.dependencies\["@bxshefby\/b24jssdk"\]'[^\n]*\n {10}if \[ "\$CORE" != "\$VER" \]/)
})

// Номер сборки в подвале сайта (#72): коммит доходит от CI до runtimeConfig. Цепочку может молча разорвать
// слияние с родителем — у bitrix24 этих строк нет.
test('номер сборки: github.sha → COMMIT_SHA → NUXT_PUBLIC_COMMIT_SHA → commitSha → подвал', () => {
  const wf = read('.github/workflows/docs-image.yml')
  assert.equal(count(wf, 'COMMIT_SHA=${{ github.sha }}'), 2, 'обе сборки образа передают коммит')
  const df = read('deploy/Dockerfile')
  assert.match(df, /^ARG COMMIT_SHA=/m)
  assert.match(df, /NUXT_PUBLIC_COMMIT_SHA=\$\{COMMIT_SHA\}/)
  assert.match(read('docs/nuxt.config.ts'), /commitSha: process\?\.env\.NUXT_PUBLIC_COMMIT_SHA/)
  const footer = read('docs/app/components/Footer.vue')
  assert.match(footer, /config\.public\.commitSha/)
  assert.match(footer, /data-testid="build-sha"/)
})

// Ответ чата (28.11): @comark/vue 0.7 принимает текст в свойстве value. Со старым :markdown текст уходил
// лишним атрибутом, и в панели оставались только шаги «Размышление / Searched» без ответа.
test('чат: ChatComark получает текст через :value, не :markdown', () => {
  const chat = read('docs/app/components/chat/Chat.vue')
  assert.equal(count(chat, ':markdown='), 0)
  assert.ok(count(chat, ':value="part.text"') >= 2)
})

// Ресурсы (28.11, решение владельца): B24 UI и B24 Icons — наши сайты, а не bitrix24.github.io. Слияние с
// родителем возвращает его адреса — этот тест краснеет.
test('ссылки на B24 UI и B24 Icons ведут на наши сайты', () => {
  let out = ''
  try {
    out = execFileSync('git', ['grep', '-lE', 'bitrix24\\.github\\.io/(b24ui|b24icons)'], { cwd: ROOT, encoding: 'utf8' })
  } catch (error) {
    // git grep без совпадений выходит с кодом 1 — это и есть успех
    if (error.status !== 1) throw error
  }
  const files = out.split('\n').filter(Boolean)
    .filter(f => !/(?:^|\/)CHANGELOG\.md$/.test(f) && !f.startsWith('.sync/'))
    .filter(f => f !== 'scripts/__tests__/fork-guards.test.mjs')
  assert.deepEqual(files, [], 'замените на https://b24-ui.bx-shef.by/… и https://b24-icons.bx-shef.by/… (.sync/PORTING.md)')
})

// Правообладатель форка (#78): слияние с родителем может вернуть его LICENSE, author и подвал. Строка
// Bitrix24 в LICENSE обязана остаться — условие MIT.
const OWNER = 'ООО «БэИксШефБай»'
for (const file of ['LICENSE', 'packages/jssdk/LICENSE', 'packages/jssdk-nuxt/LICENSE']) {
  test(`${file}: оба правообладателя — Bitrix24 и ${OWNER}`, () => {
    const s = read(file)
    assert.match(s, /^Copyright \(c\) 2024 Bitrix24$/m)
    assert.ok(s.includes(`Copyright (c) 2026 ${OWNER}`))
  })
}
for (const file of ['package.json', 'packages/jssdk/package.json', 'packages/jssdk-nuxt/package.json']) {
  test(`${file}: author — ${OWNER}`, () => {
    assert.equal(JSON.parse(read(file)).author, OWNER)
  })
}
test('подвал сайта: © ООО «БэИксШефБай» и «Основано на Bitrix24 JS SDK»', () => {
  const footer = read('docs/app/components/Footer.vue')
  assert.ok(footer.includes(`© 2026 ${OWNER}`))
  assert.ok(footer.includes('Основано на Bitrix24 JS SDK'))
})

// Размер пакета (#63): без карт исходников, лишних копий деклараций и несжатого UMD. Слияние с родителем
// возвращает его build.config.ts и files — архив снова 3,2 МБ вместо 0,74.
test('пакет @bxshefby/b24jssdk: без карт, лишних деклараций и несжатого UMD', () => {
  const files = JSON.parse(read('packages/jssdk/package.json')).files
  for (const rule of ['!dist/**/*.map', '!dist/esm/index.d.mts', '!dist/cjs/index.d.ts', '!dist/cjs/index.d.mts', '!dist/umd/index.js']) {
    assert.ok(files.includes(rule), `в files нет ${rule}`)
  }
  const values = [...read('packages/jssdk/build.config.ts').matchAll(/\bsourcemap:\s*([^,\n}]+)/g)].map(m => m[1].trim())
  assert.ok(values.length > 0, 'в build.config.ts не найден sourcemap')
  assert.deepEqual(values.filter(v => v !== 'false'), [], 'build.config.ts снова собирает карты (sourcemap не false)')
})

// /raw/*.md вне пререндера (#103): трассировщик кладёт в сервер minimark 0.2.0 от @nuxt/content, а маршрут
// импортирует minimark/stringify из 1.0.0 — всякий несуществующий адрес отвечал 500 вместо 404.
test('сайт: minimark и entities вшиты в серверную сборку, /raw/* без страницы — 404', () => {
  const config = read('docs/nuxt.config.ts')
  const inline = config.match(/externals:\s*\{\s*inline:\s*\[([^\]]*)\]/)
  assert.ok(inline, 'в nitro нет externals.inline')
  for (const dep of ['minimark', 'entities']) {
    assert.ok(inline[1].includes(`'${dep}'`), `${dep} не в externals.inline`)
  }
  assert.ok(read('docs/server/routes/raw/[...slug].md.get.ts').includes('setResponseStatus(event, 404)'), '/raw/* без страницы снова отвечает 200')
})
test('сайт: /raw/* не отражает путь запроса в ответ «не найдено»', () => {
  const route = read('docs/server/routes/raw/[...slug].md.get.ts')
  for (const call of route.matchAll(/notFound\(([^)]*)\)/g)) {
    assert.ok(!call[1].includes('${'), `notFound подставляет значение в текст: ${call[1]}`)
  }
})

// sitemap.xml совпадает с canonical (#109): оба без «/» на конце, как ссылки меню (nuxt.config.ts, prerender).
// У родителя sitemap со «/» — при синхронизации это вернётся, и каждая страница карты станет неканоничной.
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
test('сайт: sitemap.xml и canonical — адрес страницы без «/» на конце', () => {
  const canonical = stripComments(read('docs/app/composables/useCanonical.ts'))
  assert.match(canonical, /const pathNormal = withoutTrailingSlash\(route\.path\)/, 'canonical больше не без «/»')
  assert.match(canonical, /rel: 'canonical', href: joinURL\(siteUrl, pathNormal\)/, 'canonical строится не из pathNormal')
  const sitemap = stripComments(read('docs/server/routes/sitemap.xml.get.ts'))
  assert.match(sitemap, /<loc>\$\{xmlEscape\(`\$\{baseUrl\}\$\{page\.path\}`\)\}<\/loc>/, 'sitemap.xml снова со «/» на конце')
})

// CSP и источники заявок (#110, панель): правка родителя в docs/server/plugins/csp.ts молча закрыла бы Метрику
// и iframe формы заявки; источник «главная» (PR #102) без SOURCES уходил в direct.
test('сайт: CSP пускает Метрику и iframe формы заявки', () => {
  const csp = stripComments(read('docs/server/plugins/csp.ts'))
  for (const directive of ['script-src', 'connect-src', 'img-src', 'frame-src']) {
    const line = csp.split('\n').find(l => l.includes(`\`${directive} `))
    assert.ok(line && line.includes('https://mc.yandex.ru'), `${directive} без Яндекс Метрики`)
  }
  assert.match(csp, /`frame-src 'self'/, 'frame-src без self — форма заявки (b24-form.html) не встроится')
})
test('сайт: заявка различает источники шапка/подвал/главная/чат, главная и /request в sitemap.xml', () => {
  const sources = read('docs/app/pages/request.vue').match(/const SOURCES = \[([^\]]*)\]/)
  assert.ok(sources, 'нет SOURCES в request.vue')
  for (const s of ['header', 'footer', 'home', 'chat']) {
    assert.ok(sources[1].includes(`'${s}'`), `источник ${s} не принимается — уйдёт в direct`)
  }
  assert.match(stripComments(read('docs/server/routes/sitemap.xml.get.ts')), /\['', '\/request'\]/, 'главная или /request выпали из sitemap.xml')
})
// Чат помощника (#110, панель): docs/server/api/ai.post.ts — наш (DeepSeek, русские правила, заявка из чата).
// Перенос файла родителя целиком молча сменил бы модель и убрал заявку.
test('сайт: чат на DeepSeek и предлагает заявку на разработку', () => {
  const ai = stripComments(read('docs/server/api/ai.post.ts'))
  assert.match(ai, /createDeepSeek\(/, 'чат больше не на DeepSeek')
  assert.ok(ai.includes('/request?source=chat'), 'чат не ведёт на заявку (/request?source=chat)')
})
