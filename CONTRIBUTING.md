# Участие в разработке

Короткая карта: подробности — в файлах, на которые она указывает. GitHub показывает этот файл
в боковой панели и при создании issue.

| Хочу… | Читать |
| --- | --- |
| понять устройство репозитория и правила для агентов | [AGENTS.md](AGENTS.md) |
| узнать, сколько ревью нужно моему PR | [AGENTS.md](AGENTS.md), раздел «Ревью PR»; `bash tools/review-tier.sh --action` |
| запустить тесты и проверки | [.github/contributing/testing.md](.github/contributing/testing.md) |
| написать или поправить страницу документации | [.github/contributing/documentation.md](.github/contributing/documentation.md) |
| разобраться в устройстве пакета | [.github/contributing/package-structure.md](.github/contributing/package-structure.md) |
| опубликовать сайт документации | [deploy/README.md](deploy/README.md) |
| сообщить об уязвимости | [SECURITY.md](SECURITY.md) |

## Правила

- Заголовок PR и коммитов — conventional commits (`fix(core): …`, `docs: …`).
- Документация на русском; код, комментарии в коде и сообщения SDK — на английском.
- Вебхуки, токены и данные клиентов не попадают ни в код, ни в issue, ни в PR.

Проверяет CI (`fork-guards.yml`): actions в воркфлоу закреплены по SHA, установки — с
`--frozen-lockfile` (`.github/scripts/assert-*.py`).

Репозиторий — форк [bitrix24/b24jssdk](https://github.com/bitrix24/b24jssdk). Изменения родителя
приходят раз в неделю (навык `.claude/skills/upstream-sync`); правки кода SDK, полезные и родителю,
лучше предлагать там.
