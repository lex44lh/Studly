# STUDLY — план локального Django и проверки Live

- Дата: 19.10.2026, Europe/Moscow.
- Начало анализа: **00:44:36**, системные часы. Окончание указано в конце.
- Результат: подготовлен план; окружение Django не создавалось, серверы и миграции не запускались.
- Frontend: `/Users/alekspih/Projects/studly-integration`, `codex/frontend-api-integration`, порт **3002**.
- HEAD / policy revision: `1888b9194827d00317fb9cf9d27218ef702999cb`.
- Backend после `git fetch origin`: **`d7a5ffa5abc1537301ced7275da9e45282d6b4f3`**, новых commits относительно handoff нет.

## 1. Вывод и граница текущего этапа

Можно организовать отдельную локальную копию опубликованного Django, собственную PostgreSQL и Frontend на 3002. Локальный HTTP сначала проверит реальный API, БД и proxy. Для полного Telegram-входа и регистрации нужны согласованные тестовые HTTPS, настройки бота и разрешённые тестовые аккаунты.

**Все команды подготовки и запуска ниже — инструкция на следующий согласованный этап. В этом сеансе они не выполнялись.** Создание копии, `.venv`, `.env`, контейнера/БД, применение опубликованных миграций, наполнение и пользовательские записи сейчас не разрешены. Изменять Django-код, создавать миграции, подменять вход, отключать CSRF или проверку Telegram не требуется.

Действие сотрудника необходимо до подготовки: подтвердить Backend SHA, изоляцию БД, локальную конфигурацию, разрешённые данные и вариант тестового Telegram/HTTPS. Сообщение для него подготовлено в разделе 9 и не отправлялось.

## 2. Проверенные источники и фактическое состояние

Прочитаны root `AGENTS.md`, `apps/web/AGENTS.md`, `TEAM_WORKFLOW.md`, handoff Integration, `LOCAL_START.md`, индекс отчётов. Backend-документы и относящийся к окружению код читались через `git show origin/codex/backend:<path>`, без checkout/merge и серверных изменений.

Первичные документы на проверенном SHA:

- [RUN_LOCAL.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/RUN_LOCAL.md).
- [apps/api/README.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/README.md).
- [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).
- [REGISTRATION_API.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/REGISTRATION_API.md) и [OpenAPI](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/docs/registration.openapi.json).
- [BACKEND_NEXT.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/BACKEND_NEXT.md).
- [Пример переменных](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/.env.example), [settings.py](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/config/settings.py), [compose.yaml](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/compose.yaml), [requirements.txt](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/apps/api/requirements.txt).

В старых частях RUN_LOCAL/README встречаются пути компьютера сотрудника, «сервер уже запущен», «Frontend ещё не подключён», JSON-only OIDC callback. Эти фразы не описывают данный Mac/worktree. По текущему коду Frontend proxy и API-клиент уже есть; актуальный контракт допускает `next` и `303` из OIDC. BACKEND_NEXT содержит более позднее описание размещения, но оно не доказывает готовность локальной копии и не разрешает использовать production. Production на Python 3.12/PostgreSQL 16 не меняет локальный план README: Python 3.13/PostgreSQL 17.

На Mac выполнены только проверки версий/путей:

| Средство | Фактический результат |
|---|---|
| Платформа | Darwin arm64 |
| `python3.13 --version` | Python 3.13.7, `/opt/homebrew/bin/python3.13` |
| `python3` | PATH указывает на установку Python 3.14; для Backend использовать явно `python3.13` |
| `docker --version` | Docker CLI 29.7.2 |
| `docker compose version` | Compose v5.3.1 |
| Node / npm | v24.19.0 / 11.17.0 |
| TCP LISTEN 3002, 8000, 5433 | `lsof` не показал слушателей в момент проверки; exit 1 при пустом результате |
| Docker Engine / образ postgres / контейнер | Не запускалась проверка готовности; наличие CLI не подтверждает работающий Engine |

Личные `.env`, настройки сотрудника и production-секреты не читались и не копировались. Значения runtime env в этой задаче не подтверждались. Предшествующие два изменения документации своей сессии сохранены.

## 3. Что потребуется

