# STUDLY 2.0 — реализация «Кампус / Ясный ритм», /search

- Дата: **18 октября 2026 года, Europe/Moscow (UTC+3)**.
- Начало: **13:21:45** по системным часам. Основная проверка реализации завершена **13:45:26**; время закрытия документации приведено в конце.
- Статус: **дизайн окончательно утверждён пользователем; дизайн-система и /search реализованы локально, публикация ожидает отдельного разрешения**.
- Ветка: `codex/frontend-registration`; HEAD: `24117052e6091efb391c8840e3d98b2708b773c3`.
- Commit, push, merge, rebase, reset и публикация не выполнялись. Backend не изменялся.

## Цель и основание

Перенести утверждённый [прототип «Кампус»](prototypes/2026-10-18-search/dist/campus.html) в настоящее приложение, начиная только с `/search`. Источник требований — приложенное пользователем задание «STUDLY 2.0 — начало реализации redesign». Семь отчётов исследования и [визуальный этап](2026-10-18_02-08_visual-prototypes.md) остаются историческими материалами; выбор «Кампуса» теперь окончательный.

Сохранены исходный знак `BrandMark`, STUDLY, `#3547B8`, системная типографика, мотив двух лент, сетка и поверхности карточек. Прототипные имена, шесть вымышленных услуг и его JavaScript бизнес-логики в приложение не переносились.

## Что реализовано

| Модуль | Назначение |
|---|---|
| `components/studly/tokens.css` | Палитры light/dark, акценты, типографические, пространственные и motion-токены, радиус и тень |
| `components/studly/campus.css` | Перенесённые base/Campus-стили, ограниченные `.studly-app`; адаптивная сетка, поля, навигация, диалоги и состояния |
| `components/studly/Icon.tsx` | Общие декоративные SVG-иконки без внешней библиотеки |
| `components/studly/primitives.tsx` | Button primary/secondary/ghost, Field, StatusPanel loading/error/empty/unsupported |
| `components/studly/CampusShell.tsx` | Оболочка только поиска: знак, настоящие Link-переходы, постоянный Demo/Live badge, desktop/mobile navigation, меню остальных разделов, переключение тем |
| `components/studly/CampusServiceCard.tsx` | Представление настоящей услуги, цена, исполнитель, срок, избранное и переход к существующему `/service/[id]` |
| `components/catalog/LiveSearch.tsx` | Настоящая выдача в композиции Campus; существующие загрузка, retry, search, pagination, Demo/Live сохранены |
| `components/catalog/SearchFilters.tsx` | Одни контролируемые поля для desktop и mobile dialog, уникальные ID через useId |
| `lib/catalog/search.ts` | Чистая модель поиска, проверки диапазона, локальных фильтров и сортировки; отдельные тесты |
| `lib/telegram/campus-platform.ts` | Отображаемые metadata SDK, safe areas всех четырёх сторон, стабильная высота, theme/viewport subscriptions с cleanup |
| `components/AppShell.tsx` | Выбор Campus только при точном `/search`; один FavoritesProvider над обоими вариантами оболочки |
| `app/search/page.tsx` | Серверный entrypoint с `viewport-fit=cover`, клиентский компонент каталога сохранён; zoom не запрещён |

Новые зависимости не устанавливались, package.json и lockfile в этом этапе не менялись. Согласованный стек Next/React/TypeScript/CSS/Motion сохранён как направление. Для текущих состояний достаточно CSS: обратная связь 140ms, открытие native dialog 180ms, без циклов и задержки действий. Motion пока не добавлен согласно прямому условию пользователя устанавливать его только при обоснованной необходимости. Three/R3F/WebGPU не требуются этому экрану.

Основная система токенов: светлый фон `#F6F7FB`, поверхность `#FFFFFF`, текст `#17203A`, вторичный текст `#59647A`; тёмный фон `#111827`, поверхность `#192236`, текст `#F2F4FA`, вторичный текст `#AAB6CC`. Акцент `#3547B8` сохраняется в обеих темах, светлый акцентный текст тёмной темы — `#BCC7FF`. Скругление карточки 18px, контролов 11px. Заголовок 28–42px, основной текст 16px, input не меньше 16px на мобильном экране.

## Функциональность и API

