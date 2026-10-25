# STUDLY 2.0 — Integration Progress Report

- Дата: 25.10.2026, Europe/Moscow.
- Начало: **16:34:56**, системные часы; окончание фиксируется ниже.
- Задача: проверить приложенные материалы и фактические Git-снимки перед полной интеграцией STUDLY 2.0. Указания Backend handoff рассматриваются как сведения о контракте, а не самостоятельное разрешение на Git, изменения Backend, публикацию или операции с данными.
- Cwd / Git root: `/Users/alekspih/Projects/studly-integration`.
- Ветка: `codex/frontend-api-integration`; назначенный порт 3002.
- HEAD / policy revision: `1888b9194827d00317fb9cf9d27218ef702999cb`.

## Главный результат

**Принятый Redesign не перенесён в Integration. Реализация API на старых страницах не начата.** Этап 2 переданного задания требует сначала подготовить отчёт и безопасный план переноса, а большой patch/merge/import допускает только после отдельного разрешения PO. Этот документ и точный список путей подготовлены для такого решения.

Непосредственная блокировка — исходная версия Frontend, а не отсутствие всех серверных API. Backend действительно реализовал новые независимые возможности; после переноса принятой UI-базы их можно подключать по подтверждённому контракту. Финансовые и продуктовые ограничения остаются отдельными.

## 1. Приложения и актуальные версии

Файлы открыты непосредственно по указанным пользователем путям, без поиска в Downloads:

- `/Users/alekspih/Downloads/INTEGRATION_HANDOFF.md`.
- `/Users/alekspih/Downloads/STUDLY_Backend_2_Отчет_для_партнера_2026_10_24.docx`.
- Текст комплексного задания: `/Users/alekspih/.codex/attachments/420e5c10-b4cb-49f5-8753-08dae4243442/Вставленный текст.txt`.

Word прочитан как источник содержания, включая три таблицы; сам файл не редактировался, визуальная приёмка его оформления не проводилась. В репозиторий локальные приложения сотрудника не копировались.

Handoff и Word оба датированы **24 октября**, описывают одну реализацию `ebec0915a17e55033cc62093912244c13bf13782`. Они байт-в-байт совпадают с опубликованными файлами в Backend HEAD. Контрольные суммы SHA-256:

| Приложение | SHA-256 |
|---|---|
| INTEGRATION_HANDOFF.md | `ef094cc2f6b1d72d5423a1c7ce5c78a6d05e2edd088ec4e5764af284a5685bdd` |
| Word-отчёт | `faac940caff2519401a526ca1a110186794544b83e122c382885f2351b679bc4` |

`git fetch origin` обновил Backend с `d7a5ffa…` до **`8999703fe60ef6714595614413faddc5a9308d44`**. Первая попытка получила sandbox EPERM на общий FETCH_HEAD; повтор с разрешённым расширенным доступом успешен. Merge/rebase не выполнялись.

| Источник | Фактическое состояние |
|---|---|
| Локальная Integration / origin Integration | Обе `1888b9194827d00317fb9cf9d27218ef702999cb` |
| Принятый Redesign / origin Redesign | `5db64a2437ce0b000f32de51bc730a9708be5178` |
| origin Backend после fetch | `8999703fe60ef6714595614413faddc5a9308d44`, commit **24.10.2026 01:43:48 +03:00** |
| Backend-код | `ebec0915a17e55033cc62093912244c13bf13782`; следующий 8999703 меняет только документы/отчёт, не `apps/api` |
| Локальная refs/heads/codex/backend этого общего Git | Отсутствует; отдельного Backend checkout в `git worktree list` нет. Это не проверка личной копии сотрудника |

В опубликованном Backend есть один отчёт `documents/project/для отчетов/backend/2026-10-24_backend-2-report.md` и его Word-версия; Backend README указывает на них. **Отдельного отчёта за 25 октября и более нового кода в этой remote-ветке нет.** Поэтому два приложенных файла не объявлены двумя независимыми этапами. Источник текущих возможностей — фактический код `ebec091` и обновлённые контракты `8999703`.

Первичные ссылки на точный Backend HEAD: [отчёт 24 октября](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/documents/project/%D0%B4%D0%BB%D1%8F%20%D0%BE%D1%82%D1%87%D0%B5%D1%82%D0%BE%D0%B2/backend/2026-10-24_backend-2-report.md), [API_CONTRACT](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), [регистрация](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md), [Backend ROUTE_API_MATRIX](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/ROUTE_API_MATRIX.md), [workspace OpenAPI](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/docs/workspace.openapi.json), [handoff](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/INTEGRATION_HANDOFF.md).

