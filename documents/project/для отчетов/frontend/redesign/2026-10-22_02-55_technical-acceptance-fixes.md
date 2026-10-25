# STUDLY 2.0 — исправления технической приёмки R1/P2 и R2/P3

- Дата: **22.10.2026**, Europe/Moscow. Системная отметка начала контрольного этапа: **02:55:34**; окончание и финальное Git-состояние приведены ниже.
- Checkout: `/Users/alekspih/Projects/studly-redesign`, ветка `codex/frontend-redesign-campus`.
- HEAD / policy revision: `1888b9194827d00317fb9cf9d27218ef702999cb`.
- Основание: [независимая приёмка основного Frontend](/Users/alekspih/Projects/studly/documents/project/для%20отчетов/frontend/redesign/2026-10-22_02-42_redesign-technical-acceptance.md), прочитана без записи в соседний checkout.
- Цель: закрыть два замечания и сохранить утверждённый комплексный «Кампус / Ясный ритм» всех 22 маршрутов.
- Результат: **R1 и R2 исправлены и готовы к повторной независимой приёмке**. Передача в Integration и Git-публикация не выполнялись.

## Границы и исходное состояние

Перед изменениями проверены pwd, Git root, ветка, status, worktrees и последний commit. Ранее выполненный редизайн оставался незакоммиченным: 34 modified tracked и 131 untracked путь. Его файлы и доказательства сохранены. Прочитаны AGENTS.md, apps/web/AGENTS.md, TEAM_WORKFLOW.md, FRONTEND_REDESIGN.md и локальная документация Next 16.3.4 об error boundaries/reset.

Scope общих компонентов соответствует прямому поручению PO по замечаниям приёмки: Redesign — единственный автор безопасного представления Demo-полей и стабильной цели в CampusShell. AppShell, error.tsx, публичные DTO и интеграционные интерфейсы менять не потребовалось. Вспомогательные агенты отдельно проверили activity-код, оболочку и сохранность обработчиков; пересекающейся записи не было.

Выполнен `git fetch origin` (первый sandbox-запуск не смог записать FETCH_HEAD; повтор с разрешением прошёл). Опубликованный Backend reference остался **`d7a5ffa5abc1537301ced7275da9e45282d6b4f3`**: [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md). Входящих изменений policy относительно origin/codex/frontend-main-dev не обнаружено. Backend-ветка не сливалась.

## R1 / P2 — неполные сохранённые Demo-заказы

**Причина.** JSON из localStorage получает TypeScript-тип без runtime-гарантий. Новая разметка вызывала `order.status.toLowerCase()` над отсутствующим, null или нестроковым значением; initials исполнителя вызывали `performerName.slice()`. Дополнительно обычный объект statusLabels мог вернуть унаследованный `__proto__`/`constructor` вместо текста. Error/reset повторял чтение той же записи, поэтому не устранял причину.

**Исправление.** Новый чистый presentation-компонент `DemoOrderStatus` использует строгий switch четырёх существующих значений. Их подписи и CSS-модификаторы сохранены. Missing/null/пустая строка показывают «Статус не указан», остальные неподдерживаемые значения — «Статус недоступен» с нейтральным оформлением. Это пояснение отсутствующих данных, а не новый business status: оно не записывается в storage, enum не расширяется, переходы не появляются.

Имя исполнителя проверяется перед отображением: отсутствующее/null/нестроковое/пустое имя даёт «Не указан», initials — `?`. Защищены детали заказа, список заказов, список чатов и заголовок ChatWindow. Это также сохраняет доступность чата, созданного из старого заказа без имени.

Загрузка записей, localStorage keys, денежные значения/расчёты, дополнительные услуги, открытие/создание чата, delete confirmations, отправка сообщений и существующие переходы не менялись. Независимая AST-сверка с HEAD подтвердила идентичность `updateStatus`, `openChat`, `sendMessage`, `startAdditionalServicePayment`, `deleteChat`; код загрузки обоих списков сохранён побайтово. Никто не удалял и не очищал localStorage и не мигрировал пользовательские записи.

## R2 / P3 — skip link во время error boundary

**Причина.** `/search` и `/service/<id>` направляли skip link к заголовкам внутри сменяемого route content. Error boundary заменяла этот контент экраном с error-title; search-title/service-title исчезали.

**Исправление.** CampusShell всегда содержит единственный `<main id="campus-content" tabIndex={-1}>`; skip link всегда направлен на него. Цель принадлежит сохраняющейся оболочке и существует до ошибки, во время неё и после reset. Прежние тексты ссылок, route headings, классы, темы и внешний вид эталонов сохранены. Legacy prop contentId оставлен совместимым в типе, но больше не определяет нестабильную цель. AppShell и error.tsx в этом этапе не изменялись.

