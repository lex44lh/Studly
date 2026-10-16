# STUDLY

Backend регистрации: [контракт для Frontend](REGISTRATION_API.md), [OpenAPI](docs/registration.openapi.json), [план](REGISTRATION_PLAN.md). Роли, профиль, черновик и аватар реализованы на сервере; проверка реальной браузерной интеграции с другом ещё предстоит.

Платформа образовательных услуг. Frontend разрабатывается отдельно в `apps/web`; Backend — в `apps/api`. Материалы текущего серверного этапа находятся в ветке `codex/backend`.

## Для подключения Frontend

Начать с [API_CONTRACT.md](API_CONTRACT.md): действующие маршруты, JSON, сессия, CSRF, ошибки и последовательность действий. Согласованный API использует ID из PostgreSQL; статические ID и localStorage прототипа не являются серверными заказами.

| Материал | Что внутри |
|---|---|
| [API_CONTRACT.md](API_CONTRACT.md) | Контракт для разработчика Frontend |
| [RUN_LOCAL.md](RUN_LOCAL.md) | Запуск и просмотр в Safari/PyCharm |
| [apps/api/README.md](apps/api/README.md) | Настройки, зависимости и устройство Backend |
| [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) | Что осталось настроить для настоящего Telegram-входа |
| [FRONTEND_ISSUES.md](FRONTEND_ISSUES.md) | Замечания по текущему Frontend |
| [BACKEND_NEXT.md](BACKEND_NEXT.md) | Выполненные этапы и следующие задачи |
| [BACKEND_CI_PLAN.md](BACKEND_CI_PLAN.md) | Автоматические проверки Backend в GitHub и чтение результатов |
| [ORDERS_PLAN.md](ORDERS_PLAN.md) | Согласованные правила и границы заказов |
| [ORDERS_UNPAID_PLAN.md](ORDERS_UNPAID_PLAN.md) | Отмена заказчиком и отказ исполнителя до оплаты |
| [PAYMENTS_PLAN.md](PAYMENTS_PLAN.md) | Требования к оплате и открытые вопросы |
| [PAYMENT_PROVIDER_QUESTIONS.md](PAYMENT_PROVIDER_QUESTIONS.md) | Подготовленные вопросы провайдеру; не отправлялись |
| [YOOKASSA_SETUP.md](YOOKASSA_SETUP.md) | Тестовый доступ ЮKassa и серверная команда сверки |

## Что работает на Backend

- Обработчики входа Telegram Mini App и сайта через OIDC, общий пользователь, серверная сессия, профиль и выход. Настоящий вход требует внешней настройки и пока не проверен с реальным пользователем.
- Каталог PostgreSQL: поиск, постраничный вывод, детали и публичные профили. Четыре демонстрационные услуги явно помечены `is_demo`.
- Создание и исправление собственных услуг, повторная модерация и решения модератора в Django Admin.
- Предварительный расчёт надбавки заказчика 3% с точным округлением до копеек.
- Оформление заказа со снимком условий, личный список и детали, согласие исполнителя. После согласия заказ ожидает оплаты. Заказчик может отменить до оплаты, исполнитель — отказаться до своего согласия; история сохраняется.
- Серверная диагностика тестовой ЮKassa: проверка магазина и сверка существующего платежа с заказом без изменения БД. Доступ к тестовой площадке ещё не получен.

Платёжный провайдер, выполнение и завершение заказов, сообщения, баланс и выплаты ещё не подключены. Автоматические статусы, рейтинг и комиссия исполнителя отложены до отдельного согласования. Frontend пока использует демонстрационные данные и localStorage; подключение его страниц к API выполняет разработчик Frontend.

## Первый запуск Backend на macOS/Linux

Нужны Python 3.13 и работающий Docker Desktop с Compose. Секреты и виртуальное окружение в Git не входят. Команды выполняются из корня репозитория.

```bash
python3.13 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements.txt
```

Только в новой копии, если `apps/api/.env` ещё отсутствует, создать его из [примера](apps/api/.env.example). Существующий `.env` не перезаписывать. Задать свой `POSTGRES_PASSWORD`; настройки Telegram заполняются отдельно. Реальные токены и пароли не отправлять в Git.

```bash
docker compose --env-file apps/api/.env up -d --wait db
apps/api/.venv/bin/python apps/api/manage.py migrate
apps/api/.venv/bin/python apps/api/manage.py seed_demo_catalog
apps/api/.venv/bin/python apps/api/manage.py runserver 127.0.0.1:8000
```

Открыть [навигацию API](http://127.0.0.1:8000/api/v1/) или [каталог](http://127.0.0.1:8000/api/v1/services/). Личные маршруты без входа возвращают `403`. Демонстрационные услуги предназначены для просмотра: оформить их как заказ нельзя.

Запуск Backend не требует установки зависимостей Frontend. Прокси общего origin в текущем Frontend отсутствует; одни доверенные origin CSRF не включают CORS. Подключение cookie и маршрутов нужно выполнить на стороне Frontend по контракту, сохранив серверные проверки сессии и CSRF.

## Проверки

Для серверных изменений добавлен [workflow Backend checks](.github/workflows/backend.yml): Python 3.13, отдельная PostgreSQL 17, проверка зависимостей и Django, применение миграций с нуля, полный набор тестов. Он запускается при push/PR с изменениями Backend, самого workflow или `compose.yaml`; изменения только Frontend его не запускают. Результаты доступны в [GitHub Actions](https://github.com/lex44lh/Studly/actions). Это проверки кода, размещение сайта они не выполняют. Подробности: [BACKEND_CI_PLAN.md](BACKEND_CI_PLAN.md).

```bash
apps/api/.venv/bin/python apps/api/manage.py test
apps/api/.venv/bin/python apps/api/manage.py check
apps/api/.venv/bin/python apps/api/manage.py makemigrations --check --dry-run
```

На 16 октября 2026 года все 154 теста Backend прошли на отдельной PostgreSQL. Проверены права, CSRF, Telegram-обработчики с тестовыми данными, модерация, денежные суммы, сохранность условий заказа, отмена и отказ, повторные и одновременные запросы, сохранность старых заказов при миграции и сверка ответов ЮKassa с подменой внешнего HTTP. Реальная оплата и интеграция актуального Frontend этими тестами не подтверждаются.

Остальные отчёты: [исходная диагностика](DIAGNOSTICS.md), [первоначальный план](BACKEND_START.md), [схема авторизации](TELEGRAM_AUTH.md), [размещение](DEPLOYMENT.md), [история убранной интеграции](INTEGRATION_PLAN.md). В исторических документах сохранено состояние соответствующего этапа; текущий контракт — `API_CONTRACT.md`.
