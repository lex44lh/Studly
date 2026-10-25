# STUDLY — запрос архитектурной координации комплексного Frontend UX

Дата: 22.10.2026, Europe/Moscow. Статус: **предложение для согласования PO и основным Frontend; исходники ещё не изменялись**.

## Сообщение для передачи основному направлению

Начата комплексная задача PO по завершению пользовательских сценариев. Просьба технически согласовать описанный ниже scope и зафиксировать, что принятый снимок 192 файлов пока не переносится в Integration параллельно этой работе. Единственный автор исходников общего слоя — текущий Redesign-чат, `/Users/alekspih/Projects/studly-redesign`, `codex/frontend-redesign-campus`. Соседние checkout не меняются. Для непересекающихся внутренних компонентов возможны агенты под координацией одного root.

Перед началом независимо сверены **356/356 файлов** с accepted manifest от 22.10.2026 03:15; SHA manifest `3dc90f9d73d4b065d212a68b968e79a034a8a64adbfa40e2ccca56115d0061a9`. Несовпадений нет. Integration пока имеет только прежние отчёты и README, код чист относительно своей базы; оба смежных чата idle, последние завершённые задачи не выполняли перенос. Это фактический снимок проверки, не долгосрочная блокировка записи.

## Предлагаемые пути и ответственность

| Область | Предлагаемые изменения |
|---|---|
| Новый `apps/web/src/features/demo-workspace/**` | Изолированные Demo types, schema validation, reducer, money snapshot, repository, provider, role capabilities, reusable UI кабинетов/портфолио/модерации/отзывов/споров. Не wire DTO. |
| `components/AppShell.tsx` | Подключить новый provider только для Demo; сохранить Auth/Favorites и стабильный main/skip target. Live не читает Demo workspace. |
| `components/studly/CampusShell.tsx` | Ролевая навигация/переключатель интерфейса; не источник серверных permissions. |
| `context/RegistrationContext.tsx`, `app/register/layout.tsx`, `app/register/**`, `components/registration/**` | Переиспользовать формы/handlers. В Demo — восстановление draft и завершение в кабинете. Live ветки, CSRF, API, wire fields и production Live gate сохраняются. Production Demo gate — только по отдельному ответу PO. |
| `app/profile/page.tsx`, `app/profile/[id]/page.tsx`, `app/welcome/page.tsx` | Кабинеты одной учётной записи, редактирование известных Demo-полей, подготовка исполнителя; публичный профиль показывает только доступные данные. Новые URL пока не обязательны. |
| `app/create-service/page.tsx` | Использовать существующую форму/валидацию/preview, дополнить сохранением Demo draft и явной симуляцией модерации, без Live публикации. |
| `components/CreateOrderButton.tsx`, `StartChatButton.tsx`, `app/service/[id]/page.tsx` | Demo money snapshot с 5%, отдельный шаг симуляции оплаты, защита от повторного создания; сохранить визуальный эталон и LiveService/quote. |
| `app/orders/**`, `app/chats/**`, `components/ChatWindow.tsx` | Ролевые Demo-команды, единый контекст заказа/чата, результат/замечания/арбитраж/отзыв. Сохранить доступ к прежним локальным записям без их очистки, миграции и пересчёта. |
| Demo-ветки `ServiceList`, home/search/category/favorites/public profile | Только адаптер одобренных новых Demo-услуг, без переписывания search layout. `context/FavoritesContext.tsx`: сохранить namespaces/hydration и Live-ветку; для новых одобренных Demo IDs расширить whitelist через согласованный Demo adapter с регрессией. Live branch untouched. |
| Scoped CSS и `tests/*.test.cjs` | Campus tokens, light/dark, focus, reduced motion, safe areas; тесты моделей и реальных views. |

`lib/api/**`, wire DTO, AuthContext, data-mode, Django, CSRF/Telegram SDK, next.config, package/lock, политики и соседние checkout — вне реализации. Если доказанно понадобится пересечение с ними, сначала отдельное согласование. Для Live без API — честные unavailable/unauthorized states, существующие disabled actions не становятся работающими Demo-командами.

## Интерфейсы нового слоя — предложение

