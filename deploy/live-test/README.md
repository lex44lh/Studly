# STUDLY: изолированный Live для совместной проверки

Подготовка от 21 ноября 2026. Это **реальный Django API с синтетическими данными**, не Demo-хранилище Frontend и не проверка банка/настоящего Telegram. Основные адреса и рабочая БД не заменяются.

Frontend зафиксирован: `codex/frontend-legal-demo`, **6c592011ac9d07367befb877e616ec8982d63cd0**. Его исходники/lock-файл не исправлять. В Live `getApprovedLegalPublication()` возвращает `null`; `/rules` сообщает, что документы готовятся. Черновики доступны только в Demo. Оператор, реквизиты, версии и даты документов должны прийти отдельным утверждённым пакетом владельца/юриста.

## Воспроизводимый запуск на Mac

Нужны Python 3.13, Docker Desktop, Node 24 и отдельная копия Backend этой ветки. Ничего не запускать из основного рабочего дерева Downloads. Команды ниже — из корня Backend, кроме явно указанного `cd`.

```sh
python3.13 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements-production.txt
mkdir -p /private/tmp/studly-live-test
cp -n deploy/live-test/.env.example /private/tmp/studly-live-test/local.env
chmod 600 /private/tmp/studly-live-test/local.env
```

В новом приватном `local.env` заменить POSTGRES_PASSWORD своим случайным тестовым паролем. Существующий файл не перезаписывать. Для первого создания можно использовать `secrets.token_urlsafe(24)` локальным скриптом, не отправляя значение в Git/чат. `.env.example` не содержит действующих секретов. Ничего не копировать из production `.env`. Проверить свободный порт: `lsof -nP -iTCP:55432 -sTCP:LISTEN`; если занят, выбрать другой порт и изменить только приватный POSTGRES_PORT. В выполненной проверке использовался **55439**; чужой 55432 не освобождался.

```sh
export STUDLY_ENV_FILE=/private/tmp/studly-live-test/local.env
export DJANGO_SETTINGS_MODULE=config.live_test
docker compose --env-file "$STUDLY_ENV_FILE" -f deploy/live-test/compose.yaml up -d --wait db
apps/api/.venv/bin/python apps/api/manage.py check
apps/api/.venv/bin/python apps/api/manage.py migrate --plan
apps/api/.venv/bin/python apps/api/manage.py migrate --noinput
apps/api/.venv/bin/python apps/api/manage.py migrate --check
apps/api/.venv/bin/python apps/api/manage.py seed_live_test
apps/api/.venv/bin/python apps/api/manage.py runserver 127.0.0.1:8002 --noreload
```

Compose имеет отдельный project/volume `studly-live-test`; порт опубликован только на loopback. `config.live_test` требует отдельный существующий env-файл, DB/role с префиксом `studly_live_test`, отдельный `live-test-media` и явный synthetic-only opt-in. ЮKassa и Telegram credentials запрещены, включая унаследованные из родительского окружения. Не подменять эту конфигурацию production-настройками.

Во второй вкладке подготовить **отдельную** копию Frontend:

```sh
git clone --branch codex/frontend-legal-demo --single-branch https://github.com/lex44lh/Studly.git /private/tmp/studly-frontend-live
git -C /private/tmp/studly-frontend-live switch --detach 6c592011ac9d07367befb877e616ec8982d63cd0
cd /private/tmp/studly-frontend-live
npm ci --no-audit --no-fund
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_STUDLY_DATA_MODE=live DJANGO_API_ORIGIN=http://127.0.0.1:8002 npm run build -w apps/web
NEXT_TELEMETRY_DISABLED=1 npm run start -w apps/web -- --hostname 127.0.0.1 --port 3002
```

Открыть `http://127.0.0.1:3002/search`: одна явно помеченная `[ТЕСТ]` услуга поступает из настоящей PostgreSQL. Вход по Telegram честно недоступен. Не включать Demo для обхода ошибки Live. Обычный seed_demo_catalog не подходит: его услуги имеют `is_demo=true` и не заказываются.

## Синтетические сессии и проверка API

