# STUDLY 2.0 — Django Live Integration

- Начало: **26.10.2026 00:08:42 Europe/Moscow**, фактическое время начала основного сеанса по системным часам.
- Окончание реализации и проверок: **2026-10-26T13:04:34+03:00 Europe/Moscow**. Git-публикация выполняется после фиксации этого отчёта; окончательные remote HEAD/чистота дерева сообщаются PO после push.
- Возобновление после прерывания лимитом Codex: **26.10.2026 12:43:29 Europe/Moscow**. Календарный интервал содержит перерыв; это не непрерывное рабочее время.
- Рабочий каталог / Git root: `/Users/alekspih/Projects/studly-integration`.
- Ветка: `codex/frontend-api-integration`; порт 3002.
- Исходные local и origin HEAD: `d447c317eb5efa28bac65489da9b88a5d19a039d`; исходное дерево чистое.
- Принятый Redesign: `5db64a2437ce0b000f32de51bc730a9708be5178`; перенос завершён предыдущим этапом и не повторялся.
- Разрешение PO: реализовать доступные Frontend Integration-возможности, выполнить проверки и после их успеха обычные commit/push только в свою Integration-ветку. Новые merge, Backend-правки и deployment не разрешены.

**Статус документа:** подтверждённый клиентский объём завершён и проверен; код сохранён локальным commit `90a7eac83ec834da44c44666c89b136a054f0cec`. Известных новых клиентских P0/P1/P2-блокеров после исправлений не осталось. Отчётность и evidence подготавливаются к обычной публикации вместе с кодом. Настоящий Django E2E **не запускался**: PO подтвердил отсутствие изолированной среды и поручил продолжить контрактные проверки. Fixture/browser interception не объявлены интеграцией с настоящим Django.

Приложения: [полная Frontend ROUTE_API_MATRIX](2026-10-26_00-08_ROUTE_API_MATRIX.md), [зависимости Backend и готовое сообщение сотруднику](2026-10-26_00-08_backend-dependencies.md). Evidence этого этапа сохраняется в `implementation/2026-10-26-live/`; существующие доказательства Redesign и отчёты 19/25 октября сохраняются.

## 1. Цель и источники

Подключить опубликованные Django API к принятому Campus Frontend, сохранив явный выбор Demo/Live, ограничения production-регистрации, настоящие server permissions и отсутствие фиктивных денег/результатов. Готовность клиентского кода отделяется от готовности совместного окружения.

После безопасного fetch зафиксирован Backend **`8999703fe60ef6714595614413faddc5a9308d44`**. Реализация серверного кода — `ebec0915a17e55033cc62093912244c13bf13782`; следующий commit обновляет документацию. Backend изучался через Git без checkout/изменения Django, его БД или миграций. Источники контракта на конкретном SHA:

- [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md).
- [REGISTRATION_API.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md).
- [Backend ROUTE_API_MATRIX.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/ROUTE_API_MATRIX.md).
- [INTEGRATION_HANDOFF.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/INTEGRATION_HANDOFF.md).
- [workspace.openapi.json](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/docs/workspace.openapi.json), [registration.openapi.json](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/docs/registration.openapi.json).

Схемы сверены с действующими routes, serializers, permissions и tests из `apps/api/accounts`, `catalog`, `orders`, `conversations`, `operations`. Прошлые 238 Backend-тестов из handoff — результаты сотрудника на его версии; в число Frontend-проверок этого сеанса они не включаются. Локальные приложения/отчёты сотрудника и тексты пользовательских attachments в репозиторий не копировались.

## 2. Реализованный клиентский объём

### Общий транспорт и авторизация

Существующий типизированный API-клиент расширен явной версией v1/v2 и PUT с сохранением совместимости старых callers. Cookie передаётся с `credentials: same-origin`; ответы не кэшируются; redirect ответа API отклоняется. Перед каждой mutation получается новый CSRF через v1 `/auth/csrf/`, включая операции v2 и multipart. CSRF/Telegram/security guards не отключались. Ошибки 400/401/403/404/409/5xx и transport failure не включают Demo и не вызывают автоматического повторения записи.