## 2. Проверка принятого Redesign

Integration HEAD — точный merge-base и предок принятого коммита. Принятый коммит не является предком Integration. На диске нет незакоммиченного переноса исходников; прежние изменения относятся только к отчётам.

Manifest принятой версии: `documents/project/для отчетов/frontend/redesign/2026-10-23_17-12_f123-candidate.manifest.json` из Git-дерева `5db64a2`.

SHA-256 **`ef7afc71711a6341238c0cab3e99ccbe4ebe2187012e8f516532cfb204022e65`** совпадает с заданием. Проверены 507/507 перечисленных файлов: SHA-256, длина и Git mode совпадают. Всего в accepted tree 510 путей: 507 записей manifest, сам manifest и два публикационных документа. `head=1888b91…` внутри manifest обозначает исходный HEAD до публикационного коммита, а не неверную принятую версию.

| Область переноса HEAD → accepted | Добавить | Изменить | Удалить |
|---|---:|---:|---:|
| `apps/web/src/**` | 32 | 38 | 0 |
| `apps/web/tests/**` | 13 | 0 | 0 |
| Документация / evidence | 267 | 2 | 0 |
| **Всего** | **312** | **40** | **0** |

То есть в `apps/web` требуется полный согласованный перенос **83 файлов**. Точный reviewable список всех 352 путей с текущими и принятыми Git blob/mode находится в [приложении аудита](2026-10-25_16-34_redesign-transfer-audit.json). Это список различий; patch к исходникам не применялся.

По 507 manifest-записям на текущем диске: 158 совпадают, 40 отличаются, 309 отсутствуют. Отдельно отсутствуют manifest и два публикационных документа. В частности:

- отсутствуют все 19 файлов `apps/web/src/features/demo-workspace/**`, включая AccountWorkspace, AdminWorkspace, CommerceWorkspace, Provider, RegistrationAdapter, model/domain/repository;
- отсутствует `apps/web/src/app/admin/page.tsx` и новые 13 тестов;
- существующие 38 source-файлов, включая страницы, регистрационный flow, AppShell и ChatWindow, ещё старые;
- исправления F1/F2/F3 находятся в принятом коде и regression-тестах, но в Integration не перенесены;
- package/lock, next.config, API lib/AuthContext, root/web AGENTS, TEAM_WORKFLOW и LOCAL_START между этими Git-снимками не меняются; Backend в перенос не входит.

В accepted подтверждены все 12 разделов AdminWorkspace: Обзор, Пользователи, Профили на проверке, Услуги, Заказы, Обращения и споры, Жалобы и безопасность, Отзывы, Финансы, Аналитика, История решений, Настройки. Это Demo sandbox, не доказательство серверной административной авторизации.

## 3. Сохранность Integration и индекса

Пять прежних отслеживаемых API-отчётов присутствуют байт-в-байт и в принятом Redesign. Два локальных отчёта от 19 октября не входят в accepted и должны быть сохранены отдельно:

- `2026-10-19_00-21_session-initialization.md`, SHA-256 `fbd95f594d58466b3b2f182918733bdecdb48a823f39b7098617d90608810d31`;
- `2026-10-19_00-44_django-live-plan.md`, SHA-256 `f5caf858f3f824f4878110bd2e2ac6f9f17ea771f4c31cbd1fa85ab737b84315`.

Текущий незакоммиченный README до этого аудита добавлял только две ссылки на эти отчёты в конце. Accepted добавляет 12 строк ближе к началу; текущие hunks не пересекаются. При будущем merge всё равно требуется проверить итоговый индекс и сохранить обе группы ссылок, новый progress report и JSON-приложение. Прежний отчёт Live от 19 октября — история: новые миграции, pypdf, v2 tariff и API нужно брать из текущего Backend, не считать старый план готовой конфигурацией.

## 4. Backend: что подтверждено кодом

Ниже READY означает наличие маршрутов, реализации, контракта и соответствующих тестовых сценариев в опубликованном коде. Это **не** утверждение об успешном runtime/E2E в Integration. В этой сессии тесты Backend не запускались.