## Изменённые файлы этого этапа

| Файл | Изменение |
|---|---|
| `apps/web/src/app/orders/page.tsx` | Безопасные подпись статуса и имя |
| `apps/web/src/app/orders/[id]/page.tsx` | Безопасные статус, имя и initials |
| `apps/web/src/components/ChatWindow.tsx` | Безопасный статус и имя в заголовке/aria-label |
| `apps/web/src/app/chats/page.tsx` | Безопасное имя и initials списка чатов |
| `apps/web/src/components/studly/activity.css` | Нейтральное оформление неизвестного значения |
| `apps/web/src/components/studly/CampusShell.tsx` | Стабильная фокусируемая цель main |
| `apps/web/src/components/studly/DemoOrderPresentation.tsx` | Новый presentation-компонент и функции имени |
| `apps/web/tests/demo-order-rendering.test.cjs` | 49 регрессионных тестов реальных views |
| `apps/web/tests/campus-skip-link.test.cjs` | 5 регрессионных тестов оболочки/error/reset callback |
| Этот отчёт, два README-индекса и `implementation/2026-10-22-acceptance-fixes/` | Описание, контрольные суммы, журналы, JSON и 8 screenshots |

Другие продуктовые страницы и пути не менялись. В [preservation.json](implementation/2026-10-22-acceptance-fixes/preservation.json) сохранены реальные before/after SHA-256: 6 изменённых существовавших файлов приложения, 3 новых файла, 89 совпадающих из исходного набора 95. Проверка сделана до обновления двух README; их последующие изменения — только ссылки на этот этап. Удалённых исходников нет. `/search/page.tsx`, `/service/[id]/page.tsx`, их визуальные компоненты, tokens.css, campus.css, AppShell/error.tsx, API/context/types/config/package/lock совпадают со снимком начала этапа. Набор 22 page.tsx сохранён.

## Регрессионные автотесты

Тесты используют уже установленные node:test, TypeScript и React DOM server; зависимостей не добавлено.

- **P2, 49 тестов.** Реальные orders list, order detail и ChatWindow транспилируются в памяти; реальные эффекты читают изолированный fixture localStorage, затем настоящий JSX рендерится React DOM server. Матрица: missing/null/number/boolean/object/array/unknown string/prototype keys/empty status, все четыре корректных статуса, семь вариантов имени в списках, деталях и чате. Проверяются текст/оформление, отсутствие переходов для unknown, сохранение прежних кнопок для четырёх состояний и отсутствие перезаписи orders/chats при отображении. До исправления: **37 fail / 12 pass**; после: **49/49 pass**.
- **P3, 5 тестов.** Реальные AppShell/CampusShell/ErrorPage/FavoritesProvider, с изолированным Next/auth environment. Проверяются стандартная страница, отсутствие heading, композиции page → error → restored для search/service в Demo и Live, единственный main/target, tabindex=-1 и вызов исходного reset callback. До исправления: **3 fail / 2 pass**; после: **5/5 pass**. Lifecycle Next и клавиатура проверены отдельно в браузере.

| Проверка | Фактический результат |
|---|---|
| `npx tsc --noEmit --incremental false -p apps/web/tsconfig.json` | PASS, exit 0, повторено после финальных сборок |
| `npm run lint -w apps/web` | PASS, exit 0: 0 errors, прежние 2 no-img-element warnings в create-service:189/223 |
| `npm test -w apps/web` | **91/91 PASS**: 37 существующих + 54 новых |
| Registration TypeScript tests | Отдельный временный CommonJS/ES2022 runner, **8/8 PASS**; всего **99/99** |
| `NEXT_PUBLIC_STUDLY_DATA_MODE=demo npm run build -w apps/web` | PASS; чистая финальная сборка без QA-инжектора |
| `NEXT_PUBLIC_STUDLY_DATA_MODE=live npm run build -w apps/web` | PASS; только компиляция/пререндер, Django не запускался |
| Возврат `.next` в Demo после Live | PASS, финальная чистая Demo-сборка |
| `git diff --check` | PASS; дополнительно проверены новые текстовые файлы на trailing whitespace |

[Журналы и галерея](implementation/2026-10-22-acceptance-fixes/README.md). Production builds выполнены Webpack штатным скриптом. Package/lock не менялись.

## Браузерные проверки

Использован Codex in-app browser и временный production Demo-сервер `127.0.0.1:3111` из этого checkout. Начальный EPERM при bind в sandbox устранён разрешённым запуском. После проверок остановлены только собственные процессы. Пользовательский dev-сервер 3001 не перезапускался и не останавливался; в конце браузер возвращён на его `/search`, временный viewport сброшен.