Пути ресурсов и pagination URL ограничены ожидаемой версией/ресурсом и тем же browser origin. Добавлен запрет кодированных сегментов пути и scheme-подобных путей; encoded query-параметры сохраняются. Файлы передаются настоящим FormData без принудительного Content-Type/boundary. Идентификаторы/версии/денежные поля проверяются на границе DTO.

Существующая Telegram session authorization сохранена: `/auth/me/`, options, Mini App `initData`, website start/callback и logout. Live-экран предлагает настоящий вход и повторную проверку сессии. `/welcome` направляет Live-пользователя в `/profile`. Website return path формируется из текущего относительного маршрута, сервер остаётся ответственным за его проверку. Настоящий Telegram-вход этим этапом не подтверждён.

`LiveAccess` убирает приватные дочерние компоненты при logout/проверке/ошибке сессии и меняет их key по подтверждённому account ID. `useLiveResource` скрывает устаревшие данные сразу при смене account/resource/attempt, отменяет прошлые GET и игнорирует их поздние ответы. Эти механизмы не заменяют серверные permissions.

### Аккаунт, регистрация, кабинет и портфолио

- GET account/cabinet отображает один аккаунт с обеими серверными ролями, настоящие counts и capabilities. Недоступные rating/reviews/completed источники остаются `null` и показаны как недоступные, не как вымышленные нули.
- Профиль, роли, специализации, описание/курс/заметка портфолио сохраняются через канонический registration PATCH с `performer_revision`. Согласованный snapshot читается между двумя moderation GET; после wizard PATCH принимается только ожидаемая собственная редакция. Несохранённая форма удерживает исходную revision; 409/несогласованный snapshot требуют явного reread. Это не общий атомарный guard аккаунта: без PerformerProfile Backend возвращает условную revision=1; customer-only role/progress и avatar имеют описанные в handoff ограничения.
- Регистрация продолжает сохранять шаги и server draft; успешное завершение/восстановление завершённой регистрации открывает `/profile`. Production registration gate сохранён на `/register/*` и для незавершённого аккаунта на `/profile`; альтернативный вход в кабинет не позволяет пройти закрытую регистрацию. Существующие завершённые аккаунты могут редактировать свой профиль.
- Аватар загружается/удаляется через существующий приватный API. Пока текст/роли не сохранены, отдельная avatar mutation недоступна. Backend avatar v1 не принимает revision/receipt; неподтверждённый результат не повторяется автоматически, требуется чтение актуального состояния.
- Портфолио: paginated список, HTTP(S)-ссылки, multipart PNG/JPEG/WebP/PDF, изменение title/URL по контракту, soft delete и приватное скачивание файла. Файл не выдаётся через Next image optimizer/публичный alias; PDF не встраивается как активная страница.
- Отдельный серверный moderation DTO показывает status/reason/revision/readiness/missing_fields. Подача использует Version. `performer_ready` не используется как approval. Изменения approved-профиля разрешены с предупреждением о серверной повторной модерации и временном скрытии услуг.

### Услуги, каталог и избранное

Публичный каталог/поиск/деталь используют v2 Service с category/revision/extras. Search, category, min/max price, duration и ordering отправляются серверу до пагинации. Неизвестный рейтинг не используется для сортировки/фильтрации. Публичный профиль использует существующий v1 performer и только разрешённые публичные поля.

Редактор собственных услуг использует v2 my/services: новый неполный draft с revision=0, восстановление сохранённого ID, guarded PATCH, отдельный submit, server status/reason, included/extras и выбор собственных portfolio IDs. Создание draft и публикация разделены; окончательную полноту/approval/ownership проверяет Django. Список собственных серверных услуг позволяет открыть черновик после reload и видеть причину решения.