| Компонент | Назначение и способ подготовки |
|---|---|
| Git и доступ к репозиторию | Отдельная согласованная Backend-копия по точному SHA; без merge в Frontend |
| Python **3.13** | Уже найден; отдельная `apps/api/.venv` в Backend-копии |
| pip и `apps/api/requirements.txt` | Установка закреплённых версий в `.venv`; не обновлять зависимости произвольно |
| Docker Desktop / работающий Engine и Compose | Запускает только PostgreSQL, Django работает на Mac |
| PostgreSQL **17** | Образ `postgres:17` из существующего Compose; host `127.0.0.1`, порт по примеру **5433**, внутри контейнера 5432 |
| Локальные секреты | Новые случайные Django key и пароль собственной БД; ввод владельцем приватно |
| Файловое хранилище аватаров | Собственная `apps/api/media/` в Backend-копии либо отдельный согласованный `DJANGO_MEDIA_ROOT` |
| Node и Frontend-зависимости | Для Next на 3002; Python Backend не требует установки npm-зависимостей из своей копии |
| Telegram и HTTPS | Только для настоящей авторизованной проверки; отдельная согласованная конфигурация |

Прямые зависимости опубликованного lock-снимка: Django **5.2.18**, DRF **3.18.3**, psycopg/psycopg-binary **3.3.6**, Authlib **1.9.1**, joserfc **1.7.5**, requests **2.34.2**, python-dotenv **1.2.4**, Pillow **12.3.0**. Все транзитивные версии устанавливаются из `requirements.txt`; `requirements-production.txt` для локального runserver не нужен. Новые Redis/Celery/Next API не требуются по изученной конфигурации. Доступность установки пакетов на этом Mac пока не проверена.

## 4. Переменные окружения

Это перечень для будущего приватного `apps/api/.env` в Backend-копии, а не созданный файл. Backend читает его через python-dotenv; переменные shell имеют приоритет. Значения секретов в отчёты и чат не вводить.

| Переменная | План для изолированной локальной копии |
|---|---|
| `DJANGO_DEBUG` | `true` только для локального HTTP на loopback; публичное HTTPS-окружение сотрудник настраивает отдельно |
| `DJANGO_SECRET_KEY` | Собственное случайное значение; не production key и не ключ-пример |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]`; это hosts без схемы и порта |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:3002,http://127.0.0.1:3002` для планируемого выделенного процесса; основной браузерный адрес — localhost |
| `POSTGRES_DB` | `studly` из примера допустим внутри нового изолированного volume; подтвердить с сотрудником |
| `POSTGRES_USER` | `studly` из примера, локальная роль |
| `POSTGRES_PASSWORD` | Новый случайный локальный пароль, одинаковый для Django и нового контейнера |
| `POSTGRES_HOST` | `127.0.0.1`: Django запускается на Mac |
| `POSTGRES_PORT` | `5433`, только если свободен; при конфликте согласовать иной порт и одинаково применить к Compose/Django |
| `DJANGO_MEDIA_ROOT` | Необязательно: default `apps/api/media/`; не использовать каталог сотрудника/production |
| `TELEGRAM_BOT_TOKEN` | Не нужен для публичного чтения. Для Mini App — только секрет согласованного тестового бота, вводится приватно |
| `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET`, `TELEGRAM_OIDC_REDIRECT_URI` | Только для входа с сайта. Callback должен точно соответствовать регистрации Telegram на общем тестовом HTTPS origin |
| `TELEGRAM_AUTH_MAX_AGE`, `TELEGRAM_AUTH_CLOCK_SKEW`, `TELEGRAM_OIDC_STATE_MAX_AGE` | Значения примера 300 / 30 / 300 секунд; не увеличивать для обхода проверки |
| `YOOKASSA_TEST_SHOP_ID`, `YOOKASSA_TEST_SECRET_KEY` | Для этого этапа не нужны; оставить незаданными, реальные платежи не проверяются |

Frontend запускается без изменения `.env`: `DJANGO_API_ORIGIN=http://127.0.0.1:8000` задаётся только его процессу; launcher сам выбирает `NEXT_PUBLIC_STUDLY_DATA_MODE=live`. Порт задаётся аргументом `--port 3002`. `DJANGO_API_ORIGIN` не имеет `/api/`, query, credentials и не является `NEXT_PUBLIC`.

