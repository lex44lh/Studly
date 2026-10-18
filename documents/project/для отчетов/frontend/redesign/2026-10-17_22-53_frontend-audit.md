# STUDLY Frontend Redesign 2.0 — аудит текущего приложения

- Начало исследования: **17.10.2026 22:53:53 Europe/Moscow** (системные часы; 19:53:53 UTC).
- Возобновление после перерыва: **18.10.2026 01:34:14 Europe/Moscow**.
- Окончание: см. заключительную запись времени в конце документа.
- Статус: **исследовательский аудит; редизайн, изменение исходников и выпуск не начаты**.
- Область: `/Users/alekspih/Projects/studly/apps/web`, его Git-история, документация и опубликованный Backend-контракт. Backend только читался через `git show`, без checkout и изменений.
- Основной вывод: **это функциональный прототип с частичной API-интеграцией, а не завершённый маркетплейс, которому не хватает только визуальных эффектов**. Первые проблемы для ежедневного использования — читаемость, навигация, полнота сценариев, состояния данных и Telegram-адаптация. Добавление 3D само по себе их не исправляет.

## 1. Основание, правила и достоверность

Изучены [корневой AGENTS.md](/Users/alekspih/Projects/studly/AGENTS.md), [apps/web/AGENTS.md](/Users/alekspih/Projects/studly/apps/web/AGENTS.md), `apps/web/CLAUDE.md` (ссылка на AGENTS), конфигурация, package scripts, тесты, существующие Markdown-отчёты и интеграционная инструкция. Проведена инвентаризация всех 60 файлов `.ts/.tsx/.css` под `apps/web/src` с чтением маршрутов, компонентов, контекстов и адаптеров. Вложенный AGENTS предупреждает о правилах Next.js 16; новый код в этой задаче не писался. Не исследовался и не публиковался архив логотипов, существующие персональные локальные материалы не переносились.

Разделение доказательств:

1. **Проверено в этом аудите по исходникам/Git** — наличие маршрута, условие режима, запрос, хранилище, тип, CSS, история изменения. Это не равно успешной работе настоящего сервера.
2. **Проверено основным агентом этой исследовательской задачи** — сборка, типы, линтер, тесты, ограниченный браузерный просмотр production на локальном порту; результаты явно атрибутированы ниже.
3. **Сообщается в предыдущем отчёте / Backend-документе** — исторические HTTP, Telegram/VPS/fixture-проверки, не повторённые здесь. Они относятся к указанным коммитам и датам.
4. **Предположение / рекомендация** — продуктовая оценка, риск, целевой UX; не подменяет измерение или исследование студентов.

Исследование началось 17 октября, окончание документа приходится на 18 октября после перерыва. Имя сохраняет время начала. Коммит для самого аудита отсутствует: пользователь запретил commit/push на этом этапе.

## 2. Git: что именно анализировалось

| Срез | Проверенное состояние |
|---|---|
| Рабочая Frontend-ветка | `codex/frontend-registration` |
| HEAD и опубликованный Frontend | `24117052e6091efb391c8840e3d98b2708b773c3` |
| Старый main / исходный прототип | `ccfde590b6e722d1eeb0694747e10afc7958acb1` |
| Регистрационный UI | `893a6fd5bf4c6ae0059d0f4c66a3b6d353eaaa9c` |
| Интеграция Django | `7a50ea4441c638819242e1252fc285e615a1f2e3` |
| Backend-контракт первоначальной интеграции | `fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4` |
| Backend после безопасного fetch основным агентом | `d7a5ffa5abc1537301ced7275da9e45282d6b4f3` |

Перед работой проверены status, ветка, log, diff. **Рабочее дерево уже имело незакоммиченные исправления DEMO/LIVE**: 22 tracked пути (исходники, scripts, инструкция, индекс; 113 добавленных/70 удалённых строк на старте), новый `src/lib/data-mode.ts`, предыдущий отчёт о регрессии; также 3 прежних JPEG и `studly-logo-files.zip`. Они сохранены. Нельзя оценивать текущее рабочее дерево как буквальный `2411705`, а незакоммиченные исправления — как уже опубликованные.

Историческая последовательность:

- `ccfde59`: 19 продуктовых страниц, статический каталог, localStorage-сценарии заказов/чатов, собственный профиль — один заголовок. Тёмная тема, placeholder-фотографии и проблемы хранилища существовали уже здесь.
- `893a6fd`: добавлены 3 страницы регистрации и их отдельная CSS-система/Context. Формы — development-предпросмотр, production gate существует с этого коммита. Старые разделы не удалялись.
- `7a50ea4`: настоящие auth/registration/catalog adapters, proxy, честные API-ошибки. Поиск **перенесён** из `app/search/page.tsx` в `components/catalog/LiveSearch.tsx` (655 строк изменения route-файла — не доказательство утраты поиска). Обычный запуск стал LIVE. `AppShell` стал заменять четыре неподключённых семейства разделов одной заглушкой. Demo-регистрация осталась без независимого адаптера: это реальная регрессия доступности предпросмотра.
- `2411705`: завершающая публикация документации; `git diff 7a50ea4..2411705 -- apps/web` пуст, дополнительного изменения UI нет.
- Текущее незакоммиченное дерево: отдельный mode helper и команды запуска, независимый предпросмотр регистрации без API; legacy-разметка восстановлена, LIVE-данные от неё изолированы; платёжный mock отключён. Это исправляет часть регрессии, но не подключает неподдерживаемые server-сценарии.

Для чтения истории не выполнялись merge, rebase, reset, force push, checkout Backend или удаление старых изменений. `git diff -- apps/api` пуст.

## 3. Структура и количественная инвентаризация

Статический подсчёт рабочего дерева: **22 `page.tsx`**, **21 TSX-файл компонентов**, **60 файлов `.ts/.tsx/.css`**, **8 237 строк**, **289 вхождений `style={{`**, **36 файлов с директивой `use client`**. Это показатели организации исходников, не размер браузерного bundle и не оценка качества сами по себе.

```text
apps/web/
  src/app/                 22 product pages, root + registration layouts
  src/components/          shell, navigation, service/order/chat primitives
    catalog/               LiveSearch/Service/Performer/Favorites, API states
    registration/          формы, шаги, отдельный CSS module
  src/context/             Auth, Favorites, Registration
  src/lib/api/             client, auth, catalog, registration
  src/lib/data-mode.ts     явный DEMO/LIVE (untracked на старте)
  src/lib/registration/    reducer/guards/выбор специализаций
  src/lib/telegram/        display-only prefill helper
  src/types/               registration UI и DTO types
  src/data/services.ts     17 статических услуг DEMO
  public/                  STUDLY mark/inverse + остатки create-next-app SVG
  tests/                   auth.test.cjs, registration.test.ts, UI fixture
```

