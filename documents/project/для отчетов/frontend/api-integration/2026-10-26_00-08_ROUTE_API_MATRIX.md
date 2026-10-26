# STUDLY 2.0 — Frontend ROUTE_API_MATRIX

Дата: 26.10.2026, Europe/Moscow. Начало основного сеанса: 00:08:42; окончание фиксируется в [основном отчёте](2026-10-26_00-08_django-live-integration.md). Workspace `/Users/alekspih/Projects/studly-integration`, ветка `codex/frontend-api-integration`, порт 3002. Backend-контракт зафиксирован на [`8999703fe60ef6714595614413faddc5a9308d44`](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), код `ebec0915a17e55033cc62093912244c13bf13782`. Исходная Integration `d447c317eb5efa28bac65489da9b88a5d19a039d`.

**«Подключено» означает реализованный Frontend adapter/UI к существующему Backend-коду. Это не отметка настоящего Django E2E.** Изолированного окружения нет; успешные контрактные/component/fixture browser проверки указываются отдельно. S — настоящая session cookie; W — S + свежий CSRF; O — owner/участник; P/E — server customer/performer; M — staff + указанное отдельное permission. Query role/UI-tab не создаёт полномочия. Общие ответы: 400 поля, 401/403 сессия/CSRF/права, 404 чужой/скрытый объект, 409 revision/intention, 5xx сервер/конфигурация; Demo fallback отсутствует.