| Блок | Статус серверного кода | Точки подключения / ограничения |
|---|---|---|
| Аккаунт, роли, кабинеты | READY | GET `/api/v1/account/`, GET `/api/v1/cabinet/?role=customer|performer`, совместимые роли через registration; UI activeRole не permission |
| Каталог и серверное избранное | READY | GET services, серверные category/price/duration/ordering; GET favorites, PUT/DELETE `favorites/{id}/`; рейтинг не добавлен |
| Портфолио и модерация исполнителя | READY | portfolio CRUD/content, performer/moderation; приватные URL/файлы, revision и отдельное approval |
| Услуги v2 | READY | `/api/v2/services/`, `/api/v2/my/services/`, detail/PATCH/submit; draft, pending, published различаются |
| Quote v2 и неоплаченные заказы | READY | POST `/api/v2/quotes/`, POST `/api/v2/orders/`, существующие accept/cancel/decline; оплаченного выполнения нет |
| Переписка, удержание и обжалование | READY | discussions, conversations/messages, security-cases appeal; серверные ID, cursor/sequence, хранение и приватность held |
| Staff API | PARTIAL | Шесть ресурсов с отдельными правами; не покрывает все 12 разделов принятого Admin UI |
| Оплата, возврат, выплаты, результаты, completed, отзывы, арбитражные команды | BLOCKED | Нужны продуктовые/провайдерские решения и серверные операции; не подменять Demo |
| Новые API на реальном тестовом стенде / Telegram / cookies / files | NOT VERIFIED | Локально/через Next в этой сессии не запускались; новый snapshot не считается размещённым по наличию Git-кода |

Критические отличия для будущих typed adapters:

1. V1 сохраняет **3%**, v2 реально считает **5% от base + extras** через Decimal/ROUND_HALF_UP. В v2 `price_amount` — subtotal; `base_price_amount` хранится отдельно. Суммы не пересчитывать во Frontend.
2. V2 order POST принимает только `quote_id` и `request_key`. На 409 нужны новый quote и согласие пользователя; неизвестный исход повторяется прежним ключом. После replay читать актуальную запись GET.
3. Server order states: `pending_acceptance`, `awaiting_payment`, `cancelled`, `declined`; `payment_status=unpaid`. Demo IN_PROGRESS/REVIEW/COMPLETED к ним не приравниваются.
4. Versioned mutations используют `revision` и UUID `request_key`; новый service draft — revision 0. Регистрация принимает optional `performer_revision`.
5. Правки approved профиля/портфолио разрешены сервером, возвращают профиль на проверку и скрывают услуги. `performer_ready` не approval. После записи нужна новая moderation revision.
6. Portfolio: URL или multipart PNG/JPEG/WebP/PDF до 10 МиБ, private content; PDF скачивается. Публичное портфолио и произвольная серверная загрузка URL не включены.
7. Order conversation не совпадает с pre-order discussion. `stored` означает сохранение/доступность, не прочтение. Held-текст не выдаётся адресату; release сохраняет message ID и получает новый sequence.
8. Staff permissions: `accounts.view_user`, `accounts.moderate_performer`, `catalog.moderate_service`, `orders.view_order`, `operations.view_auditevent`, `conversations.review_security_case`. Одного is_staff недостаточно; case content требует purpose, участник не решает свой case. Адрес Live STUDLY Admin UI нужно согласовать отдельно от Django `/admin/`.

Новый migration graph относительно d7a5ffa: accounts.0004; catalog.0004/0005; operations.0001; orders.0003/0004; conversations.0001–0004. Tariff migration добавляет buyer-3-v1 и buyer-5-v1 без пересчёта старых сумм. Старые performer-профили автоматически approval не получают; видимость услуг после миграции требует отдельной проверки.

Workspace OpenAPI действительно содержит 42 path и 54 схемы. Backend-отчёт заявляет 238/238 PASS и успешный CI. Код тестов и CI-конфигурация изучены; CI сетью заново не проверялся, результаты сотрудника не выдаются за наши тесты.

Окружение по новому контракту: Python 3.13/PostgreSQL 17 для локального плана, прежние закреплённые зависимости плюс pypdf 6.21.2; `STUDLY_V2_BUYER_TARIFF=buyer-5-v1`, неизвестный tariff даёт 503 без fallback. `.env.example` всё ещё содержит CSRF origins 3000; будущему выделенному Django нужна согласованная конфигурация для 3002. Шаблон reverse proxy допускает 12m для файлов 10 МиБ + multipart, а работающий proxy этим Backend-этапом не менялся. Никакая из этих настроек сейчас не применялась.

## 5. Конкретный безопасный план завершения переноса

До отдельного разрешения PO этот план не выполнять.