**Данные.** На отдельном QA-origin добавлены 10 синтетических заказов и 10 связанных чатов. Временная seed-страница строго проверяла origin, дописывала только отсутствующие QA IDs, не очищала storage и не заменяла существующие записи. Пользовательский origin 3001 не использовался для seed или mutations. Исходник fixture сохранён как `.txt`; продуктовая seed-страница удалена. Тестовые записи не удалялись.

**P2.** Все 10 записей отображены в списке; для каждой открыты детали и связанный чат: missing, null, number, object, unknown string, __proto__ и четыре корректных статуса — **20 переходов без error boundary**. Для unsupported показан нейтральный текст, переходных кнопок нет. Для корректных статусов сохранены прежние действия. На отдельной корректной QA-записи выполнены PENDING → IN_PROGRESS → REVIEW → COMPLETED, затем «Открыть чат». Локальное сообщение отправлено и осталось после reload. Удаление чатов/заказов, оплата и миграции не выполнялись.

**P3.** Для точных `/search` и `/service/1` временный one-shot React gate по кнопке намеренно бросал render error. Использовалась настоящая production Next app/error.tsx, не статический макет. На ошибке Tab фокусировал skip link; Enter переносил document.activeElement на campus-content, хотя route heading отсутствовал. После «Попробовать снова» настоящий reset восстановил исходный search-title/service-title, error-title исчез; main остался. Search проверен при desktop/light, service при **390 px/dark**. После теста оба route source восстановлены строго из сохранённых исходных байтов, QA-компонент удалён, затем собраны чистые Demo и Live. Временный fault gate архивирован только как текст, не попадает в продукт.

**Responsive и темы.** На чистой production Demo выполнены **48 проверок**: `/orders`, неполный `/orders/862200`, `/chats`, связанный `/chats/862200`, `/search`, `/service/1` × **320/390/768/1440 px** × **light/dark**. Во всех случаях фактическая ширина совпала с запрошенной, scrollWidth ≤ viewport, один main/target, focusable main, error boundary отсутствует. Визуально просмотрены мобильные screenshots, нейтральные подписи читаются, нижняя навигация сохранена. После skip на обычных search/service следующий Tab достигает поля поиска/кнопки «Назад».

**Маршруты.** Отдельный smoke на чистой сборке открыл все **22 продуктовых маршрута и 404**, проверил heading и единственный main/target. Production gate регистрации и недоступность оплаты остались. Это smoke страницы, а не полное повторение всех продуктовых сценариев.

Машинные доказательства: [browser-evidence.json](implementation/2026-10-22-acceptance-fixes/browser-evidence.json), [responsive.json](implementation/2026-10-22-acceptance-fixes/responsive.json), [route-smoke.json](implementation/2026-10-22-acceptance-fixes/route-smoke.json).

## API и оставшиеся ограничения

API-клиент, DTO, endpoints, Django, auth/CSRF, Telegram SDK, регистрация, Demo/Live и расчёты не менялись. Новых или изменённых endpoints нет. Реальный Live backend, Telegram login, сессии/CSRF, платежи и WebView не проверялись — **Не запускалась** реальная Django-интеграция. Synthetic Live-фикстура в этом этапе не использовалась; Live build не доказывает Django-сценарии.

Более широкая валидация malformed массивов storage, элементов messages/additionalServices, storage quota/permissions и прежние особенности удаления/платежей остаются вне R1. Исправление гарантирует перечисленные варианты status и performerName у сохранённых объектов, не вводит схему миграции любых произвольных данных. Physical Telegram, screen reader, cross-browser и системное reduced-motion emulation в этом этапе не запускались; их код/стили не менялись. Ошибки root layout/providers относятся к global error boundary и не входят в замечание R2.

## Передача и остановка

Следующее действие: повторная независимая техническая приёмка основным Frontend по этому отчёту и рабочему дереву. Старый snapshot приёмки больше не соответствует новым исходникам; перед возможной передачей нужен новый manifest и отдельное разрешение PO. Integration самостоятельно не изменялся, не получал код/сообщения/patch. Commit, push, merge, rebase, reset, stash и git add не выполнялись.

Фактическое окончание и финальная фиксация: **22.10.2026 03:10:13 Europe/Moscow**. Git: **34 modified tracked + 158 untracked**, включая ранее существовавший полный редизайн и новые доказательства; staged пуст, HEAD/ветка прежние, удалений нет. [Полное состояние](implementation/2026-10-22-acceptance-fixes/git-state.json). Итоговая проверка 31 локальных ссылок отчёта/галереи и trailing whitespace новых исходников пройдена. На 3001 остаётся прежний PID 73590; временный 3111 остановлен. Работа завершена, следующие страницы не изменяются.
