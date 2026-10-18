# Локальный запуск STUDLY

Актуально: **18 октября2026**, ветка `codex/frontend-registration`. Дизайн «Кампус» находится на `/search`.

## Открыть терминал и проект

На Mac нажмите **⌘Пробел**, введите **Терминал**, нажмите Enter. Подойдёт также терминал VS Code/PyCharm. После каждой команды нажимайте Enter.

```sh
cd /Users/alekspih/Projects/studly
```

Нужны Node.js20.9+ и npm; проверено с Node24.19/npm11. Если `node_modules` отсутствует, выполните `npm ci` из корня. Не используйте sudo.

## Demo — Django не нужен

```sh
npm run dev:demo
```

После проверки `/search` появится:

```text
STUDLY — DEMO MODE
http://localhost:3000
```

Откройте [http://localhost:3000/search](http://localhost:3000/search). Главная — [http://localhost:3000](http://localhost:3000). Все прежние страницы сохранены; каталог использует17 демонстрационных услуг. Регистрация — предпросмотр без настоящего аккаунта, заказ — только локальный пример. Настоящие заказы и платежи не выполняются.

**Остановка:** Ctrl+C в терминале сервера, затем дождаться возвращения приглашения. После этого можно запускать другой режим. Обновление страницы не останавливает сервер.

## Отдельный Django

В этой Frontend-копии **нет `apps/api/manage.py`, Python-окружения и Backend `.env`**. Live не устанавливает и не запускает Django. Старая `npm run dev:api` в этой ветке относится к прежнему Backend, для Django здесь не подходит и сохранена без изменения.

Используйте отдельную, подготовленную копию `codex/backend`. Источники сотрудника: [RUN_LOCAL](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/RUN_LOCAL.md), [Backend README](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/README.md).

Откройте **вторую вкладку терминала** через ⌘T, запустите Docker Desktop и из корня подготовленной Backend-копии выполните:

```sh
cd /Users/alekspih/Projects/studly-backend
docker compose --env-file apps/api/.env up -d --wait db
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:3000 apps/api/.venv/bin/python apps/api/manage.py runserver 127.0.0.1:8000
```

`studly-backend` — предложенное имя отдельной папки, **она не создана этой задачей**. Если Backend уже подготовлен в другом месте, подставьте его путь. Последняя команда задаёт trusted origin только локальному процессу, не меняя `.env`. Если нужны другие доверенные адреса, согласуйте полный список с Backend-разработчиком. Локальный HTTP предполагает подготовленную debug-конфигурацию Django; при `DEBUG=false` Secure cookies требуют согласованного HTTPS. Не отключайте CSRF, Telegram-проверку или cookie-защиту.

Проверки: [health](http://127.0.0.1:8000/api/v1/health/), [PostgreSQL ready](http://127.0.0.1:8000/api/v1/ready/), [services](http://127.0.0.1:8000/api/v1/services/). Health/ready должны вернуть HTTP200 и `{"status":"ok"}`. Пустой каталог допустим.

Если Backend-копии ещё нет, её одноразовая подготовка выполняется отдельно по Backend README. Для новой папки:

```sh
git clone --branch codex/backend --single-branch https://github.com/lex44lh/Studly.git /Users/alekspih/Projects/studly-backend
```

**Clone не подготавливает сервер.** Нужны Python3.13, `.venv`, зависимости `apps/api/requirements.txt`, приватный `.env` с собственными секретами, Docker/PostgreSQL17 и миграции. Существующие `.env`/`.venv` не заменяйте. Команда миграций из корня Backend — `apps/api/.venv/bin/python apps/api/manage.py migrate`; подготовку должен согласовать владелец Backend. Frontend не выполняет её автоматически, не создаёт пользователей и не заполняет каталог.

## Live

Когда отдельный Django уже работает, в **первой вкладке**:

```sh
cd /Users/alekspih/Projects/studly
npm run dev:live
```

По умолчанию Backend — `http://127.0.0.1:8000`. После проверки Django, БД, `/search`, proxy и гостевых auth/CSRF endpoints появится:

```text
STUDLY — LIVE MODE
http://localhost:3000
```

Откройте [http://localhost:3000/search](http://localhost:3000/search). При недоступном Backend команда остановится с диагностикой до запуска Next. Ошибки и пустая база не включают Demo.

Браузер обращается на тот же origin `/api/`, существующий Next rewrite направляет запросы в Django. Session/CSRF-клиент сохранён. Startup-проверки выполняют только GET; они не создают заказ, платёж или аккаунт и не подтверждают реальный вход. Mini App по-прежнему требует Telegram, публичный HTTPS и настройки Backend. Если auth/options выключает оба входа, launcher предупреждает об этом.

Другой Backend задаётся явно, например:

```sh
DJANGO_API_ORIGIN=http://127.0.0.1:8001 npm run dev:live
```

В этом сеансе реальный Django проверялся через `DJANGO_API_ORIGIN=https://studly-help.ru npm run dev:live`. Это необязательный ручной выбор: автоматического перехода с локального сервера на production нет. Успешное чтение публичного API через localhost не доказывает Telegram/OIDC login и CSRF mutations при таком размещении; для них требуется согласованный общий origin/HTTPS.

## Остановить серверы

- Next: Ctrl+C в первой вкладке, дождаться завершения; launcher останавливает свой Next-процесс.
- Django: Ctrl+C во второй вкладке.
- PostgreSQL можно оставить работающей. Остановить без удаления данных из Backend-корня: `docker compose --env-file apps/api/.env stop db`. Не используйте `down -v` для обычной остановки.

Demo/Live запускаются **по очереди**. Два Next dev одной рабочей копии также конфликтуют за `.next/dev/lock`, даже на разных портах. Lock не удаляется автоматически: сначала остановите настоящий процесс, при сомнениях запросите диагностику.

## Занятый порт3000

Launcher не выбирает3001 незаметно и не завершает чужие процессы. Посмотреть занятый порт:

```sh
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Найдите терминал нужного сервера и остановите его через Ctrl+C. Не завершайте неизвестный PID вслепую. Для сознательного выбора другого порта:

```sh
npm run dev:demo -- --port 3001
# либо после остановки Demo:
npm run dev:live -- --port 3001
```

Открывать тогда `http://localhost:3001/search`. Для Live согласуйте новый origin с Django. Поддерживается PORT из shell (`PORT=3001 npm run dev:demo`), PORT в `.env` не используется.

## Окружение и ошибки API

| Настройка | Поведение |
|---|---|
| `NEXT_PUBLIC_STUDLY_DATA_MODE` | Две новые команды явно выбирают demo/live поверх shell/.env, не переписывая файл |
| Старое `api` | Alias **Live**, без Demo fallback; launcher предупреждает об устаревшем значении |
| Пустое значение при прямом Next dev/build | Live по умолчанию; опечатки дают ошибку |
| `DJANGO_API_ORIGIN` | Server-only HTTP(S) origin, без `/api/`, credentials, пути, query/hash |
| `.env*` | Загружаются Next из `apps/web`, shell имеет приоритет; корневой `.env` автоматически не читается |

Используется установленный вместе с Next `@next/env`. Новые зависимости и `.env` не создаются; секреты не выводятся. В явном Demo Django origin для дочернего процесса заменяется loopback default без сетевых проверок и без изменения файлов.

После смены режима/API origin остановите dev-сервер и запустите заново. Для `next start` mode и rewrites определены **во время build**: нужен rebuild, одной смены env у start недостаточно.

- `ECONNREFUSED`: запустите Django, проверьте порт8000 и origin.
- `ENOTFOUND`: проверьте домен и сеть; fallback отсутствует.
- Ready503: PostgreSQL не готова, проверьте Docker db и Backend-настройки.
- Ожидался JSON: вместо API пришли HTML/redirect/ошибка proxy; проверьте origin и маршрут.
- `auth/me`401/403 у гостя допустимы.403 при отправке формы требует проверки входа/CSRF/trusted origins, а не отключения защиты.
- Telegram не настроен: требуется настройка владельцем Backend, launcher не создаёт фиктивный вход.
- Backend упал после готовности: приложение показывает API-ошибку. Startup-проверка не является непрерывным мониторингом.

[Индекс отчётов](<documents/project/для отчетов/README.md>).