1. Повторить проверку cwd/ветки/status/fetch и точных SHA. Подтвердить одного автора переноса и отсутствие параллельной записи общих файлов.
2. Сохранить согласованным **локальным checkpoint commit только Integration-документацию**: два отчёта 19 октября, этот progress report, JSON-аудит и индекс README. Это отдельное действие, сейчас не разрешено. Не stash/reset и не включать чужие/новые неизвестные изменения.
3. По TEAM_WORKFLOW принятая Redesign-линия должна пройти согласованный PR в main-dev, а Integration получить её обычным merge после разрешения. Если PO хочет перенос прямо сейчас только в Integration, требуется **явно согласованное исключение: обычный merge точного `5db64a2437ce0b000f32de51bc730a9708be5178` в `codex/frontend-api-integration`**, без изменений соседних checkout и без push. Это позволит сохранить coherent принятый snapshot и Git-историю. Не заменять этот шаг выборочным копированием файлов, большим patch или набором cherry-pick.
4. При любом неизвестном конфликте остановиться и показать стороны/семантику. Не выбирать автоматически ours/theirs. Проверить объединённый README: принятые ссылки Redesign и все локальные Integration-отчёты должны сохраниться.
5. До API-изменений заново проверить 507 manifest-путей/режимов и наличие manifest + двух публикационных документов; отдельно хэши двух отчётов 19 октября. Сверить Demo workspace, все 12 admin sections, 13 новых тестов и F1/F2/F3. Убедиться в отсутствии Backend/config/package/policy изменений вне согласованного diff.
6. Запустить на перенесённой базе TypeScript, ESLint, существующие CJS/TS тесты, Demo/Live production builds, production gates и нужную браузерную регрессию. Исторические 220 CJS + 8 TS из acceptance evidence не заменяют новый прогон. Проверить отсутствие секретов и `git diff --check`.
7. Только после подтверждения полной принятой UI-базы начать API integration: собственная ROUTE_API_MATRIX по фактическим страницам → auth/account/registration/cabinets → portfolio/moderation → services → v2 quote/orders → conversations → staff resources. Backend dependencies вести как приложение к этому единому progress report.

Новая Frontend ROUTE_API_MATRIX пока не выдана за актуальную: её заполнение по старым страницам нарушило бы условие этапа 2. Первичная Backend-матрица доступна по точному SHA выше. После переноса нужно покрыть все accepted маршруты и 12 admin sections, не объявляя неподдерживаемые разделы готовыми.

## 6. Что выполнено и что осталось

Выполнено: чтение приложений по прямым путям, их побайтовая сверка с публикацией; системные часы, Git-инвентаризация/fetch; проверка реального Backend-кода/маршрутов/permissions/DTO/миграций/тестовых сценариев; независимая проверка accepted manifest и diff; сохранение единого отчёта и точного списка переноса. Два внутренних агента выполняли только чтение: один проверял accepted baseline, второй Backend. Запись всех файлов выполнял один автор в Integration.

Новых API-клиентов, adapters или страниц в этом этапе не подключалось; Demo/Live-код не менялся. Реальный сквозной путь ещё не подтверждён. Backend-код, env, миграции, БД, зависимости, соседние worktree и production не менялись. Сообщения сотруднику/другим чатам не отправлялись.

| Проверка | Фактический результат |
|---|---|
| cwd / root / branch / HEAD / worktree list | Ожидаемое Integration-окружение подтверждено |
| fetch и remote SHA | Выполнена, текущий Backend 8999703, accepted Redesign 5db64a2 |
| Приложения против опубликованных версий | MD и DOCX byte-identical |
| Accepted manifest | 507/507 файлов, bytes/modes/SHA-256 совпали; digest совпал с заданием |
| Полнота переноса | Не пройдена: 83 apps/web файла требуют переноса; всего diff 352 пути |
| TypeScript, ESLint, CJS/TS tests, Demo/Live build | Не запускалась: реализация и перенос заблокированы условием этапа 2 |
| Django/PostgreSQL/миграции, Telegram, API smoke/E2E | Не запускалась |
| Браузер, desktop/mobile, light/dark, клавиатура | Не запускалась |
| Git diff/ссылки/сохранность отчётов | `git diff --check` прошёл; 29 ссылок проверены; JSON/352 пути согласованы; SHA-256 двух прежних отчётов не изменились; code/staged diff пусты |

Созданы: этот Markdown и `2026-10-25_16-34_redesign-transfer-audit.json`. Изменён только индекс отчётов README. Два прежних untracked отчёта 19 октября сохранены без правок. Commit/push/merge/rebase/reset/stash не выполнялись. Готовность к полной технической приёмке Live не заявляется; следующий необходимый шаг — отдельное решение PO о переносе принятой UI-базы и сохранении текущей документации.

Окончание анализа и финальной проверки: **25.10.2026, 16:42:04 Europe/Moscow**, системные часы. HEAD остался `1888b91`. Рабочее дерево содержит изменённый индекс и четыре untracked файла отчётности: два прежних и два этого этапа. Изменений исходников нет.