Не обнаружены отдельные страницы `/catalog`, `/login`, `/settings`, `/my-services`, `/checkout`, `/register` (есть **layout**, но нет `page.tsx`), редактор существующей услуги, серверный личный кабинет или админка Frontend. Каталог в текущем продукте — `/search`, а не вымышленный дополнительный маршрут. `/icon.svg`, `/apple-icon.svg`, favicon и системный Next not-found не включены в 22 продуктовых страницы. Django `/admin/` принадлежит Backend и не является страницей `apps/web`.

## 4. Все 22 фактических маршрута

Обозначения: **D** — явно выбранный DEMO; **L** — LIVE; **dev** — `NODE_ENV=development`. «API подключён» здесь означает существование клиентского кода и контракта, а не подтверждение сквозного результата с настоящим Telegram.

| № / маршрут | Реализация и дизайн сейчас | Проблемы и что сохранить | Улучшить / переделать; зависимость Backend |
|---|---|---|---|
| 1. `/` | D: поиск, 4 категории, первые 4 из 17 услуг. L: те же hardcoded категории + первые 4 API-услуги. Простая колонка, сетка категорий 2×2, белые панели, emoji. | Сохранить немедленный вход в поиск и переход «все услуги». Фото в карточках placeholder; категории L ведут в неподключённый раздел; нет собственной продуктовой композиции. | Общая главная для D/L, ясные data states, осмысленные категории только по доступным данным/возможностям. Каталог зависит от `services/`; categories API отсутствует. |
| 2. `/welcome` | Отдельный server-rendered экран без shell: STUDLY mark + заголовок, текст, большая кнопка `/register/roles`, `100svh`, safe-area. | Сохранить знак/индиго и понятный CTA. В L production CTA приводит к закрытой регистрации; DEMO-баннера shell здесь нет. | Продумать «смотреть каталог» до регистрации, корректный production CTA; 2D/3D строго необязательны. Прямой API-зависимости контента нет, вход/доступность registration зависимы. |
| 3. `/search` | Route re-export `LiveSearch`. D: полнотекстовый local поиск по массиву, цена/срок/рейтинг/сортировка. L: `services/?search=...`, пагинация; цена/срок/сортировка текущей API-страницы, рейтинг отключён. Белые раскрываемые фильтры, вертикальные карточки. | Сохранить все работающие D-фильтры и честность L. L count показывает серверное общее число при локальном subset-фильтре; возможен «ничего не найдено» на странице при наличии совпадений на других. `autoFocus`, input 14px, нет debounce, filter state не в URL. | Общий search VM и capability-aware filters; серверные фильтры только после контракта, без загрузки всех страниц ради иллюзии. Метрики поиска/публикации; API поддерживает search, performer, ids, page, а не rating/price/order. |
| 4. `/category/[slug]` | D: 8 известных slug, поиск, цена/срок/рейтинг/сортировка. L: сохранённая разметка с disabled fieldset, пустыми результатами и честной надписью об отсутствии category API. | В 7a50ea4 route был заменён коротким notice, текущая правка вернула форму. Сохранить рабочие D-сценарии; неизвестный slug показывает «Категория»/пустоту, не согласованный 404. | Общий каталог и категории как состояние/источник; различать «данных нет» и «нет интеграции». Не выдумывать live mapping slug→service. Категорий Backend нет. |
| 5. `/service/[id]` | D: деталь услуги, исполнитель, demo-рейтинг, допопции, local chat, локальный пример заказа. L: отдельный `LiveService`, услуга + quote (сумма/3%/итог), performer link, chat/order disabled. Placeholder 220px. | Сохранить описание/состав/срок, актуальный серверный quote и явный `is_demo`. D/L дублируют детальную разметку; L не выдумывает рейтинг и допуслуги. | Единый ServiceDetails view, разные adapters/capabilities. Показ ошибки quote отдельно от service уже полезен. Переход к заказу подключать по revision/request_key, не по local totals. Backend чтение есть, orders отдельно не подключён. |
| 6. `/favorites` | D: local `favorites` + static services. L: `studly-api-favorites`, `services/?ids=...`, группы ≤100, серверная пагинация. | Сохранить изоляцию ID и честную надпись «только в этом браузере». Нет синхронизации аккаунта; исчезнувшая услуга пропадает из ответа, stale IDs остаются локально. | Общий список с пустым состоянием/удалением недоступных элементов по явному решению. Не обещать перенос между устройствами. Backend endpoint favorites отсутствует; только фильтр ids. |
| 7. `/profile` | **Только `<h1>Профиль</h1>` в обоих режимах.** | Полноценный профиль не был удалён интеграцией: ровно такой же файл у ccfde59. Вкладка в bottom nav существует, полезного кабинета нет. | Создать собственный кабинет после согласования модели; roles/profile/registration APIs уже есть, orders/my-services отдельно. Не отображать public performer как свой private account. |
| 8. `/profile/[id]` | D: 4 расширенных demo-профиля + незакоммиченный fallback для остальных услуг без придуманных биографий/метрик. L: name/about + список API-услуг. Серый аватар, простые блоки. | Сохранить переходы от всех 17 услуг. Старый bug 13 отсутствующих demo-профилей исправлен только рабочим деревом. D «Написать исполнителю» внизу не имеет onClick. | Один public performer view, реальные доступные поля; не раскрывать private avatar/portfolio автоматически. Публичный endpoint только id/name/about; рейтинга/статистики нет. |
| 9. `/register/roles` | Dev D: 1/2 роли, preview context; dev L: требует auth и GET draft, PATCH roles/progress. Production: общий gate. Аккуратные checkbox-карточки, stepper, SVG mark, 560px container. | Сохранить выбор обеих ролей, disabled без выбора, существующий бренд и доступность формы. Нет отдельного `/register` entry route. | Единая регистрация с mode adapter, capability checks; production открывать после настоящего E2E, отдельного разрешения. Auth + registration API есть. |
| 10. `/register/profile` | Dev D: имя, аватар, университет, город, about — React memory. Dev L: server restore, multipart/delete avatar, PATCH, переход/complete. Production gate. | Сохранить 16px inputs, labels, focus/aria-invalid, 5MiB MIME check, maxLength, blob cleanup, unoptimized private image. Ошибки сервера собраны общей строкой, не связаны с конкретными полями. Несохранённые поля/файлы теряются при reload. | Явное «сохранено/не сохранено», field errors и восстановление после сети; не заменять multipart внешним URL. Backend готов по контракту, реальный proxy image E2E не подтверждён. |
| 11. `/register/performer` | Dev D: поля и честно недоступный справочник; dev L: все страницы specializations, local search/chips, save/skip+complete. Production gate. | Сохранить optional fields и «позже»; empty/error/loading не смешаны. Пустой справочник Backend — согласованное состояние, не отсутствующий endpoint. | Не требовать выдуманных специализаций; отображать performer readiness как заполненность, не допуск к публикации. Backend specializations/registration готов; enforcement публикации отдельно не согласован. |
| 12. `/orders` | D: localStorage список. L: retained empty screen + notice shell, без чтения demo. Простые кликабельные div cards и emoji статусов. | Сохранить сценарий просмотра и детали; empty copy L «нет заказов» под notice может создать неверное впечатление, что сервер успешно ответил. | API-backed state/capabilities. Реальные orders API есть, frontend не подключён. Числа «заказы» без сессии не рисовать. |
| 13. `/orders/[id]` | D: local snapshot, переход чат, PENDING→IN_PROGRESS→REVIEW→COMPLETED, удаление завершённого. L: нет local read, «не найден» + notice. | Сохранить состав/суммы/связь чата как UI-сценарий D. D-статусы **не совпадают** с Django; local lifecycle нельзя просто отправить в API. | Полностью заменить бизнес-adapter, не весь UI: pending_acceptance/awaiting_payment/cancelled/declined; accept/cancel/decline по роли. Нет серверных completion/delete/work-flow. |
| 14. `/orders/[id]/additional-payment` | Query chatId/serviceId, D показывает выбранную mock-опцию; `paymentAvailable=false` всегда, pay disabled, cancel доступна. L тоже disabled. | Сохранить отсутствие ложного успеха. В коде остаётся недостижимая ветка MOCK PAYMENT, не включать простым флагом. Название «оплата» при недоступном функционале нуждается в UX-решении. | Объём/redesign зависит от будущего платежного контракта; сейчас настоящего API платежей/допопций нет. Не нужна GPU-анимация. |
| 15. `/chats` | D: local chats, last-message preview, сортировка/время. L: пустой retained экран+notice. Круглые серые аватары, white list cards. | Сохранить структуру списка, service context. Сообщения только в браузере; это не чат между двумя людьми. Loading есть, storage failure частично маскируется empty. | Отдельная transport/capability модель, состояния offline/pending/failed/read только по реальному протоколу. Chat API отсутствует. |
| 16. `/chats/[id]` | D: local chat + `ChatWindow`, сообщения, имя файла вместо передачи содержимого, order summary, допопции, удаление чата. L: local не читается, «чат не найден» + notice. | Сохранить контекст услуги и связь с заказом. `ChatWindow` 923 строки, localStorage.setItem в эффекте без catch; `calc(100vh - 140px)` и smooth autoscroll без reduced motion. | Изолировать data adapter/scroll/composer/order summary. Настоящая клавиатура, viewport и возврат Telegram пока не реализованы; серверного чата/attachments нет. |
| 17. `/create-service` | D: local form category/title/description/price/days/included/image/extras + preview, только честное alert об успешной проверке формы. L: form видна, fieldset disabled. | Сохранить preview и состав услуги. «Назад» без handler; labels без htmlFor; часть полей без name/id; нет настоящего form submit, минимумы/максимумы UI расходятся с API, blob URL не освобождается. | Переделать validation/DTO и состояния публикации по `my/services/`; image/category/extras не поддерживаются сервером. Создание/редактирование/модерационные статусы Backend есть, frontend adapter отсутствует. |
| 18. `/notifications` | D: 3 static примера read/unread; L: пустой retained list + notice. | Сохранить clear list semantics, не выдавать fixed «сегодня» за live event. Нет mark read/перехода/источника. | Capability-aware unavailable/empty; backend notifications отсутствует. |
| 19. `/about` | Статичный заголовок и одно предложение. | Маршрут есть, полноценного контента нет; не удалялся интеграцией. | Краткое описание ценности/работы сервиса; API не нужен для текущего контента. |
| 20. `/rules` | Заголовок + «Здесь будут правила…». | Это placeholder, не готовая страница правил. | Согласовать контент с владельцем, использовать readable text layout. Backend не обязателен для статичного документа. |
| 21. `/safety` | Заголовок + одна общая строка. | Не реализованы инструкции/спор/безопасная сделка как пользовательский сценарий. | Понятная справочная структура и реальные возможности; API для текущего текста не нужен. |
| 22. `/support` | Заголовок + «Здесь будет связь…». | Канал связи/форма/обращения не реализованы; не надо считать их сломанной интеграцией. | Согласованный контакт или настоящий support workflow, без фиктивной отправки. Backend support API не найден в контракте. |

