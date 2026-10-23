# STUDLY 2.0 — общий прогресс полного редизайна «Кампус / Ясный ритм»

Начало: **21.10.2026 22:18:15 Europe/Moscow**, системные часы. Рабочая папка `/Users/alekspih/Projects/studly-redesign`, ветка `codex/frontend-redesign-campus`, HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`.

Цель: привести все 22 существующих page routes и их состояния к единому Campus, сохранив функциональность и одобренную страницу услуги. Новые продуктовые маршруты/возможности не создаются. Commit/push/merge/rebase/reset запрещены.

## Согласование и границы

PO назначил этот чат владельцем полного визуального редизайна. Основное направление технически подтвердило scope общей оболочки, root viewport, карточек, визуальных форм при сохранении providers, DTO/API/CSRF, handlers и ограничений Live. Общие файлы меняет один root; непересекающиеся группы UI распределены между внутренними агентами этого чата. Соседние checkout не редактируются.

Сохранён baseline SHA256 75 исходных файлов перед работой, включая предыдущий одобренный diff услуги. `/search`, LiveSearch, CampusServiceCard, ServiceDetail и service-detail.css сохраняются как эталоны; API/lib/context/действия заказа не изменяются. Backend после fetch: `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`, [контракт](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).

## Группы и завершение

| Группа | Область | Статус |
|---|---|---|
| 0 | Аудит всех маршрутов | Выполнен; [полный реестр](2026-10-21_22-18_route-audit.md) |
| 1 | Оболочка, каталог/главная/избранное/исполнитель | Готово, проверки пройдены |
| 2 | Welcome, регистрация, создание услуги | Готово; [отчёт](2026-10-21_22-18_forms-group.md) |
| 3 | Заказы, чаты, сообщения, доплата, уведомления | Готово; [отчёт](2026-10-21_22-18_activity-group.md) |
| 4 | Информация, собственный профиль, 404/error | Готово, существующие заглушки оформлены честно |
| 5 | Общая регрессия и документация | Выполнена с ограничениями ниже |

Все существующие продуктовые страницы входят в визуальный scope и обработаны. Список отсутствующих функций не превращён в новые маршруты. Последующие страницы не ожидают отдельного промпта: комплексная задача доведена до общей проверки.

## Полный реестр статуса

Назначение, прежний дизайн, компоненты, API/actions и пересечения описаны подробно в [аудите 22 маршрутов](2026-10-21_22-18_route-audit.md). Итоговые статусы:

| Маршрут | Итог визуального этапа | Граница данных/действий |
|---|---|---|
| `/` | Campus hero, поиск, категории, карточки | Demo 4 услуги; Live существующий services list |
| `/search` | Утверждённый эталон сохранён | Исходники и логика не менялись |
| `/category/[slug]` | Campus-поиск/фильтры/сортировка/empty | Demo фильтры прежние; Live категории недоступны, есть выход к поиску |
| `/service/[id]` | Одобренная реализация сохранена побайтово | Прежние Demo-заказ/чат и Live quote/disabled operations |
| `/favorites` | Campus grid/loading/empty | Раздельные namespace Demo/Live, browser-only IDs и batching прежние |
| `/profile/[id]` | Campus performer summary, услуги, Demo stats | Live только name/about/услуги; рейтинг/статистика не придуманы |
| `/profile` | Оформлен честный недоступный кабинет | Новые account API/settings не добавлены; ссылки на существующие разделы |
| `/orders` | Campus list/empty | Прежний local Demo, Live disabled |
| `/orders/[id]` | Состав/итог/статус/действия | Прежние суммы и status transitions, Live disabled |
| `/orders/[id]/additional-payment` | Campus-проверка дополнения | `paymentAvailable=false`, успешная оплата не имитируется |
| `/chats` | Campus conversations/empty | Прежняя сортировка и local Demo, Live disabled |
| `/chats/[id]` | Переписка, детали, дополнения, composer | Прежнее хранилище/confirm; отправка без настоящего сервера |
| `/notifications` | Campus feed/unread appearance | Только существующие Demo fixtures, Live disabled |
| `/create-service` | Campus sections + preview | Исходные validation/handlers; нет публикации/нового endpoint |
| `/welcome` | Campus вход, бренд, темы | Прежний переход к регистрации |
| `/register/roles` | Campus role cards + progress | Можно выбрать одну/обе роли; production gate сохранён |
| `/register/profile` | Campus fields/аватар/errors | Прежние draft/валидация; production gate сохранён |
| `/register/performer` | Campus fields/специализации/skip | Прежний flow; production gate сохранён |
| `/about` | Campus information page | Без новых фактов о компании |
| `/rules` | Оформлена существующая заглушка | Юридические правила не выдумывались |
| `/safety` | Оформлена существующая информация | Новых гарантий/платёжных обещаний нет |
| `/support` | Оформлена существующая заглушка | Нет выдуманных контактов и неработающей формы |

Встроенный Next 404 оформлен через `not-found.tsx`, ошибки страниц — через `error.tsx` с предоставленным Next `reset`. Новых продуктовых URL для этого не создано.

## Общая система и принятые технические решения

- Существующие semantic tokens, основной синий `#3547B8`, шрифт, surfaces, focus и Reduced Motion сохранены. Новые styles используют эти переменные.
- Все страницы проходят через CampusShell. Для регистрации/Welcome — вариант onboarding без нижней/desktop навигации; стандартные страницы — с общей навигацией. AuthProvider и FavoritesProvider сохраняют состав, порядок и положение.
- Активная вкладка определяется pathname. `aria-current=page` только у точной страницы, у вложенных разделов — location. Все восемь прежних category URLs доступны в меню; прежние разделы меню сохранены.
- BackButton теперь native button с прежним router.back. В Live disabled preview возврат вынесен за fieldset: бизнес-действия остаются отключёнными, навигация доступна.
- Общая карточка — wrapper над существующим CampusServiceCard, без второй дизайн-системы. ServiceList получает те же API-ответы и использует доступные performer/duration/description, без выдуманных DTO.
- Root viewport добавляет `viewport-fit=cover`, zoom не запрещается. Новая страница услуги и её route viewport сохранены.
- Формы используют CSS Modules, остальные новые стили ограничены Campus/page/activity классами. Прежний campus.css и токены не переписывались.
- 3D, canvas, новые runtime dependencies и framework upgrades не добавлялись. Для этого интерфейса достаточно CSS feedback и existing native dialogs.
- Продуктовые сценарии, rates/status/price, auth, API/CSRF и storage schema не менялись. Demo «Написать исполнителю» на публичном профиле прежде не имел handler; теперь честно disabled, нового chat-сценария не добавлено.