Избранное в Live полностью серверное: v1 GET страниц, PUT/DELETE, получение всех страниц перед вычислением membership, повторное чтение после записи, блокировка дублирующих команд и отдельное состояние по аккаунту. Demo localStorage не используется как Live membership.

### Quotes, неоплаченные заказы, conversations и безопасность

Live-покупка использует POST v2 quotes и сохранённый quote_id. UI показывает серверные базу/дополнения/subtotal/ставку/сумму комиссии/итог/срок/тариф; не рассчитывает замену серверным деньгам. POST orders отправляет quote_id/request_key. Для одного намерения сохраняется тот же UUID; неподтверждённое создание можно повторить исходным ключом. При 409 нужен новый quote, просмотр новых условий и новое согласие; автоматического оформления по изменённой цене нет. Для восстановления покупки хранятся только scoped непрозрачные ID/key/флаг попытки, без сообщений/секретов/денежного снимка.

Ссылка кабинета `/orders?role=customer|performer` инициализирует соответствующий server filter; неизвестная роль возвращает безопасный общий список собственных заказов. Заказы читаются по server ID и role, используют только текущие неоплаченные состояния Django `pending_acceptance`, `awaiting_payment`, `cancelled`, `declined` и server available_actions с проверкой стороны аккаунта. Реализованы accept/cancel/decline по Version, история событий и переход к order conversation. Из `awaiting_payment` UI не переводит заказ в paid/исполнение.

Pre-order discussion открывается отдельно по service_id/request_key. Списки/детали conversations используют server UUID; заказ получает собственный conversation. Сообщения читаются cursor-страницами, объединяются по server message ID/sequence с учётом release. Отправка использует стабильный client_message_id. `stored` подписано «Сохранено», а не «Доставлено/прочитано»; `held` показывает отправителю warning/categories/rules и возможность обжалования. Sender/read access/удержание определяет Django, не локальное сканирование Frontend. Case читается и обжалуется по revision/request_key/reason.

### Рабочее место сотрудника

Live staff UI добавлен по **`/staff`**, чтобы не занять Django `/admin/`. Прежний `/admin` остаётся отдельным Demo sandbox с прежним production gate. `NEXT_PUBLIC_STUDLY_DEMO_ADMIN` не выдаёт Live permissions.

Визуально сохранены 12 разделов. Staff/me определяет доступные resources; списки/детали users, performers, services, orders, events, security-cases читаются только при соответствующем разрешении. Профили/услуги принимают guarded decision + reason и явное подтверждение просмотренной редакции. Текст сообщения в security case запрашивается только после ввода purpose; keep/release требует reason. Универсальная лента чужих личных чатов не добавлена. Споры, отзывы, финансы и аналитика имеют честные состояния недоступности. Обзор/настройки показывают возможности, без вымышленных агрегатов и изменения системных правил.

## 3. Исправленные Integration-дефекты

1. Старые Live-заглушки кабинета, заказов, чатов и редактора заменены typed adapters к опубликованным ресурсам; ошибки API не подменяются Demo.
2. Старый путь оформления на 3% заменён в новом Live-сценарии сохранённым quote v2 с серверными 5%; старые серверные snapshots не пересчитываются.
3. Demo status/role/approval не используются как Live permissions или оплата; profile readiness отделён от moderation approval.
4. Pagination больше не позволяет DTO выбрать произвольный ресурс/версию/origin; encoded traversal в resource path отклоняется до fetch.
5. Поздние GET, смена роли/аккаунта и reload не возвращают предыдущие приватные данные; same-frame записи сериализованы.
6. Неизвестный результат versioned команды удерживает исходные key/payload. 409 не разрешает слепо перезаписать новую редакцию; non-receipted avatar/profile write не повторяется автоматически.
7. Registration response validation отклоняет malformed specializations/missing_fields как API protocol error вместо случайного TypeError.
8. Сохранена восстановимость собственных draft IDs после reload; отдельные live ресурсы не записываются в Demo workspace.

