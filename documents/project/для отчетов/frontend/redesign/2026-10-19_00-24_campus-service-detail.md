# STUDLY 2.0 — детальная страница услуги в концепции «Кампус / Ясный ритм»

- Начало: **19.10.2026, 00:24:30 Europe/Moscow** — системные часы.
- Контрольное завершение реализации и браузерных проверок: **19.10.2026, 00:35:38 Europe/Moscow**. Окончательное время закрытия — в конце отчёта.
- Рабочий каталог: `/Users/alekspih/Projects/studly-redesign`.
- Ветка: `codex/frontend-redesign-campus`; HEAD/организационная база: `1888b9194827d00317fb9cf9d27218ef702999cb`.
- Исходное рабочее дерево чистое. Проверены cwd, Git root, branch, status, worktree list, последний commit. Три постоянных checkout соответствуют регламенту; остальные checkout не редактировались.
- Статус: реализация готова для визуальной приёмки PO. Только `/service/[id]`; остальные страницы не перерабатывались. Commit, push, merge, rebase, reset не выполнялись.

## Задача, источники и согласование

Перенести существующий экран услуги в утверждённый «Кампус», сохранив клиентские сценарии, Demo/Live, API, загрузку, ошибки и навигацию. Визуальный ориентир — действующий `/search`, его токены, CampusShell и [отчёт реализации](2026-10-18_13-21_campus-search-implementation.md). Изучены root/apps/web AGENTS, [регламент](../../../TEAM_WORKFLOW.md), [передача](../../../handoffs/FRONTEND_REDESIGN.md), текущая страница и связанные действия. До кода прочитаны установленные guides Next по CSS, client components и viewport.