## 5. Полная компонентная инвентаризация и состояние системы

| Группа / фактические компоненты | Что есть и сохранить | Недостатки / направление изменения |
|---|---|---|
| `AppShell`, `BottomNav`, `Sidebar` | Общая оболочка, header, 5 нижних вкладок; меню категорий/заказов/информации; исключение welcome/register; DEMO notice; disabled legacy LIVE. | Верхний wordmark текстовый, SVG mark живёт главным образом welcome/register. Нет active `aria-current`, nested path active не учитывается; hamburger не имеет label. Sidebar без dialog semantics, Escape, focus trap/возврата focus и блокировки фоновой прокрутки. Нет route/capability-driven navigation. |
| `ServiceCard`, `ServiceFavoriteButton` | Карточка с link, title/price/seller, optional rating/is_demo; hydration-aware local favorite. | Emoji вместо стабильных icon assets, placeholder фото, нет duration на list-card, favorite button без текстового aria-label/aria-pressed. Нет вариантов плотности/мобильной и desktop сетки. |
| `BackButton` | Browser back. | Это `div onClick`, недоступен Tab/Enter, нет fallback для прямой внешней ссылки, не связан с Telegram BackButton. Нужен настоящий button/link и предсказуемая политика возврата. |
| `AdditionalServicesSelector` | Выбор D-опций с общей суммой. | Нативные toggles не представлены aria-pressed/checkbox semantics; state/UI/business money mixed; копии массива extras в нескольких местах. Live capabilities отсутствуют. |
| `CreateOrderButton` | DEMO guard, локальный order/chat, честная подпись локального примера. | 292 строки данных/записи/UI; ошибки только console.error; нет transactional записи двух storage keys, Date.now ID. Live checkout отдельный серверный сценарий. |
| `StartChatButton` | Переиспользование D-чата performer+service, маршрут детали. | Нет собственного demo guard, безопасность режима обеспечивается тем, что mounted только из D-детали. Часть localStorage ошибок uncaught. Перенести режим/права в adapter boundary. |
| `ChatWindow` | Сообщения, composer, attachment-name preview, order/extras summary, delete confirm. | Монолит UI+local persistence+order lifecycle; необработанное сохранение storage; нет настоящих файлов, online/read/delivery. Не переносить D-«финансовую историю» как реальную функцию. |
| `ApiState`, `ServiceList` | Loading/error/retry, 404 без retry, no static fallback, пагинация API, исключение stale key. | Очень базовая текстовая загрузка; нет явного empty/unavailable/partial/stale/offline VM; fetch после client mount и отсутствие request cache/dedup. |
| `LiveSearch`, `LiveService`, `LivePerformer`, `LiveFavorites` | Рабочие адаптеры к публичным данным, quote, decimal DTO, local favorites IDs ≤100, публичность ограничена контрактом. | D/L частично разветвлены на целые views; mapping API→legacy shape внутри Search; копируется markup. Разделить источники и общие view models. |
| `RegistrationShell`, `ProfileForm`, `PerformerForm`, `SpecializationPicker` | Наиболее последовательная визуальная подсистема: labels, fieldsets, 16px inputs, :focus-visible, 44–54px цели, max lengths, состояния, busy disable, avatar preview, optional steps. | Её tokens не переиспользуются приложением. Server errors — общий текст; production gating по NODE_ENV, не явная release capability; D-специализации нельзя просмотреть полностью. Не снимать gate в исследовании. |
| `BrandMark` | SVG с существующим S-подобным знаком, primary/inverse, `#3547B8`/white. | Не заменять утверждённый mark новым 3D-логотипом. 3D может быть только дополнительной трактовкой формы после согласования. |