Дополнительно при полной проверке исправлены:

9. Старая AppShell `fieldset disabled` блокировала уже подключённые Live orders/chats/create-service. Обёртка удалена; добавлены семь проверок shell/route isolation. До исправления браузерный сценарий не мог заполнить редактор; исходные доказательства сохранены как `browser-live-contract-initial-*`.
10. Unknown create-service теперь блокирует изменение первоначального намерения и повторяет исходные payload/request_key; нельзя незаметно создать второй draft новым ключом.
11. Staff retry получает новый AbortSignal каждой попытки и синхронный guard; выход отменяет действующий повтор. Приватное скачивание portfolio уполномоченным staff подключено по существующему контракту.
12. Wizard больше не принимает произвольную последующую чужую revision за свою. Два GET окружают чтение snapshot; несогласованный ответ/ошибка после PATCH блокируют следующий save до явного stable reload. Добавлены девять race regression cases.
13. У категории оставлен один h1, мобильная навигация staff содержит все 12 секций; ссылка кабинета теперь задаёт начальную роль списка заказов.
14. Live notifications и additional-payment показывают отсутствие API, без статических Demo предложений и вымышленного пустого server inbox.
15. Старые изолированные тестовые загрузчики адаптированы к новым импортам без удаления прежних проверок. Последующие остановки browser attempt2–5 были исправлениями тестовых locators, ожидания завершения записи и persistent failure injection; они не названы дефектами Django. Финальный browser run завершён успешно.

## 4. Файлы и границы

Функциональные группы изменений:

- `apps/web/src/lib/api/client.ts`, `account.ts`, `registration.ts`, `services.ts`, `commerce.ts`, `staff.ts`, `catalog.ts`; `types/registration-api.ts`.
- `apps/web/src/features/live/shared.tsx`; новые `live-account/**`, `live-services/**`, `live-commerce/**`, `live-staff/**`.
- `apps/web/src/context/RegistrationContext.tsx`, `FavoritesContext.tsx`; Live catalog components и `ServiceFavoriteButton.tsx`.
- `apps/web/src/components/AppShell.tsx` — снята устаревшая блокировка подключённых Live-страниц; Demo-ветка не меняет поведение.
- Только функциональное подключение существующих маршрутов: profile, orders/details, chats/details, create-service, search/category, новая staff page; welcome entry с сохранением Demo-ветки.
- Новые `apps/web/tests/live-*.test.cjs`; тематическая отчётность/evidence.

Точный список **53 файлов Frontend и тестов**, SHA-256, размеры и modes — [source-manifest.json](implementation/2026-10-26-live/source-manifest.json); staged содержимое сверено с ним. Кодовый commit содержит 3115 добавленных и 147 удалённых строк. Новых dependencies, `.env`, Backend runtime/migrations, Next API endpoints и production-секретов не создавалось. `apps/api`, соседние checkout, accepted manifest и прежняя Redesign-отчётность не редактировались. Изменения визуального оформления ограничиваются существующими Campus-компонентами/классами и необходимым расположением новых серверных состояний; новый дизайн не утверждался.

## 5. Проверки и evidence

Все значения ниже фактически получены. Логи сохраняют сообщения/предупреждения, метаданные — команды/время/exit code. Форматирование логов нормализовано без изменения результатов. [Итоговая сводка и хеши](implementation/2026-10-26-live/verification-summary.json), [integrity/security](implementation/2026-10-26-live/integrity-security.json).

