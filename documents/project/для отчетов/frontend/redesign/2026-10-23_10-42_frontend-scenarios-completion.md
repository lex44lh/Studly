# STUDLY 2.0 — завершение пользовательских сценариев и административного Frontend

**Обновлённый кандидат после F1/F2/F3; независимая повторная приёмка ожидается.** Согласованные Frontend/Demo группы A–H реализованы и проверены в пределах известных правил. Backend-зависимые и неутверждённые продуктовые операции остаются явно недоступными. Новый сервер/API не создавался.

- Начало аудита:22.10.2026 18:09:21 MSK, исторический [прогресс](2026-10-22_18-09_frontend-scenarios-progress.md).
- Начало реализации по разрешению PO:22.10.2026 **20:51:25** Europe/Moscow.
- Прерывание из-за лимита Codex; точное время окончания предыдущего интервала не измерялось.
- Возобновление с сохранённых файлов:23.10.2026 **10:42:08** Europe/Moscow.
- Запись этого отчёта:23.10.2026 11:14:56 Europe/Moscow; окончательная проверка/время завершения указаны ниже. Все времена получены из системных часов.
- cwd/Git root `/Users/alekspih/Projects/studly-redesign`, branch `codex/frontend-redesign-campus`, HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`.
- Архитектурная область согласована основным Frontend22.10 в20:41: `2026-10-22_20-41_architecture-scope-approval.md`, прочитан из основного checkout read-only. Root — единственный автор общих файлов.

## 1. Сохранённое исходное состояние

22 исходных маршрута, дизайн «Кампус / Ясный ритм», исправления P2 неполных Demo-заказов и P3 skip/error сохраняются. Исходники не пересоздавались после лимита. Перед реализацией сохранены hashes92 src/tests принятого визуального этапа; полного accepted manifest356 путей. На возобновлении проверены существующие source files, Git status/diff и реальные тесты. Соседние checkout не редактировались, чужой сервер3001 не останавливался.

Backend после fetch23.10: **d7a5ffa5abc1537301ced7275da9e45282d6b4f3**, [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md). Новых endpoints нет. API/Auth/DTO/CSRF/SDK/data-mode/package/lock/next.config не менялись этим функциональным этапом. Tokens, campus.css, ServiceDetail и его CSS совпадают с принятым снимком.

## 2. Реализованные группы

| Группа | Фактический результат |
|---|---|
| A | Изолированный validated Demo workspace, role/participant/state/revision checks, стабильные action IDs, IndexedDB readwrite transaction state+assets, cross-tab refresh, fail-closed invalid data и retry |
| B | Постоянная регистрация и Blob avatar, save-before-navigation, production Demo gate, один аккаунт с двумя кабинетами/activeRole, сохранение текста/аватара между reload и вкладками |
| C | Примеры HTTP(S) и локальные PNG/JPEG/WebP/PDF≤10MiB; отдельные readiness/submission/approval, pending/rejected/changes/reason, явная Demo-модерация |
| D | Create-service с незаполненным постоянным form buffer, валидной редакцией, preview, extras/portfolio, optimistic save/submit, отдельным service approval и stable numeric IDs; approved-only catalog/favorites/public profile |
| E |5% от услуги+выбранных extras, HALF_UP integer kopecks, точный формат денег до safe integer boundary, immutable order snapshot, explicit payment simulation, idempotent checkout, входящий заказ исполнителя через явного Demo-заказчика |
| F | PENDING→IN_PROGRESS→REVIEW→COMPLETED; результат/замечания/исправление/history; один conversation на заказ, сообщения обеих сторон; один неизменяемый review после допустимого completed order и canonical rating |
| G | Existing Live branches/requests/gates/server quote сохранены; новые серверные операции честно unavailable; Demo не подставляется в Live |
| H | Полный suite, TS/ESLint, production builds, native IDB и браузерные пути,184 responsive checks,56 screenshots, handoffs и новый manifest |
| Admin |12 разделов: overview/users/profile moderation/services/orders/disputes/security/reviews/finance/analytics/events/settings; общий canonical workspace, поиск/фильтры/сортировка/paging/detail/reason/confirmation/audit; неподтверждённые полномочия закрыты |

## 3. Пользовательские пути

**Новый заказчик:** welcome/roles→profile→customer cabinet→search/service→quote/consent→Demo order→связанный чат. Отдельный accountId не создаётся при переключении роли.

**Новый исполнитель:** роли/профиль→описание→портфолио→submit profile→explicit Demo moderator decision→create draft/preview→submit service→second approval→search/public service. Создание услуги до profile approval запрещено командой. Предложение не попадает в каталог до service approval.

**Входящий заказ исполнителя:** на собственной approved service отдельный opt-in «Демо-заказчик» плюс отдельное согласие симуляции оплаты. Создаётся canonical order от другого явно тестового actor; активная identity не меняется.

**Заказ/чат/доработка:** принятие исполнителем→сообщения двух участников→результат→замечания заказчика→исправленный результат→подтверждение→review. Замечания сохраняют REVIEW; подтверждение заблокировано до исправления. Все результаты/замечания остаются в истории. Несколько заказов одной услуги не перезаписывают единственный chat.orderId. Отдельный pre-order discussion не превращается в контекст очередного заказа.

**Отзывы:** fixture ratings не отображаются как earned ratings. Public rating/review/count/completed derive только из canonical STUDLY Demo orders. Проверяются completed/participant/role/one review/no arbitration; review edit/delete отсутствуют. Live review может прийти только от Backend. Внешние договорённости не создают reviews.

**Старые данные:** localStorage не очищался и не мигрировал. Legacy history доступна отдельно, старый итог не получает новые5%. Неполные status/name безопасны. До решения PO новые role commands не применяются к безвладельным legacy records.

## 4. Чаты и диагностика старого оформления

Риск был в выборе старого renderer во время восстановления нового context и в повторном использовании detail state при смене ID. Route теперь выбирает canonical renderer по наличию DemoProvider **даже до ready**; detail keyed по conversation ID. Provider вне route/role keys. В Live этого renderer/provider нет.

В browser созданы два заказа/два чата; отправлены сообщения от двух сторон, выполнены reload, смена чата/роли/темы. Тексты остались в своих conversations, новый Campus интерфейс сохранён, old activity chat DOM не появился. Во время hydration показывается новое loading state. Добавлен отдельный actual route rendering regression на provider-before-ready/refresh и Live isolation. Фиксированная нижняя навигация не перекрывает сфокусированное поле: браузер прокручивает composer выше неё.

## 5. Деньги и сохранение

Браузерный пример: base1 000,10 + extra300,00 = subtotal1 300,10;5%=65,005→**65,01**; total**1 365,11**; срок3+1=4 дня. Снимок сохранился после reload и завершения. Двойное оформление не создало второй order. Оформление у самого себя запрещено; отдельный explicit guest — инструмент симуляции.

Суммы рассчитываются BigInt/integer minor units, не floating point. Выход за safe range запрещён; formatter не теряет последнюю копейку у MAX_SAFE_INTEGER. Цена/состав/дополнения/revision сверяются с источником при команде. UUID намерения хранится через reload; replay возвращает исходный order, включая уже завершённый.

IndexedDB writes обеих stores завершаются до success. Между вкладками revision проверяется в актуальной readwrite transaction. Нет обещания atomic CAS через localStorage. Неправильный формат блокирует запись с объяснением и сохраняет оригинал; quota/access/abort не превращаются в success. Avatar/examples Blob refs проверяются перед submission/approval. Blob URLs освобождаются, локальные файлы не объявляются URL сервера.

## 6. Проверки и фактические результаты

Автоматические tests/TypeScript/ESLint и production builds повторены после F1/F2/F3. Полная184-layout матрица,8 native IDB cases и сквозные product scenarios ниже относятся к исходной авторской проверке до независимой приёмки. Новые targeted browser F1/F2/F3 результаты и ограничения приведены в разделе10 и отдельном отчёте; они не заменяются исторической матрицей.

| Проверка | Результат |
|---|---|
| TypeScript всего apps/web | PASS, `npx tsc --noEmit --incremental false -p apps/web/tsconfig.json` |
| ESLint | PASS:0 errors,2 прежних no-img warnings в fallback старой формы create-service |
| Все `.cjs` | **220/220 PASS** |
| TS registration | **8/8 PASS**, отдельный in-memory TypeScript loader; вместе **228 tests PASS** |
| Новые tests этапа |129 новых cases относительно визуального baseline; текущие220 CJS+8 TS включают21 regression case F1/F2/F3 |
| Production Demo default | PASS; registration открыта, admin закрыт по умолчанию |
| Production Demo QA | PASS с explicit admin build flag; отдельный временный error trigger для browser recovery |
| Production Live | PASS; admin и production registration закрыты; серверный client/quote не подменяются |
| Native IndexedDB browser | **8/8 PASS** в новой случайной QA DB: serialization/conflict/idempotency/order+conversation/Blob+state/abort/malformed record |
| Route/theme/width browser | **184/184 PASS**:22 исходных+admin ×320/390/768/1440 ×light/dark,0 horizontal overflow/route errors,stable focusable main |
| Admin browser |12/12 sections; profile/service approval синхронно обновили кабинет/каталог; Escape закрыл dialog и вернул focus к opener |
| Registration browser | Both roles и customer-only, reload полей/аватара, две вкладки clean refresh; dirty account save conflict сохранил newer data |
| Service browser | Draft/preview/moderation/publication/search; incomplete form после reload восстановлена и submit disabled |
| Order/chat browser | Incoming performer и buyer fixture orders, double action, accept/result/remarks/revision/complete/review, messages both sides и два isolated chats |
| Keyboard skip/error/reset | PASS на настоящем error boundary:skip activeElement=campus-content,tabindex=-1,reset восстановил исходный heading |
| Protected boundaries | PASS:API/types/Auth/data-mode/registration libs/tokens/reference detail совпадают с pre-implementation hashes; package/lock/config/Django не менялись |
| `git diff --check` | PASS, итоговая повторная проверка ниже |
| Настоящий Django/Telegram/payment | **Не запускалась**; Live build/fixtures не доказательство интеграции |

[Логи, матрица и screenshots](implementation/2026-10-23-scenarios/README.md). Native repository Node harness отдельно маркирован как минимальная модель IDB; он не выдаётся за browser. Настоящая native browser проверка выполнена отдельно. Прямой запуск старого TS test через Node не разрешал extensionless import; финальный тест прогнан с isolated transpile loader, production TS проверен отдельным tsc.

Найденные и исправленные ошибки: avatar-only cross-tab refresh/loading guard; late/replaced Blob URL cleanup; dirty registration/profile overwrite; stale moderation confirmation и queued decision; stale service/form save и submit; partial draft loss; persisted malformed participant order/service links/URL/duplicate examples; cached rejected storage retry; display precision больших сумм. После каждого исправления соответствующие tests повторены.

## 7. Доступность и пределы

Новые UI используют label/fieldset/legend, busy/disabled/status/alert, корректные dialog focus и клавиатуру. Portfolio links имеют touch target≥44px, readiness checklist имеет озвучиваемое состояние. Campus light/dark и brand #3547B8 сохранены. Новый тяжёлый motion/3D не добавлялся; существующие reduced-motion и safe-area/platform hooks сохранены,11 unit checks платформы включены в общий suite.

Физические Telegram iOS/Android, экранная клавиатура реального телефона, hardware safe-area/viewport/insets, VoiceOver/TalkBack, OS reduced-motion toggle, Lighthouse/Web Vitals, настоящая quota exhaustion **Не запускались**. Browser default viewport/safe-area и unit metadata coverage не подменяют эти проверки. Storage quota/error abort проверены модельными tests; native browser — настоящий abort по ошибке asset, без искусственного заполнения диска.

## 8. Неразрешённые продуктовые зависимости

- Approved profile/examples: редактирование и судьба published services. Принятый snapshot read-only до решения PO.
- Арбитраж: event запрета review, powers, сроки, лимиты, возвраты. Состояния различаются в модели/представлении; открытие/решение/денежные команды не выдуманы. В orders с arbitration review не предлагается.
- Legacy actions: interim read-only history сохраняет данные; постоянную policy выбирает PO.
- Поздние extras: существующий paymentAvailable=false сохранён.
- Production Live расширенные кабинеты/портфолио/исполнение/чат/reviews/admin зависят от Backend; не изображают успешные серверные операции.

AI moderation отложена до3.0. Для2.0 подготовлено требование **серверной** проверки критических фраз/контактов/оплаты вне платформы; frontend fake protection не создана, доставка сообщений не подменяется.

## 9. Файлы, передача и Git

Функциональный delta относительно сохранённого принятого src/tests: **54 файла:31 новый,23 изменённых**, полный перечень [source changes](implementation/2026-10-23-f123/source-changes.md), machine hashes [source-delta.json](implementation/2026-10-23-f123/source-delta.json). Полный Redesign, предыдущие отчёты и старые evidence остаются в рабочем дереве; полный список repository files/рабочего delta дан в [текущем manifest](2026-10-23_17-12_f123-candidate.manifest.json). Исходный manifest23.10 11:16 сохранён отдельно без изменений.

Новые [BACKEND HANDOFF](2026-10-23_10-42_backend-handoff.md) и [INTEGRATION HANDOFF](2026-10-23_10-42_integration-handoff.md), [Admin handoff](2026-10-22_20-51_admin-backend-handoff.md). Индексы обновлены. Сотруднику Backend и в Integration ничего не отправлялось; результат направляется только в «Основная разработка Frontend» на независимую приёмку по явному поручению PO.

Временные QA source/public files удалены после проверки до финальных builds; их код сохранён как `.txt` evidence. QA-процессы запускались только на свободном3112 и останавливаются своим session Ctrl+C. Пользовательский3001 не затронут. Старые browser storage keys не удалены, исходные пользовательские данные не использованы.

Запреты соблюдены: **нет commit/push/merge/rebase/reset/stash/git add, нет patch/import/переноса в Integration**. HEAD прежний, staged пуст; итоговые counts/time/hashes фиксируются в manifest и строке завершения ниже. Независимая приёмка ещё не подменена самопроверкой автора.


Окончательная проверка и завершение авторского этапа: **2026-10-23T11:16:07+03:00 Europe/Moscow**. Git: **40 modified tracked +270 untracked** (включая новый manifest), удалений0, staged пуст, HEAD прежний. `git diff --check` PASS; QA3112 остановлен, пользовательский3001 PID73590 сохранён. Следующее действие — независимая приёмка; перенос/публикация не разрешены.


## 10. Исправления независимой приёмки F1/F2/F3 —23.10.2026

Первый функциональный кандидат6d7c86…c2cce получил REJECTED:2P2 и1P3. Это решение не отменяется самопроверкой автора. Исправлены avatar/text revision coordination, recovery lifecycle и explicit avatar removal, поздний admin Blob URL. Новые реальные browser interactions дополняют21 regression case;228 tests PASS, final builds/TS/ESLint PASS.

[Отчёт закрытия](2026-10-23_17-12_f123-closure.md), [текущий полный manifest](2026-10-23_17-12_f123-candidate.manifest.json), [готовый handoff](2026-10-23_17-12_f123-reacceptance-handoff.md), [доказательства](implementation/2026-10-23-f123/README.md). Старые207-test/184-layout результаты, timestamps и manifest6d7 относятся к первому кандидату; новые итоговые Git counts/время зафиксированы в отчёте F1/F2/F3 и новом manifest. Перенос в Integration по-прежнему запрещён.

Текущий corrective этап завершён **2026-10-23T17:39:13+03:00 Europe/Moscow**. Git: 40 modified tracked +310 untracked, staged0/deleted0. Независимый статус нового кандидата ожидается; подробности и SHA/modes — в текущем manifest и отчёте F1/F2/F3.
