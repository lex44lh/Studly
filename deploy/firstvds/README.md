# Первый запуск Backend STUDLY

План: [SERVER_DEPLOYMENT_PLAN.md](../../SERVER_DEPLOYMENT_PLAN.md). Эта папка содержит инфраструктуру Backend; Frontend не меняется. Действительное состояние размещения фиксируется в [SERVER_SETUP.md](../../SERVER_SETUP.md).

## Состав

- `requirements-production.txt` в `apps/api` добавляет Gunicorn к существующим фиксированным зависимостям Backend.
- `studly-api.service` запускает два процесса Gunicorn от `studly-api`, автоматически перезапускает их после сбоя и создаёт закрытый рабочий каталог.
- `api.env.example` описывает отдельное серверное окружение. Настоящий файл `/etc/studly/api.env` читается systemd, в Git не попадает.
- `studly-http.conf` обслуживает только HTTP-проверку сертификата и переход на HTTPS. `studly-https.conf` включается после получения сертификата.
- `studly-api-proxy.conf` направляет запросы в Unix-сокет и заменяет заголовки HTTPS/IP. Прямой публичный порт Gunicorn не открывается.

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

Пока согласованная версия Frontend не размещена, HTTPS-корень отвечает 503. `/api/` и `/admin/` обслуживает Django. В Nginx access log не записываются параметры URL с OAuth code/state; access log Gunicorn по умолчанию выключен.

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