### Контексты, состояния и данные

- `AuthContext`: loading/anonymous/authenticated/error; сначала GET me, только 401/403 от me дают путь анонимного входа; options + raw initData login + повторный me; logout; abort и single active request. D не грузит SDK и не отправляет auth-запросы. Logout API есть, видимой кнопки выхода в UI нет.
- `RegistrationContext`: reducer в React memory, restore серверного draft после подтверждённой сессии, sequence save→complete, busy, error/retry; key по текущему user id изолирует пользователей. D переводит шаги и показывает честный preview-end. Reload D стирает форму; L восстанавливает только успешно сохранённые поля, не несохранённые keystrokes/File.
- `FavoritesContext`: два ключа D/L, hydration state и межвкладочный storage event; ошибки чтения/записи пойманы, in-memory работа сохраняется. Это более устойчивая реализация, чем в demo-chat.
- `useApiResource`: abort read при смене key/unmount, error/retry; не делает статический fallback. Не имеет автоматической повторной отправки mutation — это правильно для недоказанного результата записи.
- В route tree отсутствуют авторские `loading.tsx`, `error.tsx`, `not-found.tsx`; API-состояния находятся внутри client components. Отказ эффекта localStorage в ChatWindow может попасть в системный Next error boundary без продуктового recovery.
- Forms create-service/order/chat и их типы не объединены в единую domain model. Server registration DTO отделён от UI camelCase; это удачную границу нужно расширять, сохраняя API.

## 6. Дизайн, адаптивность, доступность и анимации

**Существующая идентичность:** индиго `#3547B8`, белый фон, серые поверхности/тексты, существующий SVG-знак и STUDLY wordmark; mark/inverse есть также в `public`. `BrandMark`, welcome и регистрация показывают реальный задел бренда. Заменять знак/основной цвет без утверждения нельзя. Утверждённого brand book в прочитанной документации не найдено; перечисленные значения — факт исходников, а не новый бренд-стандарт.

**Системная слабость:** marketplace собран преимущественно из inline style без общей шкалы spacing/type/radius/states, а регистрация — отдельным CSS module. `globals.css` содержит starter Tailwind import и только background/foreground tokens. В @theme есть ссылки на Geist-переменные, но root layout не загружает Geist, body использует Arial/Helvetica/sans-serif. README утверждает next/font Geist — это устаревшее описание. Нет локально подключённых шрифтов, motion-библиотек, Three.js, canvas или графических ассетов услуг.

**Подтверждённая проблема тёмной темы:** global `prefers-color-scheme: dark` меняет body на `#0a0a0a/#ededed`, но карточки/категории/input продолжают иметь светлые inline backgrounds и наследуют светлый текст. Проблема существовала в ccfde59; основной агент повторно увидел её в production-браузере сейчас. Это визуальный bug, а не отсутствие Django. Welcome и registration имеют явный цвет/светлую поверхность и выглядят последовательнее. При редизайне нужен полный semantic color set либо согласованная единая светлая тема, учитывающая Telegram theme; смешанного автоматического dark mode быть не должно.

**Адаптивность:** основная оболочка — одна растянутая колонка с padding16, category grid 2 columns, fixed-size header60/bottomnav70; desktop composition почти не отличается. Welcome использует clamp/svh/safe-area, регистрация max-width560 и один desktop breakpoint768. В marketplace safe-area-inset отсутствует; bottom nav sticky без safe-area padding. Чат `100vh` и фиксированное вычитание140 не учитывают реальную высоту header, nav, browser chrome и экранной клавиатуры. В коде нет VisualViewport/Telegram viewport updates. Проверенный root viewport390 не имел horizontal overflow, но это не проверка настоящей клавиатуры и всех размеров.

**Доступность:** регистрация существенно лучше: явные labels, aria-invalid, roles/status, focus-visible; эта база сохраняется. Marketplace нуждается в исправлении BackButton/div-card semantics, labels и icon-only controls, `aria-current`/`aria-expanded`, focus management sidebar, контраста, touch targets/disabled states. Search input14px может вызывать iOS zoom в некоторых условиях — риск, который нужно проверить на устройстве, а не приписывать уже измеренному дефекту. AutoFocus без запроса пользователя может преждевременно открыть keyboard; продуктово целесообразность проверить.

**Анимации:** нет Motion/GSAP/Three.js/WebGL/WebGPU и нет CSS keyframes/transitions в исходниках. Основной motion сейчас — `scrollIntoView({behavior:"smooth"})` чата и поведение браузера. Нет reduced-motion ветки; не найден lifecycle паузы animations при hidden. Поэтому оценивать качество существующих сложных анимаций нельзя — их нет. В первую очередь нужны короткая обратная связь на действие и переход состояний, а не анимированный каталог.

## 7. Telegram: реальная глубина интеграции

LIVE root `AuthProvider` загружает официальный `telegram-web-app.js?64` через `next/script afterInteractive`; D этого не делает. Читается **raw `Telegram.WebApp.initData`**, которое отправляется серверу для проверки; `initDataUnsafe` не используется как подтверждение личности. В проекте существует helper безопасного display-only prefill из `initDataUnsafe`, но в текущих формах он не вызывается: фактическое L-предзаполнение приходит из server draft. Наличие helper не значит, что это работающая UX-функция сейчас.