| Проверка | Итог / evidence |
|---|---|
| Полный Frontend CJS suite | **333/333 PASS**, `tests.log` + `tests.json` |
| Отдельные TypeScript registration tests | **8/8 PASS**, `registration-tests.log`; всего **341** без двойного учёта targeted runs |
| TypeScript `tsc --noEmit` | **PASS**, `typescript.json`/`.log` |
| ESLint | **PASS: 0 ошибок**, два прежних `no-img-element` предупреждения Demo form на строках 197/231; `eslint.log` |
| Demo production build | **PASS**, `build-demo-final.log`/`.json`, mode demo, admin disabled |
| Demo admin QA production build | **PASS**, `build-demo-admin-final.log`/`.json`, mode demo, admin enabled |
| Live production build | **PASS**, `build-live-final.log`/`.json`, mode live, Demo-admin flag enabled для проверки изоляции |
| Demo browser | **184** route/viewport/theme combinations; registration/profile/avatar/order/chat reload, default admin closed; `browser-default.json` |
| Demo admin browser | **48** section/viewport/theme combinations, F3 avatar close/reopen; `browser-admin.json`; оба Demo runs — 0 API requests, 0 JS/hydration errors |
| Live synthetic browser contract | **627 assertions, 36 scenarios, 69 route/viewport/theme records**, 468 перехваченных API requests; `browser-live-contract-results.json` |
| Финальная роль из URL кабинета | **52 assertions, 4 URL cases**, customer/performer/invalid/absent; `browser-live-role-query-results.json` на финальной Live-сборке |
| Production registration/admin gates | **PASS**, четыре HTTP checks в `gates-live.json`; browser отдельно проверил incomplete `/profile`, guest и staff403 |
| Demo/Live isolation | **PASS**: Demo 0 API; Live не открывает Demo IndexedDB, не читает poisoned Demo storage как fallback и не меняет его; private children сбрасываются по account |
| Ошибки / retry / revisions / permissions | Unit/hooks и synthetic browser: 400/401/403/404/409/5xx/network, abort/stale, два synthetic account IDs, fresh CSRF, unknown same-key retry, quote409/new consent, held privacy/appeal, purpose-scoped staff |
| Campus UI | Desktop 1440/mobile390, light/dark; Demo дополнительно320/768; проверены main/topbar/h1 и отсутствие горизонтального overflow. Выборочно просмотрены сохранённые JPG |
| Старые отчёты / accepted manifest | **395** прежних tracked report/evidence файлов побайтно сохранены; README только дополнен. SHA-256 accepted manifest прежний `ef7afc71711a6341238c0cab3e99ccbe4ebe2187012e8f516532cfb204022e65` |
| Секреты / границы | Targeted credential-pattern scan и ручной review — находок нет; без .env, архива логотипов, Backend/политик/зависимостей/config изменений |
| `git diff --check` | **PASS** |
| `git diff --cached --check` | **PASS** для 53 исходных файлов и полного staged набора 84 документов/evidence; после обновления метаданных выполняется заключительный check перед docs commit |
| Настоящий Django health/readiness, PostgreSQL mutations | **Не запускалась: отсутствует изолированная среда** |
| Настоящий Telegram/OIDC, cookie/proxy/CSRF и два реальных test accounts | **Не запускалась: отсутствует изолированная среда** |
| Production deployment/финансовые операции | **Не запускалась; не входят в разрешение** |

333 CJS = 220 прежних + 36 account/registration + 22 shared/client + 11 services + 24 commerce + 13 staff + 7 shell wiring. Восемь TS registration cases учитываются отдельно. Targeted runs не суммируются повторно. Браузерные суммы также разделены: 232 Demo комбинации; 69 Live геометрических записей и 4 отдельные role-query проверки. Это **не** 305 настоящих Django E2E.

Основной Live run выполнен до узкой правки начальной роли URL; после неё весь suite, TypeScript/lint и три сборки пройдены заново, а затронутые role paths проверены отдельным browser run. Неизменённые успешные Demo/UI сценарии не запускались повторно без причины. В synthetic runs внешние HTTP и все `/api` requests перехвачены/заблокированы; fixture IDs и сообщения синтетические. Zero unhandled API, fixture errors, browser exceptions и hydration errors. Приватные токены/данные production не использовались.

