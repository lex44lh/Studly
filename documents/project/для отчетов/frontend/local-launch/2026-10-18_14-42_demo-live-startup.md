# STUDLY — настройка запуска Demo/Live

- Дата: **18.10.2026, Europe/Moscow**.
- Начало: **14:42:13**, системные часы. Основные проверки завершены около14:55; окончание записи указано ниже.
- Статус: **launcher реализован, проверен и опубликован на GitHub в codex/frontend-registration**. Пользователь отдельно разрешил commit/push после уточнения противоречия между сообщением и вложением.
- Ветка: `codex/frontend-registration`; исходный HEAD `24117052e6091efb391c8840e3d98b2708b773c3`.
- Git fetch: Frontend совпадал с origin (`0/0`), main `ccfde590b6e722d1eeb0694747e10afc7958acb1`, Backend `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`.

## Результат

Из `/Users/alekspih/Projects/studly`:

```sh
npm run dev:demo
npm run dev:live
```

Команды запускаются по очереди. Адрес после успешной проверки: **http://localhost:3000**, новый каталог — **http://localhost:3000/search**. Остановка — Ctrl+C.

Полная пошаговая инструкция, включая терминал, отдельный Django, остановку, занятый порт и ошибки: [LOCAL_START.md](../../../../../LOCAL_START.md).

## Проверенное исходное состояние

Корневые dev:demo/dev:live уже делегировали workspace, но не проверяли порт/Django/proxy. Workspace использовал shell assignments и Next dev напрямую; Next мог объявить готовность до доступности API. Root dev:api по-прежнему ссылается на прежний Nest-скрипт; Python Backend отсутствует в этой Frontend-копии. Единственный Git worktree — текущий Frontend; `manage.py`, Backend `.venv` и `.env` здесь отсутствуют.

При проверке в корне и apps/web не обнаружены `.env*`; три настройки mode/origin/PORT в исходном shell не заданы. Значения секретов не запрашивались и не выводились. API rewrite уже корректен: `/api/:path*` → server-only Django origin, slash сохранён. Авторизацию, CSRF client, cookies и Next proxy менять не потребовалось.

Документация Backend прочитана через `git show origin/codex/backend:...`, без checkout/merge/изменений: RUN_LOCAL, apps/api/README, API_CONTRACT, health/views и относящиеся к host/cookie/CSRF настройки. Некоторые фразы этих документов про ещё не подключённый Frontend исторические; действительное состояние Frontend проверено по коду.

## Реализация

| Файл | Изменение |
|---|---|
| `package.json` | Сохранены прежние скрипты; две команды workspace корректно передают дополнительные аргументы после `--` |
| `apps/web/package.json` | dev:demo/dev:live используют Node launcher без новых зависимостей и shell-specific env assignments |
| `apps/web/scripts/dev.cjs` | Загрузка Next env, явный mode, дочерний Next, startup checks, вывод готовности, Ctrl+C/SIGTERM cleanup |
| `apps/web/scripts/dev-support.cjs` | CLI/origin validation, занятый порт, GET-проверки health/ready/catalog/auth/CSRF без вывода body/secrets |
| `apps/web/src/lib/data-mode.ts` | Старое `api` → строго Live; опечатки по-прежнему ошибочны, fallback отсутствует |
| `apps/web/tests/auth.test.cjs` | Тест совместимости alias api |
| `apps/web/tests/dev-launcher.test.cjs` |7 тестов launcher/контрактов/ошибок/CSRF/неразглашения body |
| `LOCAL_START.md`, web README/INTEGRATION | Инструкции, ограничения, правильный запуск Backend, env и proxy |
| `.gitignore` | Локальный архив логотипа исключён;16 проверенных файлов dist-прототипов включены как намеренные документы |

Режим команды имеет приоритет над прежним shell/.env mode. Launcher предупреждает об `api`. Env-файлы не создаются/не переписываются, PORT берётся из shell/CLI до loadEnvConfig, остальные настройки Next — из apps/web по штатному порядку. В Demo origin для дочернего процесса фиксируется loopback, API вообще не проверяется. В Live проверяется исключительно указанный Django origin или явный default8000; production origin автоматически не выбирается.

Проверки Live **до Next**: GET health200/statusok, ready200/statusok (реальный DB check), services200/DTO, auth/options200/booleans. Затем проверяется `/search` и те же API через Next origin, HttpOnly CSRF Set-Cookie и гостевой me401/403 либо корректный user200. Только после этого выводятся `STUDLY — LIVE MODE` и адрес. Стандартная строка Next «Ready» скрыта до проверки приложения. При сбое startup Next прекращается, Demo не включается. Новая команда не ослабляет серверную защиту и не подтверждает реальный пользовательский вход.

## Проверки