Не обнаружено вызовов/подписок Mini App `ready`, `expand`, BackButton/MainButton, themeChanged, viewportChanged, safeAreaChanged/contentSafeAreaChanged, activate/deactivate либо проверки SDK-version capabilities. Нет собственного Telegram runtime adapter. CSS safe areas есть только welcome/register; не подключены Telegram safe-area/content-safe-area значения. Нет настройки viewport-fit=cover в собственном metadata viewport и стратегии клавиатуры.

Веб-вход: `AuthOptions.telegram_website` валидируется по типу, но **никем не используется для начала website login**. Backend уже предоставляет OIDC с безопасным `next` и 303-возвратом (bf04c13, включён в d7a5ffa); старое заключение «callback только JSON, server return отсутствует» более не актуально. У Frontend по-прежнему нет кнопки/навигации `/api/v1/auth/telegram/start/?next=...`, обработки UX ошибки callback и website-сценария. Это незавершённый клиентский путь, а не необходимость переписывать server auth.

Реальный запуск Telegram iOS/Android, signed login, память/GPU, смена темы, keyboard, back swipe, re-open/resume, медленная сеть **в этом аудите не проверялись**. Наличие общего JS SDK не доказывает полноценную Mini App-готовность. Исходный приоритет Backend-документов — website; актуальная задача владельца устанавливает основной приоритет Mini App. В редизайне следует зафиксировать это продуктовое изменение в согласованной архитектуре, сохраняя оба способа входа.

## 8. API и точные границы Backend

Актуальный snapshot для будущей работы: **d7a5ffa5abc1537301ced7275da9e45282d6b4f3**. Прочитаны API_CONTRACT, REGISTRATION_API, TELEGRAM_AUTH, docs/registration.openapi.json, актуальные FRONTEND_ISSUES и FRONTEND_DEPLOYMENT_PLAN. OpenAPI registration: версия **1.0.0**, OpenAPI **3.0.3**. Некоторые повествовательные фразы Backend-документов «Frontend ещё не подключён» исторические: наличие конкретных adapters проверено по исходникам Frontend, сквозная проверка всё ещё отдельна.

Git blob IDs (это идентификаторы содержимого Git, не runtime build hashes):

| Документ в d7a5ffa | Git blob |
|---|---|
| `API_CONTRACT.md` | `0fae9e5fb9bb61e95809e08d4b427b49a0be6771` |
| `REGISTRATION_API.md` | `37c798d025768a4d70c4996d99900698960608a4` |
| `docs/registration.openapi.json` | `266b8b0982abf0ce535a6bba5ef5d6712cb51088` |
| `TELEGRAM_AUTH.md` | `1dbfb6d8282cf45717d35400c3df4013541fc25f` |

| Действующие API (префикс `/api/v1/`) | Frontend | Сохранить / ограничение |
|---|---|---|
| GET `auth/me/`, `auth/options/`, `auth/csrf/`; POST `auth/telegram/mini-app/`, `auth/logout/` | Подключены в L | cookie same-origin; HttpOnly session/CSRF, JSON csrf; raw initData; повтор me после login; logout button нет. |
| GET `auth/telegram/start/?next=...`, callback | Backend готов; клиент website не подключён | Начинать обычной браузерной navigation, не fetch/поддельным initData. После возврата fresh CSRF/me/registration. |
| GET/PATCH `registration/`; POST `registration/complete/` | Подключены в dev L; production gate | camelCase↔snake_case mapping, server status.is_complete; сохранение только после успешного ответа; skip тоже complete. |
| GET `specializations/` | Все API-страницы в dev L; local UI search | Реальный пустой справочник допустим; UUID, нет искусственного лимита числа выбранных. |
| POST/DELETE/GET `registration/avatar/` | Multipart + delete + browser image | Private cookie-bound avatar; не отправлять avatarUrl/blob в JSON и не показывать чужим. PNG/JPEG/WebP≤5MiB; server проверяет содержимое/пиксели. |
| GET `services/` и `<id>/`, `<id>/quote/`; GET `performers/<id>/` | Подключены в L | Цена decimal-string RUB; count/next/previous/results, пагинация20; next превращается в same-origin path; public performer только id/name/about. |
| GET/POST `my/services/`; GET/PATCH `my/services/<id>/` | **Не подключены**, хотя Backend есть | JSON; title≤200, price0.00…99999999.99, duration integer1…32767, included≤50×500; category/image/extras сервер не принимает. status pending/published/rejected, mutation снова pending. |
| GET/POST `orders/`; GET `orders/<id>/`; POST accept/cancel/decline | **Не подключены**, хотя Backend есть | snapshot условий и 3%; `request_key` UUID для идемпотентности, revision из quote. Никакого client-assigned price/status. |
| Categories, ratings/reviews/stats, service images/extras, server favorites, messages/attachments, notifications, payments/results/completion | Требуемых контрактов не обнаружено | Не выдумывать wire fields, серверный успех, fake data fallback. Registration avatar — исключение из общей фразы «файлов нет». |

Ключевой разрыв заказов: DEMO `PENDING/IN_PROGRESS/REVIEW/COMPLETED` не отображается один-в-один на L `pending_acceptance/awaiting_payment/cancelled/declined`. Сервер не поддерживает произвольные PATCH/DELETE order, выполнение и завершение. Простая замена localStorage на fetch сломала бы бизнес-контракт. Для получения результата/оплаты/чатов нужны отдельные соглашения, а не творчество UI-разработчика.

Транспорт: `apiRequest` использует относительные `/api/v1/...`, `credentials:same-origin`, `cache:no-store`, AbortSignal, проверку JSON и `ApiError`; мутации получают новый JSON CSRF на каждый write. FormData boundary выставляет браузер. Приватная сессия/токены в localStorage не хранятся. `pagePath` ограничивает API pathname конкретным ресурсом и не отправляет cookie на host из ответа. Хорошие решения сохраняются.

Env-конфигурация: используются имена **`DJANGO_API_ORIGIN`**, **`NEXT_PUBLIC_STUDLY_DATA_MODE`**, **`NODE_ENV`**; тестовая fixture отдельно требует `STUDLY_ALLOW_TEST_FIXTURE`. Файлы `.env*` в корне Frontend checkout и `apps/web` не обнаружены; секретные значения не запрашивались и не выводились. `DJANGO_API_ORIGIN` server-only, валидируется как HTTP(S) origin без credentials/path; default loopback8000, Next rewrite `/api/` сохраняет Django slash через `skipTrailingSlashRedirect`. Public mode инлайнится Next при build: смена требует rebuild/restart.