## 6. Оставшиеся зависимости и план реальной проверки

Полный перечень и готовый запрос сотруднику: [backend-dependencies](2026-10-26_00-08_backend-dependencies.md). Блокировка окружения не подменяется локальным фальшивым Backend. Реальные платежи/возвраты/выплаты, paid/execution/completion/results, completed-order reviews, arbitration, notifications, финансовые агрегаты/analytics, публичные portfolio/avatar и chat attachments не объявлены реализованными.

После подготовки разрешённого Backend runtime проверить последовательность:

1. SHA/миграции/изолированная БД и media; health/ready напрямую и через same-origin `/api/` на 3002; у гостя auth/me 403 допустим.
2. Настоящий Telegram login с проверкой подписи/OIDC и cookie, свежий CSRF после входа, logout/relogin и восстановление регистрации.
3. Два тестовых аккаунта: один customer, второй performer; включение обеих ролей, browser reload и отдельные browser profiles. Проверить 403/404 чужих объектов и 409 stale формы.
4. Профиль/специализации/avatar, link/file portfolio, private access, 400 файла/размера/CSRF и cross-account отказ. Проверить повторную модерацию approved-профиля и исчезновение услуг из публичного каталога.
5. Уполномоченный третий staff: own-decision запрет, необходимые permissions, profile/service decisions с revision/reason, второй reviewer и stale conflict; security purpose audit.
6. Service draft/save/reload/submit → approval → реальный каталог/поиск/избранное; скрытая услуга не появляется в избранном/quote.
7. Quote с несколькими extras, decimal rounding и снимок 5%; повтор/потеря ответа orders с одним request_key; изменение цены/тарифа → 409 → новый quote и отдельное согласие. Проверить старый исторический v1 snapshot без пересчёта.
8. Accept/cancel/decline в поддержанных неоплаченных состояниях, история/order conversation. Подтвердить отсутствие доступного paid/complete обхода.
9. Discussion и отдельный order chat, cursor pagination, duplicate client_message_id, held sender/receiver privacy, appeal, purpose-scoped staff keep/release и новый visibility sequence после release.
10. Повторить key маршруты на desktop/mobile, light/dark через настоящий согласованный HTTPS; зафиксировать browser evidence без личных данных.

## 7. Git и готовность к независимой приёмке

На момент фиксации отчёта код уже сохранён локально:

- Кодовый commit: [`90a7eac83ec834da44c44666c89b136a054f0cec`](https://github.com/lex44lh/Studly/commit/90a7eac83ec834da44c44666c89b136a054f0cec) — `feat(integration): connect STUDLY 2.0 live frontend to Django APIs`.
- Родитель / опубликованный старт: `d447c317eb5efa28bac65489da9b88a5d19a039d`.
- Отдельный docs/evidence commit создаётся после финального staged review; затем оба commits отправляются обычным fast-forward push только в `origin/codex/frontend-api-integration`.
- Итоговые push/local=remote HEAD/чистота дерева сообщаются в ответе PO после операции; отчёт не создаёт бесконечные commits ради включения собственного SHA.
- Ветка: [codex/frontend-api-integration](https://github.com/lex44lh/Studly/tree/codex/frontend-api-integration).
- Проверки состава и состояния перед публикацией: [publication-gate.json](implementation/2026-10-26-live/publication-gate.json).

Готов к независимой технической приёмке **проверенный Frontend-клиентский объём**, вместе с ограничениями и Backend handoff. Настоящий Django E2E остаётся отдельной совместной приёмкой после подготовки среды; production-ready не заявляется. Тестовые Frontend/Chrome процессы этого этапа остановлены; Django/Python/Docker не запускались. После разрешённой публикации работа останавливается без merge в main и deployment. Следующий этап — независимый review в чате «Основная разработка Frontend».