| Проверка | Фактический результат |
|---|---|
| npm test workspace | **37/37 PASS**:30 прежних +7 launcher; внутри тестов дополнительно проверены неверная decimal price и pagination path |
| Registration TS tests отдельно через transpileModule runner | **8/8 PASS**, всего45 автоматических тестов |
| TypeScript `--noEmit --incremental false` | PASS |
| ESLint |0 errors/2 прежних image warnings create-service429/589 |
| Production build mode live | PASS,22 прежних page templates |
| Production build legacy api | PASS; alias не переводит сборку в Demo |
| `npm run dev:demo` из корня | PASS, port3000; banner только после `/search`200,17 услуг в браузере |
| Занятый3000 | Запуск второй команды остановлен с адресной диагностикой/lsof, без fallback port и чужих kill |
| Ctrl+C | Demo/Live остановлены; следующий dev запуск получает свободный lock; фоновые процессы специально не оставляются |
| `npm run dev:live` без локального Django | Ожидаемый отказ ECONNREFUSED на8000; Next не запущен, banner готовности отсутствует, Demo не включён |
| Настоящий публичный Django | `DJANGO_API_ORIGIN=https://studly-help.ru npm run dev:live` прошёл health/ready/services/options, Next `/search`, proxy/CSRF-cookie/me; это **не HTTP-фикстура** |
| Browser Live | LIVE badge, count0, честное empty, нет17 Demo-услуг |
| Demo override/аргументы | При старом mode api и некорректном Django origin команда dev:demo с `-- --port 3001` успешно запустила именно Demo3001; `.env` не изменён |
| Маршруты Demo |22 representative GET=200, включая search/service/profile/category/orders/chats/registration; это HTTP smoke, не E2E каждого бизнес-сценария |
| diff-check | PASS |
| Предпубликационная проверка | По whitelist120 кандидатов на момент первой проверки; неизвестных файлов и совпадений основных secret-patterns не выявлено. Финальная staged-проверка зафиксирована в Git-отчёте |

[Demo screenshot](2026-10-18_14-42_demo-search.png) · [Live screenshot](2026-10-18_14-42_live-search.png).

Начальные EPERM на bind/fetch в инструментах агента вызваны sandbox; проверки повторены с разрешённым локальным запуском. Это не ошибка команды в обычном терминале пользователя. Занятый порт диагностирован на настоящем втором запуске. Исследование lock-conflict и timeout веток ограничено кодом/тестами; отдельный зависший Next специально не создавался.

## Ограничения и Backend

**Локальный Django не запускался:** исходников/окружения в этой копии нет, Backend менять запрещено. Точная штатная команда в подготовленном Backend-корне:

```sh
docker compose --env-file apps/api/.env up -d --wait db
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:3000 apps/api/.venv/bin/python apps/api/manage.py runserver 127.0.0.1:8000
```

Первичную Python/PostgreSQL/.env/migration подготовку выполняет владелец Backend по документации; текущая задача не создаёт копию Backend, БД, аккаунты, заказы или платежи. При другом порте следует согласовать trusted origin. Cookie Secure/SameSite, сессия, CSRF и Telegram signature rules не менялись.

Публичный Django на момент проверки возвращает пустой каталог и `telegram_mini_app=false`, `telegram_website=false`; launcher выдаёт предупреждение. Чтение реального API, получение CSRF-cookie и допустимый guest403 **не доказывают** успешный Telegram login/registration/session mutations. Такие проверки, физические Telegram/iOS/Android и публикация сайта в интернете не выполнялись. Начальная готовность — не непрерывный мониторинг; последующие API-сбои честно отображаются существующим UI.

## Сохранность и публикация

Незакоммиченный Campus, Demo/Live guards, регистрация, существующие страницы и API client из предыдущих этапов просмотрены и сохранены. Менялись только запуск, alias, документация/индекс и правила включения документационных прототипов. Backend/его ветка и main не изменялись. Новых библиотек и Next API replacement нет.

После явного уточнения пользователя разрешены commit/push **всех готовых Frontend-изменений** только в origin/codex/frontend-registration. Исходники Git публикуются отдельно от развёртывания сайта: deployment этим не разрешён. Архив логотипа, env, node_modules, .next, временные файлы и Backend-материалы не включаются. Итоговые hashes/ссылки/послепубликационная сверка: [Git-отчёт](../../git/2026-10-18_14-42_frontend-publication.md).

## Источники и следующие действия

- [Backend API_CONTRACT d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md), [RUN_LOCAL d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/RUN_LOCAL.md), [settings](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/config/settings.py).
- Установленные Next16.3.4 docs: `01-app/02-guides/environment-variables.md`, `01-app/03-api-reference/06-cli/next.md`; AGENTS.md и фактический код проекта.
- [Предыдущий Campus этап](../redesign/2026-10-18_13-21_campus-search-implementation.md), [предшествующие Demo/Live исправления](../api-integration/2026-10-16_21-12_regression-demo-live.md).
- Дальше: подготовить отдельный локальный Django у владельца; настроить настоящий Telegram/HTTPS и провести согласованную сессионную интеграционную проверку. Release/security gate предыдущего аудита перед размещением сайта остаётся отдельным этапом. Другие страницы не переделывались.

Окончание настройки/проверки документации: **18.10.2026,14:59:37 Europe/Moscow**, системные часы.162 локальные ссылки29 Markdown-документов существуют; финальный lint0 errors/2 прежних warnings. Коммиты реализации уже созданы; hashes и окончание публикации фиксируются в связанном Git-отчёте. Все запущенные в этом сеансе dev-серверы остановлены.