В начале выполнен `git fetch origin`; он потребовал разрешение на запись FETCH_HEAD вне sandbox и затем успешно завершился. Backend reference остался `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. Направление Redesign не имеет новых remote-изменений относительно исходного HEAD.

Scope передан в чат **«Основная разработка Frontend»**. Получена предварительная техническая оценка: точное распознавание маршрута, сохранение поведения `/search`, необязательные props оболочки, работающий skip link, активный раздел без ложного `aria-current="page"`, CSS только для детали, сохранение запросов и действий. Основное направление не редактирует эти файлы параллельно. PO отдельно ответил: **«Согласовать эту область изменений»**. Единственный автор реализации — этот чат Redesign.

## Что изменилось визуально

- Единая оболочка Campus: бренд, desktop-меню, mobile-навигация, темы и меню дополнительных разделов.
- Название, доступная категория, основная цена и срок объединены в карточку. Абстрактная статичная лента — декоративная графика; отсутствующие фотографии не изображаются реальными.
- Исполнитель: инициалы вместо выдуманного портрета, имя, переход в существующий профиль, прежний чат. Рейтинг показывается только из Demo-данных с маркировкой «Демо».
- Описание сохраняет переносы строк. Состав услуги — отдельный список. Для пустых description/included/name предусмотрены честные пояснения.
- Demo-дополнения сохраняют исходные три опции, цены, дополнительные дни и порядок. Кнопки получили доступное состояние `aria-pressed`; выбор передаётся прежнему CreateOrderButton.
- Desktop: расчёт заказа в боковой колонке, закреплённой при прокрутке. До 800 px — последовательный поток.
- Mobile: цена основной услуги и ссылка «К оформлению» / «К расчёту» над нижней навигацией. Это переход к настоящему блоку расчёта, а не фиктивная операция оплаты. В Dock явно указано «Стоимость услуги»; итог с дополнениями находится в блоке заказа.
- Избранное использует прежний FavoritesContext и его hydration gate. Меняются только представление и доступные названия кнопки.
- Ссылка пропуска ведёт к фокусируемому `service-title`. Поиск на детали имеет `aria-current="location"`, на `/search` остаётся `page`.
- Добавлен route-local `viewport-fit=cover`, без запрета масштабирования.
- Использованы существующие CSS tokens/transitions. Новые зависимости, Motion runtime, Three, GPU-сцены не добавлялись: для этого экрана достаточно CSS и статичной графики.

## Файлы

Изменены:

1. `apps/web/src/app/service/[id]/page.tsx` — Demo-представление, доступный выбор дополнений, композиция прежних действий; явный Demo/Live выбор сохранён.
2. `apps/web/src/components/catalog/LiveService.tsx` — только представление detail/quote; callback загрузки, ресурсный hook и клиент прежние.
3. `apps/web/src/components/AppShell.tsx` — точное подключение CampusShell для `/service/<id>`; оболочки остальных маршрутов прежние.
4. `apps/web/src/components/studly/CampusShell.tsx` — необязательные `contentId`, `skipLabel`, `isSearchPage` с прежними defaults `/search`.
5. Тематический `frontend/redesign/README.md` и общий индекс `для отчетов/README.md`.

Созданы:

- `apps/web/src/app/service/[id]/layout.tsx` — viewport только этого маршрута.
- `apps/web/src/components/catalog/ServiceDetail.tsx` — общее визуальное представление и состояние ошибки/загрузки.
- `apps/web/src/components/catalog/service-detail.css` — 110 правил, все selectors ограничены `.studly-app` и классами детали. Несколько overrides с `!important` перекрывают прежние inline-стили только у неизменённых Demo-действий внутри новой страницы.
- Этот отчёт и каталог [артефактов](implementation/2026-10-19-campus-service/): screenshots, JSON доказательства, синтетическая read-only HTTP-фикстура и незапущенный platform preview.

Удалённых исходников нет. [Проверка границ](implementation/2026-10-19-campus-service/scope-check.json) подтверждает побайтовое совпадение с HEAD для 15 контрольных файлов: API transport/catalog, data mode, Auth/Favorites contexts, CreateOrderButton, StartChatButton, AdditionalServicesSelector, Campus tokens/CSS, `/search`/LiveSearch, Telegram adapter и package/lock. `apps/api` не изменён.

## API и сохранённые сценарии

Использован [Backend API_CONTRACT.md на d7a5ffa5abc1537301ced7275da9e45282d6b4f3](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).

- Прежний `GET /api/v1/services/<id>/` — описание, цена, срок, performer, included, is_demo.
- Прежний `GET /api/v1/services/<id>/quote/` — цена, buyer_fee_percent/amount, total_amount, service_revision. Итог и комиссия не вычисляются Frontend заново.
- Переход `/profile/<performer.id>` сохраняется. Нового запроса профиля на экране услуги не добавлено.
- Сохраняются общие auth/options и auth/me, без изменения авторизации, cookies или CSRF.
- Категорий, фотографий, публичных рейтингов и портфолио в Service DTO нет: Live их не выдумывает.
- API-клиент, валидация DTO, отмена запросов, retry и правило отсутствия retry для 404 не менялись. Ошибка Live не подменяется Demo.
- В текущем Frontend Live-заказ и чат на этой странице были отключены и остаются отключёнными. Наличие Backend orders endpoint не является разрешением подключить новую бизнес-функцию в задаче редизайна.
- Demo: прежние `studly-orders`/`studly-chats` и ключи избранного не менялись. Суммы и сроки рассчитывает прежний CreateOrderButton; локальный заказ не изображает реальную оплату.

## Проверки этого сеанса

| Проверка | Фактический результат |
|---|---|
| `npx tsc --noEmit --incremental false -p apps/web/tsconfig.json` | PASS |
| `npm run lint -w apps/web` | PASS: 0 errors; 2 прежних `no-img-element` warnings в `/create-service` (429/589). Финальный повтор после изменений — тот же результат |
| `npm test -w apps/web` | 37/37 PASS |
| Существующий `registration.test.ts` через изолированный TypeScript transpileModule runner | 8/8 PASS; всего 45 автоматических тестов |
| Production Demo `NEXT_PUBLIC_STUDLY_DATA_MODE=demo npm run build -w apps/web` | PASS, включая TypeScript; финальная пересборка после исправления метки Demo также PASS |
| Production Live с `NEXT_PUBLIC_STUDLY_DATA_MODE=live DJANGO_API_ORIGIN=http://127.0.0.1:18003` | PASS; только локальная синтетическая фикстура |
| Основные маршруты, production Demo | 24 representative HTTP GET = 200; [результаты](implementation/2026-10-19-campus-service/routes.json). Это smoke оболочек, не полное E2E всех страниц. Клиентский not-found услуги имеет HTTP 200, как существующий маршрут |
| Responsive | 320/390/768/1440, обе темы: фактический client width подтверждён, горизонтальный overflow 0; 8 финальных screenshots |
| Touch targets | В первой полной матрице все видимые кнопки/ссылки не меньше 44×44; у нижних вкладок 56 px по высоте. Проверена доступность допуслуг и CTA прокруткой на 320 px |
| Контраст | Основные текстовые, accent и выбранные состояния: минимум 5.95:1 в проверенном наборе; [вычисления](implementation/2026-10-19-campus-service/contrast.json). Это не полный WCAG audit |
| Demo-заказ | На услуге 500 ₽ выбрана опция +400 ₽/+1 день: расчёт и созданный заказ показывают 900 ₽, 4 дня, «Подробный отчёт», PENDING. Реальных платежей нет |
| Demo-избранное | Сохраняется после перехода и reload; гидратационных ошибок в наблюдаемых логах нет |
| Demo-чат | Прежняя кнопка открыла существующий чат, связанный с созданным Demo-заказом |
| Навигация/клавиатура | Профиль исполнителя открывается; Enter на skip link ставит фокус на `service-title`; Back возвращает по истории, включая hash, затем к `/search` |
| Регрессия `/search` | 17 Demo-карточек; Python → 1 услуга; переход `/service/2` с прежней ценой/сроком. В каталоге нет `.service-detail`, skip target `search-title`, aria-current `page` |
| Live quote UI | Синтетические 1000.00 + 30.00 = 1030.00 RUB показаны из quote; чат и оформление disabled |
| Live ошибки | 401/403/404/500, non-JSON, invalid DTO; при 404 retry отсутствует, в прочих проверенных ошибках есть. Отдельные quote 500/404/invalid DTO не скрывают саму услугу |
| Live retry/границы | Retry после синтетического 500 восстановил услугу. Пустые поля показывают fallback-тексты; длинное название без пробелов не даёт overflow на 320 px; is_demo маркируется и в услуге, и в quote |
| Live загрузка/недоступность | Синтетический задержанный detail показал «Загрузка…». Выполнен переход с незавершённого запроса. После остановки фикстуры proxy error показан как ошибка, Demo не появляется |
| CSS isolation / сохранность | PostCSS: 110 rules, 0 unscoped selectors; 15 контрольных файлов совпали с HEAD |
| Браузерный журнал финального Demo-осмотра | Наблюдаемых errors/warnings нет. Это не доказательство отсутствия ошибок во всех браузерах |
| `git diff --check` | PASS |

