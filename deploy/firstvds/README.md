# Размещение STUDLY на FirstVDS

Планы: [Backend](../../SERVER_DEPLOYMENT_PLAN.md), [публикация Frontend](../../FRONTEND_DEPLOYMENT_PLAN.md). Эта папка содержит инфраструктуру сервера; исходники Frontend не меняются. Действительное состояние размещения фиксируется в [SERVER_SETUP.md](../../SERVER_SETUP.md).

## Состав

- `requirements-production.txt` в `apps/api` добавляет Gunicorn к существующим фиксированным зависимостям Backend.
- `studly-api.service` запускает два процесса Gunicorn от `studly-api`, автоматически перезапускает их после сбоя и создаёт закрытый рабочий каталог.
- `api.env.example` описывает отдельное серверное окружение. Настоящий файл `/etc/studly/api.env` читается systemd, в Git не попадает.
- `studly-http.conf` обслуживает только HTTP-проверку сертификата и переход на HTTPS. `studly-https.conf` — общий vhost сайта и API, включается после получения сертификата и подготовки обеих служб/snippets.
- `studly-api-proxy.conf` направляет запросы в Unix-сокет и заменяет заголовки HTTPS/IP. Прямой публичный порт Gunicorn не открывается.
- `studly-certbot-deploy.sh` после успешного обновления сертификата проверяет Nginx и перечитывает его конфигурацию. На VPS устанавливается с правами `0755` в `/etc/letsencrypt/renewal-hooks/deploy/studly-nginx-reload`; одного обновления файлов сертификата недостаточно для их подхвата работающим Nginx.
- `studly-web.service` запускает production Next.js от отдельного пользователя на `127.0.0.1:3000`; `studly-web-proxy.conf` направляет к нему страницы. API/admin и приватные данные остаются у Django.

## Каталоги и база данных

На проверенном VPS используются системные Python 3.12 и PostgreSQL 16 из Ubuntu 24.04. Совместимость обеих пар Python/PostgreSQL (3.12/16 и прежней 3.13/17) проверяет GitHub CI. MySQL и веб-серверы ispmanager не заменяются.

Код отдельного проверенного коммита располагается в `/opt/studly/releases/<полный SHA>`, ссылка `/opt/studly/current` выбирает версию. Окружение Python — `/opt/studly/venv`. Из Git переносится Backend и эта папка; локальные `.env`, БД и пользовательские загрузки не переносятся.

Перед первым запуском создаются системный пользователь `studly-api`, база `studly` и отдельная роль `studly_api` без прав суперпользователя, создания ролей или баз. PostgreSQL слушает localhost. Для Django и БД генерируются разные случайные секреты прямо на сервере. Повторный запуск не должен перезаписывать окружение или существующую БД.

Пути данных независимы от версии кода:

- `/var/lib/studly-api/avatars` — приватные аватары; каталог данных доступен только пользователю приложения, публичного Nginx alias нет.
- `/srv/studly/static` — результат `collectstatic`, доступный Nginx. Production-префикс — `/django-static/`.
- `/etc/studly/api.env` — секреты, `root:root`, `0600`, родительский каталог `0700`.

## Подготовка и проверки

Ниже команды запускаются администратором **после** создания окружения, БД, каталогов, установки зависимостей и размещения нужного коммита. Значения секретов в команды не подставляются.

```sh
systemd-run --unit=studly-api-migrate --wait --collect --property=User=studly-api --property=Group=www-data --property=EnvironmentFile=/etc/studly/api.env --working-directory=/opt/studly/current/apps/api /opt/studly/venv/bin/python manage.py migrate --noinput
systemd-run --unit=studly-api-static --wait --collect --property=User=studly-api --property=Group=www-data --property=EnvironmentFile=/etc/studly/api.env --working-directory=/opt/studly/current/apps/api /opt/studly/venv/bin/python manage.py collectstatic --noinput
systemd-analyze verify /etc/systemd/system/studly-api.service
systemctl daemon-reload
systemctl enable --now studly-api.service
```

Проверка закрытого сокета выполняется от пользователя Nginx. Здесь заголовок HTTPS выставляется администратором только для внутренней проверки; это не проверка настоящего TLS:

```sh
runuser -u www-data -- curl --fail-with-body --unix-socket /run/studly-api/api.sock -H 'Host: studly-help.ru' -H 'X-Forwarded-Proto: https' http://localhost/api/v1/health/
runuser -u www-data -- curl --fail-with-body --unix-socket /run/studly-api/api.sock -H 'Host: studly-help.ru' -H 'X-Forwarded-Proto: https' http://localhost/api/v1/ready/
```

Перед включением конфигурации изучаются `nginx.conf`, подключённые vhost и список сайтов ispmanager. На проверенном сервере подключается `/etc/nginx/conf.d/*.conf`. Файлы STUDLY устанавливаются туда под отдельными именами; существующие конфигурации панели сохраняются. Не создавать дублирующий сайт `studly-help.ru` через панель.

При наличии DNS A → `153.76.172.88` сертификат можно получить Certbot с webroot `/var/lib/letsencrypt`. Плагин автоматического изменения Nginx не обязателен. Перед каждым reload обязателен `nginx -t`; HTTPS-конфигурация с отсутствующим сертификатом не включается. Успешный выпуск, таймер обновления и `renew --dry-run` проверяются отдельно, а не считаются выполненными по наличию файлов в Git.

