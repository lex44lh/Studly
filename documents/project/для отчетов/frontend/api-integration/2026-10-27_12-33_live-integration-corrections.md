# STUDLY 2.0 — исправление REJECTED Live Integration

Начало: **27.10.2026 12:33:13 Europe/Moscow**, по системным часам. **Окончание реализации и браузерных проверок: 27.10.2026 13:11:01 Europe/Moscow**. Отчётные/Git gates выполняются перед публикацией с отдельными timestamps в evidence. Рабочая папка `/Users/alekspih/Projects/studly-integration`, ветка `codex/frontend-api-integration`, порт 3002.

Цель — исправить L1–L4/C1 опубликованного отклонённого кандидата **abe0efb2648ab34f19b9c23f3cf4427bd76e6e05**, сохранить существующую интеграцию и принятый Campus/F1/F2/F3, предоставить новый проверяемый клиентский кандидат. PO отдельно разрешил исправления, необходимые commits и обычный push этой ветки. Повторный перенос Redesign, merge и подключение production не выполнялись.

## Основания и контракт

Прочитаны root/apps/web AGENTS, TEAM_WORKFLOW, handoff Integration, собственный [предыдущий отчёт](2026-10-26_00-08_django-live-integration.md) и материалы независимой приёмки в основном checkout, только для чтения:

- `2026-10-26_22-08_django-live-independent-acceptance.md`;
- `2026-10-26_22-08_live-review-handoff.md`;
- связанные журналы, JSON и четыре issue screenshots в `implementation/2026-10-26-independent-live/`.

Независимые документы не редактировались и не копировались в Integration. Предыдущие зелёные 341 тест не были приняты за доказательство отсутствия найденных interaction defects. Новые сценарии проверяют именно эти воспроизведения.

Безопасный fetch проверил Backend **8999703fe60ef6714595614413faddc5a9308d44**. Источник контракта: [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), [REGISTRATION_API.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md), опубликованный OpenAPI и серверные исходники через Git objects. Правило исходного receipt — API_CONTRACT:267 и `apps/api/operations/services.py:17–30`. DTO/endpoints/серверные бизнес-правила не менялись.

## Исправления и доказательства

| ID | Причина | Изменение | Целевая проверка | Результат |
|---|---|---|---|---|
| L4/P1 | Revision не связывает dirty-форму с actor; общая cookie менялась вне вкладки | Immutable actor+epoch для форм/writers; GET me перед и после свежего CSRF; проверка lease перед записью и выдачей результата; abort старых запросов; focus/pageshow/visibility/channel/storage recheck; явное закрытие контекста и удаление старого ввода | A/B с одинаковой revision, две реальные вкладки в одном browser context; смена cookie во время CSRF; A→B→A; logout, expired/unbound writer; события фокуса/канала/storage | Клиентские guards и целевые регрессии PASS; атомарная серверная привязка остаётся Backend dependency |
| L1/P2 | Pending slot зависел от текущих extras, которые сбрасывались после reload | Account/service slot, discovery/migration прежних extras-слотов; original quote/key/attempted; GET собственного заказа/detail либо quote; восстановление extras из серверного DTO; блокировка новых намерений при неопределённости | Extras → quote → сервер сохранил order → 503 → reload → тот же order/один POST; changed revision; quote404; ошибка GET; malformed/ambiguous storage; прежний unknown→409 без подтверждения | Unit/contract и собственное browser воспроизведение PASS |
| L2/P2 | Собственная portfolio-команда повышала общую revision под dirty profile | Synchronous dirty guard блокирует portfolio/moderation до save/discard; собственные последовательные операции получают подтверждённый snapshot; внешняя revision не присваивается форме автоматически | Dirty name → заблокированное portfolio → save name → portfolio; stale external CAS из второй вкладки | Unit и browser PASS |
| L3/P2 | Completed account мог сохранить пустое имя/ноль ролей и потерять редактор за production gate | Trim-name и хотя бы одна роль проверяются до PATCH; ошибки рядом с полями; production gate сохранён | Whitespace-only name и ноль ролей → ноль PATCH, completion сохраняется; валидное сохранение; ранее incomplete остаётся закрыт | Unit и browser PASS; recovery не выполнялся |
| C1/P2 | Receipt является исходным response, а не current state | После purchase/order action/appeal — GET current resource; после send/retry — все cursor pages, merge по ID/sequence; GET failure сохраняет неизвестный исход и ключ | Accept receipt awaiting_payment при текущем cancelled; held receipt с прежним ID/sequence против released stored с новым sequence; ошибка reconciliation GET | Unit/contract и собственное browser воспроизведение PASS |

