# STUDLY — этап 1.2: настройка Frontend-worktree

- Начало: 2026-10-18 20:34:57 Europe/Moscow.
- Обновлено: 2026-10-18 20:38:42 MSK.
- Статус: Git/worktree, окружения, проверки и первичная публикация выполнены. Этап НЕ завершён: фактические привязки Desktop ожидают владельца; повторный запуск основной Demo на 3000 заблокирован существующим процессом.

## Цель и разрешения
Реализовать утверждённый TEAM_WORKFLOW: три ветки/worktree от общего коммита, независимые установки и проверки, организационный commit/push. Без merge, изменения приложения/main/Backend и секретов.

## Проверка исходного состояния
- status, branch -avv, worktree list, HEAD, log, remote и fetch проверены. Состояние совпало с аудитом: frontend-registration и origin — `7e85114b527c6cfa6fcbb4d556b657a4dbb2bbbe`.
- main/origin/main — `ccfde590b6e722d1eeb0694747e10afc7958acb1`; origin/codex/backend — `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. Backend-контракт читается через Git, новые endpoints в этом этапе не добавляются.
- Существовавшие незакоммиченные документы: TEAM_WORKFLOW, аудит 20-08 и ссылка в индексе. Изменений кода нет; сохранён исходный SHA-256-манифест 190 отслеживаемых файлов для итоговой сверки.
- Git 2.51.0, Node v24.19.0, npm 11.17.0, Next 16.3.4.
- Fetch сначала запрещён sandbox на записи FETCH_HEAD; повторён с разрешением и завершился успешно. Удалённые refs не изменились.
- Порт 3000 занят PID 29732 с cwd apps/web основной копии. Неизвестный процесс не остановлен. 3001/3002/8000 свободны на момент проверки.

## Документы и инструкции
Обновлены root AGENTS, apps/web/AGENTS (блок Next.js сохранён), TEAM_WORKFLOW, LOCAL_START и индекс. Добавлены инструкция Desktop и три пакета передачи. Аудит предыдущего этапа сохраняется без изменения. Исходники, package/lock и Backend не меняются.

## Codex Desktop
Списки проектов и чатов повторно подтвердили старый cwd всех трёх чатов. Поддержанного инструмента смены cwd нет; Computer Use отказал в доступе к приложению Codex. Обход не предпринимался. Подготовлены [ручные шаги](../../CODEX_DESKTOP.md) и [контексты](../../handoffs/README.md). До подтверждения новых Local-сессий этап не завершён.

## Созданная структура и общая база
Организационный коммит: [`1888b9194827d00317fb9cf9d27218ef702999cb`](https://github.com/lex44lh/Studly/commit/1888b9194827d00317fb9cf9d27218ef702999cb), `chore(frontend): establish shared worktree workflow`. Создан в main-dev; затем оба дополнительных дерева созданы от этого фактического SHA, без merge.

| Каталог | Ветка | База | Порт |
|---|---|---|---|
| /Users/alekspih/Projects/studly | codex/frontend-main-dev | 1888b91 | 3000 |
| /Users/alekspih/Projects/studly-redesign | codex/frontend-redesign-campus | 1888b91 | 3001 |
| /Users/alekspih/Projects/studly-integration | codex/frontend-api-integration | 1888b91 | 3002 |

Завершающий отчётный коммит в main-dev изменяет только этот Markdown; redesign/integration остаются на общей базе. Это нормальное различие HEAD после фиксации результатов, не создание направлений от разных баз. Его фактический SHA и итоговый remote-status сообщаются после push в ответе; дополнительных коммитов ради самообновления отчёта не будет.

## Установки и процессы
- В redesign и integration отдельно выполнен `npm ci --no-audit --no-fund`: exit 0, по 360 пакетов. Package/lock не изменились. Основная копия сохранила уже установленный собственный node_modules.
- npm предупредил о deprecated eslint 9.39.5 и неразрешённом postinstall unrs-resolver 1.12.2. Новые разрешения скриптам не выдавались; все проверки ниже прошли. Зависимости не обновлялись.
- У всех трёх node_modules и apps/web/.next разные реальные пути и inode, это не symlink. Никакие env/секреты из старых папок не копировались. Backend-копия не создавалась.
- Запуск основной `npm run dev:demo -- --port 3000`: exit 1, понятная диагностика занятого порта; другой порт автоматически не выбран. Существующий PID 29732 сохранён. Чтение его /search дало HTTP 200 и Demo-разметку, но это не подтверждает выполненный нами чистый запуск launcher на 3000.
- Redesign `npm run dev:demo -- --port 3001`: готовность `STUDLY — DEMO MODE`, /search HTTP 200.
- Integration `npm run dev:demo -- --port 3002`: аналогично HTTP 200. Оба собственных Next-процесса одновременно слушали 3001/3002, без конфликта .next/lock.
- После проверки оба собственных launcher остановлены Ctrl+C, exit 130. Финальный lsof показал только прежний 3000; 3001/3002 свободны. Чужие процессы и пользовательские данные не менялись.
- Первый curl к loopback из sandbox не подключился; повторён с разрешением вне sandbox, HTTP 200. Live автоматически **не запускался**, локальный Django не подготовлен. Запуск Live на 3002 и trusted origins описаны в LOCAL_START, реальные login/CSRF/DB — отдельная совместная проверка.

## Проверки: фактические результаты
| Проверка | Основная | Redesign | Integration |
|---|---|---|---|
| `npm run build -w apps/web` (Webpack) | exit 0 | exit 0 | exit 0 |
| `./node_modules/.bin/tsc --project apps/web/tsconfig.json --noEmit --incremental false` | exit 0 | exit 0 | exit 0 |
| `npm run lint -w apps/web` | exit 0, 0 errors, 2 warnings | то же | то же |
| `npm run test -w apps/web` | 37/37 | 37/37 | 37/37 |
| Дополнительные registration.test.ts | 8/8 | 8/8 | 8/8 |
| Исходные файлы, ветка, история, независимые кэши | прошли | прошли | прошли |

Два прежних ESLint warnings — no-img-element в неизменённом create-service/page.tsx:429 и :589. Не исправлялись в организационной задаче.

registration.test.ts не входит в glob `tests/*.test.cjs`. Сначала испробована историческая отдельная команда компиляции: exit 2 из-за отсутствия пути alias `@/lib/api/registration` при компиляции вне проекта. Полная проектная tsc при этом прошла. Для отдельного теста созданы временные tsconfig только в /private/tmp, наследующие конфигурацию проекта с абсолютным paths и разрешённой CommonJS-выдачей; повтор компиляции exit 0, `node --test` — 8/8 во всех деревьях. Исходники и конфигурация проекта не менялись.

Новые временные пути: /private/tmp/studly-stage12-registration-{core,redesign,integration}; соответствующие /tmp/studly-stage12-*.json. Они не добавлены в Git.

## Сохранность и безопасность
- Все 190 изначально отслеживаемых файлов есть в каждом дереве. SHA-256 186 совпадают с исходным снимком; отличаются только 4 согласованных файла политики/индекса: AGENTS, apps/web/AGENTS, LOCAL_START и индекс отчётов. Утверждённый Next.js-блок сохранён.
- Новые файлы — только 8 Markdown-документов: TEAM_WORKFLOW, CODEX_DESKTOP, четыре handoff-файла и два отчёта (предыдущий аудит + этот). Удалённых файлов нет. Исторический отчёт аудита не редактировался.
- Приложение, Campus CSS/компоненты, все страницы, public, API-клиент, Demo/Live launcher, тесты, package/lock, прототипы и Backend-файлы не менялись. Сохранность дизайна подтверждена идентичностью исходников; визуальная повторная приёмка в браузере не проводилась.
- Проверены все семь Frontend-предков: 893a6fd, 7a50ea4, 2411705, 202fa99, 781770d, 9ad99ef, 7e85114. Все сохранены во всех деревьях.
- Проверка 198 текущих tracked/публикуемых файлов по шаблонам private keys, GitHub/Telegram/provider tokens: совпадений нет. Запрещённых env, архивов, локальных БД/ключей среди них нет. Это проверка шаблонов, не гарантия обнаружения любого возможного секрета. Значения env не выводились.
- git diff --check и --cached --check прошли. На момент первичного push все три дерева чистые.

## GitHub и неизменяемые ветки
Перед публикацией повторён fetch: неизвестных изменений не было. Обычный push с upstream создал три Frontend-ветки. Затем `git ls-remote --heads origin` подтвердил SHA 1888b91 у каждой.

- [main-dev](https://github.com/lex44lh/Studly/tree/codex/frontend-main-dev)
- [redesign](https://github.com/lex44lh/Studly/tree/codex/frontend-redesign-campus)
- [integration](https://github.com/lex44lh/Studly/tree/codex/frontend-api-integration)

`main` и `origin/main` сохранились на ccfde590b6e722d1eeb0694747e10afc7958acb1; origin/codex/backend — d7a5ffa5abc1537301ced7275da9e45282d6b4f3; локальная и удалённая frontend-registration — 7e85114b527c6cfa6fcbb4d556b657a4dbb2bbbe. Локальной Backend-ветки не создавали. Merge/rebase/reset/force/delete не выполнялись; сервер не развёртывался.

## Окончание автоматической подготовки
2026-10-18 20:44:31 MSK, Europe/Moscow. Подготовлен этот финальный отчёт; далее его отдельный commit/push только в main-dev и read-only сверка. Фактический окончательный Git-статус и SHA — в ответе после этих операций.

## Следующий шаг владельца
Создать/проверить три новые Local-сессии по CODEX_DESKTOP.md и передать соответствующий handoff. Старые чаты не удалять. До проверки их фактических cwd этап не завершён. Для чистой проверки основной Demo на 3000 владелец должен найти терминал прежнего сервера, остановить его Ctrl+C и выполнить команду из правильной основной сессии; неизвестный PID не завершать. Подготовка Django и реальный Live — отдельный совместный этап, здесь автоматически не запускаются.