## Mobile, safe areas и Reduced Motion — границы подтверждения

Реальные screenshot dimensions: 320×844, 390×844, 768×844, 1440×1000. На телефоне dock заканчивается на y=770, нижняя навигация начинается y=770 при высоте 844; элементы не пересекаются. Доступная прокрутка и дополнительный нижний отступ позволяют дойти до последнего действия. Планшет использует одноколоночный поток, desktop — основную и боковую колонку.

Safe areas используют неизменный Telegram adapter и существующие `--safe-*`: max browser env и SDK insets. Dock смещён на `74px + var(--safe-bottom)`, учитывает left/right. В production DOM подтверждён `viewport-fit=cover`. Существующие автоматические проверки adapter (валидность, max без суммирования, viewport, подписки, SSR) прошли.

В загруженных production styles найдены 4 media blocks Reduced Motion. Система в этом сеансе сообщала `prefers-reduced-motion: false`; настройки пользователя не менялись. Существующие правила отключают transitions/animations/scroll-behavior; новый detail-rule дополнительно сбрасывает transient active transform. Постоянных анимаций на экране нет.

**Отдельная CSS-эмуляция safe insets и включённых Reduced Motion rules — Не запускалась.** Подготовлен test-only [platform preview](implementation/2026-10-19-campus-service/platform-preview.html), но перезапуск тестового сервера с ним был отклонён инструментом (`rejected by user`); дополнительная причина не предоставлена. Обход не выполнялся. Не выдаём анализ CSS/adapter tests за физическую проверку Telegram safe areas или ОС Reduced Motion.

**Не запускалась:** проверка на физических iPhone/Android и настоящем Telegram WebView, реальной экранной клавиатуре, fullscreen/landscape, screen reader; реальная Django/Telegram/CSRF end-to-end сессия, оплата, performance/CWV/FPS/энергия. Синтетическая фикстура — не Django и не продуктовый Backend. Новые серверные возможности не подтверждаются этим QA.