### Файлы и строки

Относительные пути ниже относятся к `apps/web/`; полный список с modes/хешами — в manifest.

| Файл:строка | Назначение |
|---|---|
| `src/lib/api/session.ts:14`, `:28`, `:35`, `:47` | Coordinator, immutable identity lease, controller и серверная проверка actor |
| `src/lib/api/client.ts:23`, `:37`, `:49` | Bound raw write, late response abort, две проверки вокруг CSRF; credentials same-origin/no-store сохранены |
| `src/lib/api/auth.ts:33` | Logout проходит ту же identity/CSRF защиту; signed Mini App login сохранён |
| `src/context/AuthContext.tsx:36`, `:89` | Подтверждение actor/epoch и межвкладочная/фокусная синхронизация; явное подтверждение нового входа |
| `src/features/live/shared.tsx:42`, `:48` | Private children и resources keyed actor+epoch; старый контекст размонтируется |
| `src/features/live-account/useAccountWriter.ts:18` | Writer и pending closure принадлежат неизменному lease |
| `src/features/live-account/LiveAccountWorkspace.tsx:44`, `:58`, `:200` | Dirty coordination, completed fields validation, bound account writer |
| `src/context/RegistrationContext.tsx:36`, `src/context/FavoritesContext.tsx:157` | Bound операции и remount по status/id/epoch |
| `src/features/live-services/LiveServiceEditor.tsx:30`, `src/features/live-staff/LiveStaffWorkspace.tsx:80` | Owner-bound service editor и staff writer |
| `src/features/live-commerce/protocol.ts:13`, `:30`, `:54` | Canonical intent discovery, validation/migration и безопасное удаление только согласованного намерения |
| `src/features/live-commerce/index.tsx:38`, `:213`, `:276` | Purchase restoration/freeze и current-state reconciliation |
| `src/features/live-commerce/reconcile.ts:5`, `:10`, `:29` | Current order, paginated purchase lookup, full cursor message reconciliation |
| `src/features/live-commerce/useWrite.ts:15`, `:28`, `:37` | Immutable lease и delivery fence |
| `src/components/catalog/LiveService.tsx:33` | Передача service revision/performer и восстановление extras/блокировки выбора |

Всего **24 Frontend-пути**: 14 изменённых и 2 новых исходника; 5 изменённых и 3 новых теста. Новые исходники только session.ts/reconcile.ts. Новые regression suites: `live-account-corrections.test.cjs`, `live-commerce-corrections.test.cjs`, `live-identity-corrections.test.cjs`. Существующие isolated loaders/fixtures адаптированы к новым imports, owner prop и обязательному последующему GET; прежние проверки не удалялись. Дополнительно три проверки lease/epoch добавлены в account suite.

### Используемые API

Существующие `/api/v1/auth/{me,csrf,logout,telegram/mini-app}/`; v1 account/cabinet/registration/avatar, performer moderation/portfolio, favorites, discussions/conversations/messages/security cases и staff; v2 quotes/orders/actions/my services. Новых Next.js API routes, фиктивного Django, ожидаемого header без серверного контракта и вычисления денег вместо сервера не добавлено.

## Полная проверка

