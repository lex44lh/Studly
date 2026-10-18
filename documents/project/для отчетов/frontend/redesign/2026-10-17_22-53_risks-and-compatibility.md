# STUDLY Redesign 2.0 — риски, совместимость и производительность

- Начало сеанса: **17.10.2026, 22:53 Europe/Moscow**; контрольное время при подготовке документа: **18.10.2026, 01:38:47 Europe/Moscow**. Окончание записи и проверки: **18.10.2026, 01:42:03 Europe/Moscow**, системные часы.
- Статус: **исследование и проект бюджетов; испытания на физических Telegram-устройствах не выполнены**.
- Git: Frontend HEAD/remote `2411705`, рабочая копия содержит прежние незакоммиченные Demo/Live-исправления. Изучены интеграция `7a50ea4`, регистрация `893a6fd`, база `ccfde59`. Backend remote после fetch — `d7a5ffa` (read-only).
- Источники: [Technology Research](2026-10-17_22-53_technology-research.md), [Frontend Audit](2026-10-17_22-53_frontend-audit.md), production build локального проекта, [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [R3F performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [Web Vitals](https://web.dev/articles/vitals), [методика измерений](https://web.dev/articles/vitals-measurement-getting-started), [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## 1. Фактически выполненные проверки

| Проверка | Результат | Что это доказывает / чего не доказывает |
|---|---|---|
| `git status`, branch, log, diff, cached diff | Ветка `codex/frontend-registration`, HEAD `2411705`; staged diff пуст; прежние изменения сохранены | Есть воспроизводимый baseline; working copy не равна опубликованному HEAD |
| `git fetch --no-tags origin` | Успешно, `origin/codex/backend`: `fd9011e` → `d7a5ffa`; Frontend remote без изменений | Актуальные refs получены без merge/checkout; приложение не синхронизировалось автоматически |
| `npm test -w apps/web` | **13/13 PASS** | Unit/contract harness для auth/registration/catalog/data mode, не реальный Django E2E |
| Отдельный запуск `tests/registration.test.ts` | **8/8 PASS**, TypeScript transpile в памяти через установленный compiler | Проверена логика draft/prefill/roles; штатный npm test пока не включает `.test.ts` |
| `tsc --noEmit --incremental false -p apps/web/tsconfig.json` | **PASS**, exit 0 | Типовая согласованность текущей копии; не гарантия runtime API |
| `npm run lint -w apps/web` | **0 errors, 2 warnings** | Предупреждения `no-img-element` в create-service, строки 429/589 на этом baseline |
| `npm run build -w apps/web` | **PASS**, Next 16.3.4 webpack; компиляция 1205 ms, TypeScript 528 ms, генерация static 283 ms | Собираемость локальной копии; скорость сборки не равна скорости Mini App |
| Временный `next start`, 127.0.0.1:3107 | Ready 83 ms, config 68 ms | Время готовности локального сервера, **не** cold start телефона или LCP |
| IAB осмотр `/`, `/search`, `/welcome` | Desktop 1280×720 и viewport 390×844; root DOM width/scrollWidth =390/390 | Частичный визуальный smoke test; не настоящий мобильный браузер/Telegram |
| Live без локального Django | На `/` и `/search` воспроизводится «Сервер временно недоступен», Demo не появился | Честный error path при недоступном origin; не доказательство сбоя production Backend |
| Системная тёмная тема | На главной почти белый текст на белых категориях, чёрный body | Дефект темы подтверждён экраном; существовал до Django, не его регрессия |

Исходники, Backend, lockfile и зависимости не изменялись этим исследованием. Build создал игнорируемые `.next`-артефакты. Временный локальный сервер остановлен после проверки (SIGINT, exit130; это штатное завершение осмотра, не ошибка build). Его логи подтвердили ECONNREFUSED к локальному Django127.0.0.1:8000. На физических устройствах, production Django, staging с реальной сессией, Lighthouse, RUM, FPS, GPU memory и батарее проверки **не запускались**.

## 2. Измеренные размеры текущего build

Метод: прочитаны `apps/web/.next/server/app/{index,search,welcome,register/roles}.html`, взяты уникальные внешние `<script src="/_next/...">` ресурсы. Суммированы размеры соответствующих локальных файлов, отдельно `zlib.gzipSync` каждого файла с параметрами по умолчанию. Modern-сумма исключает `nomodule` polyfill. Это **оценка локального сжатого набора**, не HAR, HTTP transfer, Brotli или фактический first-load граф браузера с prefetch/API/SDK.

| Route | HTML, bytes | Modern JS raw, bytes | Локальный gzip, bytes | Локальный gzip, KiB |
|---|---:|---:|---:|---:|
| `/` | 9 692 | 488 927 | 147 203 | 143.8 |
| `/search` | 8 525 | 494 191 | 148 557 | 145.1 |
| `/welcome` | 11 832 | 483 764 | 145 044 | 141.6 |
| `/register/roles` | 9 738 | 515 098 | 156 624 | 153.0 |

Дополнительные факты:

- `nomodule` polyfill — 112 594 raw / 39 627 gzip bytes, не включён в modern-сумму.
- Всего 42 JS chunk-файла в production `static/chunks`, суммарно **1 096 005 raw bytes**. Это весь набор, не начальная загрузка одного маршрута.
- В `public` семь небольших SVG, суммарно **4 134 bytes**; два brand mark — по 410 bytes. Настоящие обложки услуг ещё не создают реалистичной медийной нагрузки, поэтому малый объём `public` не доказывает будущую скорость.
- В браузерном DOM найден внешний Telegram script `https://telegram.org/js/telegram-web-app.js?64`; его размер/transfer не измерен и в таблицу не включён. Next/RSC runtime включён в локальные modern JS; API/изображения/CSS/inline bootstrap не включены.
- `page_client-reference-manifest` ссылается не на весь начальный runtime и может содержать лишние route references. Его сумму нельзя выдавать за initial JS — поэтому использован HTML script inventory.

Размеры измерены в production Live по умолчанию, без установки Motion/Three. Они не дают основания утверждать, что новый стек уже укладывается в бюджеты.

### Воспроизведение измерения

1. Зафиксировать hash и рабочий diff; выполнить существующий `npm run build -w apps/web` с явным целевым режимом и известной конфигурацией.
2. Для каждого указанного HTML извлечь script src, исключить внешние источники и `nomodule`, сопоставить с `.next`.
3. Суммировать raw `Buffer.length` и gzip каждого файла; записать версии Node/Next и параметры gzip для последующего сравнения. Текущие цифры не нормализованы между платформами/релизами compressor.
4. Для выпуска снять отдельный HAR с пустым cache на телефоне/staging: фактическая сеть может использовать другой алгоритм сжатия и prefetch. Учитывать Telegram SDK и всё, что реально запрашивается до готовности основного действия.

## 3. Предлагаемые бюджеты — ещё не результаты

Следующие ограничения — **проектные стартовые цели**, их нужно утвердить и уточнить после пилота. Пороговые значения LCP/INP/CLS согласуются с Core Web Vitals: LCP≤2.5 s, INP≤200 ms, CLS≤0.1 на p75; остальные числа ниже — выбор STUDLY, не отраслевой стандарт. [Официальные определения](https://web.dev/articles/vitals).

| Метрика | Предлагаемая цель | Как проверять |
|---|---|---|
| Initial modern JS основного route | ≤170 KiB gzip self-hosted, включая Next/React; 3D =0 bytes на critical path | Сопоставимый HTML/chunk inventory + HAR; учитывать размер после добавления Motion |
| Общий critical JS с Telegram SDK | Предварительный gate ≤200 KiB gzip-equivalent; уточнить после фактического измерения SDK | Реальный transfer по HAR, отдельно sources и compression; не складывать разные единицы |
| Дополнительный UI route chunk | Обычно ≤25 KiB gzip; исключения обосновать | Bundle diff и размер route-specific кода |
| Critical media каталога | ≤350 KiB transfer на первый viewport; одна миниатюра обычно ≤60–80 KiB | Responsive images, реальные API assets, явно заданные width/height/aspect ratio |
| Шрифт | Системный сначала; если нужен брендовый — ≤100 KiB WOFF2 critical subset суммарно | Локальная лицензированная кириллица, fallback metrics, cache; без синхронной блокировки UI |
| LCP | p75≤2.5 s на целевом mobile profile | Lab для диагностики + RUM после rollout, раздельно Demo/Live и platform |
| INP | p75≤200 ms | Настоящие взаимодействия и RUM; TBT в Lighthouse только proxy, не INP |
| CLS | p75≤0.1, внутренний ориентир ≤0.05 | Полный сценарий с loaded images, ошибками, панелями и навигацией |
| Mini App startup | p75≤2 s до видимого пригодного shell и активного поиска; полезные данные≤3 s на эталонном 4G | Отдельно `navigationStart→shell`, `→search usable`, `→data`; SDK ready не равно получению API |
| Слабое устройство | Поиск/навигация работают без canvas; при стресс-сети shell≤4 s — стартовая гипотеза | Реальный бюджетный Android + отдельный lab 6×CPU, 1.6Mbps/150msRTT; stress 400kbps/300msRTT не считать обычным 4G |
| Кадры UI | Стремиться к60 fps на средних устройствах (≤16.7ms/frame), без блокировки действия; на слабых уменьшать/убирать анимации | Trace interactions; p95 frame time, long tasks, доступность input; среднее FPS недостаточно |
| 3D, если одобрена | Дополнительный lazy JS≤350 KiB gzip и модель+текстуры≤750 KiB transfer как верхний pilot gate | Build/HAR реальной сцены; budget не означает разрешения грузить её до поиска |
| Геометрия/GPU | Один canvas, ≤20k triangles, ≤30 draw calls, текстуры≤1024² по умолчанию, без обязательных realtime shadows/post passes | Renderer stats + GPU profiling; это стартовый cap небольшой сцены, не гарантия FPS |
| DPR / quality | DPR1 на слабом классе, cap1.5 для mobile, ≥2 только при доказанной необходимости и замерах | Device test, fill rate и frame-time trend; не только user-agent/число ядер |
| Память UI | Ориентир JS heap≤80MiB на эталонном сценарии и retained growth≤10MiB после50 route cycles | Chrome profiler с одинаковым сценарием/GC; неприменимо как универсальный iOS heap counter |
| GPU textures/buffers | Pilot ориентир≤32MiB активных ресурсов сцены | Оценка по форматам/размерам + доступный profiler; portable GPU memory API отсутствует |
| Фон/покой | 0 непрерывных декоративных RAF loops в фоне и после затухания | activated/deactivated + visibility + offscreen traces; никаких постоянных spin loops |
| Восстановление | Потеря canvas не мешает API/UI; повторные записи автоматически не создаются | Context/device loss, background/resume, interrupted submit, retry read before repeat write |

LCP/INP/CLS текущего STUDLY **не измерены**. По build time и размерам нельзя вывести их численно. Не заявляется ни «быстрый», ни «медленный» Mini App без этих данных. Память, FPS и энергия новой графики также остаются неподтверждёнными.

## 4. Telegram/WebView: практическая политика

SDK Telegram предоставляет theme/viewport/safe area/lifecycle возможности, но доступность зависит от версии клиента. Обёртка проверяет методы/версию и корректно отписывается. `safeAreaInset` и `contentSafeAreaInset` — разные ограничения; их нельзя бездумно складывать с CSS env и получать двойной padding. [Официальный SDK](https://core.telegram.org/bots/webapps).

### Матрица планируемых испытаний

| Среда | Что обязательно проверить | Состояние в исследовании |
|---|---|---|
| Telegram iOS на старом поддерживаемом iPhone/OS | WKWebView, keyboard/visual viewport, safe areas, scroll back, background resume, отсутствие WebGPU | Не запускалось |
| Telegram iOS на актуальной OS/клиенте | То же + фактическое создание WebGPU adapter/device, если pilot существует | Не запускалось |
| Telegram Android, бюджетный телефон | Реальный System WebView/GPU, memory pressure, scroll/input, клавиатура, API retry | Не запускалось |
| Telegram Android, современный телефон | 60Hz/120Hz, DPR cap, lifecycle, WebGL/context loss; WebGPU не включать по названию OS | Не запускалось |
| Telegram Desktop | Размеры окна, клавиатура, theme, доступность SDK, links/back | Не запускалось |
| Safari/Chrome обычного сайта | No Telegram SDK, website auth, desktop layout, back/forward, fallback | Локальный IAB — только ограниченный smoke, не эти браузеры |
| Slow/offline/flaky network | Loading/timeout/retry, данные не становятся demo, draft/input не теряется | Локальный unavailable backend воспроизведён; full network matrix не запускалась |
| Reduced Motion / increased text / screen reader | Никаких бесконечных декоративных движений, не теряется смысл, focus/touch доступность | Требование, полная проверка не запускалась |

Минимальная OS/browser support policy STUDLY ещё не согласована. Для пилота включить устройства на нижней границе реальной аудитории и актуальные; конкретные модели/версии занести в матрицу перед испытаниями. Поддержка framework не тождественна наличию новых GPU API.

### Клавиатура и управление

- Главные действия доступны обычным tap; hover только дополняет UI. Drag не единственный путь.
- Для input и CTA учитывать visual viewport/Telegram viewport, а не только `100vh`. Чатовая кнопка остаётся выше клавиатуры; не закреплять всю страницу на высоту первого кадра.
- Локальные sheet/dialog управляют focus/return-focus/Escape; нативный Telegram BackButton согласован с маршрутом/модальным состоянием, не выполняет двойной переход.
- Touch target продукта — обычно≥44×44 CSS px. Это более удобная проектная цель; WCAG2.2 AA minimum24×24 имеет исключения/spacing и не следует называть его требованием44px. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Длинные тексты, загрузка картинок и ошибка API не сдвигают CTA внезапно; skeleton зарезервирован по реальному layout.

## 5. WebGPU и fallback без блокировки продукта

Нельзя решать по строке browser/OS или только `'gpu' in navigator`. Последовательно проверить secure context, наличие API, получить adapter, requestDevice, инициализировать renderer и обработать ошибку/device loss. Для WebGL отдельно проверяются создание WebGL2 context и context loss. Feature detection не является benchmark и не доказывает достаточную скорость.

```text
DOM + доступный SVG/poster уже показаны, CTA уже активны
       ↓ разрешены эффекты? reduced motion? активен? виден? есть бюджет?
       ├─ нет → оставить SVG/poster
       └─ да → lazy import только сцены
                  ├─ выбран WebGL pilot → context/init OK → ограниченная сцена
                  └─ будущий WebGPU pilot → adapter/device/init OK → сцена
                                     └─ ошибка → совместимый WebGL2 путь
                                                       └─ ошибка → SVG/poster
```

WebGPU не выбран по умолчанию в основном стеке. Даже «автоматический WebGL fallback» Three не гарантирует переносимость всех TSL/compute/GLSL эффектов. Пока нет пилота и проверенной версии, обещать одинаковую картинку нельзя.

Сцена владеет своими canvas/assets/observers/listeners и освобождает geometry/material/texture/render targets на unmount. Demand rendering после затухания предпочтительнее непрерывного цикла. При скрытии вкладки, Telegram deactivated, уходе объекта за viewport, открытии критичного ввода/клавиатуры — остановка/снижение качества. При возвращении не пересоздавать сцену бесконечно; при повторной ошибке использовать постер до следующего явного посещения.

Motion получает явную Reduced Motion policy (`user` или эквивалент), потому что default не следует автоматически считать пользовательским предпочтением. Canvas и CSS loops требуют своей остановки, настройка Motion их не выключит. Опция «без эффектов» доступна независимо от ОС; смысл и статус операции передаются текстом/DOM.

## 6. Реестр рисков

Вероятность и влияние — экспертные оценки, не статистика инцидентов. Владелец означает предполагаемую область ответственности, а не поручение внешнему сотруднику.

| Риск / доказательство | Приоритет | Мера и проверка | Владелец |
|---|---|---|---|
| `mode=api` в deployment plan против нового `demo/live` resolver | Критично до следующего deploy | Согласовать единый deployment contract, production build smoke с env; не включать Demo при invalid value | Frontend + владелец deployment |
| Next/sharp baseline старее advisory14.10 | Высокий до Live-релиза | Отдельный patched build, проверить платформу и включённые возможности, не заявлять доказанный exploit | Frontend + deployment |
| Незакоммиченный Demo/Live fix отсутствует в опубликованном2411705 | Высокий | Не считать local pass доказательством production; отдельное разрешение на публикацию/commit | Frontend |
| UI исчезал из-за ранних return unsupported | Высокий | Полная route/state inventory; сохранение экрана с честной доступностью; content regression tests | Frontend |
| `fieldset disabled` не отключает ссылки/любые side effects | Высокий | Capability guards в действиях и ссылках, не только визуальный disabled | Frontend |
| Orders/create-service API существует, Frontend не подключён | Высокий scope risk | Проверить актуальный контракт; отдельный интеграционный этап, не писать «Backend отсутствует» | Frontend + contract owner |
| Глобальные filter/sort/rating/categories не поддержаны | Высокий UX risk | Честная доступность; не считать current-page filter глобальным; contract backlog | Product + Frontend + Backend owner |
| Ошибка API ошибочно воспринимается как удаление данных | Средний/высокий | Раздельные error/empty/unsupported состояния, retry, mode badge; прежние страницы не удалять | Product + Frontend |
| Смешанная тёмная тема и inline цвета | Высокий readability risk | Полные semantic themes, визуальные проверки всех состояний, contrast audit | Design + Frontend |
| 3D попадает в shell/common chunk | Высокий performance risk | Ноль scene imports в core; bundle gate; lazy только после UI | Frontend |
| GPU/context/device недоступен либо потерян | Средний/высокий | Poster first, init catch/error boundary, no forced remount loop; физические устройства | Creative + Frontend |
| Memory leak при route/background cycles | Средний/высокий | Resource ownership/dispose,50cycles trace, один canvas | Frontend |
| Анимация мешает tap/input/scroll | Высокий UX risk | Нет scroll hijack, pointer interception, obligatory entrance delay; reduced motion | Design + Frontend |
| Fake success/двойная запись | Критично для заказов | Server final state, pending command guard, никаких automatic write retries без idempotency | Frontend + API contract |
| Website login не использует актуальный server callback | Высокий для web platform | Обновить знание контракта наd7a5ffa, протестировать options/start/return/me flow | Frontend + auth contract owner |
| Избранное и чаты только browser storage | Средний | Ясно назвать ограничения; isolated namespaces; не обещать cross-device sync/delivery | Product + Frontend |
| Storage quota/error в demo chat | Средний | Try/catch и сохранение input, честное сообщение; не терять уже введённый текст | Frontend |
| Лицензия/кириллица/шрифтовой transfer | Средний | Проверка права использования, local subset, budget; системный fallback | Design + Frontend |
| Предположения о вкусах студентов | Средний | Task-based usability с разными студентами и телефонами; не выбирать по «любят яркое» | Product/UX |

## 7. Восстановление после ошибок

Для чтения API: AbortController, конечный timeout, управляемый пользователем retry, сохранение фильтров/позиции и различение offline/серверной ошибки. Можно показывать ранее полученные настоящие данные с явной отметкой устаревания, если появится согласованная cache policy; это не Demo и не текущая реализованная возможность.

Для команд: pending state предотвращает двойной tap; после неопределённого сетевого исхода сначала проверить серверный результат, не автоматически повторять заказ/оплату. UI не объявляет успех по одному click. Проверка сессии не удаляет пользовательский ввод при временной ошибке API.

Для графики: переключить только иллюстрацию в статичный режим. Не перезапускать авторизацию и не перезагружать всю страницу из-за device lost. Для rollout: вернуть представление одного route при сохранении data adapters, server IDs и контрактов.

## 8. Что остаётся неизвестным

Нет фактических LCP/INP/CLS/RUM, weak-phone FPS, memory pressure и энергозатрат; неизвестна доля WebGPU в аудитории STUDLY. Нет проверки реального Telegram login/website callback/регистрации с доступным Django в этом сеансе; успешные node fixtures не заменяют её. Candidate stack с Motion/новыми версиями не установлен, значит его размер и совместимость именно в приложении ещё не доказаны.

**Вывод:** выбранный DOM-first стек имеет наименьшую дополнительную поверхность риска, но его реальная скорость должна пройти измерения. **Рекомендация:** утвердить бюджеты как gate пилота, проверить конфигурацию/security baseline, начинать с поиска, а GPU-эффекты держать вне критических сценариев.
