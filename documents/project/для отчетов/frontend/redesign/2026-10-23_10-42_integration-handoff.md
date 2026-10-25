# STUDLY 2.0 — INTEGRATION HANDOFF после реализации

Записан:23.10.2026 11:14:56 Europe/Moscow. Реализация только `/Users/alekspih/Projects/studly-redesign`, `codex/frontend-redesign-campus`, HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`. Ничего не переносилось.

Новый полный [manifest](2026-10-23_10-42_frontend-scenarios.manifest.json) заменяет прежний192-path пакет **только как кандидат новой независимой приёмки**. Старое визуальное ACCEPTED не означает приёмку новых функций. Перенос в Integration/Git-публикация требуют отдельного разрешения PO после проверки. Не копировать целые shared files между checkout для синхронизации.

## Реальные точки подключения

| Область | Реализовано | Правило будущего Live adapter |
|---|---|---|
| AppShell/Provider | Auth → Demo-only workspace → Favorites → CampusShell; provider вне route/role keys | Не монтировать Demo provider и не читать его БД в Live |
| RegistrationContext | Только Demo bridge/draft/Blob persistence; production Demo открыт | Нынешний Live RegistrationSession/abort/CSRF/restore/complete/gate сохранён |
| AccountWorkspace | Customer/performer dashboards, одна identity, activeRole, readiness/portfolio | Session identity из Auth; extended profile/roles через подтверждённый registration API, staff права только Backend |
| ServiceWorkspace/Commerce | Approved-only published Demo catalog, checkout, service forms | LiveService/quote сохранён; новые mutation clients вводить отдельным согласованным этапом |
| Repository/domain | Command role/participant/state/revision/actionId checks, transaction persistence | Сервер повторяет проверки и даёт capabilities/confirmed responses; frontend guards не authority |
| Routing | /orders и /chats с context-first branch до hydration, keyed detail renderer | Сохранять один canonical conversation и state mapping по Backend contract |
| Public profiles/reviews | Demo aggregates только по linked COMPLETED orders | Exclusively confirmed Backend order/review data; нет внешних отзывов и Demo fallback |
| Admin |12 views, read-only неподтверждённые полномочия, явные profile/service decisions | Live закрыт до отдельного staff auth/RBAC/API; не включать одним снятием disabled |

Сохранить Campus tokens, CSS scopes, `main#campus-content[tabindex=-1]`, keyboard skip/reset, layouts/search/service reference. Исторические fixtures в данных не являются источником displayed ratings: adapter убирает синтетические рейтинги.

## Поведение данных и денег

Namespace новой модели: IndexedDB `studly-demo-workspace-v2`, stores state/current и assets. Старые `studly-orders`, `studly-chats`, `studly-chat-messages-*`, Demo favorites и Live favorites не очищаются, не мигрируют и не отправляются на Backend. Legacy interim view-only не присваивает чужой безвладельный заказ новому аккаунту.

Незавершённая форма услуги — отдельный optional composerDrafts buffer; отсутствие поля в сохранённом v2 читается без автоматической записи. Валидная service редакция не публикуется без двух approvals. Dirty form хранит просмотренные revisions, stale save/submit/decision дают conflict. Ошибка записи не показывается как success.

Demo5% integer HALF_UP и payment-first — решение только для Demo. Live продолжает отображать реальные3% и текущие Backend states. Не пересчитывать historical snapshots и не переименовывать enum без нового контракта. Изменение quote требует повторного согласия и нового намерения; неизвестный исход требует прежнего idempotency key.

## Gate и повторные проверки

- Production Demo registration открыта только с `NEXT_PUBLIC_STUDLY_DATA_MODE=demo`. Production Live gate сохранён.
- `/admin` в production Demo по умолчанию закрыт. Изолированный QA sandbox доступен только при явном build `NEXT_PUBLIC_STUDLY_DEMO_ADMIN=enabled` либо в development Demo. Query/localStorage/выбранная роль не включают его. Live всегда закрыт даже при этом флаге. Это не секрет и не реальная авторизация.
- После переноса: protected hashes, all tests/TS/ESLint/builds; full22+admin routes; both roles/foreign records; persistence failure/concurrency/reload; money snapshots; multiple orders per service and separate chats; pending/rejected/changes/approved; reviews constraints; default gates;320/390/768/1440 light/dark; keyboard/safe areas/reduced motion.
- Настоящие Django session/CSRF/Telegram/uploads/order/payment/moderation нужны отдельно. Здесь Live production build и сохранность client/contracts проверены; Live сервер и Django **Не запускались**.

[Результаты и скриншоты](implementation/2026-10-23-scenarios/README.md), [общий отчёт](2026-10-23_10-42_frontend-scenarios-completion.md), [Backend handoff](2026-10-23_10-42_backend-handoff.md). Прежний [план Integration](2026-10-22_18-09_integration-handoff.md) сохранён как история требований, актуальная реализация описана здесь.