Fixtures создают buyer/performer/moderator/outsider без настоящего Telegram ID, usable password и superuser. Модератор имеет только три профильных permissions. Создание fixtures не доказывает реальное прохождение регистрации/модерации. Повторный seed не перезаписывает изменённые данные; коллизии actor/ownership отклоняются. Публичного test-login нет.

Из корня Backend в третьем терминале, с теми же STUDLY_ENV_FILE и DJANGO_SETTINGS_MODULE:

```sh
apps/api/.venv/bin/python apps/api/manage.py live_test_session --actor buyer --host 127.0.0.1 --cookie-file /private/tmp/studly-live-test/buyer.cookies
apps/api/.venv/bin/python scripts/live_test_smoke.py --base-url http://127.0.0.1:3002 --cookie-file /private/tmp/studly-live-test/buyer.cookies --service-id 1
```

ID услуги взять из JSON seed, не предполагать `1` в уже использованном стенде. Cookie-файл — **секрет**, права 0600, HttpOnly, срок сессии час; не коммитить, не прикладывать к отчёту и не пересылать. Повторная команда не перезапишет файл. Для новой сессии выбрать новое имя. Smoke проверяет auth, отсутствие CSRF, чужой Origin, успешные quote/order, повтор намерения и conversation; создаёт только синтетический неоплаченный заказ. Секреты/токены в вывод не попадают. Полная UI-интеграция авторизованных форм — отдельный совместный шаг.

## Порядок миграций и проверки

Использовать полный `migrate` с чистой БД; вручную переставлять приложения нельзя. Ключевой граф: accounts.0004 → catalog.0005 → orders.0003–0004 → conversations.0001–0004; operations.0001 и встроенные auth/admin/sessions также обязательны. orders.0004 создаёт версии тарифов 3%/5%; conversations backfill не пересчитывает прежние денежные снимки. Никаких production-миграций этой подготовкой не разрешено.

```sh
cd apps/api
STUDLY_ENV_FILE=/private/tmp/studly-live-test/local.env .venv/bin/python manage.py test --settings=config.settings --noinput --verbosity 1
STUDLY_ENV_FILE=/private/tmp/studly-live-test/local.env .venv/bin/python manage.py makemigrations --check --dry-run --settings=config.settings
.venv/bin/python -m pip check
```

Запускать suite из **apps/api**: существующие subprocess-тесты production требуют этого рабочего каталога. Django создаёт отдельную `test_studly_live_test`; не использовать рабочую БД или `--keepdb` чужой сессии. Перед production потребуются независимые копии PostgreSQL и MEDIA_ROOT с восстановлением; откат кода не является откатом схемы.

## Тестовый HTTPS

