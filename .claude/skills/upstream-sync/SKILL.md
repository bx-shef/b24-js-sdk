---
name: upstream-sync
description: Еженедельная синхронизация форка bx-shef/b24-js-sdk с родителем bitrix24/b24jssdk — посмотреть, что пришло в upstream, влить main родителя в ветку sync/ГГГГ-ММ-ДД merge-ем (не rebase), свести конфликты по правилам форка (переведённые тексты, отключённая автоматика, lock-файл пересобирается), прогнать проверки, открыть PR с отчётом и ревью по уровню. Брать на «синхронизируй с bitrix24», «что нового в upstream», «подтяни родителя», «еженедельная синхронизация».
---

# Синхронизация с bitrix24/b24jssdk

> Последняя сверка: 2026-11-24

Родитель — `bitrix24/b24jssdk`, ветка `main`. Наш форк живёт отдельно: документация на русском,
автоматика родителя выключена, свой деплой. Синхронизация — раз в неделю (решение владельца
2026-11-24), одним PR.

## 1. Что пришло

```bash
git remote get-url upstream || git remote add upstream https://github.com/bitrix24/b24jssdk
git remote set-url --push upstream DISABLED   # в родителя не пушим никогда
git fetch upstream main
git log --oneline --no-merges HEAD..upstream/main
```

Пусто — синхронизация не нужна, отчёт одной строкой. Иначе — короткий отчёт владельцу: что
пришло по смыслу (фичи, исправления, ломающие изменения, зависимости), без пересказа коммитов.

## 2. Ветка и слияние

```bash
git switch -c sync/$(date +%F) origin/main
git merge --no-ff upstream/main
```

Только merge: история родителя должна оставаться общей, иначе следующая синхронизация
повторит те же конфликты.

## 3. Конфликты — правила форка

| Где | Чья версия |
|---|---|
| `docs/content/**`, `skills/**/*.md`, `AGENTS.md`, `README.md`, `.github/contributing/**` | **наша** (русский текст), но смысловую правку родителя перенести в перевод: новый абзац, исправленный пример, новый параметр. Новый файл родителя — перевести в этом же PR или отдельным PR сразу после |
| Код `packages/**/src`, тесты | **родителя**, затем наши правки поверх, если они были (сейчас их нет) |
| `.github/workflows/*.yml`, `.github/dependabot.yml` | **родителя** + вернуть наши условия: `github.repository == 'bitrix24/b24jssdk'` и `open-pull-requests-limit: 0`. Сторож — `scripts/__tests__/fork-guards.test.mjs`. Новый action по тегу (`@v6`) закрепить по SHA — иначе покраснеет `fork-guards.yml` (`assert-actions-pinned.py`) |
| `pnpm-lock.yaml`, `skills/*/pnpm-lock.yaml` | не сводить руками: взять версию родителя и `pnpm install` (затем `pnpm audit`) |
| `pnpm-workspace.yaml` (overrides) | объединить: наши override из PR #8 оставить, если родитель не закрыл ту же уязвимость сам |
| `docs/app/**` (дизайн), `docs/modules/bx-assistant/**`, `deploy/**`, `docs-image.yml` | **наша**, изменения родителя перенести вручную |
| `tools/review-tier.*`, `.claude/**` | **наша** |

Сомнение — оставить конфликт решать владельцу и написать об этом в PR, а не угадывать.

## 4. Проверки

`pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run typecheck`,
`pnpm run package-jssdk:test:run-unit`, `node --test "scripts/__tests__/**/*.test.mjs"`,
`node scripts/docs-link-check.mjs`, `node scripts/md-internal-links.mjs`, `pnpm audit --audit-level=moderate`.

## 5. PR

Заголовок `sync: bitrix24/b24jssdk до <короткий sha>`; в описании — отчёт из шага 1, как сведены
конфликты, что осталось непереведённым. Уровень ревью — `tools/review-tier.sh --action`
(обычно 2: приходят код, сборка и CI) и навык `review-panel`.
