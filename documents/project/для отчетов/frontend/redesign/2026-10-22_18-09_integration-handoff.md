# STUDLY — INTEGRATION HANDOFF: комплексные пользовательские сценарии

Дата: 22.10.2026, Europe/Moscow. **План подключения будущего Frontend; реализация ожидает технического согласования.** Готовность новых функций этим документом не объявляется. Integration checkout не изменялся, сообщения в смежные чаты и patch не отправлялись.

## База и порядок работ

- Принятый полный Redesign: source HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`; manifest основного Frontend от22.10.2026 03:15, SHA `3dc90f9d73d4b065d212a68b968e79a034a8a64adbfa40e2ccca56115d0061a9`, 356 repository files / 192 transfer paths.
- В начале новой задачи сверены все356 hashes/modes — совпали. Перенос не начался; Integration имеет прежний README и два отчёта, без исходников Redesign. Проверка состояния — снимок, а не гарантия отсутствия будущей параллельной записи.
- Backend после fetch: `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. [Первичный контракт](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).
- PO поручил дождаться технического согласования [scope](2026-10-22_18-09_architecture-coordination.md). Код новой задачи не реализован. Прежний manifest после новых docs уже не описывает весь будущий результат; окончательный manifest формируется после реализации и независимой приёмки.

## Предлагаемая граница адаптеров

Общие Campus presentation-компоненты получают view models и capabilities. Demo domain/store и Live adapters разделены. Demo account/role/money/moderation IDs не становятся SessionUser, wire DTO, серверной сессией или permissions.

| Интерфейс | Предлагаемый источник Demo | Реальный источник Live / отсутствие |
|---|---|---|
| Account/roles/profile | Новое отдельное local workspace; одна identity, selectedRoles + activeRole | Identity из Auth; общие/performer поля и roles из существующего registration API. Не приписывать расширенные поля auth/me |
| Registration | Переиспользованные формы, новый isolated draft persistence и completion | Существующие GET/PATCH/complete/avatar/specs, busy/abort/guards; production Live gate остаётся |
| Favorites | Существующий Demo namespace, согласованный adapter новых published IDs | Существующий browser-local `studly-api-favorites`; это не серверный список и не account sync |
| Portfolio/moderation | Явная local simulation, approved только через Demo-панель | Текст portfolio есть; files/items/submission/approval API отсутствуют. performer_ready не approval |
| Own services | Новые Demo draft/submission states и approved-only catalog | Backend my/services существует, клиента пока нет. Три server states pending/published/rejected; нет draft/needs_changes/reason; права публикации не отвечают новому правилу |
| Quote/order creation | Captured 5% snapshot, явная simulation | Отображать server quote без пересчёта. Order API существует только до awaiting_payment, Frontend client пока отсутствует |
| Execution/chat/dispute/reviews | Canonical Demo entities и events после согласования | Server operations отсутствуют; honest unavailable states до контракта |

## Запреты и правила подключения

1. Сохранить текущие `lib/api`, AuthContext, CSRF/session/SDK, default Live/no fallback и production Live gate. Не делать Live-операцию вызовом Demo dispatch.
2. PO отдельно разрешил открытие **production Demo** регистрации. Это не снятие Live gate и не подтверждение серверной регистрации.
3. Demo-комиссия по ответу PO:5% от услуги+дополнений, HALF_UP до копейки. Backend всё ещё3%; Live показывает его значения. Ставка и итог не подменяются фронтовой константой. Старые заказы не пересчитываются.
4. Demo оплата→PENDING→принятие не равно Backend pending_acceptance→awaiting_payment. Не переименовывать states напрямую. Live adapters получают серверные capabilities и сохраняют отдельный state mapping только после утверждения.
5. Существующий order create: service_id/service_revision/request_key; один UUID на намерение, после неизвестного network outcome тот же ключ/условия. Не автоматически повторять mutation. При409 обновить данные и запросить новое подтверждение условий.
6. Профиль сохранять через существующий registration API с сериализацией изменений, блокировкой busy и отображением только подтверждённого результата. UI activeRole — preference из разрешённых сервером roles; он не даёт права publish/accept/review.
7. Уважать реальные ownership и404/403. Client role filters не заменяют проверку чужого заказа на сервере. Не подставлять Demo ratings/университеты/portfolio в Live.
8. Новые портфолио/модерация/публикация/отзывы включаются только после контрактов и server permissions. Не путать собственный avatar API с файловым API портфолио.
9. Сохранять Campus tokens/layout/skip target и props presentation layer. Новые loader/hooks/DTO/clients — отдельная работа Integration после технического согласования, а не изменения Redesign ради вида.
10. Legacy browser orders/chats/messages сохраняются без очистки/автоматического импорта. Новые Demo данные отделены. ID/файлы/сообщения старой модели не отправляются в Live. Политику legacy actions согласовать с PO.

## План реального подключения

1. Подготовить согласованный Django/test DB/media, тестовые аккаунты и HTTPS/Telegram origin; актуальный опубликованный контракт по SHA. Не копировать production secrets.
2. До переноса заморозить source/target, получить новый manifest, проверить hashes/modes, allowlist, protected paths и отсутствие параллельной записи. Самостоятельный patch/import этим handoff не разрешён.
3. Сначала подключить уже существующие read paths кабинета и свои услуги; затем существующие неоплаченные orders с реальными states. Не включать весь новый lifecycle одним снятием disabled fieldset.
4. После серверных расширений подключать portfolio/moderation/publish, tariff/quote confirmation, payment, execution, conversation, revisions/dispute/reviews по отдельным regression gates.
5. Сохранять loading/empty/error/unauthorized/forbidden/not-found/conflict/pending/disabled и безопасный retry. Нет UI success до подтверждения сервера.

## Проверки после подключения

- Реальные cookie/session/fresh CSRF, Telegram login/logout/reload, роли и сохранность второй части профиля.
- Production Live gate и отсутствие чтения Demo store/fallback; local favorites не смешиваются.
- Чужая запись404, недопустимая роль403, конфликт409,503/offline/empty/invalid DTO; stale response и abort.
- Повторные create/accept/payment/result/message/review, concurrent tabs/requests; один order context, immutable money snapshots и один review.
- Изменение тарифа/услуги между quote/create, исторические3% orders, серверная5% математика после обновления и HALF_UP.
- Настоящий multipart, permissions portfolio и публикация только одобренного исполнителя; public/private разделение.
- TypeScript, ESLint, все тесты, Demo/Live builds, все существующие routes, light/dark320/390/768/1440, keyboard/skip/error/reset, safe areas/reduced motion.

Synthetic API tests, Demo и Live build не являются доказательством Django-интеграции. Этот план пока не выполнялся. [BACKEND HANDOFF](2026-10-22_18-09_backend-handoff.md) перечисляет контрактные зависимости и открытые продуктовые решения.