`ALLOWED_HOSTS` и CSRF origins решают разные задачи. Django проверяет Origin небезопасного запроса; доверенный origin содержит схему, host и порт. Добавление origins не включает CORS. Это соответствует [настройке CSRF Django 5.2](https://docs.djangoproject.com/en/5.2/ref/settings/#csrf-trusted-origins). Если запускается уже используемый сервер, полный список origins согласовать с сотрудником, не затирать его одноадресным override.

## 5. Пошаговый запуск после согласования

### Шаг 1. Согласовать копию и снимок

Сначала получить ответы из раздела 9. Если сотрудник предоставит готовую **выделенную** локальную копию, проверить её путь, HEAD, status и адрес собственной БД; не менять его рабочую папку и не заменять существующие `.env`/`.venv`.

Если готовой копии нет, предлагается отдельный clone в **ещё не существующий** `/Users/alekspih/Projects/studly-backend`, закреплённый detached на проверенном SHA. Это будущий вариант, не созданный worktree. Его должен согласовать PO и сотрудник. Пример после согласования:

```sh
git clone --branch codex/backend --single-branch https://github.com/lex44lh/Studly.git /Users/alekspih/Projects/studly-backend
cd /Users/alekspih/Projects/studly-backend
git switch --detach d7a5ffa5abc1537301ced7275da9e45282d6b4f3
git rev-parse --show-toplevel
git log -1 --oneline
git status --short
```

При существующей папке остановиться и установить её владельца/назначение. Перед фактической подготовкой повторить fetch и сверить контракт: при новом Backend SHA план нужно пересмотреть. Backend-ветку не сливать в Integration; исходники из соседних worktree не копировать. Инструкции Backend-копии также прочитать до её подготовки.

### Шаг 2. Подготовить Python-окружение

В новой согласованной Backend-копии без существующей `.venv`:

```sh
python3.13 --version
python3.13 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements.txt
apps/api/.venv/bin/python -m pip check
```

Не нужны sudo, глобальная установка Django или перенос `.venv` сотрудника. Окружение создаётся на месте; activation не обязателен при явном пути Python. Основание: [Python 3.13 venv](https://docs.python.org/3.13/library/venv.html).

### Шаг 3. Подготовить приватные настройки

Владелец/сотрудник вручную создаёт локальный `apps/api/.env` на основе **опубликованного** `.env.example`, только при отсутствии файла, с собственными секретами и параметрами раздела 4. Существующий файл не перезаписывать; секреты не передавать в чат, командную строку или Git. В этом этапе такой файл не создавался.

Уточнить отсутствие посторонних shell overrides `POSTGRES_*`/`DJANGO_*` без вывода их значений. Backend и Compose должны использовать одну локальную БД. Проверить игнорирование приватного файла командой `git check-ignore apps/api/.env` без чтения содержимого.

### Шаг 4. Запустить отдельную PostgreSQL

Открыть установленный Docker Desktop вручную и дождаться готовности Engine. Проверка без создания контейнера: `docker info --format '{{.ServerVersion}}'`. Перед стартом проверить свободный согласованный порт 5433 через `lsof -nP -iTCP:5433 -sTCP:LISTEN`; неизвестный процесс не останавливать.

**Изоляция:** в Backend Compose стоит `name: studly-local`. Для нового выделенного окружения предлагается согласованное имя **`studly-integration-local`**. Использовать одинаковый `-p` во всех командах: флаг имеет приоритет над `name:` и разделяет Compose-ресурсы. См. [Docker: project name](https://docs.docker.com/compose/how-tos/project-name/). До первого старта убедиться, что проект с таким именем ещё не занят; не подключать существующий чужой volume. Отдельное имя проекта не устраняет конфликт host-порта.

Из корня Backend:

```sh
docker compose -p studly-integration-local --env-file apps/api/.env up -d --wait db
docker compose -p studly-integration-local --env-file apps/api/.env ps
```

По опубликованному Compose это PostgreSQL 17, `127.0.0.1:5433` → container 5432 и отдельный именованный volume `postgres_data` с префиксом проекта. Флаг `--wait` ожидает running/healthy согласно [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/). Healthcheck контейнера не подтверждает правильность Django-пароля и миграций — это проверяется следующим шагом.

### Шаг 5. Применить только опубликованные миграции

Выполняет сотрудник либо PO после его подтверждения **пустой изолированной локальной БД** и отдельного разрешения на этот этап:

```sh
apps/api/.venv/bin/python apps/api/manage.py check
apps/api/.venv/bin/python apps/api/manage.py showmigrations --plan
apps/api/.venv/bin/python apps/api/manage.py migrate --plan
apps/api/.venv/bin/python apps/api/manage.py migrate
apps/api/.venv/bin/python apps/api/manage.py showmigrations
```

`migrate` применяет уже опубликованные миграции. `makemigrations` для подготовки не нужен; новую схему/миграцию Frontend не создаёт. При неожиданных миграциях, подключении к существующей БД или ошибке остановиться и передать сотруднику безопасную диагностику. Не удалять БД/volume и не выполнять fake/rollback по предположению.

### Шаг 6. Выбрать данные

Пустой каталог допустим и достаточен для первого smoke. После отдельного согласования сотрудник может выполнить существующую команду:

```sh
apps/api/.venv/bin/python apps/api/manage.py seed_demo_catalog
```

Она добавляет четыре опубликованные услуги `is_demo=true`, без Telegram ID, с неактивными демонстрационными исполнителями и непригодным паролем; повторный запуск пропускает уже существующие demo keys. Это настоящие записи локальной PostgreSQL с явным признаком демо. Они годятся для чтения каталога и quote, но не доказывают вход и не допускаются к оформлению серверного заказа.

Не импортировать production dump/аватары/пользователей. Специализации по решению PO остаются пустыми до утверждённого наполнения. Администратора, разрешения модератора и тестовые Telegram-аккаунты определяет сотрудник с PO. Не создавать синтетическую сессию или подставного Telegram-пользователя через shell. Заказы и платежи вне первого smoke; будущие проверки заказов потребуют отдельно согласованной реальной тестовой публикации и двух авторизованных участников в выделенной среде.

### Шаг 7. Запустить Django

Для выделенной локальной debug-конфигурации раздела 4, после проверки порта 8000, из корня Backend:

```sh
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002 apps/api/.venv/bin/python apps/api/manage.py runserver 127.0.0.1:8000
```

Команда меняет origins только в окружении процесса; все остальные локальные настройки уже должны быть подготовлены сотрудником. Не использовать её для общего работающего Django с другими origin. Django остаётся на loopback; не публиковать debug/runserver в интернет. Путь `apps/api/.venv/bin/python apps/api/manage.py` взят из Backend. Корневая `npm run dev:api` текущего Frontend относится к старому Backend и здесь не подходит.

### Шаг 8. Проверить API напрямую, затем запустить Frontend

Сначала выполнить проверки раздела 6. Остановить собственный Demo на 3002 через его терминал Ctrl+C и дождаться завершения. После готовности Django в отдельном терминале:

```sh
cd /Users/alekspih/Projects/studly-integration
DJANGO_API_ORIGIN=http://127.0.0.1:8000 npm run dev:live -- --port 3002
```

Открыть `http://localhost:3002/search`. Launcher проверяет GET health/ready/services/options напрямую, затем `/search` и API через proxy, HttpOnly CSRF-cookie и гостевой `/auth/me/`. Только после этого печатает `STUDLY — LIVE MODE`. Это подтверждение startup-чтения, не успешного login или записи. При недоступном API Demo не включается.

Остановка: Ctrl+C своих Next/Django. БД сохраняется; остановить только согласованный контейнер без удаления данных:

```sh
cd /Users/alekspih/Projects/studly-backend
docker compose -p studly-integration-local --env-file apps/api/.env stop db
```

Не использовать `down -v` и не завершать неизвестные PID. Перезапуск не требует seed, создания `.env` или новых миграций автоматически.

## 6. Как проверить настоящее соединение

Следующие GET-команды после запуска не используют фикстуру и не выполняют прикладных записей:

```sh
curl --max-time 10 -sS -i -H 'Accept: application/json' http://127.0.0.1:8000/api/v1/health/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://127.0.0.1:8000/api/v1/ready/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://127.0.0.1:8000/api/v1/services/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://127.0.0.1:8000/api/v1/auth/options/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/health/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/ready/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/services/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/auth/options/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/auth/me/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/registration/
curl --max-time 10 -sS -i -H 'Accept: application/json' http://localhost:3002/api/v1/specializations/
```

| Endpoint | Ожидаемый результат |
|---|---|
| `/health/` | 200, `{"status":"ok"}`; проверяет HTTP без БД |
| `/ready/` | 200, `{"status":"ok"}`; реальный SQL к PostgreSQL. При сбое 503/unavailable |
| `/services/` | 200, `count/next/previous/results`; пустой список допустим. Ошибка таблиц при успешном ready указывает на неприменённые миграции |
| `/auth/options/` | 200 и два boolean. Оба false допустимы для публичного smoke; true само по себе не доказывает login |
| `/auth/me/`, `/registration/` без cookie | 403 по контракту Django; это ожидаемая защита, не поломка proxy |
| `/specializations/` | 200, пагинация; утверждённый пустой справочник допустим |
| `/services/<id>/`, `/quote/`, `/performers/<id>/` | Проверять только ID из фактического списка; опубликованная запись 200, отсутствующая/скрытая 404 |

В приватном окне браузера на **одном host `localhost`** проверить Network: запросы идут на `localhost:3002/api/v1/...`; на стороне локального Django видны соответствующие запросы. Браузер не обращается напрямую к порту 8000. Прямой curl к 8000 выше — диагностика upstream, его cookie не переносится в браузер.

`GET /api/v1/auth/csrf/` дополнительно проверить локально в DevTools: 200, JSON `csrf_token`, Set-Cookie `csrftoken`, HttpOnly. Значения токена/cookie не копировать в отчёт, screenshot или чат. Launcher уже проверяет форму JSON/Set-Cookie, но не проходит с этими cookie настоящий login. Статус `/me/` после входа нужно проверять в том же браузере с его сессией; отдельный curl без cookie по-прежнему будет гостем.

## 7. Что подтверждено по коду Frontend

| Путь в текущем worktree | Соответствие плану / предел вывода |
|---|---|
| `apps/web/next.config.ts` | `/api/:path*` переписывается в явно заданный Django origin с trailing slash; `skipTrailingSlashRedirect: true` сохраняет методы без Next 308 |
| `src/lib/api/client.ts` | Относительный `/api/v1/`, `credentials: same-origin`, no-store; свежий JSON CSRF перед записью; FormData без ручной multipart boundary; нет автоматического повтора mutation |
| `src/lib/api/auth.ts`, `context/AuthContext.tsx` | Проверка `/me/`, raw Telegram initData только из SDK, CSRF → Mini App POST → `/me/`; logout с новым CSRF. Website OIDC start текущий AuthProvider автоматически не открывает |
| `src/lib/api/registration.ts`, `context/RegistrationContext.tsx` | GET/PATCH, server complete, шаг, специализации и приватный avatar; успешная запись должна подтверждаться ответом Django |
| `scripts/dev.cjs`, `scripts/dev-support.cjs` | Поддерживают `--port 3002`; проверяют startup-чтение и останавливаются при ошибке без fallback |
| `src/lib/data-mode.ts` | Default/legacy `api` означает Live, Demo включается явно |
| `src/app/register/layout.tsx` | Формы доступны только в development; production gate остаётся закрыт |

Изменение proxy по результатам статического чтения не требуется. Перед приёмкой всё равно нужно проверить сохранение Set-Cookie, методов, multipart, бинарного avatar и Host/Origin в реальной цепочке. Конфигурация на диске и планируемая среда совместимы; runtime-совместимость ещё не доказана.

Cookie `sessionid` хранит серверную Django-сессию, HttpOnly, SameSite=Lax, host-only; `csrftoken` также HttpOnly. По settings при DEBUG=false обе Secure, поэтому HTTP-проверка защищённой сессии с такой конфигурацией не является целевым сценарием. Для локального loopback применяется предусмотренный Backend debug-режим; для HTTPS нельзя менять cookie-защиту ради прохождения теста. Cookies не разделяются портами: для независимости от Frontend на 3000/3001 использовать отдельный профиль/контекст браузера. `localhost` и `127.0.0.1` в одной пользовательской сессии не смешивать.

## 8. План реальной интеграционной проверки

Каждый этап принимается отдельно. Успешные фикстуры, unit-тесты, сборка, health или гостевой CSRF не заменяют следующую строку.

| Этап | Условия и сценарии | Критерий / статус этого сеанса |
|---|---|---|
| A. Локальный Django и БД | Согласованная копия, собственные настройки/volume, существующие миграции; direct health/ready/services | Реальные JSON/SQL, известный SHA/БД. **Не запускалась** |
| B. Frontend proxy 3002 | Live, direct/proxy сравнение, empty/seed catalogue, query, детали и quote, отсутствующий ID | Реальные Django-запросы, без Demo fallback. **Не запускалась** |
| C. Подготовка авторизации | Участники теста, отдельный/согласованный бот, общий тестовый HTTPS origin, callback/CSRF/hosts, изолированное хранилище, защита доступа к стенду | Сотрудник/PO подтверждают конфигурацию; production не используется. **Не запускалась** |
| D. Настоящий вход | Mini App на согласованном HTTPS; SDK raw initData, CSRF → login → me; повторное открытие, logout, новый login | Сервер подтвердил пользователя и браузерную сессию без обходов. **Не запускалась** |
| E. Регистрация и файлы | Клиентские три комбинации ролей; PATCH по шагам, reload/восстановление, пропуск исполнителя, complete; валидный тестовый PNG/JPEG/WebP до 5 МиБ, чтение/замена/DELETE | Повторный GET и новое открытие после повторного входа подтверждают запись в выделенной PostgreSQL; avatar читается только с сессией. **Не запускалась** |
| F. Ошибки и защита | Пустой справочник, 400 validation без частичной записи, неверный CSRF/Origin, истечение сессии, двойной клик; недоступный Backend после запуска | Нет фиктивного успеха, повторной записи без контроля и fallback. Негативные сценарии только на собственных тестовых данных. **Не запускалась** |
| G. Целевые клиенты | Telegram iOS/Android/Desktop/Web на согласованном origin | Cookie/SameSite, возврат, avatar и клавиатура проверены отдельно по клиентам. **Не запускалась** |

Для Mini App использовать исходный `Telegram.WebApp.initData`, проверяемый Backend; `initDataUnsafe` не подтверждает личность. Это требование [Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). Никакой генерации подписанных тестовых initData с реальным bot secret, сохранения raw строк или передачи их в отчёт.

Для отдельной проверки website OIDC сотрудник должен настроить собственные Client ID/Secret и точный HTTPS callback; Bot API token их не заменяет. На **общем согласованном origin** можно открыть обычной браузерной навигацией `/api/v1/auth/telegram/start/?next=%2Fregister%2Froles`. Успех — callback 303 к форме, затем me/registration 200; без next контракт сохраняет JSON. Проверить одноразовый state и повторный старт после неуспешной попытки. Требования регистрации адресов: [Telegram Login](https://core.telegram.org/bots/telegram-login#registering-your-allowed-urls). UI-кнопка website login в этом Frontend ещё не подключена; этот ручной сценарий не подтверждает готовность пользовательского UI.

Локальный `http://localhost:3002` не является общедоступным HTTPS для Telegram. План публичного тестового входа должен отдельно определить схему размещения Frontend из нужного снимка и Django, общий origin и защиту стенда. Нельзя автоматически открывать Next dev/Django debug через публичный tunnel или подключать production API. Production-регистрация здесь закрыта; этот gate не снимается ради теста. Нужен отдельно согласованный тестовый способ работы с development-формами, без публичной выдачи debug-среды.

После подготовки сотрудник может выполнить существующие Backend-тесты в отдельной тестовой PostgreSQL (`manage.py test`) и проверки `manage.py check`, `python -m pip check`. Тестовый пользователь БД должен иметь право создавать отдельную test-БД; не давать эти права production ради теста. Числа успешных тестов из BACKEND_NEXT — исторические результаты сотрудника, не результаты этого сеанса.

## 9. Сообщение Backend-разработчику — готово к передаче

> Привет! Готовим выделенное Live-окружение STUDLY для Frontend `/Users/alekspih/Projects/studly-integration`, ветка `codex/frontend-api-integration`, порт 3002. После fetch Backend указывает на `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. Django-код, правила, миграции и production не меняем.
>
> 1. Подтверди, что этот SHA и API_CONTRACT/REGISTRATION_API подходят для совместной проверки. Есть ли обязательные ещё не опубликованные исправления или обновлённые инструкции?
> 2. Есть ли уже выделенная Backend-копия на этом Mac? Нужны её путь, SHA и назначение БД, без секретов. Если нет, согласуем отдельный clone `Projects/studly-backend` на закреплённом SHA, Python 3.13 и зависимости из requirements.txt. Подготовку и применение существующих миграций кто выполняет?
> 3. В compose.yaml стоит `name: studly-local`. Предлагаем отдельный Compose project `studly-integration-local`, новый volume, PostgreSQL 17 на loopback:5433 (либо другой свободный согласованный порт), Django loopback:8000. Подтверди отсутствие пересечений с твоими/другими БД и правила очистки тестовых данных.
> 4. Подтверди локальные параметры: DEBUG=true только на loopback, ALLOWED_HOSTS localhost/127.0.0.1/[::1], CSRF_TRUSTED_ORIGINS `http://localhost:3002,http://127.0.0.1:3002`, отдельные случайные SECRET_KEY/пароль БД и собственный media root. Пример .env опубликован; production .env/дампы/секреты передавать не нужно. Секреты вводим приватно в локальной копии после согласования.
> 5. Начнём с пустого каталога. Разрешён ли затем существующий seed_demo_catalog в этой изолированной БД? Справочник специализаций оставляем пустым до решения PO? Какие тестовые аккаунты/файлы допускаются, кто создаёт служебного администратора при необходимости?
> 6. Для настоящего Mini App-входа согласуем тестового бота или отдельную тестовую конфигурацию, стабильный HTTPS origin и маршрутизацию страниц/API в одну тестовую среду. Кто владеет BotFather и настройкой тестового адреса? Не менять рабочее меню бота без PO. Для дополнительного website OIDC нужны зарегистрированный callback и отдельные Client ID/Secret; достаточно подтверждения готовности и адреса, секреты в переписке не нужны.
> 7. Согласуем время совместного прогона: direct/proxy health/ready/catalog → настоящий login/me → новый CSRF → registration PATCH/reload/complete → avatar POST/GET/DELETE → logout/relogin и ошибки. Нужна проверка cookies/Host/Origin/multipart на тестовом HTTPS и целевых клиентах Telegram. Production-регистрация пока закрыта, подготовку защищённого стенда с формами согласуем отдельно.
>
> Со стороны Frontend proxy, same-origin cookie и CSRF-клиент уже есть, дизайн не меняем. Сообщи несекретные параметры/решения и ответственных; после этого PO сможет разрешить отдельный этап подготовки. Заказы, платежи, отключение CSRF и фиктивные endpoints в этот этап не входят.

## 10. Возможные проблемы и действия

| Признак | Что проверять |
|---|---|
| Docker CLI есть, Engine недоступен | Запустить установленный Desktop вручную после разрешения; CLI version не доказывает Engine readiness |
| Установка Python-пакета не проходит | Версия именно 3.13, arm64 wheels/доступ к registry; передать ошибку сотруднику, не менять pinned версии самовольно |
| 5433 занят / появился чужой Compose project | Установить владельца, согласовать отдельный порт/project; не kill и не повторное использование неизвестного volume |
| PostgreSQL authentication failed | Совпадение настроек Django/контейнера и shell overrides. Новый пароль .env не меняет пароль уже созданного volume; не удалять volume ради исправления |
| health 200, ready 503 | БД/пользователь/пароль/порт не готовы; health не проверяет PostgreSQL |
| ready 200, services 500 | Проверить применение опубликованных миграций; ready не проверяет всю схему каталога |
| ECONNREFUSED / ENOTFOUND | Явный DJANGO_API_ORIGIN, локальный Django, сеть; production и Demo автоматически не подставлять |
| 400 DisallowedHost | Фактический Host proxy и ALLOWED_HOSTS, без wildcard обхода |
| 308/HTML/неожиданный redirect вместо JSON | Trailing slash, нужный процесс/порт, proxy destination; проверять с Accept JSON |
| me/registration 403 до входа | Ожидаемая защита. После входа — проверить session cookie в том же браузере |
| 403 на запись | `/me/`, затем свежий CSRF, cookie, Origin с портом 3002 и полный approved trusted list; не отключать защиту и не повторять автоматически |
| Cookie теряется | Один браузерный host, HttpOnly/Secure/SameSite, HTTPS для защищённой среды, отдельный browser profile; проверить Telegram Web отдельно |
| auth/options false / login 503 | Не готова Telegram-конфигурация, login не подтверждён. Поддельная initData не решение |
| Mini App 401 / OIDC state истёк | Подлинность и свежесть данных, системные часы и новый запуск из Telegram/через start; не растягивать сроки и не логировать raw данные |
| Form отсутствует в production | Действующий gate, а не сбой Django; не открывать автоматически |
| Пустые services/specializations | Допустимые реальные ответы, UI не должен выдавать Demo или выдуманные специализации |
| Avatar 400/404/403 | Формат PNG/JPEG/WebP, лимит 5 МиБ и Backend-лимиты декодирования, сессия/CSRF, private route и media permissions; Next optimizer не должен терять cookie |
| .next/dev/lock / порт 3002 занят | Остановить свой Demo в его терминале; неизвестный lock/PID не удалять и не завершать |

## 11. Ответственность, проверки и Git

Самостоятельно в рамках анализа: читать опубликованные контракты, проверять пути/версии, готовить документацию. После отдельного разрешения и передачи подготовленного окружения Frontend может запустить свой Live на 3002, проверить GET/proxy/UI и выполнить согласованные тестовые сценарии.

Сотрудник/PO должны согласовать копию, БД/project/ports, создание приватной конфигурации, применение опубликованных миграций, seed/аккаунты, media и тестовый HTTPS/Telegram. Изменения серверного кода/миграций/правил остаются у Backend-разработчика. Установка инструментов сейчас не нужна по результатам PATH/версий, но Engine и установка зависимостей ещё не подтверждены.

Фактически выполнено: чтение перечисленных источников и Frontend-кода, системные часы/версии, Git-инвентаризация, `git fetch origin`, сравнение Backend/handoff, policy diff с `origin/codex/frontend-main-dev` (пусто), сравнение Integration с remote (0/0), подготовка этого отчёта и индекса. Первая fetch-попытка получила sandbox EPERM на общий FETCH_HEAD; разрешённый повтор завершился успешно. Это ограничение доступа инструмента, не ошибка репозитория.

| Проверка / действие | Фактический результат текущего сеанса |
|---|---|
| cwd, Git root, branch, HEAD, worktree list | Соответствуют назначению Integration; соседние каталоги не редактировались |
| Python/Docker CLI/Compose/Node/npm versions | Выполнена; результаты в разделе 2 |
| Backend-копия, установка, `.env`, Docker Engine/БД, migrate/seed | Не запускалась |
| Direct/proxy API, Demo/Live, Telegram, регистрация/avatar E2E | Не запускалась |
| TypeScript, ESLint, build, Frontend/Backend автотесты | Не запускалась |
| Проверка Markdown-ссылок и diff | 37 ссылок проверены, включая 10 Backend-путей на точном SHA; ошибок нет. `git diff --check` прошёл |

Создан: `documents/project/для отчетов/frontend/api-integration/2026-10-19_00-44_django-live-plan.md`. Изменён: индекс `documents/project/для отчетов/README.md`. Сохранён без изменений предыдущий незакоммиченный отчёт и его запись в индексе. Удалённых файлов нет. Программный код, дизайн, apps/api, env, зависимости и lock-файлы не менялись.

Commit/push/merge не выполнялись; HEAD не менялся. Запрос сотруднику подготовлен, не отправлен. Следующее действие — передать ему раздел 9 и получить несекретные ответы; анализ на этом останавливается.

Окончание анализа и проверки документации: **19.10.2026, 00:48:18 Europe/Moscow**, системные часы. Рабочее дерево содержит только изменённый индекс и два новых отчёта (предыдущая и текущая задачи); кодовых изменений нет. HEAD `1888b91`, Integration и remote совпадают (0/0 на проверке после fetch).