## Изменённые файлы

Точный список относительно начала **этой** задачи: [changed-files.json](implementation/2026-10-21-campus-full/changed-files.json). В отличие от общего git diff он исключает уже существовавший одобренный результат /service/[id].

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/information.module.css`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/components/BackButton.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/ChatWindow.tsx`
- `apps/web/src/components/ServiceCard.tsx`
- `apps/web/src/components/studly/PageHeading.tsx`
- `apps/web/src/components/studly/CampusShell.tsx`
- `apps/web/src/components/studly/campus-pages.css`
- `apps/web/src/components/studly/activity.css`
- `apps/web/src/components/registration/RegistrationShell.tsx`
- `apps/web/src/components/registration/registration.module.css`
- `apps/web/src/components/catalog/ServiceList.tsx`
- `apps/web/src/components/catalog/LivePerformer.tsx`
- `apps/web/src/components/catalog/LiveFavorites.tsx`
- `apps/web/src/app/favorites/page.tsx`
- `apps/web/src/app/about/page.tsx`
- `apps/web/src/app/welcome/welcome.module.css`
- `apps/web/src/app/welcome/page.tsx`
- `apps/web/src/app/safety/page.tsx`
- `apps/web/src/app/register/layout.tsx`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/support/page.tsx`
- `apps/web/src/app/create-service/create-service.module.css`
- `apps/web/src/app/create-service/page.tsx`
- `apps/web/src/app/rules/page.tsx`
- `apps/web/src/app/chats/page.tsx`
- `apps/web/src/app/orders/page.tsx`
- `apps/web/src/app/notifications/page.tsx`
- `apps/web/src/app/orders/[id]/page.tsx`
- `apps/web/src/app/orders/[id]/additional-payment/page.tsx`
- `apps/web/src/app/chats/[id]/page.tsx`
- `apps/web/src/app/profile/[id]/page.tsx`
- `apps/web/src/app/register/roles/page.tsx`
- `apps/web/src/app/category/[slug]/page.tsx`

Документация: этот прогресс/итоговый отчёт, аудит, отчёты форм/activity, общий и тематический README; [артефакты](implementation/2026-10-21-campus-full/). Новый test-only platform preview был временно в public, после проверки удалён; в итоговом приложении тестовой страницы нет. Его исходник сохранён только в доказательствах.

## Backend/API boundary

Проверенный reference после `git fetch origin`: **d7a5ffa5abc1537301ced7275da9e45282d6b4f3**; [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).

Сохраняются GET `/api/v1/services/` с search/ids/performer/page, `/services/<id>/`, `/services/<id>/quote/`, `/performers/<id>/`, существующие auth/registration endpoints. Новый API-клиент/серверные маршруты Next не создавались. Все запросы, trailing slash, credential/CSRF и money validation принадлежат прежним клиентам. Отображение денежных сумм остаётся через существующие значения/форматирование. Live order create не подключается как побочный эффект редизайна.

[SHA256-проверка сохранности](implementation/2026-10-21-campus-full/preservation.json) подтверждает идентичность защищённых исходников началу задачи: API/lib/context, одобренные search/detail, CampusServiceCard, token/Campus CSS, существующие действия создания заказа/чата, поля регистрации и специализации. Backend, package/lock, next.config, launcher не менялись. В activity/forms группах дополнительно сравнивались исходные business handlers; они сохранены.

## Фактические проверки этого этапа

| Проверка | Результат |
|---|---|
| TypeScript nonincremental `tsc --noEmit --incremental false` | PASS; итоговые Demo и Live builds также выполнили TypeScript |
| ESLint | 0 errors; 2 прежних no-img-element warnings у blob previews create-service (теперь строки 189/223) |
| `npm test -w apps/web` | 37/37 PASS, включая финальный повтор после всех правок |
| Существующий registration TS suite отдельным transpileModule runner | 8/8 PASS, включая финальный повтор; всего 45 тестов |
| Production Demo `NEXT_PUBLIC_STUDLY_DATA_MODE=demo npm run build -w apps/web` | PASS; финальная пересборка после CSS/Live-back исправлений PASS |
| Production Live с локальным read-only test origin 18005 | PASS; настоящий Django при этом не проверялся |
| HTTP smoke production Demo | 30/30 ожидаемых ответов: 22 representative routes, дополнительные категории и 404. [JSON](implementation/2026-10-21-campus-full/routes.json) |
| Responsive + темы | 22 страницы + 404 × 4 ширины × 2 темы = **184** конечных измерения; actualWidth=scrollWidth=320/390/768/1440, main один, видимых button/link ниже 43px по высоте не найдено |
| Development registration | 3 формы × 4 ширины × 2 темы = **24** дополнительных измерения без overflow/вложенных main |
| Demo-заказ | 1200 + 400 = 1600 ₽, 5 + 1 = 6 дней; PENDING→IN_PROGRESS→REVIEW→COMPLETED подтверждены UI |
| Demo-чаты | Открыт связанный чат, отправлено локальное сообщение, текст сохранён после переходов. Дополнительная оплата остаётся disabled |
| Demo-категория | max500 → 1 услуга; min1000/max500 → прежняя ошибка; сброс → 3 услуги |
| Создание услуги | Все обязательные пустые поля получают invalid; заполненный preview показывает введённые title/price/состав. Публикации нет |
| Регистрация | Обе роли, пустое имя rejected, имя/университет сохраняются при возврате, «Заполнить позже» ведёт в честный Demo preview end |
| Live synthetic | Home/performer/services/quote, browser favorites с ID42 отдельно от Demo ID101; 1000+30=1030 из quote; loading/empty/503/404/invalid DTO, Demo fallback отсутствует |
| Live disabled scopes | Orders/chats/notifications/create-service/category: disabled fieldset, 0 enabled form controls, Demo-заказ не показывается, Back доступен за блокировкой |
| Меню/фокус | 8 категорий доступны; Escape возвращает focus на «Открыть меню». Reference skip links сохранены, новые ведут на main content |
| CSS safe-area simulation | Insets top24/bottom34/left-right30: header92, nav108, workspace left30/bottom134, overflow0. Это эмуляция CSS, не устройство |
| Reduced Motion simulation | Активированы исходные media rules; computed animation=none, transition=0s. Настройки ОС не менялись |
| Composer | После исправления все mobile cases выше nav. В 390×500 при focus input bottom387, composer bottom399, nav top426; доступен native document scroll |
| `git diff --check` | PASS |

Доказательства: [общая матрица](implementation/2026-10-21-campus-full/responsive.json), [формы](implementation/2026-10-21-campus-full/registration-responsive.json), [регистрация](implementation/2026-10-21-campus-full/registration-checks.json), [Demo](implementation/2026-10-21-campus-full/demo-checks.json), [категория](implementation/2026-10-21-campus-full/category-checks.json), [Live](implementation/2026-10-21-campus-full/live-checks.json), [safe/motion](implementation/2026-10-21-campus-full/platform-simulation.json), [короткий чат](implementation/2026-10-21-campus-full/chat-short-viewport.json).

## Найденные и исправленные ошибки

1. Возврат четырёх потерянных category links после замены Sidebar; теперь сохранены все восемь.
2. Исправлена специфичность invalid-border и кнопки удаления допуслуги в форме создания услуги.
3. Placeholder opacity поднята до1 для сохранения контраста semantic muted.
4. На320px composer первоначально пересекался с nav на10px; уменьшена расчётная высота chat, добавлен scroll margin поля. Финальная матрица перепроверена, перекрытия нет.
5. Native Back внутри disabled fieldset блокировался; возврат вынесен наружу в Live preview без включения команд.
6. Разобраны ограничения браузерного QA: viewport capability действует на текущую выбранную вкладку. После закрытия дополнительных тестовых вкладок Live-снимки пересняты с проверенным actualWidth390. Промежуточные неверные снимки перезаписаны. В responsive JSON оставлены последние измерения каждого route/width/theme.
7. Несколько locator/iframe-read ошибок относились к QA-инструменту: пустой заголовок уточнён по фактическому DOM, iframe измерен через frameLocator. Это не ошибки приложения.

## Ограничения и оставшиеся продуктовые задачи

- Production-регистрация по-прежнему показывает «Регистрация скоро появится»; формы доступны в development preview. Gate не снимался.
- Собственный кабинет, настройки, служба поддержки/юридические документы, public media/category/rating APIs и новые Live операции не реализованы исходным продуктом. Здесь оформлены их текущие состояния, новые функции не выдумывались.
- Live orders/chats/create-service/notifications сохраняют прежнюю блокировку; дополнительные платежи отключены. Реальных денег, fake payment success или аккаунтов не создавалось.
- Физические iPhone/Android, настоящий Telegram WebView/экранная клавиатура, landscape/fullscreen и OS text scaling/200% — **Не запускалась**. Проверка короткого viewport и CSS safe/reduced simulation не подменяет их.
- Screen reader audit, cross-browser matrix и LCP/INP/CLS/FPS/memory/energy — **Не запускалась**. Полная WCAG/performance сертификация не заявляется.
- Реальная Django/Telegram/session/CSRF E2E — **Не запускалась**. Синтетическая фикстура test-only, read-only, не настоящий Backend.
- Error boundary собран/проверен по коду; преднамеренный crash в продуктовый код не добавлялся.
- Упомянутый в аудите потенциальный objectURL lifecycle формы существовал ранее; бизнес/ресурсная логика не расширялась в визуальной задаче.

Это реестр ограничений платформы/интеграции и проверок, а не необработанные существующие маршруты.

## Передача основному Frontend

Для Git-review передаются: обобщённая CampusShell/AppShell с сохранением providers и Live gating; root viewport; optional wrapper props и PageHeading; общая карточка/BackButton; scoped page/activity CSS и form modules; визуальные page composition всех существующих маршрутов; 404/error presentation; реестр/скриншоты/проверки. API DTO/handlers и package dependencies не требуют переноса. Одобренный предыдущий service diff остаётся в том же рабочем дереве отдельной историей и не перезаписан.

Проверить при интеграции реальные изменения других направлений, согласовать Git diff/порядок PR и выполнить регрессию на согласованном Backend. Ветки не объединялись, файлы соседних checkout не копировались. Новое сообщение в основной чат с результатом не отправлялось: подготовлен этот перечень для PO.

## Git, процессы и итог

Commit/push/merge/rebase/reset не выполнялись. Всё оставлено незакоммиченным в Redesign для review. Существующий пользовательский dev-процесс PID73590 на3001 не останавливался. Production QA выполнялся отдельно на3101, синтетический read-only API —18005. Финальная `.next` собрана в Demo. Точные остановки своих QA-процессов и закрытие отмечаются ниже.

Проверка отчёта и исходников: **21.10.2026 22:53:04 Europe/Moscow**, системные часы. Защищённых файлов SHA256: **28**, все совпадают с baseline.

Закрытие: **21.10.2026 22:54:34 Europe/Moscow**, системные часы. Свои production QA на3101 и read-only fixture на18005 остановлены. Пользовательский dev на3001 сохранён и его готовая главная открыта для проверки. 89 локальных ссылок новых отчётов проверены, отсутствующих targets нет. HEAD `1888b91` не менялся; исходники/отчёты остаются незакоммиченными.
