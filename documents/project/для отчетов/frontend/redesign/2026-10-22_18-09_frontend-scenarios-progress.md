# STUDLY 2.0 — комплексное завершение пользовательских сценариев

Дата: **22.10.2026**, Europe/Moscow. Начало контрольного этапа по системным часам: **18:09:21**. Это единая продолжающаяся задача на весь согласованный Frontend UX и Demo, не отдельное завершение очередного экрана.

**Текущий статус: реализация A–G записана в исходники, идёт завершение и общая регрессия H.** Техническое согласование основного Frontend получено 22.10 в 20:41; PO явно разрешил реализацию. Код начат 22.10.2026 в 20:51:25 MSK. После прерывания из-за лимита работа продолжена 23.10.2026 в 10:42:08 MSK с сохранённых файлов. Ниже разделы аудита 18:09 сохранены как исторический снимок; актуальные результаты реализации приведены в продолжении.

## 1. Исходное состояние и сохранность

- Фактические cwd/Git root: `/Users/alekspih/Projects/studly-redesign`, ветка `codex/frontend-redesign-campus`, HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`; staged пуст.
- До новых документов: **34 modified tracked +158 untracked**, принятый полный Redesign и исправления P2/P3. Набор22 page.tsx сохранён.
- Три постоянных worktree/ветки соответствуют TEAM_WORKFLOW. Соседние checkout не редактировались. Integration содержит прежний изменённый отчётный README и два отчёта19.10, исходники относительно базы чисты. Перенос не обнаружен.
- Основной Frontend и Integration на момент проверки idle; прочитаны последние завершённые задачи. Основное направление завершило повторную приёмку, Integration — подготовку плана Django; применённого переноса нет. Это контрольный снимок, а не вечная гарантия отсутствия будущих параллельных правок.
- Проверены **356/356 hashes и modes** по независимому accepted manifest22.10.2026 03:15, несовпадений0. SHA manifest: `3dc90f9d73d4b065d212a68b968e79a034a8a64adbfa40e2ccca56115d0061a9`. Кандидат передачи в нём192 файла. Перед любым новым кодом scope должен быть согласован; после реализации нужен новый manifest.
- Прочитаны задание из вложения, AGENTS.md, apps/web/AGENTS.md, TEAM_WORKFLOW, handoffs Redesign/Core/Integration, отчёты полного Redesign и P2/P3, независимая повторная приёмка. Старые отчёты не копировались из соседних checkout.
- `git fetch origin` выполнен: sandbox отказал в записи FETCH_HEAD, разрешённый повтор прошёл. Backend остался **`d7a5ffa5abc1537301ced7275da9e45282d6b4f3`**. Общие политики относительно origin/codex/frontend-main-dev не расходятся.

Первичный [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md) и [REGISTRATION_API](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/REGISTRATION_API.md) изучены read-only. Новых/изменённых endpoints этого этапа нет.

## 2. Решения PO в текущем чате

| Вопрос | Ответ / область действия |
|---|---|
| Новая Demo-комиссия | **5% от основной услуги + выбранных дополнений**, округление HALF_UP до копейки; прошлые снимки сохраняются |
| Новый Demo lifecycle | **Явная симуляция оплаты → PENDING → принятие исполнителем → IN_PROGRESS → REVIEW → COMPLETED**; Live порядок сохраняется |
| Production registration gate | Открыть формы **только для явно выбранного production Demo**; production Live gate не меняется |
| Готовность Demo-профиля к подаче | Непустые имя/описание + минимум один HTTP(S)-пример либо локальный PNG/JPEG/WebP/PDF ≤10 МиБ |
| Demo-модерация | Решение только явной Demo-панелью, без автоматического одобрения |
| Техническое согласование | PO передаст scope основному Frontend; **дождаться согласования** |

Правила единственного неизменяемого отзыва1–5 после COMPLETED и запрета после арбитража взяты из задания; повторное согласование самих этих правил не требуется. Неопределённые границы арбитража перечислены отдельно.

## 3. Реальная архитектура и данные

`RootLayout → AuthProvider → AppShell → FavoritesProvider → CampusShell → route`. Auth/Favorites не имеют role route keys; стабильный main/skip target уже исправлен и принят. RegistrationProvider находится только под register layout, который сейчас закрывает формы в любом production, включая Demo.

AuthContext в Demo остаётся anonymous/user:null; это не Demo-аккаунт. Live SessionUser знает id/display_name/telegram_username. Роли и дополнительные поля — в registration API, не в session DTO. Активного режима UI, server moderation approval и кабинетов в текущем Auth нет.

Demo registration draft хранится в React state и теряется при reload. Роли можно выбрать обе, данные performer при отключении роли не стираются. Live draft восстанавливается с сервера, формы уже имеют prerequisite guards/busy/errors/retry/abort. Завершение Demo сейчас previewComplete; Live complete ведёт на главную, а не в роль-кабинет.

Текущие browser namespaces:

| Хранилище | Что хранит / ограничение |
|---|---|
| `favorites` | Demo service IDs; whitelist только статического Demo-каталога |
| `studly-api-favorites` | Live browser-local IDs; не серверный список и не синхронизация аккаунта |
| `studly-orders` | Старые Demo orders, snapshot дополнений/цен/срока, chatId; нет владельца/revision/fee policy |
| `studly-chats` | Старые Demo chats, performer/service и единственный orderId |
| `studly-chat-messages-<id>` | Старые сообщения id/text/mine/time; нет senderId/client operation ID |
| React create-service state / blob URLs | Временный draft/preview; reload не восстанавливает файлы |

Будущий Demo workspace должен быть отдельным от Auth/Live. Его новая модель — только предложение в [архитектурном scope](2026-10-22_18-09_architecture-coordination.md). Legacy-ключи не удалять, не мигрировать и не пересчитывать автоматически.

## 4. Карта всех маршрутов и состояний

Обозначения: **Frontend** — реально работающий интерфейс/локальная навигация без серверного изменения; **Demo** — только явно локальная модель; **Live** — существующий настоящий клиент API. Раздел недоступен в Live, если требуемого адаптера/сервера нет; визуальное оформление не означает функциональную готовность.

| Маршрут | Сейчас | Следующий необходимый сценарий / зависимость |
|---|---|---|
| `/` | Frontend: hero/навигация; Demo fixtures; Live services list | Связь с роль-кабинетом и согласованными новыми Demo published services |
| `/search` | Полностью оформленные поиск/фильтры; Demo и Live catalog | Сохранить эталон. Добавить только Demo data adapter новых approved services |
| `/category/[slug]` | Demo фильтр/сортировка; честная Live-недоступность категории | Не выдумывать server category contract |
| `/service/[id]` | Demo extras/локальный order/chat; Live service+quote/retry/errors, actions disabled | Demo5% snapshot и явная simulation, canonical order/chat; Live оставить server sums |
| `/favorites` | Реальная local Frontend функция, разделены Demo/Live; reload/storage events | Учесть новые approved Demo IDs, без смешивания аккаунта/Live |
| `/profile` | Campus-заглушка и ссылки | Одна identity, два кабинета, профиль/настройки/role switch, readiness/portfolio/moderation |
| `/profile/[id]` | Demo fixture stats; Live только name/about/services | Demo собственный профиль/услуги/отзывы; Live unavailable для отсутствующих данных |
| `/orders` | Demo список; Live disabled | Покупки и заказы исполнителя, participant filtering, legacy history |
| `/orders/[id]` | Demo состав/сумма/4 статуса, действия/чат | Money fee snapshot, guards/role/revision, результат/замечания/доработка/спор/review |
| `/orders/[id]/additional-payment` | Сводка дополнения; paymentAvailable=false | Не включать старую MOCK-success ветку. Поздние дополнения требуют правила/контракта |
| `/chats` | Demo список, последнее сообщение, сортировка; Live disabled | Canonical participant contexts и сообщения обеих сторон |
| `/chats/[id]` | Demo local composer и linked order; все сообщения mine:true | Sender identity, idempotent commands, корректный reload/смена диалога, один context заказа |
| `/notifications` | Demo fixtures; Live disabled | Не выдавать fixture события за серверные; новые local events только в Demo |
| `/create-service` | Поля/валидация/дополнения/локальные фото/preview | Persist draft, performer approval gate, submit/moderation/reason, approved-only catalog |
| `/welcome` | Переход в registration | Вернуться к draft либо существующему кабинету, честная Demo-маркировка |
| `/register/roles` | Обе роли, текущий provider, production gate | Persist selectedRoles и правильный следующий шаг; production Demo отдельно разрешён |
| `/register/profile` | Имя/avatar/university/city/about, guards/errors | Reload draft без потери данных, завершение в нужном кабинете |
| `/register/performer` | Description/studyYear/portfolio/specs, skip | Разделить регистрационную полноту и publish approval; не считать performer_ready модерацией |
| `/about` | Оформленная информация | Сохранить факты и навигацию |
| `/rules` | Честная информационная заглушка | Юридические правила не выдумывать |
| `/safety` | Существующая информация | Не добавлять неподтверждённых платёжных гарантий |
| `/support` | Честная заглушка | Не создавать фиктивную доставку обращения/контакты |

Next error/not-found уже существуют. P2 helper безопасно показывает status/name; P3 main target сохраняется независимо от страницы. Эти исправления должны остаться в общей регрессии.

## 5. Карта пользовательских путей и отсутствующих зависимостей

### Заказчик

Цель: welcome → роли → профиль → кабинет → search/favorites → service → прозрачный quote → доступный order flow → чат → результат → проверка → завершение → отзыв.

Сейчас связаны каталог/услуга/публичный исполнитель/избранное и старый локальный order/chat. Нет постоянного Demo account, кабинета, actor guards, 5% fee snapshot, симуляционного checkout, результата/замечаний/отзывов. В Live подключён read catalog/quote и auth/registration client, но production registration закрыта и order client отсутствует.

### Исполнитель

Цель: роли → профиль → обязательные примеры → submit → понятное ожидание/решение → создать услугу → draft/preview → submit/moderation → published → назначенные заказы → результат/исправления.

Сейчас нет собственной ролевой панели, структурированного портфолио и approval модели. Create-service — только локальный preview, черновик не сохраняется. Backend предоставляет my/services, но не новые ограничения обязательных работ/одобренного профиля; `performer_ready` не заменяет их.

### Обе роли

Один accountId, отдельная activeRole preference, сохранённые данные обеих частей профиля и одна история. Смена режима не remount-ит providers и не даёт серверных permissions. Для моделирования контрагента нужен явно отдельный Demo actor, не превращение текущего пользователя в другого участника через обычный role switch.

### Заказ, чат, замечания, арбитраж и отзыв

Новая Demo-модель должна иметь canonical order + устойчивый conversation + participant IDs + operation IDs/revisions. После REVIEW заказчик подтверждает либо описывает замечания; исполнитель видит их и повторно передаёт результат. Обсуждение/доработка/спор/рассмотрение/решение различаются. Сроки, количество доработок, возвраты и полномочия не выводятся из макета. Отзыв неизменяем и связан с конкретным завершённым заказом; arbitration rule проверяется domain-командой, не только кнопкой.

Live не имеет исполнения/чата/отзывов/споров, поэтому UI должен объяснять доступность, а не локально объявлять успешный серверный результат.

## 6. Выявленные функциональные риски

1. CreateOrderButton не имеет idempotency/busy guard. Date.now может дать совпадающие IDs; повторное действие создаёт вторую запись.
2. Чат ищется по performer+service, затем единственный chat.orderId перезаписывается. Несколько заказов делят chatId; сводка меняется от последнего открытия заказа.
3. Order/chat сохраняются отдельными setItem; при ошибке второй записи связь неполная. Между вкладками нет транзакции/защиты lost update.
4. updateStatus проверен кнопкой, но не самой командой; stale view может выполнить недопустимый переход.
5. Сообщения имеют mine:true вместо senderId; нет защиты от повторного operation. При смене chatId эффекты могут сохранить предыдущие messages в новый key.
6. P2 закрыла status/name presentation, но не schema всех storage records: malformed array elements/additionalServices/messages/money и quota/access errors остаются.
7. Production gate закрывает также Demo onboarding; текущий draft исчезает после reload.
8. Create-service не сохраняет draft, не валидирует полностью допуслуги; blob URLs не постоянны и не всегда освобождаются.
9. Favorites уже разделены по mode, но новые динамические Demo service IDs отвергаются нынешним whitelist; Live list не account-specific.
10. Backend3% и принятие до оплаты расходятся с новым Demo-планом. Service revision не защищает от смены тарифа между quote/create; требуется server quote/tariff confirmation.

Это результаты статического аудита исходников; ни один новый дефект в этом этапе не объявлен браузерно воспроизведённым или исправленным.

## 7. План реализации после технического согласования

| Группа | Работа | Статус |
|---|---|---|
| A | Изолированный Demo domain/repository/provider: schema, команды/roles/revisions, money snapshots, legacy read adapter, persistence errors | Ожидает technical scope |
| B | Переиспользование registration, production Demo gate, draft reload, кабинеты/role switch/редактирование известных полей | Product решения получены; ожидает technical scope |
| C | Portfolio local preview/persistence, profile readiness/moderation, явная Demo-панель | Критерии подтверждены; политика изменения approved profile открыта |
| D | Существующая service form + draft/preview/submission/moderation, approved-only catalog | Ожидает shared interfaces и approval capability |
| E | Demo5% checkout/simulation, guarded lifecycle и один чат, обе стороны, reload/double actions | Деньги/порядок подтверждены; ожидает domain scope |
| F | Result/comments/revision, модельные dispute states и immutable review/aggregates | Независимые правила review известны; детали арбитража требуют PO |
| G | Honest Live adapters/capability states в пределах нынешнего API, без новых DTO/фиктивных mutations | Ожидает scope; реальная Integration отдельна |
| H | Полная регрессия, screenshots, final Backend/Integration handoff, новый manifest, повторная приёмка | После реализации; не запускалась |

Общие файлы меняет один root. Внутренние агенты выполняли только непересекающиеся read-only audits. Новые API-клиенты, Auth/SDK/CSRF/Django/package/lock не изменяются как побочный эффект этой задачи.

## 8. Открытые продуктовые вопросы

Не повторять уже принятые ответы по5%, базе/округлению, Demo оплате, gate и портфолио. Остаются:

- Какие изменения одобренного performer profile/примеров запускают повторную модерацию и что происходит с его опубликованными услугами?
- На каком событии арбитража отзыв становится запрещённым: открытие, передача арбитру или решение? Как учитывать отозванный спор?
- Кто открывает/закрывает спор; какие решения/права моделировать? Сроки, лимиты доработок, возвраты и полномочия без решения не реализовывать.
- Старые безвладельные Demo-заказы: отдельный просмотр без новых команд либо сохранение прежнего legacy режима действий? Явный импорт/миграция без разрешения не выполняется.
- Если нужны дополнительные покупки после заказа: отдельный quote/комиссия или другой согласованный сценарий? До ответа старый paymentAvailable=false не включать.

Это вопросы перед соответствующими зависимыми частями. Они не мешают независимым группам после общего технического согласования.

## 9. Требования Backend и Integration

Подготовлены отдельные **черновики**, без отправки сотруднику и без выполнения переноса:

- [BACKEND HANDOFF](2026-10-22_18-09_backend-handoff.md): существующие API/states/permissions и требуемые операции, methods/actors/inputs/outputs/errors/idempotency,5%, tariff confirmation, portfolio/moderation/payment/result/chat/dispute/review.
- [INTEGRATION HANDOFF](2026-10-22_18-09_integration-handoff.md): adapters, Demo/Live separation, работа с существующими registration/my-services/unpaid-orders, guards и настоящая regression gate.
- [Сообщение основному Frontend и точный scope](2026-10-22_18-09_architecture-coordination.md): paths, предлагаемые props/domain boundaries, один автор, protected files и проверки.

## 10. Проверки текущего этапа

| Проверка | Фактический результат |
|---|---|
| cwd/root/branch/HEAD/status/staged/worktrees | Выполнена; назначение верно, staged пуст |
| Сохранность принятого snapshot до новых документов | **356/356 hashes+modes PASS**,0 mismatch |
| Backend fetch/reference и policy comparison | PASS, прежний d7a5ffa; политики не расходятся |
| Начавшийся перенос / параллельные исходники | Не обнаружен по Git/файлам и последним завершённым задачам; PO дополнительно ожидает технической координации |
| Read-only архитектурный/контрактный аудит | Выполнен root и тремя непересекающимися группами |
| TypeScript | **Не запускалась** в этом этапе: исходники не менялись |
| ESLint | **Не запускалась** в этом этапе |
| Автотесты / новые regression tests | **Не запускалась**; новые тесты пока не написаны |
| Production Demo / Live builds | **Не запускалась**; .next не перезаписывался |
| Browser/screenshot/Telegram/Django | **Не запускалась**; процессы не запускались/не останавливались |
| git diff --check и локальные ссылки документации | Финальные результаты ниже |

Исторические99 тестов и Demo/Live builds из прежних отчётов не выдаются за проверки этого нового функционального этапа.

## 11. Файлы и Git

В этом этапе созданы только четыре Markdown: этот общий прогресс, architecture-coordination, backend-handoff и integration-handoff. Обновляются два существующих README-индекса отчётов. Код/тесты/API/DTO/context/package/lock/Django и старые доказательства не менялись, данные browser storage не читались/не очищались/не мигрировали. Чужие процессы и соседние файлы не менялись.

Окончательный manifest новых функций пока не создаётся: реализация не начата. Accepted source hashes сохранены; после новых README прежний manifest уже не является точным snapshot всего рабочего дерева документации, это необходимо учитывать перед переносом.

Commit/push/merge/rebase/reset/stash/git add, patch/import и сообщения в другие чаты не выполнялись. Продуктовая задача продолжается после ожидаемого технического согласования; никакие остальные экраны не объявлены завершёнными этим аудитом.

Аудит и подготовка документов завершены: **22.10.2026 18:30:17 Europe/Moscow**, системные часы. Локальные ссылки четырёх документов: **6 PASS**; trailing whitespace новых Markdown отсутствует; `git diff --check` PASS. Из356 принятых файлов **354 совпадают**, менялись только два README-индекса; **все 92 файлов src/tests совпадают**. Добавлены ровно четыре описанных Markdown. Git: **34 modified +162 untracked**, staged пуст, HEAD/ветка прежние; удалений нет. Реализация не начата: ожидается техническое согласование, которое PO передаст основному Frontend.


## 12. Реализация после согласования — продолжающийся этап

Согласование: официальный документ основного Frontend `2026-10-22_20-41_architecture-scope-approval.md`, прочитан read-only из основного checkout. Root — единственный автор пересечений; внутренние агенты работают в изолированных feature UI/tests. Новый Demo слой уже подключён к маршрутам, это не только документация.

| Группа | Записанный результат | Проверка на возобновлении 23.10 |
|---|---|---|
| A | model/domain, IndexedDB state+assets atomic commands, provider, roles/revisions/action IDs, legacy read adapter | 17 domain tests ранее PASS; TSC сейчас PASS; repository review продолжается |
| B | Постоянный registration draft и Blob avatar, production Demo gate, один account и два кабинета | Реальные hook/render tests; новый avatar-only cross-tab edge проверяется |
| C | Портфолио URL/file, readiness, pending/approved/rejected/changes, явная Demo-модерация | 11 account +13 admin render checks сохранены, итоговый suite после исправлений |
| D | Сохранённые service drafts, preview/submit, approved-only catalog/favorites/public profile | 5 catalog checks; полноценный сквозной путь ещё проверяется |
| E | Integer 5% HALF_UP snapshot, explicit payment simulation, idempotent purchase, canonical order/conversation | Входящий performer flow дополняется; браузерная проверка впереди |
| F | Результат, замечания, повторный результат, завершение, immutable review/aggregates | Domain/render tests; спорные policy-dependent команды остаются unavailable |
| G | Существующие Live branches сохранены, DemoProvider только в Demo, API/Auth/DTO не меняются | Защищённые файлы и Live build будут повторно сверены |
| H | Полная регрессия, screenshots, handoffs, новый manifest | В работе; пока не объявлена завершённой |
| Admin | 12 разделов, канонические очереди profile/service, подтверждение с причиной, read-only операции без утверждённых правил | Production sandbox закрыт по умолчанию; QA требует явного build-флага |

На 23.10 10:44: TypeScript PASS; ESLint 0 errors /2 прежних img warnings; первый повторный suite нашёл avatar-only regression (исправление/повтор в работе). Первая production Demo QA-сборка компилируется успешно, ожидается завершение build. Это промежуточные факты, не финальная приёмка. Старые localStorage записи не очищались/не мигрировали, соседние checkout не редактировались, Git HEAD прежний, staged пуст.


## 13. Итог реализации и передача23.10

Группы A–H завершены в согласованном Frontend/Demo scope; открытые PO/Backend операции остаются объяснённо unavailable. [Итоговый отчёт](2026-10-23_10-42_frontend-scenarios-completion.md), [доказательства](implementation/2026-10-23-scenarios/README.md), [новый manifest](2026-10-23_10-42_frontend-scenarios.manifest.json).207 tests PASS, TS/ESLint/builds PASS,184 browser route/theme/width checks и native IDB8/8. Исторические «Не запускалась» выше относятся к аудиту18:09; новые фактические результаты находятся в итоговом отчёте. Самостоятельный перенос/публикация не выполнялись.
