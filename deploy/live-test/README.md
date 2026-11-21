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

Плановый адрес — **https://live-test.studly-help.ru**; A-запись должна указывать на 153.76.172.88. До подтверждения DNS/сертификата адрес не считается работающим. Отдельные users `studly-live`/`studly-live-web`, DB/role `studly_live_test_bank`, окружение `/etc/studly-live/api.env` (root:studly-live 0640, каталог0750; приложение читает свой env, Frontend не имеет доступа), данные `/var/lib/studly-live/live-test-media`, релизы `/opt/studly-live/releases/<SHA>` и `/opt/studly-live-web/releases/<Frontend SHA>`. Production `/opt/studly/current`, `/opt/studly-web/current`, DB `studly` и их окружение не переключать.

Шаблоны рядом: отдельные systemd units и Nginx vhost. Для серверного env: DEBUG=false, новый DJANGO_SECRET_KEY, ALLOWED_HOSTS=live-test.studly-help.ru, trusted origin=https://live-test.studly-help.ru, DB port5432 с отдельной ролью/БД, отдельные MEDIA_ROOT/STATIC_ROOT. STUDLY_ENV_FILE должен указывать на этот же приватный файл. Frontend собирать с `NEXT_PUBLIC_STUDLY_DATA_MODE=live`; `/api/` Nginx направляет прямо в отдельный Gunicorn socket, Next слушает только 127.0.0.1:3002. Доступ к `/media/` и Django `/admin/` снаружи закрыт, индексация запрещена.

Порядок установки: создать выделенные пустые ресурсы/секреты → разместить проверенный SHA → установить закреплённые зависимости → `check`, `migrate --plan`, полный `migrate`, `collectstatic`, seed → проверить units и локальные health/ready → после верной DNS выпустить отдельный сертификат webroot → `nginx -t` → reload → HTTPS/CSRF smoke. Не включать HTTPS-конфиг с отсутствующим сертификатом. Не отключать проверку TLS. Не выполнять эти шаги на рабочей БД. Остановка/возврат тестового релиза не удаляет данные автоматически.

Для HTTPS cookie-файл выпускать с `--host live-test.studly-help.ru` непосредственно на стенде и хранить приватно. Настройки задают отдельные имена session/CSRF cookies, Secure при DEBUG=false, HttpOnly и SameSite=Lax. В отчёте показывать только признаки cookie, не значения.

## Telegram и границы приёмки

Настоящий вход требует отдельного согласованного окружения для реальных тестировщиков: собственный тестовый бот, Mini App HTTPS URL; для сайта — отдельные OIDC Client ID/Client Secret, зарегистрированные origin и точный `/api/v1/auth/telegram/callback/`. Bot API token не заменяет OIDC secret. Synthetic-only конфигурация специально отвергает эти credentials: не ослаблять её, чтобы выдать фикстуру за настоящий Telegram login. Переход к настоящим идентификаторам, юридическим согласиям и retention согласовывается отдельно.

При совместной проверке: чистый профиль браузера → auth/options → CSRF GET → настоящий login → новый CSRF после login → auth/me → приватные чтения/записи → reload → logout → отказ прежней сессии. Дополнительно два аккаунта/вкладки, неверный Origin, истёкшая сессия и Telegram iOS/Android/Desktop/Web. Cookie из HTTP localhost не доказывают Secure/SameSite в Telegram. Реальная оплата, paid/completed, выплаты и документы действующего оператора не включаются.

Ранее выявленный риск пропуска released message при конкурентной cursor pagination остаётся отдельной незавершённой задачей. Последовательные проверки чата и успешный suite не доказывают устранение этой гонки. В этой подготовке алгоритм sequence не изменялся.