**Новая критичная несовместимость размещения:** опубликованный Backend [FRONTEND_DEPLOYMENT_PLAN в d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/FRONTEND_DEPLOYMENT_PLAN.md) фиксирует `NEXT_PUBLIC_STUDLY_DATA_MODE=api` для выпуска **2411705**. В том коде это означало non-demo. Текущий незакоммиченный `resolveDataMode` разрешает только `demo`/`live`/пусто и **бросает исключение для `api`**. Следующий выпуск текущего Frontend со старым build env может упасть. Это не означает, что уже опубликованный 2411705 сломан. До реализации/выпуска нужно согласовать допустимый alias либо обновить build-конфигурацию владельцем инфраструктуры; Backend/production в этом аудите не менялись.

## 9. Все сообщения прошлой интеграции и причина утраты видимого содержимого

Пользователь привёл **шесть отдельных цитат**. Для полноты седьмым пунктом проверен отдельный симптом исчезновения прежнего содержимого. Не добавляем выдуманное седьмое сообщение.

| Цитата / симптом | Причина в коде / истории | Статус сейчас и классификация | Что исправлять при редизайне |
|---|---|---|---|
| 1. «Сервер временно недоступен. Повторите попытку позже» | `apiErrorMessage`: generic для нераспознанных status, включая500/502/503; upstream proxy при недоступном loopback Django отдавал500. Такой текст также возможен при malformed JSON и не доказывает ровно одну причину. | Код и честная L-ошибка сохраняются; основной агент воспроизвёл локально отсутствие доступного Django8000. Отчёт16.10 содержит ECONNREFUSED. **Локальная транспортная/конфигурационная проблема, не удаление страницы.** Production у Backend-документа17.10 имеет пустой ответ200, его сейчас независимо не измеряли. | Разделить network/upstream/validation/404/empty; retry с понятным действием, сохранять страницу. API-down не переводит в D. Нельзя делать вывод CORS/CSRF, пока upstream не отвечает. |
| 2. «Не удалось проверить вход. Проверьте подключение API» | `AuthContext.messageFor`: generic auth API failure; `/me/` non401/403 прерывает auth flow. Сейчас строка содержит ещё «и повторите попытку». | В dev L без Backend возможна; D текущего дерева вообще не инициирует auth, поэтому D-регистрация снова доступна. **Причина local API + неполный веб-вход; не отсутствие форм.** В production формы закрыты gate независимо от auth. | Honest auth error, retry, Mini App vs website entry; не создавать fake session. Подключить готовый website-start и настоящий Telegram E2E отдельно. |
| 3. «Категории пока не подключены» | В7a50ea4 category route выбирал отдельный notice, потому что Backend не выдаёт categories. | Дословный старый текст заменён; L текущего дерева сохраняет disabled category UI с notice, D полон. **Backend capability отсутствует + прежняя UI-подмена частично исправлена в uncommitted diff.** | Не обещать доступные категории на главной L, пока не определён честный UX/контракт; не подставлять static services по slug в L. |
| 4. «Раздел пока не подключён» | `AppShell.pendingIntegration`7a50ea4 для orders/chats/create-service/notifications и descendants возвращал section вместо children. | В текущем diff универсальная подмена удалена: children видимы, L без demo reads и с disabled controls. **Реальная регрессия видимой UI-разметки исправлена локально, но не опубликована.** Для orders/create-service сервер существует, клиент отсутствует; chat/notifications API нет. | Capability UI без блокировки всего дерева; оставить работающие маршруты/навигацию, заменить adapter только по готовому контракту. |
| 5. «Цена, срок и сортировка применяются к текущей странице» | `LiveSearch` фильтрует уже загруженные results20; в API доступны search/performer/ids/page, нет price/order/duration filters. | **Сохраняется в L как честное ограничение**, в D фильтры полного17-array работают. Это не сообщение о сбое. Count API и local filtered subset могут путать. | Серверные filters только после договора; до того ясный scope и корректный count. Не убирать предупреждение, оставляя неверное обещание глобального поиска. |
| 6. «Рейтинг пока недоступен» | Отсутствуют Backend rating/reviews/stats. `LiveSearch` отключает checkbox и option, не рисует фальшивые оценки; D рейтинг статический. | **Сохраняется в L по контракту**, D функционален. Это продуктовая capability, не сеть и не UI deletion. | Рейтинг/отзывы проектировать с empty/unavailable и происхождением данных; поддерживать дизайн без числа звёзд. |
| 7. Старые страницы перестали показывать прежнее содержимое | Переключение default в L без работающего local Backend; branch выбора API views; AppShell replacement; D-registration зависела от auth. 13 demo profiles отсутствовали ещё до интеграции. | Удалённых route/component файлов в разобранных переходах нет. Search перенесён. Current D восстанавливает каталог/forms/orders/chats; L не получает static данные намеренно. `/profile` никогда не был полноценным кабинетом. **Смешанный симптом: часть настоящий UI regression, часть смена источника/среды, часть старый прототип.** | Freeze route/scenario inventory как acceptance baseline; D/L отдельные sources и одни views; визуальный regression review на обоих режимах и error/empty, а не только populated demo screenshot. |

### Ранее замеченные дефекты: что осталось, что уже исправлено

- **13/17 demo-переходов в отсутствующего исполнителя:** существовало ccfde59, текущий `profile/[id]` выводит минимальный профиль по существующей service record. Исправлено рабочим деревом; обычного серверного fallback в L нет. Жёстко заданные4 профиля остаются демонстрационными.
- **ChatWindow storage quota:** сохранение `studly-chat-messages-*` до сих пор без catch. Исторический Backend FRONTEND_ISSUES воспроизводил падение; здесь подтверждено по текущему коду, отказ storage браузером повторно не моделировался. Нужны in-memory recovery и honest persistence status.
- **Dark mixed theme:** сохраняется и повторно подтверждена root браузером; не следствие Django.
- **Фиктивная успешная оплата:** current `paymentAvailable=false`; server success не имитируется. Старая unreachable mock-ветка остаётся техническим долгом, не активной оплатой.
- **Форма услуги сообщала об отправке:** current alert говорит только о проверке предпросмотра, не о публикации. Реальный POST не подключён.
- **`registrationClient` всегда unavailable / отсутствуют endpoints регистрации:** исторический факт893a6fd, **исправлено7a50ea4**. Не переносить старое предупреждение в текущий blockers list.
- **Django slash308 и relative proxy:** интеграцией настроены `skipTrailingSlashRedirect` и rewrite; ранее отмеченное отсутствие proxy не актуально. Живые cookie/CSRF/multipart всё ещё требуют проверки.
- **OIDC возвращает только JSON:** актуальный Backend исправил безопасный return303 с `next`; без next JSON остаётся штатно. Недостаток теперь клиентский и внешняя настройка.
- **2 no-img-element warnings:** сохраняются наcreate-service429/589; не падение build, не повод обещать измеренное ухудшение LCP от локального preview.