- Demo использует все **17 существующих услуг**, включая ID100/101. Добавлены категории из настоящего локального массива; никакой фиктивной классификации Live.
- Live продолжает обращаться через `catalogClient.list`, `apiRequest`, `/api/v1/services/?search=...` и существующий Next rewrite к Django. DTO, trailing slashes, обработка decimal money, session/CSRF, API-клиент и Backend не менялись.
- Серверный поиск и DRF `next/previous` сохранены; URL пагинации обрабатывается прежним `pagePath`, запросы отменяются прежним `useApiResource`. Изменение поиска возвращает первую страницу.
- Цена, срок и сортировка в Live относятся только к загруженной странице. Подпись разделяет «показано на этой странице» и серверный total. Недоступные рейтинги отключены; отсутствие категорий явно обозначено.
- Ошибка Live показывает ошибку и допустимый retry, без подстановки Demo. Для404 retry отсутствует, как раньше. Loading, empty и error разделены.
- Неверный диапазон цены показывает ошибку; ни одна ценовая граница не применяется частично. Мобильный apply отключён до исправления.
- Избранное использует существующий FavoritesContext и неизменные ключи `favorites` / `studly-api-favorites`. Провайдер сохраняет положение при переходах между новым поиском и legacy. Начальный pressed-state карточки gated через isHydrated, чтобы сохранённые данные не вызывали hydration mismatch.
- Авторизация остаётся у существующего AuthProvider. Платформенный hook не читает initData/личность, не запускает ready/expand/fullscreen и не грузит второй SDK. Browser stub SDK с `platform=unknown` оставляет системную тему.

Связанный Backend-контракт: [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md), snapshot `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`, зафиксированный предыдущим аудитом. Историческая интеграция: `fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4`. В этой задаче удалённые ветки не изменялись, новый fetch не выполнялся.

## Отличия от визуального прототипа

| Отличие | Причина |
|---|---|
| 17 прежних услуг вместо6 примеров, иные длины текста и порядок обложек | Требование сохранить функциональность и данные приложения |
| Действительные категории Demo вместо групп «Учёба/Код/Медиа» | Не подменять существующую таксономию; Live taxonomy API отсутствует |
| Диапазон цены от/до, сроки1/3/7 дней, рейтинг Demo и прежние сортировки | Сохранены рабочие возможности приложения, а не упрощённые фильтры прототипа |
| Нет prototype-фильтра «Только избранное» | Его не было в настоящем поиске; избранное доступно на существующем маршруте |
| Реальные имена, рейтинг Demo и срок вместо специальностей/курса/единицы цены | Текущий DTO не содержит этих дополнительных полей; сведения не выдумываются |
| Абстрактные CSS-обложки; Live получает нейтральный STUDLY-мотив | API не передаёт фото/категорию; оформление не маскируется под реальный медиаконтент |
| Переход к настоящей странице услуги вместо prototype dialog | Существующая маршрутизация и сценарий заказа сохранены |
| Кнопка меню и настоящие переходы | Сохранена доступность заказов, уведомлений, публикации и информационных разделов |
| Строка исполнителя имеет touch target44px; карточки немного выше | Доступность и действительный рейтинг требуют дополнительного места |
| Live capability/error/loading/pagination notices | Честное отображение возможностей Django вместо визуальной заглушки |

Заголовки, размеры, палитры, обложки, тонкие границы и мобильная композиция визуально сопоставлены с Campus screenshots. Это ручное сравнение; pixel-perfect diff с разными данными не заявляется. Остальные страницы сохраняют прежнее оформление.

## Telegram, темы, доступность

По умолчанию используется тема Telegram, при отсутствии настоящего SDK — CSS `prefers-color-scheme`. Есть локальное ручное переключение и возврат к теме Telegram/системы в меню. Ручной выбор не сохраняется между размонтированиями страницы; системная тема остаётся исходным поведением.

Safe areas объединяются как `max(env(), SDK)`, не складываются. SDK metadata finite/nonnegative, device/content insets берутся по большему значению, неподдержанные события безопасны; подписки удаляются. Используется viewportStableHeight с валидным viewportHeight fallback и `100svh` без SDK. Поля, кнопки, ссылки исполнителя и навигация имеют основные touch targets44px и более. Для диалогов используется native showModal: focus, Escape, возврат к opener; фильтр закрывается при переходе на desktop. Очистка поиска возвращает фокус input; Enter не снимает keyboard focus на desktop.

Проблема светлого текста на белой карточке устранена внутри нового `/search`: фон и цвет задаются одной scoped theme. Legacy-страницы глобально не перекрашивались.

| Текстовая пара | Светлая | Тёмная |
|---|---:|---:|
| Основной текст / поверхность | 16.10:1 | 14.43:1 |
| Вторичный / поверхность | 5.95:1 | 7.76:1 |
| Вторичный / фон | 5.56:1 | 8.68:1 |
| Белый / основной синий | 7.65:1 | 7.65:1 |
| Акцентный текст / мягкий акцент | 6.51:1 | 7.41:1 |

Расчёт по относительной яркости цветов токенов: [contrast.json](implementation/2026-10-18-campus-search/contrast.json). Это проверка основных текстовых пар, не сертификат полной WCAG-совместимости; contrast отключённых контролов и скринридер-аудит не объявляются завершёнными.