Перед выпуском проверить также AAAA: если рабочий IPv6 на VPS не настроен, неправильная AAAA должна отсутствовать. Доступность webroot проверяется снаружи через временный несекретный файл в `/.well-known/acme-challenge/`. Затем выдаётся сертификат только для `studly-help.ru`, включается подготовленный HTTPS-vhost, устанавливается deploy-hook и выполняется `certbot renew --cert-name studly-help.ru --dry-run --run-deploy-hooks`. Эта проверка использует тестовый центр сертификации и запускает hook с действующим сертификатом; успешный результат нужно зафиксировать отдельно.

Результат установки hook и настоящего HTTPS смотрите в [SERVER_SETUP.md](../../SERVER_SETUP.md). Наличие этого скрипта в репозитории само по себе не подтверждает их включение.

Текущий HTTPS-vhost требует запущенный Frontend и установленный `studly-web-proxy.conf`. При размещении только API вместо его корневого location используется заглушка `return 503`; старый вариант сохранён на действующем VPS как описано в `SERVER_SETUP.md`. `/api/` и `/admin/` обслуживает Django. В Nginx access log не записываются параметры URL с OAuth code/state; access log Gunicorn по умолчанию выключен.

## Frontend без изменений исходников

На действующем VPS установлен Node.js `24.22.0` из официального архива с проверенным SHA-256; ссылка `/opt/studly/node` ведёт на версионный каталог runtime. Frontend выбирается отдельно по полному SHA из ветки его автора. Релиз размещается в `/opt/studly-web/releases/<SHA>`, `current` выбирает сборку. Backend и Frontend не обязаны иметь один SHA; их рабочие директории не смешиваются.

В новую папку из зафиксированного архива извлекаются root `package.json`, `package-lock.json`, `apps/web` и при появлении импортов — согласованные workspace-пакеты. Локальные `.env`, `.next`, `node_modules` и тестовые данные не копируются. До установки снимаются SHA-256 исходных файлов. В релизе выполняются от отдельного непривилегированного пользователя:

```sh
npm ci --no-audit --no-fund
npm run lint -w apps/web
npm run test -w apps/web
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_STUDLY_DATA_MODE=api DJANGO_API_ORIGIN=https://studly-help.ru NODE_OPTIONS=--max-old-space-size=1536 npm run build -w apps/web
```

Это команды после подготовки пользователя и runtime; его `bin` должен быть в PATH. `npm ci` использует имеющийся lock-файл, без обновления версий. Параметры публичного режима и rewrite задаются уже при сборке. Регистрация остаётся под production gate автора; `NODE_ENV=development` для публикации не используется. Тестовая HTTP-фикстура Frontend не запускается.

После успешной сборки и сверки исходных SHA-256 код передаётся `root:root`. Только `apps/web/.next/cache` принадлежит `studly-web` и доступен для записи. Устанавливаются unit и proxy-snippet, `systemd-analyze verify` проверяет unit, затем включается служба. До переключения Nginx Next должен отдавать главную `200` локально, а `ss` — показывать только `127.0.0.1:3000`. Существующий vhost сохраняется вне `/etc/nginx/conf.d`, проверяются `nginx -t` и reload. Прямой Node-порт наружу не открывается, CORS не ослабляется.

Для обновления сначала собирается отдельный новый SHA. После проверок атомарно переключается `current`, перезапускается `studly-web`, выполняется HTTPS/browser smoke. При ошибке возвращается предыдущая ссылка и процесс; если менялся Nginx, возвращается сохранённый vhost с обязательными `nginx -t` и reload. Старые релизы и БД автоматически не удаляются. Ошибки исходников передаются в `FRONTEND_ISSUES.md` автору.

## Что остаётся перед настоящим использованием

Для Telegram OIDC владелец должен зарегистрировать origin и callback в BotFather и записать отдельные Client ID/Client Secret в серверное окружение. Bot API token не заменяет OIDC Client Secret. Пока поля Telegram пустые, вход недоступен; тестовые пользователи и администратор автоматически не создаются.

До приёма настоящих пользовательских данных требуется внешнее резервное копирование PostgreSQL и аватаров и проверка восстановления. Локальный VPS не является независимой резервной копией. Платежи остаются отложенными.

## Обновление и возврат версии

1. Выбрать новый полный SHA с успешным CI, сохранить прежний SHA и подготовить резервную копию БД.
2. Разместить новую версию отдельно, проверить зависимости и план миграций. Общие данные и окружение не заменять.
3. Выполнить необходимые миграции и `collectstatic`, переключить ссылку `current`, перезапустить сервис и проверить health/ready.
4. При ошибке вернуть ссылку на предыдущую совместимую версию и зависимости. Откат кода не откатывает миграции и данные: совместимость проверяется отдельно, автоматического сброса БД нет.

HSTS установлен на один час без `includeSubDomains` и `preload`. Эти два расширения не включены до проверки всех поддоменов; соответствующие рекомендации `check --deploy` фиксируются явно.

Источники: [Gunicorn — deployment](https://gunicorn.org/deploy/), [Django 5.2 — deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [Timeweb — DNS](https://timeweb.com/ru/docs/domeny/resursnye-zapisi-domena-dns-zapisi/nastrojka-dns-zapisej/).