Доказательства: [implementation/2026-10-27-corrections](implementation/2026-10-27-corrections/). Command/exit code/start/finish/env записаны в соседних `.json`, stdout/stderr — в `.log`. Итоговый [verification-summary.json](implementation/2026-10-27-corrections/verification-summary.json) связывает файлы SHA-256. Synthetic fixtures не импортируют DTO приложения: их происхождение и OpenAPI request/response проверки зафиксированы в browser corrections evidence.

| Проверка | Результат |
|---|---|
| Полный CJS suite | **370/370 PASS**, `tests.log` |
| Отдельный TS registration suite | **8/8 PASS**, свежая компиляция из текущих sources; `registration-tests.log` |
| Итого без повторного счёта targeted runs | **378 PASS**; 37 новых случаев относительно прежних 341 |
| TypeScript | **PASS**, `typescript.log` |
| ESLint | **PASS**, 0 errors, 2 прежних no-img-element warnings в unchanged create-service; `eslint.log` |
| Production builds | **3 PASS**: Demo/admin disabled; Demo/admin enabled; Live/admin enabled — stress production gates. `build-demo`, `build-demo-admin`, `build-live` |
| Demo Campus/F1/F2/F3 | **184+48=232 route/viewport/theme combinations PASS**, zero API calls, zero page/hydration errors; UI registration/avatar/order/chat persistence и admin avatar reopen |
| Общая Live synthetic регрессия | **69 UI route checks, 627 assertions, 509 fixture requests PASS**, 36 сценариев; zero unhandled API/fixture/browser/hydration errors |
| Live offline | **46 combinations PASS**, explicit network/session error, закрытые registration/admin, no Demo fallback |
| Production gate HTML | **4/4 PASS**, 3 registration routes + admin; отдельный Live admin flag не открывает права |
| Целевые browser L1–L4/C1 | **11/11 сценариев, 62 assertions, 223 synthetic requests PASS**, zero fixture/schema/page errors; `browser-corrections-results.json`/`browser-corrections-run-2.*` |
| Live order role URL | **4/4 PASS**, customer/performer/invalid/missing query; `browser-live-role-query.*` |
| Git diff/cached diff, source/preservation/credential scan | **PASS** на code staged gate; повторяется для отчётности, `publication-gate.json` |
| Настоящий Django/PostgreSQL/Telegram/cookies/CSRF middleware E2E | **Не запускалась: изолированная среда не подготовлена** |
| Deployment, production/финансовые операции | **Не запускалась**, не входят в задачу |

Первый lint нашёл два нарушения Next lint rule в новом test harness (`module` как имя локальной переменной); имя исправлено, финальная проверка без errors. Исходный log сохранён как `eslint-initial.*`. Исторический offline browser runner ожидал h1 на закрытых LiveAccess routes; screenshot/DOM подтвердили существующий h2 sign-in branch. Сохранены `browser-live-*-initial` и screenshot; новый `browser-offline-regression.cjs` проверяет точный закрытый экран, message/retry, отсутствие private form и геометрию, без общего исключения для пропавших заголовков. Production-код ради ожиданий теста не менялся. Первый corrections run дал 7/10 PASS из-за ожиданий runner: закрытый identity экран не имел role=alert, а уже созданный заказ согласовывался через GET own orders/detail без ненужного GET quote. После проверки screenshot/запросов ожидания уточнены; добавлен отдельный одиннадцатый сценарий no-order + quote404 → lock → explicit read recovery → тот же key. Первая полная попытка сохранена в `browser-attempt-1/`; окончательные семантические проверки не ослаблялись. В диагностическом publication script исправлено чтение Unicode Git paths через NUL separator; финальная проверка прежних файлов проходит.

## Manifest, сохранность и границы

Новый [source-manifest.json](implementation/2026-10-27-corrections/source-manifest.json) содержит **171 файл apps/web** (все tracked + новые nonignored исходники/тесты), SHA-256 и Git mode, исходный rejected base и Backend reference. Generated `.next`/node_modules/env исключены. Sources заморожены для окончательных проверок; verifier сверяет их повторно перед публикацией.