Reduced Motion реализован media rule: transition/animation отключены, hover/active transform сброшены. Проверен исходный CSS и наличие правила в сборке; переключение ОС с настоящим Reduced Motion не выполнялось. Нет постоянной анимации, GPU-сцен или ожидания анимации перед действием.

## Проверки и доказательства

| Проверка | Результат и границы |
|---|---|
| `npm test -w apps/web` | **30/30 PASS**:13 прежних +6 search +11 platform |
| Registration TS tests отдельным transpileModule runner | **8/8 PASS**; всего38 автоматических тестов |
| `tsc --noEmit --incremental false -p apps/web/tsconfig.json` | PASS; финальная Next-сборка также выполнила TypeScript |
| `npm run lint -w apps/web` | 0 errors;2 прежних no-img-element warnings в create-service:429/589 |
| Production build Live | PASS, `DJANGO_API_ORIGIN=https://studly-help.ru NEXT_PUBLIC_STUDLY_DATA_MODE=live`; проверен реальный пустой Django-каталог |
| Финальный production build Demo | PASS, `NEXT_PUBLIC_STUDLY_DATA_MODE=demo`; после исправлений focus/hydration/viewport/touch areas |
| Маршруты | 22 прежних page templates;22 representative HTTP GET=200, [routes.json](implementation/2026-10-18-campus-search/routes.json); это smoke, а не E2E каждого раздела |
| Demo browser | 17 услуг; Python→ID2; категория→3; max500+срок3→ID1/6; неверный диапазон→alert; срок1→empty; убывание цены→ID4; сброс→17 |
| Избранное browser | ID101→избранное→поиск→reload сохранён; ошибок hydration в наблюдаемых логах нет |
| Фильтры browser | Native modal, invalid apply disabled, Escape закрывает и возвращает фокус |
| Live с настоящим Django | GET публичного `https://studly-help.ru/api/v1/services/`=200, count0/results[]; локальный production UI показывает честную пустую выдачу с LIVE badge |
| Live с синтетической HTTP-фикстурой | Заполненная выдача ID42/43, total2/visible1, next/previous, новый query→первая страница, disabled rating;401/403/404/500/malformed JSON/invalid DTO/empty; retry500; Demo fallback отсутствует |
| Responsive и обе темы | Production DOM в браузерной рамке с проверенным child viewport320/390/768/1440, восемь screenshots; scrollWidth=width во всех размерах |
| CSS isolation | PostCSS-проверка:0 unscoped selectors вне keyframes; переход в старое избранное не содержит `.studly-app`, body font остаётся прежним |
| Сохранение рабочего дерева | SHA256-сравнение87 исходных non-doc файлов: изменены только3 разрешённых файла этого этапа; все остальные, включая прежние Demo/Live, API, auth, package/lockfile и AGENTS, совпадают с baseline |
| `git diff --check` | PASS |

При320px первый CTA заканчивается около753px, нижняя навигация начинается770px; при390px CTA около693px. Desktop1440 —3 колонки,768 —2. Это данные локального browser viewport844px высотой на мобильных размерах, не замер реального телефона.

Тестовая фикстура — только frontend QA, **не настоящий Django**, не продуктовая реализация Backend и не Demo fallback. Настоящие login/registration/CSRF операции с production не выполнялись; платежи/заказы не создавались. Сырые production-ответы, cookies и персональные данные в отчёты не сохранялись.

### Визуальные материалы

| Размер | Светлая | Тёмная |
|---|---|---|
| 320×844 | [Экран](implementation/2026-10-18-campus-search/search-320-light.png) | [Экран](implementation/2026-10-18-campus-search/search-320-dark.png) |
| 390×844 | [Экран](implementation/2026-10-18-campus-search/search-390-light.png) | [Экран](implementation/2026-10-18-campus-search/search-390-dark.png) |
| 768×844 | [Экран](implementation/2026-10-18-campus-search/search-768-light.png) | [Экран](implementation/2026-10-18-campus-search/search-768-dark.png) |
| 1440×1000 | [Экран](implementation/2026-10-18-campus-search/search-1440-light.png) | [Экран](implementation/2026-10-18-campus-search/search-1440-dark.png) |

[Browser measurements и Live fixture cases](implementation/2026-10-18-campus-search/browser-qa.json). Screenshots показывают настоящее приложение после production build, не HTML-прототип. Дополнительные доказательства: [проверка границ изменений](implementation/2026-10-18-campus-search/scope-check.json), [список ресурсов сборки](implementation/2026-10-18-campus-search/resources.json), [исходник синтетической HTTP-фикстуры](implementation/2026-10-18-campus-search/http-fixture.cjs).