Адрес стенда — [live-test.studly-help.ru](https://live-test.studly-help.ru/search). A-запись Timeweb указывает на `153.76.172.88`. У стенда отдельный сертификат Let's Encrypt, действительный до 19.02.2027, и включённое продление через `certbot.timer`. Отдельные пользователи `studly-live` и `studly-live-web`, БД и роль `studly_live_test_bank`, окружение `/etc/studly-live/api.env` (root:studly-live 0640, каталог 0750, Frontend не имеет доступа), файлы `/var/lib/studly-live/live-test-media`, релизы `/opt/studly-live/releases/<SHA>` и `/opt/studly-live-web/releases/<Frontend SHA>`. При обновлении стенда сохранять рабочие `/opt/studly/current`, `/opt/studly-web/current`, БД `studly` и их окружение.

Шаблоны рядом: отдельные systemd units и Nginx vhost. Для серверного env: DEBUG=false, новый DJANGO_SECRET_KEY, ALLOWED_HOSTS=live-test.studly-help.ru, trusted origin=https://live-test.studly-help.ru, DB port5432 с отдельной ролью/БД, отдельные MEDIA_ROOT/STATIC_ROOT. STUDLY_ENV_FILE должен указывать на этот же приватный файл. Frontend собирать с `NEXT_PUBLIC_STUDLY_DATA_MODE=live`; `/api/` Nginx направляет прямо в отдельный Gunicorn socket, Next слушает только 127.0.0.1:3002. Доступ к `/media/` и Django `/admin/` снаружи закрыт, индексация запрещена.

Порядок установки: создать выделенные пустые ресурсы/секреты → разместить проверенный SHA → установить закреплённые зависимости → `check`, `migrate --plan`, полный `migrate`, `collectstatic`, seed → проверить units и локальные health/ready → после верной DNS выпустить отдельный сертификат webroot → `nginx -t` → reload → HTTPS/CSRF smoke. Не включать HTTPS-конфиг с отсутствующим сертификатом. Не отключать проверку TLS. Не выполнять эти шаги на рабочей БД. Остановка/возврат тестового релиза не удаляет данные автоматически.

Для HTTPS cookie-файл выпускать с `--host live-test.studly-help.ru` непосредственно на стенде и хранить приватно. Настройки задают отдельные имена session/CSRF cookies, Secure при DEBUG=false, HttpOnly и SameSite=Lax. В отчёте показывать только признаки cookie, не значения.

## Telegram и границы приёмки

### Вход двух участников для совместного прогона

После установки версии с email-входом и включения флага на стенде оператор один раз создаёт обычные аккаунты `live-buyer` и `live-performer` и услугу `[ТЕСТ] Консультация для совместного прогона`. Команда `seed_live_email_testers --settings=config.live_test --credentials-file /абсолютный/приватный/каталог/accounts.json` записывает разные пароли в новый файл 0600. Каталог должен иметь права 0700. Передавайте каждому участнику только его данные по закрытому каналу. Пароли и session cookie не публикуйте в чате, Git или в отчёте.

Пользователь открывает `/api/v1/auth/live-test/sign-in/` на том же HTTPS-origin. После входа он попадёт в каталог с настоящей серверной сессией. Используйте два отдельных профиля браузера. Заказчик открывает тестовую услугу и создаёт неоплаченный заказ. Исполнитель находит этот заказ, проверяет карточку и переписку. Оба записывают результат и выходят. Формы продуктовой регистрации, чтение ссылки и сброс пароля добавляет разработчик Frontend по [контракту](../../REGISTRATION_API.md#регистрация-и-вход-по-email).

### Тестовые письма для нового API

Создайте новый закрытый каталог outbox с правами 0700, доступный только пользователю тестовой службы. В отдельном env включите `STUDLY_EMAIL_AUTH_ENABLED=true`, задайте `STUDLY_EMAIL_TEST_OUTBOX` абсолютным путём к каталогу и `STUDLY_EMAIL_ACTION_URL` адресом интерфейса. На HTTPS-стенде для прогона API до появления формы используйте `https://live-test.studly-help.ru/search`. На Mac доступен loopback-адрес из `.env.example`. Разрешён только домен получателя `example.test`. На стенде действует файловый backend Django. Получение почты идёт через закрытый каталог, без исходящего SMTP.

После полного `migrate` активируйте только тестовый `studly-live-email.timer`. Он вызывает `manage.py deliver_email_auth --settings=config.live_test`. Для локального теста выполните эту команду вручную после каждого `202` перед чтением письма. В журнал попадают счётчики отправленных и отложенных писем. В outbox лежит содержимое писем, включая одноразовые ссылки. Ограничьте просмотр оператором и удалите тестовые письма после прогона. На сервере используйте `/var/lib/studly-live/email-outbox` согласно systemd-шаблону.

На Mac прошёл 271 тест Backend на отдельной PostgreSQL 17. Дополнительно через локальный HTTP проверены доставка письма в файловый outbox, подтверждение регистрации, вход по обоим идентификаторам, сброс пароля с отзывом старой сессии и форма входа двух участников с неоплаченным заказом. Внешний HTTPS для этой версии проверяется после обновления стенда.

Настоящий вход требует отдельного согласованного окружения для реальных тестировщиков: собственный тестовый бот, Mini App HTTPS URL; для сайта — отдельные OIDC Client ID/Client Secret, зарегистрированные origin и точный `/api/v1/auth/telegram/callback/`. Bot API token не заменяет OIDC secret. Synthetic-only конфигурация специально отвергает эти credentials: не ослаблять её, чтобы выдать фикстуру за настоящий Telegram login. Переход к настоящим идентификаторам, юридическим согласиям и retention согласовывается отдельно.

При совместной проверке: чистый профиль браузера → auth/options → CSRF GET → настоящий login → новый CSRF после login → auth/me → приватные чтения/записи → reload → logout → отказ прежней сессии. Дополнительно два аккаунта/вкладки, неверный Origin, истёкшая сессия и Telegram iOS/Android/Desktop/Web. Cookie из HTTP localhost не доказывают Secure/SameSite в Telegram. Реальная оплата, paid/completed, выплаты и документы действующего оператора не включаются.

Ранее выявленный риск пропуска released message при конкурентной cursor pagination остаётся отдельной незавершённой задачей. Последовательные проверки чата и успешный suite не доказывают устранение этой гонки. В этой подготовке алгоритм sequence не изменялся.

## Фактически выполнено 21 ноября 2026

- Backend `aba56191aabbd21901feacc552d134bb7aae8232`: 244/244 теста на отдельной PostgreSQL17/macOS; `check`, отсутствие новых миграций, `pip check`, `git diff --check` успешны. Запуск suite из корня не является корректной процедурой: subprocess-тестам нужен apps/api; окончательный полный запуск выполнен именно оттуда.
- [GitHub CI](https://github.com/lex44lh/Studly/actions/runs/44942327045) успешен для Python3.12/PostgreSQL16 и Python3.13/PostgreSQL17: установка, Gunicorn config, миграции с нуля, tests.
- Frontend SHA6c59201: production Webpack build, TypeScript, 393/393 tests, lint0ошибок/2 прежних img warnings. Хеши180 исходных файлов после локальных установки/сборки/тестов совпали. Linux-сборка на VPS также прошла без изменения исходных файлов.
- Mac: Next3002 → Django8002 → отдельная PostgreSQL55439. Browser `/search` показал синтетическую услугу из API; карточка сохранила Live и сообщила об отсутствии Telegram-настройки; `/rules` показал «Документы готовятся к публикации»; console errors в проверенных страницах отсутствовали.
- Через настоящий Next proxy выполнены auth/me, CSRF GET, отказ POST без CSRF и с чужим Origin, quote105.00 RUB, неоплаченный order и идемпотентный повтор, conversation. Это synthetic API E2E, не настоящий Telegram/банковский платёж/полный приватный browser E2E.
- На VPS отдельно созданы тестовые пользователи, БД, хранилище файлов, окружение и службы. `systemd-analyze verify` успешен, обе службы активны, внутренних перезапусков нет. API readiness и Next.js ответили HTTP 200. Рабочий API также ответил HTTP 200, ссылки на рабочие релизы сохранены.
- Security reviewer статически проверил границы prod/test и CLI-сессий; замечания об унаследованных Telegram credentials и коллизии synthetic actor исправлены с отрицательными тестами. Это не юридическая приёмка.

## Внешний HTTPS 22 ноября 2026

- Все четыре авторитетных DNS-сервера Timeweb подтвердили A-запись. Выпущен отдельный сертификат Let's Encrypt для тестового виртуального хоста. Проверки `nginx -t` и `certbot renew --cert-name live-test.studly-help.ru --dry-run --non-interactive` прошли. С Mac каталог ответил HTTP 200 с обычным разрешением DNS. Внешние проверки дали HTTP 200 из трёх сетей на каждом адресе. [API readiness](https://check-host.net/check-report/59a07c85kc0e), [каталог тестового стенда](https://check-host.net/check-report/59a07c9dk84f), [рабочий API](https://check-host.net/check-report/59a07cb4k783).
- Синтетическая сессия с `config.live_test` прошла по публичному HTTPS. Проверены `Secure`, `HttpOnly`, `SameSite=Lax` у CSRF-cookie, отказ без CSRF и с чужим Origin, расчёт стоимости, неоплаченный заказ, повтор с тем же ключом и чтение переписки. Без сессии профиль ответил HTTP 403, `/media/` ответил 404. [Настоящий Telegram-вход](#telegram-и-границы-приёмки) остаётся отдельным этапом.