Источники для каждой строки: [Django routes](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/apps/api/config/urls.py), [Backend ROUTE_API_MATRIX](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/ROUTE_API_MATRIX.md), [REGISTRATION_API](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md), [workspace.openapi.json](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/docs/workspace.openapi.json). Когда документ 16 октября расходится с новым runtime, приоритет имеет фактический код этого SHA. Новые v2-реализации происходят из [Backend code commit `ebec0915`](https://github.com/lex44lh/Studly/commit/ebec0915a17e55033cc62093912244c13bf13782); этот отчёт привязан к полной опубликованной версии `8999703`, а не к подвижному имени ветки.

## Маршруты и пользовательские действия

| Frontend route / действие | Реальный API | Auth / DTO | Состояние Frontend и проверяемые границы |
|---|---|---|---|
| Диагностика соединения | GET `/api/v1/health/`; GET `/api/v1/ready/` | Public; JSON / readiness PostgreSQL | Контракт существует; в этой сессии настоящий Django не запускался, HTTP 200 не подтверждён. Проверять напрямую и через origin Frontend 3002 |
| `/` услуги и поиск | GET `/api/v2/services/` | Public, Page<Service2> | Подключено через ServiceList; первые реальные услуги, переход в `/search`; Demo-карточки только в Demo |
| `/search` | GET `/api/v2/services/?search=&category=&min_price=&max_price=&max_duration=&ordering=&page=` | Public, Page<Service2> | Подключено; серверные фильтры/сортировка до pagination, rating недоступен; loading/empty/error/retry |
| `/category/[slug]` | GET `/api/v2/services/?category=...` | Public, Page<Service2> | Подключено через LiveSearch; существующий UI slug сопоставлен точному строковому category; неизвестный slug — явное состояние |
| `/service/[id]` деталь | GET `/api/v2/services/{id}/` | Public, Service2 | Подключено: revision/category/extras, только серверные условия; 404 hidden/deleted |
| `/profile/[id]` публичный исполнитель | GET `/api/v1/performers/{id}/`; GET `/api/v2/services/?performer={id}` | Public performer + Page<Service2> | Подключено только к существующим name/about/видимым услугам; public rating/avatar/portfolio отсутствуют |
| `/welcome`, приватные страницы: вход | GET v1 `auth/options/`, `auth/me/`, `auth/csrf/`; POST `auth/telegram/mini-app/`; browser GET `auth/telegram/start/`, callback | Telegram/S/W, краткий SessionUser | Существующий поток сохранён; Live entry в кабинет, website entry только по server options; production gate не снят; физический Telegram не проверен |
| Любая приватная страница: logout/recheck | POST v1 `auth/logout/`; GET `auth/me/` | W/S | Существующий AuthContext; приватные дети unmount во время recheck/logout, новая account key; cookie E2E ожидает окружение |
| `/register/roles` | GET/PATCH v1 `registration/`; GET `performer/moderation/` | S/W, Reg + performer_revision | Подключено; customer/performer/обе, progress; guard по просмотренной revision; production Live gate закрыт |
| `/register/profile` | GET/PATCH v1 `registration/`; GET/POST/DELETE `registration/avatar/` | S/W/O, Reg + multipart | Подключено; профиль/аватар/дальнейший шаг; CSRF, serial write, ошибки сохраняют draft; avatar API без revision отмечен отдельно |
| `/register/performer` | PATCH `registration/`; GET `specializations/`; POST `registration/complete/` v1 | S/W, Reg/Specialization | Подключено: специализации/описание/курс/заметка/skip; завершение направляет `/profile`; performer_ready не approval |
| `/profile` account/role tabs | GET v1 `account/`; GET `cabinet/?role=customer\|performer` | S, Account/Cabinet/capabilities | Подключено; один server ID, server counts и null statistics, tab из query; чужие данные при смене аккаунта скрываются. Production Live незавершённый аккаунт получает закрытое состояние с выходом, без альтернативной регистрации через редактор |
| `/profile` редактирование | PATCH v1 `registration/` + performer_revision | W/O, частичный Reg patch | Подключено: roles/profile/performer/specializations; stale 409, сохранение/чтение/восстановление; approved-правка отправляет на server remoderation |
| `/profile` аватар | GET/POST/DELETE v1 `registration/avatar/` | S/W/O, приватный PNG / FormData | Подключено; 5 МиБ, неподтверждённая запись не replay; нет server optimistic guard для самого аватара |
| `/profile` portfolio list/link/file | GET/POST v1 `portfolio/` | S/W/E/O, Page<Example> / Version+title+URL либо FormData file | Подключено; pagination, 10 МиБ, genuine multipart; DTO/path validation; server content checks должны пройти реальный runtime |
| `/profile` portfolio edit/delete | PATCH/DELETE v1 `portfolio/{uuid}/` | W/E/O, Version + patch | Подключено; title/URL по kind, guarded soft delete, server moderation revision; unknown result удерживает исходный key/payload |
| `/profile` portfolio download | GET v1 `portfolio/{uuid}/content/` | S/O либо profile M, file stream | Подключено как same-origin download с cookie; PDF без iframe, нет публичной выдачи; cross-account enforcement ожидает Django E2E |
| `/profile` performer moderation | GET/POST v1 `performer/moderation/` | S/W/E/O, Moderation/Version | Подключено: status/reason/missing_fields/readiness/submit; нет локального самоодобрения |
| `/profile` собственные услуги | GET `/api/v2/my/services/` | S/O, Page<OwnService2> | Подключён paginated список сохранённых IDs/status/reason и переход в редактор; историческое чтение не выдаёт право новых записей |
| `/favorites`, favorite buttons | GET v1 `favorites/`; PUT/DELETE `favorites/{service_id}/` | S/W/O, Page<Service1> / `{}` → 204 | Подключено; все страницы перед membership, serial writes/reread, account key; Demo storage отдельно |
| `/create-service` новый draft | POST `/api/v2/my/services/` | W/E, Draft + revision=0/request_key | Подключено; неполный серверный draft, extras/included/portfolio_example_ids; не автоматическая публикация. После network/5xx новые правки блокируются, явный retry сохраняет исходные body/key |
| `/create-service?id={id}` или `?edit={id}` | GET/PATCH `/api/v2/my/services/{id}/` | S/W/E/O, OwnService2 / Draft+Version | Подключено: restore, редакция, status/reason; unknown key retained, stale 409 требует новое чтение |
| `/create-service` submit | POST `/api/v2/my/services/{id}/submit/` | W/E/O, Version | Подключено; completeness/profile approval/active portfolio проверяет сервер; результат pending, не published |
| `/service/[id]` quote и extras | POST `/api/v2/quotes/`; GET `/api/v2/quotes/{uuid}/` | W/P, service_id/extra_ids → Quote2 | Подключено; saved server 5%/tariff/base/extras/subtotal/total/days, восстановление opaque IDs; суммы не пересчитываются Frontend |
| `/service/[id]` создать заказ | POST `/api/v2/orders/` | W/P/O, quote_id/request_key → Order2 | Подключено; stable intention/replay, 409 → новый quote и повторное согласие; нет фиктивной оплаты |
| `/orders` | GET `/api/v2/orders/?role=customer|performer` | S/O, Page<Order2> | Подключено; реальные server states, обе стороны и pagination, reload; Demo order states отдельно |
| `/orders/[id]` | GET `/api/v2/orders/{id}/`; GET v1 `orders/{id}/events/` | S/O, Order2/Page<Event> | Подключено: снимок/состояние/история, без выдуманной истории до журнала |
| `/orders/[id]` accept/cancel/decline | POST `/api/v2/orders/{id}/{action}/` | W/O, Version | Подключено: только available_actions и сторона server order; revision/UUID/replay/conflict; paid не выставляется |
| `/orders/[id]` order conversation | GET v1 `orders/{id}/conversation/` | S/O, Conversation | Подключено; заказной UUID не service ID, переход в `/chats/{uuid}` |
| `/service/[id]` обсудить до заказа | POST v1 `discussions/` | W/P, service_id/request_key → Conversation | Подключено; отдельный устойчивый buyer/service контекст; свой/Demo/невидимый service отклоняет Django |
| `/chats` | GET v1 `conversations/` | S/participant, Page<Conversation> | Подключено; server context/title/UUID, pagination; универсального staff доступа нет |
| `/chats/[id]` | GET v1 `conversations/{uuid}/`; GET `conversations/{uuid}/messages/` | S/participant, Conversation/CursorPage<Message> | Подключено; cursor/sequence, dedup server ID/release sequence, ручное обновление; WebSocket/push нет |
| `/chats/[id]` send | POST v1 `conversations/{uuid}/messages/` | W/participant, client_message_id/text → Message | Подключено; stable UUID, stored/held из сервера, unknown outcome/retry; «Сохранено» не означает доставку/прочтение |
| `/chats/[id]` held appeal | GET/POST v1 `security-cases/{id}/appeal/` | S/W/sender, Case/Version+reason | Подключено; предупреждение/categories/rules, server revision/reason/outcome; recipient held text не отображается |
| `/staff` | v1 `staff/me/` и разрешённые staff resources | S/M | Подключён отдельный Live UI, 12 секций описаны ниже; никак не обходится через Demo admin flag |
| `/admin` | Новые Live API не направляются сюда | Demo gate | Прежний sandbox сохранён; production gate не снят; Django `/admin/` и размещение не менялись |
| `/notifications` | Действующего API нет | — | Backend dependency; Live не должен показывать Demo события или обещать работающую доставку |
| `/orders/[id]/additional-payment` | Действующего API нет | — | Backend/PO dependency; платежи недоступны, оплаченные extras/сроки заказа не изменяются |
| `/about`, `/rules`, `/safety` | API не требуется для статического текста | Public | Прежний редакционный Campus-контент; не подтверждает server state |
| `/support` | API формы support case нет | Public editorial | Информационный маршрут сохранён; создание/ведение обращения не реализуется фиктивно |

## Двенадцать секций `/staff`

| Секция | Подключённые запросы | Django permission и действие | Недоступная часть |
|---|---|---|---|
| Обзор | GET `staff/me/` | staff, перечисление resources/unavailable | Server dashboard/revenue aggregates/notifications |
| Пользователи | GET `staff/users/`, `staff/users/{id}/`, paging/search | `accounts.view_user`, read-only | Изменение ролей staff/аккаунта/платформенных правил |
| Профили на проверке | GET `staff/performers/`, `staff/performers/{user_id}/`; GET `portfolio/{uuid}/content/`; POST `staff/performers/{user_id}/decision/` | `accounts.moderate_performer`, просмотр ссылок и приватный download файла с server audit; approved/rejected/changes + Version/reason; own decision запрещает сервер | Обход revision/readiness/self decision, публичное раскрытие файлов |
| Услуги | GET `staff/services/`, `staff/services/{id}/`; POST `{id}/decision/` | `catalog.moderate_service`, decision + Version/reason; own service запрещена | Публикация неполной услуги/профиля без approval |
| Заказы | GET `staff/orders/`, `staff/orders/{id}/` | `orders.view_order`, read-only Order1 snapshot | paid/возврат/завершение/арбитраж/универсальный чат |
| Обращения и споры | API отсутствует | Честное состояние недоступности | Создание/разбор/исход спора |
| Жалобы и безопасность | GET `staff/security-cases/`; GET `{id}/?purpose=...`; POST `{id}/` | `conversations.review_security_case`, case content с purpose; keep/release + Version/reason | Общие жалобы вне held case, общий просмотр переписки, self case decision |
| Отзывы | API отсутствует | Честное состояние недоступности | Completed-order reviews и их moderation |
| Финансы | API отсутствует | Честное состояние недоступности | Настоящие revenue/refund/payout отчёты/операции |
| Аналитика | API отсутствует | Честное состояние недоступности | Серверные метрики и периоды |
| История решений | GET `staff/events/`, `staff/events/{id}/`, paging/search | `operations.view_auditevent`, read-only audit metadata | Изменение/подделка истории, универсальная переписка |
| Настройки | GET `staff/me/` | Чтение собственных capabilities/ограничений | Secrets, права staff, тариф/бизнес-правила и server mutations |

Каждый разрешённый resource имеет pagination, detail, loading/empty/error/retry; search/status используются только для поддержанных ресурсов. Decisions требуют прочитанной детали и явного подтверждения. Unknown outcome сохраняет исходное намерение; 403/409 перечитываются без автоматического нового решения. Для blocked разделов сам факт визуального существования вкладки не означает API.

`/staff` — отдельный Next-маршрут; он не использует Demo admin flag. `/admin` сохраняет прежний Demo gate и в Live не открывает sandbox. Next rewrite распространяется только на `/api/:path*`; Django `/admin/` не направляется на новый staff UI и не подключается этим rewrite. Фактическую схему размещения Django Admin за внешним reverse proxy должен подтвердить Backend-владелец; изменение deployment в этот этап не входит.

## Защитные границы и проверка результата

| Граница | Реализация и ожидаемое поведение | Доказательство и предел |
|---|---|---|
| Session / CSRF | `credentials: same-origin`, `cache: no-store`; перед POST/PATCH/PUT/DELETE свежий v1 `auth/csrf/`, затем X-CSRFToken; ошибка не повторяет mutation автоматически | Adapter tests. Подлинная cookie rotation/Origin проверка не запускалась с Django |
| Server errors | Network → явная ошибка; 400 сохраняет форму; 401/403 не считаются успехом; 404 не подставляет Demo; 409 требует чтения/нового решения; 5xx не подтверждает запись | Contract/component/browser fixtures. Реальные server responses требуют изолированной среды |
| Account / stale | Приватные дети размонтируются на session loading/logout; ключи содержат account ID, запросы отменяются; собственные записи не загружаются из Demo localStorage | Автоматические проверки client lifecycle; два настоящих Telegram аккаунта не проверены |
| Role / permissions | UI role не меняет session identity; account/staff capabilities читаются с сервера; действия проверяются Django независимо от disabled controls | Реальные 403/404 и отдельные permissions нужно проверить совместно с сотрудником |
| Versions / unknown result | Draft/submit/moderation/order/appeal используют server revision + UUID; повтор неизвестного намерения удерживает исходные данные/ключ. Fresh revision не даёт права молча перезаписать несохранённую форму | Race/idempotency tests; реальные параллельные транзакции Django не запускались |
| Profile snapshot | Registration/account читаются между двумя moderation GET с одинаковыми user_id/revision. После wizard PATCH принимается только ожидаемый собственный touch; более поздняя revision/сбой чтения блокирует следующий save до явного reload | Защита перепроверена после race fix. Это не атомарный Backend DTO; customer-only данные до создания performer profile и avatar API имеют описанные ограничения server guard |
| Purchase reload | Только opaque quote/request IDs в scoped sessionStorage; GET восстанавливает server snapshot, POST автоматически не replay; согласие требуется заново | Fixture verification; настоящий повтор order.create и tariff 409 пока не проверены |
| Demo / Live | Demo repository и browser storage остаются отдельными; Live не вызывает Demo domain как fallback. API v1 quote 3% сохранён для совместимости, новый Live UI использует v2 server quote | Demo/Live checks перечислены в основном отчёте; production-ready не заявляется |
| Gates | Production Live `/register/*` закрыт; незавершённый account не получает редактор регистрации через `/profile`; Demo `/admin` отдельно закрыт без разрешённого флага | Финальный gate PASS должен подтверждаться основным отчётом и browser evidence |

Live order states: `pending_acceptance`, `awaiting_payment`, `cancelled`, `declined`; `payment_status` — `unpaid`. Demo `PENDING/IN_PROGRESS/REVIEW/COMPLETED` не являются серверными переходами. Cursor выдаёт сообщения по server sequence; released held message сохраняет ID, получает новую sequence и объединяется без дубликата. Автодоставка/прочтение не объявляются.

## Неподдержанные возможности и совместимость

Настоящие платежи/доплаты/возвраты/выплаты, paid/execution/result/completed lifecycle, completed-order reviews, server notifications, arbitration и часть admin ресурсов остаются зависимостями Backend/PO. Public performer v1 не расширяется локальными приватными portfolio/avatar полями. Категории остаются строками, университет — приватным свободным текстом; новые серверные справочники не выдуманы. Rating filter не отправляется как работающий.

Имеющиеся старые v1 routes/DTO не удаляются и их исторические суммы не пересчитываются. Новый Live purchase путь использует v2 quote/order, общие account/registration/portfolio/chat/staff/favorites — v1. Исходники принятого Redesign и прошлые Integration reports/manifest сохраняются; отличие текущего client-кода — целевое подключение API, не новый перенос accepted tree.

Фактические тесты/сборки/browser evidence и Git-публикация фиксируются только в [основном отчёте](2026-10-26_00-08_django-live-integration.md). Настоящий Django E2E для всех строк этой матрицы пока **не запускался**.

Матрица дополнительно сверена с текущими исходниками и опубликованным Backend 26.10.2026, 00:28:27 MSK. Это время обновления приложения к отчёту; фактическое окончание всего этапа и финальный Git-статус заполняются в основном отчёте после проверок и публикации.

После возобновления сеанса матрица повторно сверена 26.10.2026, 12:44:10 MSK: учтены финальные snapshot/revision guards, закрытый production incomplete-account `/profile`, приватный staff download, отмена staff retry, мобильный выбор всех 12 секций и один заголовок категории. Итоговые результаты обязательных проверок и публикации по-прежнему берутся из основного отчёта.

Финальное уточнение 26.10.2026: ссылка кабинета `/orders?role=customer|performer` задаёт начальный server filter; неизвестная/отсутствующая роль — все собственные заказы. Устаревшая disabled-preview обёртка подключённых Live orders/chats/create-service удалена из AppShell. Проверки роли выполнены отдельно на финальной Live-сборке; доказательства указаны в основном отчёте.
