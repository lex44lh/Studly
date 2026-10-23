# STUDLY 2 Передача Backend в Integration

24 октября 2026. Получатель — направление `codex/frontend-api-integration`; этот файл подготовлен для владельца, сообщения другим чатам/участникам не отправлялись.

## Версии и фактическая готовность

Frontend изучен строго на принятом `5db64a2437ce0b000f32de51bc730a9708be5178`. Backend-база до изменений — `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. Код новой реализации опубликован с разрешения владельца только в `codex/backend`: [`ebec0915a17e55033cc62093912244c13bf13782`](https://github.com/lex44lh/Studly/commit/ebec0915a17e55033cc62093912244c13bf13782). Для Integration зафиксировать этот SHA и сверить контракт по нему; последующий отчётный commit не меняет серверный код. `main`, Frontend, Integration, Git-история и действующий сервер не менялись.

Готовы локально код и тесты блоков A–D, текстовый чат/обжалование и ограниченный staff API. Ни одна функция не помечена INTEGRATED. Production, настоящий Telegram, файлы через live reverse proxy и реальный платёжный провайдер в этой задаче не проверялись. Полные маршруты/DTO/ошибки: [API_CONTRACT.md](API_CONTRACT.md); [ROUTE_API_MATRIX.md](ROUTE_API_MATRIX.md); схемы [registration](docs/registration.openapi.json) и [workspace](docs/workspace.openapi.json).

## Что подключать первым

1. Сохранить текущие Telegram/session/CSRF: auth/options, csrf, mini-app, website OIDC, auth/me, logout. Не менять их формат и не отправлять Demo identity/IndexedDB на Backend. После входа свежий CSRF.
2. Account/кабинет: GET account и cabinet?role; профиль/роли сохранять прежним registration PATCH. Для модерируемых правок получать performer/moderation.revision и передавать performer_revision. Смена UI activeRole — локальный выбор представления, не server permission.
3. Portfolio: UUID работы/URL или multipart (не JSON File/Blob). После записи брать новый moderation.revision; не использовать stale revision для следующего submit. Приватный content URL требует cookie; файлы не загружать через серверный оптимизатор, теряющий сессию. PDF только скачивание. Текущий контракт не даёт публичного портфолио.
4. Profile moderation: отдельные readiness/status/reason; performer_ready не approval. Demo запрещал менять approved профиль, но новое решение владельца разрешает правку с повторной проверкой и скрытием услуг — это **изменение клиентской модели для Integration**, не поручение нам менять Redesign.
5. Service draft: v2/my/services, draft revision=0 для нового, актуальная revision для PATCH/submit. Неполный draft не означает submitted/published. Административное решение отдельное; успешный клик не публикация.
6. Quote v2 и согласие: показать base/выбранные extras/subtotal/5%/total/days из сохранённого quote. POST orders принимает только quote_id/request_key. На 409 получить новый quote и новое согласие; не автоматически оформлять по новым деньгам.
7. OrderList: роль-фильтр customer/performer не создаёт вторую запись заказа. Хранить server ID и state; PENDING/IN_PROGRESS из Demo нельзя подставлять вместо pending_acceptance/awaiting_payment. Предусмотрены accept/cancel/decline, истории и available_actions. Оплата/результат/complete пока недоступны.
8. Order chat: conversation из заказа, не из service ID. До заказа POST discussions с service_id/request_key возвращает отдельный стабильный discussion; новый заказ его не перезаписывает. Сообщения только серверные; client_message_id стабилен при неизвестном исходе. Сначала pending локально, затем stored или held из подтверждённого ответа. Cursor/sequence, объединение по message ID; при release повторно видимый ID приходит с новым sequence. После receipt replay перечитать актуальный ресурс.
9. Held: показать sender предупреждение/категорию и appeal; не показывать текст получателю. case revision и ключ намерения для appeal. Нет автоматического наказания и сообщения о «доставке», пока запись не сохранена.
10. Staff: получить staff/me и разрешённые ресурсы. is_staff и пользовательские роли недостаточны. Не включать все 12 разделов одним снятием disabled. Case content только с purpose и нужным правом. Не открывать Live `/admin` поверх существующей Django `/admin/` до отдельного решения proxy.

## Request примеры

Здесь условные данные. Реальные ID/revision брать из серверного ответа, ключи генерировать на новое намерение.

```json
{"revision":1,"request_key":"00000000-0000-4000-8000-000000000001","title":"Пример работы","url":"https://example.com/work"}
```

```json
{"service_id":42,"extra_ids":["00000000-0000-4000-8000-000000000002"]}
```

```json
{"quote_id":"00000000-0000-4000-8000-000000000003","request_key":"00000000-0000-4000-8000-000000000004"}
```

```json
{"client_message_id":"00000000-0000-4000-8000-000000000005","text":"Здравствуйте, уточним условия задания"}
```

Новый POST с повторным request_key и иными условиями даёт 409. Транзакционно сохранённый успешный повтор возвращает прежний исходный response; после восстановления связи выполнить GET. Не менять ключ для повторной отправки неизвестного исхода. Для новой согласованной суммы — новый quote и новое намерение. V1/v2 creation keys не смешивать.

## Окружение и миграции

- Python/Django/DRF/PostgreSQL остаются прежними; добавлен фиксированный pypdf 6.21.2 для закрытых PDF. Requirements должны ставиться в отдельное Backend venv, без зависимостей Frontend.
- Прежние DJANGO_SECRET_KEY/DEBUG/ALLOWED_HOSTS/CSRF_TRUSTED_ORIGINS, POSTGRES_*, Telegram Bot/OIDC, DJANGO_MEDIA_ROOT — по существующему `.env.example`, без production secrets.
- Новый `STUDLY_V2_BUYER_TARIFF=buyer-5-v1`. Он не меняет v1. Новая версия тарифа должна существовать; нет fallback при ошибке.
- После разрешения запуска на отдельной локальной/staging БД применить весь граф миграций. Production-миграции в этом этапе не запускались, существующая локальная рабочая БД также не менялась: Django tests создавали отдельную test БД.
- Для multipart proxy нужен лимит не менее 10 МиБ + overhead; предложен Nginx 12m в шаблоне, live ранее был 6m. MEDIA_ROOT целиком приватный, включая portfolio; никаких публичных alias и переносов Demo files.
- Тестовые пользователи/роли/portfolio/тарифы создаются тестами. Локальные реальные пользователи, production-аккаунты и заказы не наполнялись. Специализации по-прежнему пусты до списка владельца.

## Фактические проверки

Полный набор: **238/238 PASS**, реальная локальная PostgreSQL с отдельной тестовой БД. Включены CSRF/session, ownership, роли, file contents/PDF/размер/EXIF, stale moderation, запрещённое self approval, quotes/3%/5%/rounding, cross-version keys, cursor, held privacy, appeal/audit, параллельные order/favorites/message/decision и переход старой схемы без пересчёта денег. Django check — без ошибок; makemigrations --check — No changes detected; pip check — No broken requirements; git diff --check — успех; apps/web и package-lock diff пуст.

OpenAPI: 42 path/54 schemas; тесты проверили наличие методов/путей и request-поля сериализаторов. Это не доказательство frontend hydration/cookies через Next, физического Telegram, реальной оплаты или proxy на production. [GitHub CI](https://github.com/lex44lh/Studly/actions/runs/40035221210) коммита `ebec091` завершился успешно: Python 3.13 / PostgreSQL 17 и Python 3.12 / PostgreSQL 16; проверены установка зависимостей, системные проверки, миграции пустой БД и полный набор тестов.

## Блокировки и следующий этап

Все решения/проект арбитражных моделей/порядок payment-first собраны в [OPEN_PRODUCT_DECISIONS.md](OPEN_PRODUCT_DECISIONS.md). Проект выпуска, миграций и совместимости тарифов — [BACKEND_ARCHITECTURE_DECISIONS.md](BACKEND_ARCHITECTURE_DECISIONS.md). До их решений не подключать user paid/result/completed/review/refund/payout/arbitration commands. Нет серверных уведомлений, реальных финансовых отчётов и analytics; в этой версии не обещаются публичные портфолио/аватары или файловые вложения чата/заказа.