**Manifest SHA-256: `46d74bfc9966c1e29164044c1d2276b169481364e39926439e0dd8ba403a9779`.**

Accepted Redesign manifest не исправлялся под merged README: его SHA остаётся **ef7afc71711a6341238c0cab3e99ccbe4ebe2187012e8f516532cfb204022e65**. Относительно rejected base byte/mode неизменны: config/dependencies 9/9, Demo workspace 19/19, Campus components/tokens/styles 10/10, четыре F1/F2/F3 источника 4/4, launcher 2/2, policies 4/4. Четыре F-источника также совпадают с accepted `5db64a2`. Все **478** прежних отчётных артефактов сохранены; общий README получает только новую ссылку. Старые claims не переписывались для сокрытия REJECTED.

Django отсутствует в этом checkout и не создавался; серверная ветка, соседние рабочие каталоги, .env, конфигурации/dependencies, Campus CSS, исходный accepted manifest не менялись. Нет migrations, установок, rebase/reset/stash/merge/force push или deployment. Локальные frontend/Chrome процессы относятся только к порту 3002 и synthetic tests. Секреты, реальные initData/cookies и production-данные не использовались; журналы содержат только QA fixture identities/сообщения. Pattern scan дополнен ручным review diff; это не доказательство отсутствия всех возможных классов секретов.

## Остаточные ограничения и передача

Отдельный [Backend handoff/recovery](2026-10-27_12-33_backend-identity-recovery-handoff.md) содержит конкретный запрос атомарного expected actor/session guard, тесты гонки после последнего `/me/`, unknown purchase diagnostics и recovery ранее incomplete аккаунтов. Сотруднику автоматически ничего не отправлялось.

1. L4 закрывает наблюдаемую клиентскую ошибку и сбрасывает старый контекст. **Нельзя считать атомарную принадлежность mutation полностью решённой:** session cookie может измениться между последним GET и обработкой POST. Abort не откатывает сервер. Для полной защиты нужен опубликованный и проверенный Backend guard; новый клиентский header без него не имитировался.
2. Unknown purchase без доступного server snapshot/положительного current-order reconciliation остаётся заблокированным. Не предлагается удалить storage и создать новый key. sessionStorage восстанавливает эту вкладку при reload, но не является межвкладочной транзакционной блокировкой или защитой после очистки данных браузера.
3. Новая L3-валидация предотвращает повторную инвалидизацию; уже incomplete аккаунты сама не восстанавливает. Production wizard закрыт. Recovery требует PO/Backend, подтверждённых owner/permissions и разрешённого серверного пути.
4. Synthetic browser работает с настоящим Next production build и контролируемыми OpenAPI fixtures. Это не Django E2E и не доказательство реальных permissions, Telegram подписи, session-cookie rotation, CSRF middleware, PostgreSQL транзакций, storage security или deployment.

Следующий шаг: независимая целевая клиентская переприёмка нового SHA/manifest L1–L4/C1; затем изолированный совместный Django E2E по handoff и прежнему плану. Production-ready и завершённая серверная интеграция не заявляются.

## Git

Старт: clean `abe0efb`, local=origin; remote `https://github.com/lex44lh/Studly.git`. Перед публикацией повторяются fetch/remote comparison, полный staged scope/diff, whitespace/credential/preservation checks. Разрешён только обычный fast-forward push `HEAD:refs/heads/codex/frontend-api-integration`. Кодовый commit: **f674b2f0a3f75284b0bcf57e8837f220b5c96a32** — `fix(integration): fence identity and reconcile live retries` (24 пути). Отдельный docs/evidence commit и окончательные local/remote HEAD/чистота сообщаются после публикации без рекурсивных post-push отчётных commits. После браузерных проверок собственные серверы на 3002 остановлены; неизвестные процессы не останавливались.