## 10. DEMO и LIVE: независимость есть, дублирование ещё есть

Текущий `resolveDataMode`: `undefined`, пусто, `live`→LIVE; `demo`→DEMO; другое→exception. Обычный dev и production default LIVE. Mode выбирается при запуске `next dev` либо при production `next build`, **не реакцией на сетевую ошибку**. В production значение вшито в bundle: смена env только у `next start` не меняет режим, требуется пересборка. API client/catch не содержит перехода на D. API `is_demo:true` и глобальный D — разные понятия: L может честно показать серверную демонстрационную запись, но заказывать её server запрещает.

**D:** static17 услуги, known categories/filter/rating, local favorites/order/chat/message examples; регистрация context-only и честный preview end, без API/SDK/auth; реальных платежей нет. Уведомления static. `create-service` только preview, не сохраняет запись. Специализации не заполнены синтетикой и доступны только как unavailable state; production registration gate не даёт смотреть формы даже с D build. Поэтому обещание «абсолютно все D-сценарии полностью тестируемы» пока было бы неверным: справочник, server mutation и production registration не доступны.

**L:** public API и проверяемая сессия, server registration в development; no static/localStorage demo order/chat reads. Favorites остаётся честно локальным списком API-ID. Неподключённые views disabled, но их `нет заказов/чат не найден` сейчас визуально соседствует с integration notice — это нужно развести на отдельное unavailable state. Profile heading и info pages пока одинаково скудны в обоих режимах.

**Проблема архитектуры:** mode import присутствует во многих pages/context/components; детали услуги, исполнителя, favorites имеют отдельные D/L views; Search переносит API в legacy shape. Сценарии уже частично разделены, но источники и markup ещё переплетены. Предложение: один `DataModeProvider`/composition root выбирает typed repositories; capability manifest (`canOrder`, `canChat`, `hasRating`, …) поступает в view model; shared views получают данные, а не читают mode по всему дереву. Live adapter никогда не вызывает demo adapter после ошибки. D-платежи всегда capability=false. Переход на новую границу выполняется по одной feature, сохраняя DTO и поведение API-клиента.

## 11. Проверки текущего исследования и доступные измерения

Сам субагент аудита **не запускал сборку, тесты или серверы**, чтобы не конкурировать с основным агентом. Ниже — результаты, сообщённые основным агентом в этой же задаче для рабочего дерева17.10; они не выдаются за ещё одну независимо повторённую серию.

| Проверка | Результат и предел утверждения |
|---|---|
| TypeScript noEmit incremental=false | PASS. Это типы, не работа API/UX. |
| ESLint | 0 ошибок, 2 прежних warnings `<img>` create-service429/589. |
| `npm test` | **13/13** `.cjs` тестов PASS; glob не включает registration.test.ts. |
| Отдельный запуск registration.test.ts | **8/8 PASS** через in-memory TypeScript→CommonJS transpile hook. Итого21 тест, а не ложное «npm test запускает21». |
| `next build --webpack` | PASS; compile1205ms, TypeScript528ms, static generation283ms. Эти времена build не являются LCP/INP или временем запуска Mini App. |
| Локальный production browser | `/` и `/search` на390px без horizontal overflow в проверенном состоянии; welcome на390px имеет ясный white layout. Dark UI defect подтверждён. Это не все маршруты/устройства и не accessibility audit инструментом. |
| LIVE local API unavailable | Ошибка без D fallback воспроизведена; настоящий Django8000 не был доступен. |
| Production process ready |83ms — server ready log, не cold app startup у пользователя. |

Суммы **modern script файлов, перечисленных HTML**, рассчитанные root локально после production build; исключены nomodule polyfill и внешний Telegram SDK:

| HTML route | Raw JS bytes | Локальная сумма gzip bytes |
|---|---:|---:|
| `/` |488927|147203|
| `/search` |494191|148557|
| `/welcome` |483764|145044|
| `/register/roles` |515098|156624|

Это **не измеренная wire-передача**, не чистый application-code size и не память после исполнения. Реальные response compression/cache, SDK, CSS/HTML, общий/повторно используемый cache, dynamic chunks и поведение embedded browser сюда не входят. Наличие ~145–157kB gzip scripts у простого welcome — основание измерить common shell/provider cost и будущую изоляцию 3D, а не доказательство плохого UX по одному числу.

**Не измерены:** LCP/INP/CLS p75 на студенческой аудитории, Mini App cold-ready, стабильный FPS/long tasks, JS heap/process memory, GPU memory, battery/thermal, slow4G/mobile CPU, настоящие iOS/Android WebView и keyboard, real signed Telegram session, server registration/avatar/orders с Django, production network live site текущим аудитом. Нет корректного основания назвать приложение быстрым или медленным по этим метрикам. Бюджеты и план измерений находятся в остальных документах redesign; они являются целями, не результатами этого проекта.

## 12. Приоритеты до и во время редизайна

| Приоритет | Действие | Проверка готовности без изменения Backend |
|---|---|---|
| P0 до следующей публикации | Согласовать mode env `api`↔`live` с инфраструктурой и отделить current diff от deployed2411705. | Сборка выбранного релиза с реальным согласованным env, D/L smoke, no demo in L errors; в этой задаче не выполняется выпуск. |
| P0 до открытия регистрации | Реальные Mini App session/CSRF/restore/avatar+website return flow; сохранить release gate до совместного результата. | Подписанные реальные login, reload/logout/expired session, empty specialization и multipart на HTTPS; подтвердить iOS/Android. |
| P1 UX foundation | Исправить semantic theme, shell/safe-area/back, focus/labels/navigation; разбить пустой/ошибка/неподключено. | Контраст и keyboard navigation; оба modes, dark/light,320/390/desktop, реальные клавиатуры. |
| P1 robustness | Storage error handling D, honest save/send/registration recovery; не стирать текущие данные. | Quota/security error не ломает экран и не заявляет persist; no mutation auto replay. |
| P1 product model | Общие views + D/L adapters/capabilities; контрактная карта orders/create-service до оформления их UI. | Сохранены22 маршрута и D-сценарии, L корректно использует server status/revision/request_key. |
| P2 редизайн первой feature | Shell + главный сценарий **главная→поиск/каталог→деталь** как один небольшой вертикальный срез. | Прототип студенческого task-flow, скорость поиска/сравнения, все states наD/L; без 3D зависимости. |
| P2 последующие features | Public performer/favorites, registration/account, server service creation/orders; chat/payment только по согласованным capabilities. | Никаких клиентских фиктивных live успехов, роль/права и серверные правила сохранены. |
| P3 brand enhancement | После foundation — отдельный lazy brand scene для welcome при утверждении концепции. | Статичный SVG/2D fallback полностью функционален, каталог открывается сразу, reduced motion и lifecycle. |