Demo provider: `ready`, `persistenceState`, `account`, `selectedRoles`, `activeRole`, `performerProfile`, `capabilities`, `services`, `orders`, `conversations`, `reviews`, `dispatch(command)`.

Команда несёт `actionId`, `actorId`, `expectedRevision` и payload; reducer проверяет участника, роль, исходное состояние и повторность. Переключение `activeRole` не меняет accountId, не remount-ит providers и не выдаёт серверные права. Явная Demo-панель контрагента/модератора отделена от роли текущего аккаунта и не маскируется под реального пользователя или сотрудника.

Предлагаемый новый namespace — `studly-demo-workspace-v2`; единый validated envelope с revision. Новые бинарные примеры — только отдельное локальное IndexedDB-хранилище и metadata refs, с честными quota/reload errors. Это локальная Demo-модель, не защищённое файловое хранилище. Старые `studly-orders`, `studly-chats`, `studly-chat-messages-*`, `favorites`, `studly-api-favorites` не удалять и не автоматически переписывать. Старые заказы читать через legacy adapter; исторические суммы показывать как сохранённые, без новой 5% комиссии задним числом. Политику read-only legacy actions зафиксировать перед реализацией.

Один новый заказ — один устойчивый `conversationId` и оба participant IDs. Предзаказное обсуждение услуги может быть отдельным существующим контекстом, но нельзя перезаписывать его единственный orderId для нескольких заказов. Уведомления/сообщения и ролевые представления получают один canonical order, а не независимые копии.

## Уже принятые новые продуктовые решения

Ответ PO в текущем чате:

1. Demo-комиссия **5% от основной услуги и всех выбранных дополнений**, `ROUND_HALF_UP` до копейки. Старые денежные снимки не пересчитывать.
2. Новый Demo flow: **явная симуляция оплаты → PENDING → принятие → IN_PROGRESS → REVIEW → COMPLETED**. Реальных списаний и оплаты по одному клику нет. Live сохраняет текущий серверный порядок до отдельного Backend-решения.

3. PO отдельно разрешил полноценные регистрационные формы **только в production Demo**. Production Live gate сохраняется.
4. PO подтвердил Demo-критерий подачи профиля: непустое имя и описание + минимум один валидный пример — HTTP(S)-ссылка либо локальный PNG/JPEG/WebP/PDF до **10 МиБ**. Решение модератора — только явная Demo-панель.
5. PO ответил: **«Передам основному Frontend; дождаться технического согласования»**. Техническое согласование ещё не получено. Реализация общих компонентов, contexts и хранения не начата.

Для новых заказов сохранять стоимость в копейках, выбранные дополнения, fee policy/version, комиссию и итог как неизменный снимок. Не добавлять неутверждённые изменения после оплаты/заказа.

## Что требует ответа до зависимого кода

- Техническое подтверждение путей/интерфейсов и одного автора, отсутствие параллельного переноса.
- Разрешение production Demo уже получено; его реализация входит в ожидаемый технический scope. Production Live gate не менять.
- Demo-критерии имени/описания/примеров, форматы и размер уже подтверждены PO выше; специализации — только при наличии подтверждённых данных. Политика изменения уже одобренного профиля и судьбы его опубликованных услуг пока требует PO.
- Арбитраж: кто открывает/закрывает, как выглядят решение и доступные действия; финансовые последствия/сроки/лимиты до решения не реализовывать.

## Проверки и последующая передача

Unit/domain: malformed storage без перезаписи, role guards, повторные команды, reload, старые snapshots, money rounding, canonical chat, immutable one-review-per-completed-order, запрет отзыва после арбитража. Integration UI: сохранение обоих режимов аккаунта, draft/portfolio/moderation, publish gate, ожидаемые unavailable Live. Общая регрессия: TypeScript, ESLint, весь test suite, Demo/Live builds, 22 routes, 320/390/768/1440 light/dark, keyboard/skip/error/reset, safe areas/reduced motion. Реальный Django — отдельный этап.

После реализации: новый полный manifest и независимая приёмка. Прежний accepted snapshot не объявлять снимком новых функций. Commit/push/merge/rebase/reset/stash и перенос в Integration не разрешены.