Повторная локальная проверка: `npm run dev:demo -w apps/web -- --hostname 127.0.0.1 --port 3120`. Для Live задать действительный `DJANGO_API_ORIGIN` и использовать `npm run dev:live -w apps/web`. Для production режим задаётся во время build: смена env только у next start не переключает Demo/Live. Синтетическая фикстура запускается отдельно через `STUDLY_ALLOW_TEST_FIXTURE=1 node 'documents/project/для отчетов/frontend/redesign/implementation/2026-10-18-campus-search/http-fixture.cjs'`, затем Live dev с `DJANGO_API_ORIGIN=http://127.0.0.1:18001`. Прежде следует остановить ранее запущенный Next dev, чтобы не конкурировать за lock. Эти команды не меняют production.

## Измеренные ресурсы и непроверенные предположения

По финальному prerendered `/search` HTML: сумма gzip современного initial self-hosted JavaScript — **154133bytes (~150.5KiB)**,8 scripts; legacy noModule polyfill дополнительно около39.6kB gzip и исключён из modern-суммы. Initial CSS около10.5kB gzip. Метод — локальное gzip-суммирование файлов, не HAR и не сетевой профиль Telegram. Предыдущий аудит фиксировал148557bytes modern JS; прямое сравнение приблизительное, поскольку режим/срез сборки различались. Лимит исследования170KiB modern JS не превышен.

LCP/INP/CLS p75, FPS, энергия, память, слабые смартфоны, реальные iOS/Android Telegram WebView, экранная клавиатура и landscape fullscreen **не измерялись на устройствах**. CSS/SDK insets и unit tests уменьшают риск, но не заменяют эту проверку. Скорость приложения в Telegram не объявляется доказанной.

Известные ограничения прошлого аудита остаются: Live taxonomy/rating и некоторые разделы ещё не подключены; Live фильтры локальны текущей странице; deployment env `api` несовместим с текущим resolver `demo/live`; release/security patch-проверка Next должна быть отдельным согласованным шагом перед публикацией. В этой реализации конфигурация production и версии не менялись.

## Git, откат и следующий этап

Из существовавших non-doc файлов в рамках этого этапа изменены только:

- `apps/web/src/app/search/page.tsx`;
- `apps/web/src/components/AppShell.tsx`;
- `apps/web/src/components/catalog/LiveSearch.tsx`.

Новые исходники: `SearchFilters.tsx`,6 файлов `components/studly/`, `lib/catalog/search.ts`, `lib/telegram/campus-platform.ts`, `tests/search.test.cjs`, `tests/campus-platform.test.cjs`. Документация: этот отчёт, тематический/общий README и implementation screenshots/JSON. `data-mode.ts` и прочие dirty-файлы существовали до задачи; их нельзя приписывать этой реализации или удалять.

Безопасный откат — выборочный откат только изменений этого этапа с сохранением прежнего diff; `git reset/checkout --` всего дерева применять нельзя. Начальный diff и SHA256 baseline сохранены вне Git для проверки этого сеанса. Новый commit не создавался: единственный HEAD по-прежнему2411705, историческая реализация API7a50ea4, регистрация893a6fd.

Далее: визуальная приёмка пользователем → реальные iOS/Android Telegram проверки и согласованный release/config/security gate → отдельное разрешение публикации. Следующий дизайн-экран по roadmap — `/service/[id]`, однако его переработка **не начата и требует согласования**. Работа этого этапа заканчивается на `/search`.

## Источники

- [Индекс семи исследований](README.md), [аудит](2026-10-17_22-53_frontend-audit.md), [roadmap](2026-10-17_22-53_redesign-roadmap.md), [риски](2026-10-17_22-53_risks-and-compatibility.md).
- [Утверждённый Campus brief](prototypes/2026-10-18-search/brief-campus.md), [DOM/design contract](prototypes/2026-10-18-search/DESIGN-CONTRACT.md), base.css/campus.css/app.js и Campus screenshots прототипа.
- Локальные `AGENTS.md`, исходники приложения, installed Next docs CSS/use-client/linking/generate-viewport и тип Viewport.
- [Telegram Mini Apps — официальные API темы, safe areas и viewport](https://core.telegram.org/bots/webapps).
- [Backend deployment plan d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/FRONTEND_DEPLOYMENT_PLAN.md), [связанный Frontend HEAD2411705](https://github.com/lex44lh/Studly/commit/24117052e6091efb391c8840e3d98b2708b773c3).

Закрытие этапа: **18.10.2026,13:48:42 Europe/Moscow**, системные часы. Финальный lint:0 errors/2 прежних warnings;36 локальных ссылок нового отчёта/индекса существуют, diff-check PASS. Временные серверы Next, HTTP-фикстуры и QA-рамки остановлены; сохранены8 production screenshots. HEAD и исходные исправления интеграции сохранены. Публикация и следующие страницы не начаты.