Научно обоснованной оценки «понравится всем студентам» нет. Гипотеза: ясные цена/срок/исполнитель, стабильные controls и короткие сценарии дадут больше пользы, чем 3D-card navigation. Проверять на представителях ЦА задачами поиска, заказа и публикации; фиксировать время/ошибки/понимание, а не только предпочтение скриншота. Конкретные3 дизайн-направления и рекомендованный стек описаны в сопутствующих документах, здесь ими не заменён аудит.

## 13. Источники, проверенные факты и ограничения

### Локальные первичные источники

- [Root layout](/Users/alekspih/Projects/studly/apps/web/src/app/layout.tsx), [AppShell](/Users/alekspih/Projects/studly/apps/web/src/components/AppShell.tsx), [globals.css](/Users/alekspih/Projects/studly/apps/web/src/app/globals.css), [BrandMark](/Users/alekspih/Projects/studly/apps/web/src/components/BrandMark.tsx).
- [AuthContext](/Users/alekspih/Projects/studly/apps/web/src/context/AuthContext.tsx), [RegistrationContext](/Users/alekspih/Projects/studly/apps/web/src/context/RegistrationContext.tsx), [FavoritesContext](/Users/alekspih/Projects/studly/apps/web/src/context/FavoritesContext.tsx).
- [API client](/Users/alekspih/Projects/studly/apps/web/src/lib/api/client.ts), [auth](/Users/alekspih/Projects/studly/apps/web/src/lib/api/auth.ts), [catalog](/Users/alekspih/Projects/studly/apps/web/src/lib/api/catalog.ts), [registration](/Users/alekspih/Projects/studly/apps/web/src/lib/api/registration.ts), [data-mode](/Users/alekspih/Projects/studly/apps/web/src/lib/data-mode.ts), [Next config](/Users/alekspih/Projects/studly/apps/web/next.config.ts).
- [LiveSearch](/Users/alekspih/Projects/studly/apps/web/src/components/catalog/LiveSearch.tsx), [ChatWindow](/Users/alekspih/Projects/studly/apps/web/src/components/ChatWindow.tsx), [create-service](/Users/alekspih/Projects/studly/apps/web/src/app/create-service/page.tsx), [registration CSS](/Users/alekspih/Projects/studly/apps/web/src/components/registration/registration.module.css).
- [INTEGRATION](/Users/alekspih/Projects/studly/apps/web/INTEGRATION.md), [package scripts](/Users/alekspih/Projects/studly/apps/web/package.json), [auth tests](/Users/alekspih/Projects/studly/apps/web/tests/auth.test.cjs), [registration tests](/Users/alekspih/Projects/studly/apps/web/tests/registration.test.ts), [UI fixture](/Users/alekspih/Projects/studly/apps/web/tests/ui-fixture.cjs). Fixture opt-in — не замена Django и не доказательство signed auth.

### Исторические отчёты, прочитанные с учётом даты

- [Регистрация UI16.10](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/registration/2026-10-16_12-39_registration.md>).
- [Первый auth этап](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-16_13-13_auth.md>), [аудит Backend15:08](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-16_15-08_backend-contract-audit.md>).
- [Интеграция20:43](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-16_20-43_integration-publish.md>), [статус16.10](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-16_integration-status.md>).
- [Диагностика/исправление DEMO/LIVE21:12](</Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-16_21-12_regression-demo-live.md>).
- [Git preparation](</Users/alekspih/Projects/studly/documents/project/для отчетов/git/2026-10-16_12-37_git.md>), [публикация интеграции](</Users/alekspih/Projects/studly/documents/project/для отчетов/git/2026-10-16_20-59_frontend-integration-publication.md>), [индекс](</Users/alekspih/Projects/studly/documents/project/для отчетов/README.md>).

Исторический report16.10 документирует настоящий браузер D и HTTP fixture L, включая route smoke, форму/reload/complete на фикстуре. Он не является новым прогоном18.10 и не доказывает Django/Telegram production-сценарий.

### Опубликованные Backend-источники (прочитаны read-only через Git)

- [API_CONTRACT d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).
- [REGISTRATION_API d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/REGISTRATION_API.md), [OpenAPI](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/docs/registration.openapi.json).
- [TELEGRAM_AUTH d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/TELEGRAM_AUTH.md), [FRONTEND_ISSUES d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/FRONTEND_ISSUES.md), [FRONTEND_DEPLOYMENT_PLAN d7a5ffa](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/FRONTEND_DEPLOYMENT_PLAN.md).

Связанные Git-коммиты: [ccfde59](https://github.com/lex44lh/Studly/commit/ccfde590b6e722d1eeb0694747e10afc7958acb1), [893a6fd](https://github.com/lex44lh/Studly/commit/893a6fd5bf4c6ae0059d0f4c66a3b6d353eaaa9c), [7a50ea4](https://github.com/lex44lh/Studly/commit/7a50ea4441c638819242e1252fc285e615a1f2e3), [2411705](https://github.com/lex44lh/Studly/commit/24117052e6091efb391c8840e3d98b2708b773c3), [Backend website-return bf04c13](https://github.com/lex44lh/Studly/commit/bf04c13), [текущий Backend d7a5ffa](https://github.com/lex44lh/Studly/commit/d7a5ffa5abc1537301ced7275da9e45282d6b4f3).

Ни наблюдения статического кода, ни локальные Node-тесты не утверждают отсутствия иных багов. Аудит не включает серверные настройки/доступы, реальные пользовательские данные, безопасность платежей, production deployment, GPU baseline или полное user research. Проблемы отделены от ожидаемых неполных capabilities и от гипотез.

## 14. Изменения этого аудита и остановка

Создан **только этот Markdown-документ** в предварительно проверенной тематической папке `frontend/redesign` (папка отсутствовала). Другие документы redesign/индекс координирует основной агент. Исходники, lock-файл, брендинг, AGENTS, Backend и Git refs этим субагентом не изменены. Существующие tracked/untracked изменения сохранены. Commit, push, merge, rebase, reset, force push не выполнялись.

Результат передан на выбор архитектуры/концепции. **Реализацию Frontend Redesign2.0 не начинать до утверждения пользователем технологий и дизайна.**

Окончание аудита и записи: **18.10.2026 01:38:41 Europe/Moscow** (системные часы: 17.10.2026 22:38:41 UTC).