## Скриншоты и данные

| Ширина | Светлая | Тёмная |
|---|---|---|
| 320 | [Снимок](implementation/2026-10-19-campus-service/service-320-light.jpg) | [Снимок](implementation/2026-10-19-campus-service/service-320-dark.jpg) |
| 390 | [Снимок](implementation/2026-10-19-campus-service/service-390-light.jpg) | [Снимок](implementation/2026-10-19-campus-service/service-390-dark.jpg) |
| 768 | [Снимок](implementation/2026-10-19-campus-service/service-768-light.jpg) | [Снимок](implementation/2026-10-19-campus-service/service-768-dark.jpg) |
| 1440 | [Снимок](implementation/2026-10-19-campus-service/service-1440-light.jpg) | [Снимок](implementation/2026-10-19-campus-service/service-1440-dark.jpg) |

Дополнительно: [полный desktop dark](implementation/2026-10-19-campus-service/service-1440-dark-full.jpg), [Demo-дополнения и итог](implementation/2026-10-19-campus-service/demo-extras-320.jpg), [Demo not-found](implementation/2026-10-19-campus-service/demo-not-found-320.jpg), [Live quote](implementation/2026-10-19-campus-service/live-quote-320.jpg), [Live loading](implementation/2026-10-19-campus-service/live-loading-320.jpg), [Live error](implementation/2026-10-19-campus-service/live-unavailable-320.jpg), [регрессия поиска](implementation/2026-10-19-campus-service/search-regression-768.jpg).

Доказательства: [responsive](implementation/2026-10-19-campus-service/responsive.json), [Demo](implementation/2026-10-19-campus-service/demo-checks.json), [Live](implementation/2026-10-19-campus-service/live-checks.json), [viewport и media rules](implementation/2026-10-19-campus-service/accessibility-inspection.json).

## Ошибки процесса и ограничения

- Первые локальные listen и HTTP smoke заблокированы sandbox (EPERM); повторены с разрешением и завершились успешно. Fetch аналогично выполнен после разрешения.
- Во время UI automation уточнены два locator: Next route announcer тоже имеет role alert, поэтому проверка ограничена `.service-detail`; поисковое поле найдено по label. Это ошибки инструментария QA, а не найденные дефекты приложения.
- Один CDP navigation timeout сопровождался изменением фактического viewport: неверный промежуточный снимок 768 dark перезаписан после явного контроля размеров; 1440 light/dark тоже подтверждены отдельно. В финальном JSON у всех восьми вариантов actualWidth соответствует заданному. Размеры JPEG проверены независимо по заголовкам файлов.
- Найден и исправлен перенос букв в маленькой метке «ДЕМО»: добавлены flex-shrink:0 и nowrap. Финальная Demo-сборка и снимки сделаны после исправления.
- Ограничения интеграции прежние: Live-кнопки заказа/чата не подключены, нет media/category/rating DTO. Профиль и другие legacy-страницы сохраняют своё прежнее оформление.
- Новые тесты, дублирующие верстку, не добавлялись. Использованы существующие regression suites и проверки реального браузерного интерфейса.

## Git и завершение

Код, отчёт, индексы и доказательства оставлены незакоммиченными для review. Backend, API-контракты, auth, бизнес-действия и package/lock не изменены. Запрещённые Git-операции не выполнялись; публикации/деплоя нет. Тестовая фикстура остановлена; финальная `.next` собрана в Demo. Финальное состояние локального Next-процесса и время закрытия фиксируются ниже.

Следующее действие — визуальная проверка PO. Остальные страницы не начинать автоматически. Реальные Telegram-проверки и включение новых Live-операций требуют отдельных задач.

Закрытие этапа: **19.10.2026, 00:37:27 Europe/Moscow**, системные часы. Локальный Next на 3001 остановлен своим Ctrl+C; тестовый процесс фикстуры ранее остановлен. Проверка локальных ссылок отчёта: отсутствующих targets — 0. Все восемь финальных responsive-измерений совпадают с заданной шириной, overflow 0. Финальные Git-границы и diff-check проверены; HEAD не менялся.
