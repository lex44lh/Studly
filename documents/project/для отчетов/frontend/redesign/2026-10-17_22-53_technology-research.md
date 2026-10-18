# STUDLY Frontend Redesign 2.0 — исследование технологий

- Начало: **17.10.2026, 22:53:27 Europe/Moscow (UTC+03:00)**, системные часы.
- Окончание: **18.10.2026, 01:37:51 Europe/Moscow (UTC+03:00)**, системные часы; между исследованием и записью был перерыв.
- Исследуемый срез версий: **17 октября 2026 года**; веб-источники проверены вечером 17 октября. Запись документа продолжена 18 октября после перерыва.
- Статус: **исследование; архитектура и дизайн ожидают утверждения; реализация не начата**.
- Рабочая ветка: `codex/frontend-registration`; HEAD `24117052e6091efb391c8840e3d98b2708b773c3`.
- Связанные коммиты: `7a50ea4` — предыдущая Frontend-интеграция; `fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4` — контракт, на который ссылается текущая `apps/web/INTEGRATION.md`; после безопасного fetch координатором актуальный `origin/codex/backend` — `d7a5ffa`.
- Изменения этого этапа: только настоящий Markdown-документ. Backend, приложение, зависимости, lockfile и Git-история не изменялись. Коммит и push не выполнялись.

## 1. Вывод для принятия решения

Рекомендуемая основа STUDLY — **Next.js + React + TypeScript + существующие CSS/Tailwind + Motion for React**. Это вариант A из задания. Повседневные сценарии остаются в семантическом DOM: поиск, каталог, сравнение, публикация услуги, заказ, формы и переписка. CSS отвечает за простые реакции; Motion — за небольшое число переходов и жестов, где он действительно сокращает сложность реализации.

Three.js подходит как возможное **отложенное визуальное дополнение** к welcome или брендовому блоку. React Three Fiber целесообразен, если после утверждения концепции появится настоящая интерактивная сцена, требующая компонентов, состояний и очистки ресурсов. Обязательной зависимости от R3F/Three у первого этапа нет. Предварительно отрисованный фирменный объект может дать нужный визуальный характер дешевле.

**WebGPU не требуется для задач маркетплейса.** Его можно исследовать позднее внутри изолированной сцены с WebGL 2 и статическим fallback. Наличие поддержки в современных браузерах не доказывает доступность и выгоду в конкретном Telegram WebView. Более современный API сам по себе не улучшит каталог, доверие к исполнителю или оформление заказа.

Ниже отделены проверенные факты от инженерной оценки. Качественные оценки — применимость к STUDLY, а не мировой рейтинг технологий. Числа библиотечных размеров не подменяют измерения production-сборки.

## 2. Метод и границы доказательств

Изучены `AGENTS.md`, `apps/web/AGENTS.md`, `apps/web/package.json`, корневой `package-lock.json`, установленные package manifests и относящаяся к установке документация Next в `node_modules/next/dist/docs/`. Прочитаны официальные руководства, changelog, tagged manifests и доступные npm registry metadata.

Названия `latest`, «stable» и таблицы совместимости описывают разные вещи:

1. `latest` npm — опубликованный dist-tag, а не результат проверки в STUDLY.
2. Stable выпуск библиотеки не означает поддержку каждого нового API всеми дополнениями.
3. Browser Compatibility Data описывает движок/браузер. Telegram дополнительно зависит от версии клиента, OS, WebView, GPU, драйвера и условий запуска.
4. `experimental: false` у Web API не означает стопроцентный охват аудитории.
5. Новый релиз без суффикса alpha может всё ещё требовать повышенной осторожности при смене renderer, материалов и post-processing.

На этой машине не проводились запуск на физических iPhone/Android, измерение FPS/энергии/памяти Telegram или сравнение WebGL/WebGPU на одной сцене. Они не считаются выполненными. Build, lint, node tests и измерения текущего приложения отражаются в общем Frontend Audit; данный документ не выдаёт библиотечные заявления за показатели STUDLY.

## 3. Версии: что установлено и что подтверждено источниками

Проверка registry/changelog выполнена **17.10.2026 приблизительно 22:54–22:59 MSK**. Источники не были механически заменены на предположенные будущие версии. Где registry оказался недоступен, это явно указано.

| Технология | Локальное состояние | Подтверждённый доступный выпуск / статус на срез | Решение для STUDLY |
|---|---|---|---|
| Next.js | `16.3.4`, build использует `next build --webpack` | npm `latest` — **16.4.2**; релиз 16.4 от 06.10.2026. [registry](https://registry.npmjs.org/next/latest), [анонс](https://nextjs.org/blog/next-16-4) | Сохранить framework. Отдельно подготовить проверку security patch, не смешивать её с массовым редизайном |
| React / React DOM | `19.2.8` / `19.2.8` | React registry `latest` — **19.3.1**; основной выпуск 19.3 от 09.09.2026. [registry](https://registry.npmjs.org/react/latest), [анонс](https://react.dev/blog/2026/09/09/react-19-3) | Не переносить возможности 19.3 на установленный 19.2.8. Обновление React/DOM должно быть согласованной парой |
| TypeScript | Manifest `^5`; установлен **5.9.3** | npm `latest` — **7.0.2**; 7.0 выпущен 08.07.2026. [registry](https://registry.npmjs.org/typescript/latest), [Microsoft](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) | На этапе редизайна сохранить рабочую toolchain; миграцию компилятора оценивать отдельно |
| Three.js | Не установлен | Сайт — **r186**; npm `latest` — **0.186.1**. [сайт](https://threejs.org/), [registry](https://registry.npmjs.org/three/latest), [release list](https://github.com/mrdoob/three.js/releases) | Не устанавливать до утверждения сцены и её бюджета |
| React Three Fiber | Не установлен | **9.8.2 stable** от 15.10.2026; **10 alpha** — отдельная ветка развития. [releases](https://github.com/pmndrs/react-three-fiber/releases), [введение](https://r3f.docs.pmnd.rs/getting-started/introduction) | Если потребуется сцена: кандидат R3F 9.8.2; не выбирать v10 alpha для основного UI |
| Motion for React | Не установлен | Официальный changelog — **14.3.0** от 15.10.2026; main manifest совпадает. Registry endpoint в веб-инструменте не прочитан. [changelog](https://motion.dev/changelog), [manifest](https://raw.githubusercontent.com/motiondivision/motion/main/packages/motion/package.json) | 14.3.0 — проверенный опубликованный кандидат; совместимость production bundle ещё предстоит проверить |
| GSAP | Не установлен | Registry dist-tag `latest` — **3.15.0**; официальный анонс 3.15 от 13.04.2026. [registry](https://registry.npmjs.org/gsap), [блог](https://gsap.com/blog/) | Не добавлять одновременно с Motion без отдельной задачи, требующей сложной timeline |
| Babylon.js | Не установлен | GitHub Latest — **9.30.0** от 08.10.2026. Scoped registry не прочитан. [releases](https://github.com/BabylonJS/Babylon.js/releases) | Альтернатива для самостоятельного 3D-продукта; чрезмерен для одной брендовой сцены STUDLY |
| Tailwind CSS | Установлен **4.3.3**, manifest `^4` | Локальный факт; внешний latest в этом исследовании не проверялся | Сохранить, использовать как способ реализации токенов, а не как готовую визуальную идентичность |
| WebGPU / WebGL / TSL / CSS / View Transitions | Браузерные API или часть Three, собственных npm-версий нет | Поддержку определяют engine и конкретный API; TSL следует версии Three | Не присваивать им фиктивные «версии 2026» |

У установленного Next `engines.node` — `>=20.9.0`. В локальной документации установки указаны Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ и TypeScript минимум 5.1. Это граница framework, **не обещание**, что WebGPU или новые CSS-возможности доступны на всём этом диапазоне.

### Существенное замечание по актуальности и безопасности

Официальное уведомление Next от **14.10.2026** указывает patched ветки `16.4.1` и `15.5.28`. Оно описывает проблемы Cache Components/typed arrays, Image Optimization с upstream-библиотекой и App Router с Server Actions; условия применимости различаются. [Официальный advisory](https://nextjs.org/blog/nextjs-security-update-october-14-2026).

По дополнительной локальной проверке координатора lockfile содержит `sharp 0.35.4`, а `use server` / `use cache` в `src` не найдены. Это **не доказательство эксплуатации** и не полноценный security audit. Перед Live-развёртыванием нужно проверить фактически устанавливаемый sharp, платформу Linux/glibc, конфигурацию Image Optimization и набор включённых возможностей. Не следует называть Next 16.3.4 актуальным security baseline только потому, что приложение успешно собирается. Изменений зависимостей в данном исследовании нет.

### Почему TypeScript 7 не нужно автоматически брать в редизайн

Microsoft подтверждает стабильный TypeScript 7, но отмечает изменение программного API и потребность части tooling в совместимости с TypeScript 6. У локально установленных пакетов `typescript-eslint` диапазон peer dependencies ограничен **`>=4.8.4 <6.1.0`**. Поэтому простая замена `^5` на `latest` может нарушить lint/type tooling; новый компилятор не ускоряет загружаемый пользователем интерфейс сам по себе. [Анонс Microsoft](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

## 4. Полная матрица 16 критериев

В четырёх таблицах сохранена нумерация критериев задания. «Условно» значит, что нужны capability detection, fallback и проверка на устройствах. «Размер не измерен» означает отсутствие собственного production bundle measurement, а не нулевую стоимость. Для Next/React/TS оценивается их роль как основы приложения: они не являются прямыми заменами GPU renderer или animation library.

### 4.1. Визуальные возможности, анимация, производительность, смартфоны

| Технология | 1. Визуальные возможности | 2. Качество анимаций | 3. Производительность | 4. Смартфоны |
|---|---|---|---|---|
| Next.js | Любой DOM/CSS UI; не собственный renderer эффектов | Организует маршруты и загрузку; эффекты дают другие инструменты | RSC и разделение кода полезны; чрезмерный client graph увеличивает JS | Подходит при небольшом shell и точечных client islands |
| React | Компоненты, формы, состояния, доступные DOM-сценарии | Сам не spring engine; 19.3 добавляет стабильную интеграцию ViewTransition | Избыточные rerender и global context могут вредить INP | Подходит; не обновлять React state на каждом кадре сцены |
| TypeScript | Прямого визуального эффекта нет | Не меняет плавность исполнения | Проверка на сборке; типы не ускоряют GPU/DOM | Польза через надёжность кода, не через графику |
| Three.js | Геометрия, камера, PBR-материалы, свет, shaders | Очень высокий потолок; качество зависит от сцены и motion design | Стоимость draw calls, fill rate, материалов, текстур и pass; нет гарантии FPS | Нужны малая сцена, DPR cap и статическая замена |
| R3F | Возможности Three в компонентной модели React | `useFrame`, события, управление сценой; не готовый стиль анимации | Позволяет demand loop; не устраняет GPU-стоимость Three | Удобен для lifecycle; плохой scene graph остаётся тяжёлым |
| WebGPU | Современный render/compute API, сложные shaders | Не animation engine; сам не задаёт инерцию | Возможна экономия CPU для сложных задач; простой объект может не получить выгоды | Охват и device limits неоднородны; startup и device loss учитывать |
| WebGL 2 | Достаточен для небольшого качественного брендового 3D | Камера, трансформации, shaders через библиотеку | Зрелый путь; может упираться в GPU/CPU и память | Более консервативный вариант 3D; контекст всё равно может не создаться |
| TSL | Процедурные материалы, деформации, node shaders | Подходит для материала/света/деформации по времени | Компиляция graph и shaders имеет стоимость; compute не бесплатен | Усложнять материалы только после profiling |
| Motion | DOM/SVG, layout, presence, жесты, springs | Сильный вариант для интерфейсной инерции и прерываемых переходов | Хорош при transform/opacity и узкой области layout measurement | Подходит для sheets, chips и feedback; touch/scroll не блокировать |
| GSAP | DOM/SVG/Canvas/Three properties, последовательности | Сильный контроль timeline, scroll и синхронизации | Хорош при дисциплине layout reads/writes; сложный ScrollTrigger требует QA | Подходит технически, но narrative scroll неудобен в повседневном Mini App |
| Babylon.js | Полный 3D engine, PBR, сцены, инструменты | Мощные группы анимации и сценические сценарии | Сильные возможности оптимизации, но engine и ассеты требуют бюджета | Реален при оптимизации; для STUDLY мало пользы от широты engine |
| CSS animations | Transform, opacity, transitions, keyframes, часть 2.5D | Отличны для коротких предсказуемых реакций | Низкая зависимость от JS; дорогие paint/layout свойства остаются дорогими | Лучший базовый вариант для press/focus/selection |
| View Transitions | Снимки и shared elements между DOM-состояниями | Качественные переходы при корректном naming и scope | Snapshot/rasterization тоже требуют ресурсов; не применять ко всему экрану без измерений | Полезное улучшение на поддерживаемых движках, без обязательного ожидания |

Основания: [Next client/server](https://nextjs.org/docs/app/getting-started/server-and-client-components), [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [R3F performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [WebGL practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [Motion](https://motion.dev/docs/react), [GSAP React](https://gsap.com/resources/React/), [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language). Оценка полезности и стоимости для STUDLY — инженерный вывод.

### 4.2. Telegram, iOS, Android, Next.js

| Технология | 5. Telegram WebView | 6. iOS | 7. Android | 8. Совместимость с Next.js |
|---|---|---|---|---|
| Next.js | DOM-приложение совместимо с поддерживаемым engine; SDK нужен отдельно | Учитывать нижнюю границу Safari framework, WKWebView и клавиатуру | Учитывать реальный System WebView, а не только версию Android | Основа проекта; миграция framework не нужна |
| React | Работает в подходящем JS/DOM engine; SDK bridge изолировать | Важны focus, scroll, hydration и возврат из фона | Важны re-render cost, память и touch | Native ecosystem Next |
| TypeScript | Транспилируется до запуска WebView | Зависит от emitted JS target, не наличия TS | Аналогично | Штатная интеграция; проверить tooling при major upgrade |
| Three.js | Условно: нет гарантии GPU/context | WebGL 2 при доступном контексте; WebGPU только на подходящих версиях/устройствах | WebGL 2 при доступном контексте; GPU/driver ограничения | Browser-only scene внутри client boundary, lazy import |
| R3F | Как Three; framework не добавляет поддержку GPU | Плюс согласованность React/reconciler | То же; управлять mount/unmount canvas | Совместим через client island; проверить SSR и production bundler |
| WebGPU | Только runtime capability check, реальная инициализация и fallback | Safari/WebKit 26 поддерживает API; старые OS и embed-среды не покрыты обещанием | Современный Chromium/WebView может поддерживать; hardware/driver/engine различаются | Доступен на клиенте; SSR не должен обращаться к navigator |
| WebGL 2 | Проверять `getContext('webgl2')` и context loss | Доступность GPU может меняться после фона/давления памяти | Не все устройства/настройки создают контекст | Клиентский canvas; основное приложение независимо |
| TSL | Следует renderer и выбранным node-возможностям | Нет отдельной гарантии сверх renderer | То же | Bundler должен корректно разделить `three/tsl` и сцену |
| Motion | DOM-анимации подходят; отключать лишние циклы при deactivated | Reduced Motion и touch; не полагаться на hover | Touch/scroll и слабый CPU; не измерять всю ленту на каждый layout | `motion/react` в client components; есть специальный client export |
| GSAP | Подходит; native scroll предпочтительнее перехвата | Протестировать viewport resize и cleanup | Протестировать scroll и lifecycle | Клиентская интеграция, `useGSAP`/cleanup; plugin import проверить build |
| Babylon.js | Как GPU engine: условно | Browser/GPU matrix, память, fallback | Browser/GPU matrix, память, fallback | Можно изолировать в client scene; выгода от миграции Next отсутствует |
| CSS animations | Широко применимая база; новые свойства отдельно проверять | Обычные transitions/keyframes; новые scroll timeline не равны старым CSS animations | Обычные transitions/keyframes; проверка новых свойств | Штатно; CSS Modules/Tailwind не конфликтуют с подходом |
| View Transitions | Engine support не равен наличию интеграции router | Native `startViewTransition` — Safari 18+ по BCD | Chrome/соответствующий WebView — от 111 по BCD | React 19.3 и router integration требуют отдельной проверки; не делать обязательным |

Источники: [Telegram SDK](https://core.telegram.org/bots/webapps), [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [MDN GPU BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json), [Document BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Document.json), [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas), [Next lazy-loading](https://nextjs.org/docs/app/guides/lazy-loading). Таблица не заменяет тесты Telegram на устройствах.

### 4.3. Стабильность, размер, разработка и поддержка

| Технология | 9. Стабильность | 10. Размер зависимостей | 11. Сложность разработки | 12. Сложность поддержки |
|---|---|---|---|---|
| Next.js | Stable framework; отдельные experimental flags не использовать автоматически | Уже установлен; важен route client JS, не размер npm-пакета | Средняя: RSC/client, caching, routing, env | Средняя: обновления безопасности, regressions сборщика и router |
| React | 19.2 установлен; 19.3 stable доступен | Уже установлен; фактический общий bundle измеряется проектом | Средняя: state/effects/a11y; новая API требует version gate | Средняя; единая версия React/DOM/reconciler |
| TypeScript | 5.9.3 установлен; 7 stable, новая toolchain | Dev dependency; не отправляется как компилятор пользователю | Низкая текущая; migration на 7 отдельная работа | Tooling, types и compiler API требуют согласования |
| Three.js | Регулярные numbered releases; migration guide обязателен | Сценический chunk и ассеты не измерены; WebGPU entry отличается от WebGL | Высокая: сцена, GPU, материалы, assets | Высокая при custom shaders/post-processing; pin version |
| R3F | 9.8.2 stable; 10 alpha отдельно | Добавляется к Three, содержит собственные runtime dependencies; размер не измерен | Средняя/высокая; знание Three всё равно нужно | Peer React/reconciler/Three и helpers требуют совместного QA |
| WebGPU | Доступный standard-track API, но MDN Limited availability; не объявлять повсеместным | Сам API встроен в браузер; код renderer, WGSL и assets не бесплатны | Высокая при прямой работе с API | Высокая: adapter limits, GPU errors, device lost, разные движки |
| WebGL 2 | Зрелый API; текущий Three требует именно WebGL 2 | API встроен; библиотека и ресурсы добавляют transfer/parse | Высокая напрямую; ниже через Three | Context loss, driver differences, ресурсная очистка |
| TSL | Поставляется с Three; отдельного обещания LTS нет | Увеличение scene graph/compiler chunk зависит от imports, не измерено | Высокая для сложных shaders; проще строкового patching | Частые API/migration изменения и визуальная регрессия |
| Motion | 14.3.0 в stable changelog | Есть lazy feature loading; официальные примеры размеров ниже | Низкая/средняя для React UI | Средняя; унифицировать presets и не анимировать бизнес-логику |
| GSAP | Stable 3.15.0 | Core и выбранные plugins; STUDLY bundle не измерен | Средняя, выше при DOM timeline и scroll choreography | Cleanup, синхронизация React/DOM и собственная лицензия |
| Babylon.js | Stable 9.30.0; experimental возможности выделять отдельно | Модульные imports; engine + loaders + assets не измерены | Высокая для команды без game/3D engine опыта | Избыточная площадь API для этой задачи |
| CSS animations | Обычные keyframes/transitions зрелые; новые APIs отдельно | Нет внешнего JS engine; CSS тоже имеет transfer/style cost | Низкая для реакций; высокая для сложной choreography | Низкая при токенах; не наращивать набор разрозненных keyframes |
| View Transitions | Native API и React 19.3 stable; поддержку частей проверять | Нет отдельного animation runtime для native пути; CSS/wrappers не нулевые | Средняя: names, scopes, async updates, router | Browser differences и fallback; не смешивать несколько owners одного перехода |

### 4.4. Документация, риски, fallback и маркетплейс

| Технология | 13. Документация | 14. Долгосрочные риски | 15. Fallback | 16. Целесообразность для STUDLY |
|---|---|---|---|---|
| Next.js | Подробная официальная и локальная version-specific | Framework churn, caching semantics, необходимость patching | Loading/error boundaries, обычная навигация; это не offline fallback | Сохранить: уже вложена работа, есть сайт и Mini App |
| React | Подробная официальная | Обновления ecosystem/reconciler, слишком крупные client trees | Предсказуемые DOM-состояния; при сбое данных не менять режим | Сохранить как основу UI и state |
| TypeScript | Подробные guides/release notes | Разрыв compiler API/tooling на major migration | Сохранение текущей проверенной toolchain | Сохранить для contracts/view models; не средство красоты |
| Three.js | Официальные API/examples/migration guides | Непродуманный asset pipeline и рост GPU-эффектов | Статичный SVG/WebP/AVIF той же композиции | Только локальный брендовый остров, если доказана польза |
| R3F | Подробные docs, performance/pitfalls | Зависимость от React internals и совместимости helpers | Canvas fallback + ErrorBoundary + статичный poster | Полезен при утверждённой interactive scene; не нужен обычным страницам |
| WebGPU | W3C/MDN/vendor docs; качество отдельных примеров различается | Неравномерный охват, меняющиеся limits и higher maintenance | WebGL 2 для совместимого набора; затем статичный 2D | Отложить; нет compute/render задачи, оправдывающей обязательность |
| WebGL 2 | Зрелая документация Khronos/MDN | Старый GPU, context loss и высокое энергопотребление | 2D poster; основные операции живут в DOM | База возможной маленькой 3D-сцены |
| TSL | Официальный wiki/guide и examples | Быстро меняющиеся nodes и renderer parity | Упрощённый материал/статичное изображение; не каждый compute эффект переносим | Не нужен для первого редизайна; позже только конкретный shader |
| Motion | Хорошая официальная документация | Избыточное применение layout/drag и рост веса features | CSS/no-motion, немедленное отображение конечного состояния | Рекомендуется выборочно для sheets/presence/feedback |
| GSAP | Очень подробные docs и React integration | Два animation engines, императивный lifecycle, лицензия не MIT | MatchMedia, обычный scroll/CSS/no animation | Резерв для сложного промо; не основа ежедневных сценариев |
| Babylon.js | Подробные API, Playground, tooling | Содержание engine знаний при слабой продуктовой отдаче | Выбрать engine до сцены, либо 2D poster | Не выбирать для текущего scope |
| CSS animations | MDN и browser docs | Дорогие filters/blur и разрозненные параметры | Статическое конечное состояние + reduced motion | Первый выбор для большинства микрореакций |
| View Transitions | MDN/React/browser docs | Ожидание feature parity у старых WebView; дублирование Motion | Проверка API и немедленный update без эффекта | Дополнительное улучшение после baseline QA, не зависимость сценария |

Ссылки в предыдущих разделах подтверждают механизмы и ограничения; «целесообразность» и относительная сложность — вывод автора для команды STUDLY. GSAP бесплатен для многих коммерческих сценариев согласно собственным условиям, но **бесплатность не равна MIT**; права использования сверять по [Standard License](https://gsap.com/community/standard-license/), не по устаревшим обзорам Club GSAP.

## 5. Отдельно о совместимости React / R3F / Three / Next

### 5.1. Проверенные peer constraints

В [manifest R3F v9.8.2](https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.8.2/packages/fiber/package.json) указаны `react >=19 <19.4`, `react-dom >=19 <19.4`, `three >=0.156`. Документация соотносит R3F 8 с React 18, R3F 9 — с React 19. Release notes 9.8.0 подтверждают совместимость с React 19.3 и отдельно предупреждают, что новые API поддержаны не все. [R3F releases](https://github.com/pmndrs/react-three-fiber/releases).

Следовательно, React 19.2.8 и React 19.3.x входят в диапазон R3F 9.8.2, Three 0.186.1 также входит в указанный peer range. Это **проверка объявленной совместимости**, не выполненный тест сборки STUDLY. До принятия конкретной версии нужны install без конфликтов, type-check, production build и mount/unmount в Strict Mode. `@types/three`, если он нужен, должен соответствовать выбранной версии Three. `drei`, physics, postprocessing и другие пакеты не добавлять автоматически.

### 5.2. B с WebGL как базой

R3F `Canvas` по умолчанию использует Three `WebGLRenderer`. Текущий `WebGLRenderer` требует **WebGL 2**; поддержка WebGL 1 удалена с r163. Поэтому надпись «WebGL fallback» должна означать проверенный WebGL 2, а не обещание поддержки любого старого телефона. [Canvas](https://r3f.docs.pmnd.rs/api/canvas), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

Для небольшой сцены это наиболее консервативный кандидат B: простые материалы, ограниченный DPR, без постоянного post-processing, `frameloop='demand'` там, где нет движения. Инерцию можно вычислять через delta/damping без физического engine. После затухания сцена перестаёт генерировать кадры. Это предлагаемый подход, не измеренный результат.

### 5.3. B с WebGPU и fallback

Three `WebGPURenderer` импортируется через `three/webgpu`, по умолчанию пытается использовать WebGPU и при отсутствии поддержки выбирает WebGL 2 backend; есть `forceWebGL`. R3F 9 документирует асинхронную `gl` factory и `await renderer.init()`. Отдельные новые WebGPU entry points и scheduler R3F v10 находятся в alpha; их нельзя путать с существующим custom renderer путем v9. [Three renderer](https://threejs.org/docs/pages/WebGPURenderer.html), [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas).

Автоматический выбор backend **не означает** визуальную эквивалентность всех материалов, legacy `ShaderMaterial` hooks, post-processing и compute workloads. Весь используемый набор функций нужно проверить в обеих ветках. Ошибка асинхронной инициализации или последующая потеря device тоже должна приводить к poster/fallback; наличие ветки fallback в library не заменяет ErrorBoundary приложения.

TSL генерирует shader graph для WGSL/GLSL, но это не обещание перевода любой WebGPU compute-задачи в WebGL. Для первой сцены STUDLY такого объёма вычислений не требуется. Не строить брендовый объект на эффекте, для которого статическая и WebGL версии потребуют второй независимой реализации.

### 5.4. SSR и изоляция

`'use client'` определяет client boundary, но само по себе не означает «этот код никогда не участвует в prerender». Browser-only scene импортируется через клиентский wrapper с lazy загрузкой; если библиотека действительно требует отсутствия SSR, `next/dynamic({ ssr: false })` объявляется в Client Component. Server Components продолжают отдавать shell и poster. [Next lazy-loading](https://nextjs.org/docs/app/guides/lazy-loading).

Не импортировать Three/R3F из общего `ui/index` или корневого provider, иначе отделение сцены от critical graph может быть потеряно. DOM-кнопки, текст и навигация должны оставаться вне canvas и доступны, пока загружается chunk. Сбой сцены не должен размонтировать auth/data providers.

## 6. WebGPU внутри Telegram: практический вывод

### 6.1. Что подтверждено

- WebKit официально включил WebGPU в Safari 26.0; старый текст «только Safari Technology Preview / beta» уже не описывает этот выпуск. Это не даёт гарантии для всех установленных iOS и всех Telegram клиентов. [WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
- Chrome объявлял включение Android WebGPU начиная с Chrome 121 для Android 12+ на определённых GPU. Это историческая нижняя точка rollout, **не универсальная минимальная спецификация Android для октября 2026**. [Chrome 121](https://developer.chrome.com/blog/new-in-webgpu-121).
- Проверенный текущий MDN BCD указывает Chrome Android 121, Safari 26, а Android/iOS WebView как `mirror`. Firefox Android остаётся без поддержки. У GPU API `experimental: false`, но общая страница MDN всё ещё помечена Limited availability. [GPU BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json), [MDN API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).
- Telegram SDK не содержит обещания «WebGPU доступен на всех устройствах» и не заменяет графические браузерные API. Проверяется feature и успешный renderer init, не только имя платформы. [Telegram](https://core.telegram.org/bots/webapps).

Практический вывод: нельзя утверждать ни «WebGPU совсем не работает в Telegram», ни «современный Telegram гарантирует WebGPU». Охват российских студентов и распределение устройств в STUDLY не измерены. Их нельзя подменять мировой долей новых браузеров.

### 6.2. Предлагаемая лестница возможностей

1. **Всегда:** семантический DOM, доступный каталог и формы, статичный фирменный asset. Вход и заказы не ждут GPU.
2. **Обычные CSS реакции:** при отсутствии reduced motion; конечное состояние доступно сразу.
3. **Motion:** только нужные features, с явной reduced motion policy.
4. **Опциональная WebGL 2 сцена:** после загрузки critical UI, проверки контекста и разрешённого качества; без неё продукт полностью работоспособен.
5. **WebGPU experiment:** только в выделенном scene island и после измеримого преимущества над WebGL 2 на целевых устройствах. По умолчанию выключен на первом этапе.

Для WebGPU проверки наличия `navigator.gpu` недостаточно: `requestAdapter()` может вернуть `null`, `requestDevice()` или `renderer.init()` могут завершиться ошибкой, device позже может быть потерян. Приложение должно обрабатывать эти исходы, ограничивать ожидание сцены и освобождать временные ресурсы при отмене. Короткий deadline сцены не должен отменять auth/API запросы. [requestAdapter](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter), [GPUDevice.lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost).

В WebGL аналогично учитывать неуспешное создание контекста, `webglcontextlost`, восстановление и давление памяти. После повторного сбоя сеанс остаётся на статическом asset, без бесконечного цикла перезапуска renderer. [MDN context loss](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost).

### 6.3. Ограничения Mini App и предлагаемые правила

| Ограничение | Решение проекта | Проверка перед выпуском |
|---|---|---|
| Telegram UI, notch, системная navigation bar | Единый viewport/safe-area adapter, события SDK, web CSS fallback | Обычный/expanded/fullscreen, портрет/альбом; CTA и bottom nav не закрыты |
| Keyboard и изменение видимой области | Скроллируемая форма, корректный focus, учёт visual viewport; не привязывать всё к постоянному `100vh` | Поиск, textarea чата, длинная регистрация; клавиатура не закрывает поле/действие |
| Touch и системные свайпы | Нативный scroll; жесты только локально; hover не несёт обязательного смысла | Scroll рядом со сценой и sheet; Telegram minimize/back сохраняют ожидаемое поведение |
| Слабый CPU/GPU | Poster по умолчанию при отказе/низком качестве, DPR cap, без тяжёлого blur/transmission и shadow loops | Худшие целевые Android и iPhone; взаимодействия во время подгрузки сцены |
| Память WebView | Один canvas максимум в рассматриваемом сценарии, texture budget, dispose и отмена loaders | 10–20 переходов туда/обратно; нет накопления contexts/resources |
| Нестабильная сеть | Critical UI раньше брендовой сцены, lazy assets, отмена лишнего, retry данных отдельно | Slow 4G, offline во время загрузки, возврат связи |
| Минимизация/фон | Остановка canvas loop, GSAP/Motion continuous loops, timers и media; возобновление только видимой сцены | Telegram deactivated/activated, background/foreground, блокировка телефона |
| Reduced Motion | CSS media query + `MotionConfig reducedMotion='user'` + отключение camera drift/scroll effects в сцене | Системная настройка включена до и во время сессии |
| GPU сбой | Локальный error boundary и стабильный poster | Контекст не создан/lost; каталог и формы продолжают работать |

У Telegram есть `safeAreaInset`, `contentSafeAreaInset`, `viewportHeight`, `viewportStableHeight`, `activated`/`deactivated`, `isActive`, BackButton и HapticFeedback. Поддержку новых возможностей проверять через версии/доступность SDK, подписки снимать при cleanup. Для safe area не нужно без измерения складывать все inset источники: выбрать понятную семантику system/content и исключить двойной padding. [Telegram docs](https://core.telegram.org/bots/webapps).

`VisualViewport` описывает реально видимую область и полезен для диагностики клавиатуры; он не освобождает от проверки embed-поведения Telegram. [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport). Для web fallback есть `env(safe-area-inset-*)`, где поддерживается. [CSS env](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).

Не полагаться только на автоматическое throttling браузера. Совместить `document.visibilityState` и события Telegram; scene активна, только если документ видим, Mini App активна и сам island в viewport. При отсутствии нового SDK всё равно работает Page Visibility. [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

**Важная деталь Motion:** `MotionConfig` по умолчанию использует `reducedMotion='never'`. Нужна явная настройка `'user'`. При reduced motion библиотека отключает transform/layout, но opacity/background animations могут сохраняться; canvas, camera и ручные loops нужно регулировать отдельно. [MotionConfig](https://motion.dev/docs/react-motion-config), [accessibility](https://motion.dev/docs/react-accessibility). У GSAP аналогичный общий policy реализуется через [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/), а не возникает автоматически из наличия GSAP.

## 7. Где достаточно CSS/Motion, а где оправдана сцена

| Раздел | Предпочтительный инструмент | Решение и ограничение |
|---|---|---|
| Welcome / onboarding | CSS/Motion; возможен poster и позже R3F | Однократная короткая реакция фирменного объекта; пропуск и поиск доступны сразу |
| Главная | DOM/CSS/Motion | Поиск и категории первыми; брендовый объект второстепенный и отложенный |
| Каталог / фильтры | CSS + точечный Motion | Press, selected state, sheet, сохранение позиции; никаких вращающихся карточек |
| Детальная услуга | CSS/Motion | Галерея, раскрытие условий, feedback заказа; 3D не поясняет большинство услуг |
| Профиль исполнителя | CSS | Иерархия, подтверждённые данные и портфолио важнее сценических эффектов |
| Регистрация | CSS + короткие переходы шагов | Focus, ошибки, сохранение; не блокировать действие до завершения exit |
| Кабинет | CSS/Motion выборочно | Изменение статуса/вкладок; нет постоянного декоративного render loop |
| Заказы | CSS | Таймлайн и подтверждение действия, читаемые статусы; GPU не нужен |
| Чаты | CSS, минимальная анимация | Нативный scroll, textarea и keyboard; сообщения не обязаны разыгрывать эффект |
| Пустые состояния | Статичный asset/CSS | 3D только как необязательная заранее подготовленная иллюстрация |
| Загрузка | Статичный skeleton/короткий opacity | Не загружать engine для loader; без бесконечного shimmer при reduced motion |

Фирменная механика-кандидат: **«карточки собираются в связь»** — две плоские формы, связанные с существующим знаком STUDLY, на welcome слегка сближаются и один раз мягко фиксируются; в обычном UI тот же мотив выражается двумя контурами в selected chips и подтверждении действия. Для статического режима остаётся та же композиция. В настоящем 3D может меняться угол и свет, но сама история не требует GPU. Это дизайн-гипотеза, а не разрешение менять утверждённый логотип.

Реалистичная инерция небольшого объекта не требует physics engine. Достаточно damped spring / delta-correct interpolation с ограниченной амплитудой и временем затухания. На touch эффект отвечает короткому действию, не перехватывает вертикальный scroll и не требует гироскопа.

## 8. Размеры: подтверждённое, неизмеренное и способ проверки

У Three/R3F/GSAP/Babylon не измерен размер добавления в STUDLY. Не использовать размер распакованного npm-пакета как размер, который скачает студент. Конкретные imports, renderer, production bundler, tree shaking, chunks, compression и ассеты меняют результат.

Официальное руководство Motion приводит **примеры Rollup bundles**: `useAnimate` mini 3.3 kB, полный `motion` около 43 kB, начальная часть `m` + LazyMotion чуть больше 5 kB; feature packs `domAnimation` +24 kB, `domMax` +38 kB. Само руководство предупреждает об отличии Webpack tree shaking. Это **атрибутированные ориентиры авторов, не измерение Motion 14.3.0 в STUDLY** и не суммы, которые следует механически складывать. [Motion bundle guide](https://motion.dev/docs/react-reduce-bundle-size).

Для решения после утверждения архитектуры нужен один воспроизводимый эксперимент:

1. Production baseline A на фиксированном commit и режиме, холодная загрузка без cache.
2. Тот же экран с Motion imports/presets: route initial JS, lazy chunks, transfer/parse и INP.
3. Тот же экран с одной опциональной WebGL 2 сценой: дополнительные scene JS, модель/текстуры, время init, кадры, память.
4. Если у WebGPU есть обоснованный эффект — ровно та же сцена/quality на тех же устройствах с WebGPU и WebGL 2. Сравнить не только FPS, но cold start и стабильность после фона.
5. Reduced Motion, GPU off/context loss, отказ загрузки asset: одинаковая функциональная доступность.

Требуется считать transfer encoded bytes, raw/decompressed JS, общие и route chunks раздельно; отдельно указать lazy payload. 3D не должен попадать в critical graph каталога даже при наличии этой сцены на welcome. Конкретные целевые бюджеты устанавливаются в Recommended Tech Stack / Risks and Compatibility и не выдаются за результаты этого эксперимента.

## 9. Native CSS и View Transitions: что уже разумно использовать

Обычные transform/opacity transitions, keyframes и WAAPI подходят большинству микрореакций. WAAPI даёт управляемые pause/cancel/play без дополнительного engine, но сложные presence/layout/spring взаимодействия потребуют собственного lifecycle-кода. Это обоснованный вариант D: Next/React/TS + CSS/WAAPI + native View Transitions там, где они поддерживаются. [WAAPI](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).

Native `document.startViewTransition` поддерживается не тем же диапазоном, что Next framework: проверенный BCD указывает Chrome 111, Safari 18, Firefox 144; части API имеют другие версии. React `<ViewTransition>` стал stable именно в **19.3**. Нельзя объявлять его стабильной возможностью текущей React 19.2.8 только по актуальной документации сайта. [BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Document.json), [React docs](https://react.dev/reference/react/ViewTransition).

CSS scroll-driven animations — отдельная возможность от обычных CSS animations. MDN для `animation-timeline` указывает Limited availability; BCD на момент проверки содержит Chrome 115 и Safari 26, а также запись Firefox 159. Последняя запись сама по себе не доказывает, что целевая аудитория уже получила такую версию: без отдельной проверки release/status не обещать охват. Использовать `@supports`, статическое конечное состояние и отсутствие зависимости навигации от timeline. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline), [BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/animation-timeline.json).

В STUDLY native View Transitions можно добавить после проверки маршрутизации и доступности. Нельзя одновременно поручать Motion и native transition трансформацию одного и того же элемента. Не скрывать основное содержимое до завершения scroll reveal. Scroll hijacking и smooth scroll engine в Mini App не предлагаются.

## 10. Сопоставление A–D и рекомендация

Полная взвешенная оценка приводится в отдельном Recommended Tech Stack; здесь зафиксированы технические различия.

| Вариант | Что даёт | Главная цена/риск | Решение |
|---|---|---|---|
| **A: Next + React + TS + Motion** | Достаточный инструментарий для всей продуктовой части; springs/presence/sheets | Нужно контролировать feature loading и layout measurement | **Один основной рекомендуемый стек**, CSS-first |
| B: A + R3F + Three | Повторяемые React-сцены, качественные материалы/камера | Дополнительный JS/asset pipeline, GPU QA, lifecycle и compatibility | Только последующий изолированный брендовый island при доказанной пользе |
| C: Next + React + TS + GSAP + Three | Сложная режиссура, timeline и scroll choreography | Императивный lifecycle, синхронизация с React, выше цена QA | Для агентского промо сильнее, для текущей продуктовой задачи избыточен |
| D: Next + React + TS + CSS/WAAPI + native View Transitions | Меньше сторонних runtime dependencies, хорошая базовая совместимость CSS | Собственная реализация springs/presence; native API охват неодинаков | Разумная экономная альтернатива, но A проще стандартизировать для интерактивных sheets |

Выбор A не запрещает изучать 3D. Он означает, что продукт не обязан ждать 3D-компетенций и device QA ради обновления карточки услуги. Ни смена Next на другой framework, ни Babylon вместо Three не решат текущие проблемы навигации, состояния API или информационной иерархии.

## 11. Проверенные факты, предположения и нерешённые вопросы

### Проверенные факты

- Локально установлены Next 16.3.4, React/DOM 19.2.8, TS 5.9.3, Tailwind 4.3.3; перечисленные новые animation/3D packages отсутствуют в manifest приложения.
- Доступные версии и конкретные источники зафиксированы в §3; R3F peer constraints — в §5.
- У современного Three WebGL renderer нет WebGL 1 fallback; WebGPURenderer документирует WebGL 2 backend.
- WebGPU поддерживается современными движками, но не является универсальной предпосылкой Telegram Mini App.
- Telegram предоставляет viewport/safe area/lifecycle API, а Motion требует явного включения политики reduced motion.
- В рабочем дереве до создания отчёта уже были изменённые Frontend-файлы и незакоммиченный Demo/Live слой. Они не принадлежат этому исследованию и не откатывались.

### Предположения и гипотезы

- Большинству сценариев STUDLY достаточно CSS + Motion — инженерная гипотеза, основанная на типе задач, а не пользовательское исследование аудитории.
- Маленькая качественная сцена может улучшить запоминаемость welcome — дизайн-гипотеза; нельзя считать доказанным рост конверсии.
- WebGL 2 будет более удобным baseline для первой сцены — стратегия снижения риска, не выполненный cross-device benchmark.
- Статичный asset может быть предпочтительнее realtime 3D — это нужно проверить на прототипе и пользователях.

### Не проверено

- Реальная доля устройств STUDLY с WebGPU/WebGL 2, версия Telegram/WebView и GPU failure rate.
- FPS, startup, memory, battery и thermal throttling на физических устройствах.
- Фактический bundle increment для Motion/R3F/Three в текущем Webpack production build.
- Визуальная эквивалентность будущей сцены на двух renderers: сцена ещё не создана.
- End-to-end Django API и Telegram auth в рамках данного технологического отчёта не запускались.

## 12. Следующие действия после решения владельца

1. Утвердить A и одно дизайн-направление; до этого не менять приложение и не устанавливать новые packages.
2. Подготовить отдельную проверку обновления безопасности текущей framework toolchain; не смешивать major TS migration с первым визуальным срезом.
3. Сначала проверить каталог/поиск и дизайн-систему на реальном содержимом Demo и Live. Не начинать с обязательного 3D welcome.
4. Ввести общие motion tokens, reduced motion/lifecycle policy, состояния loading/error/empty и тестируемые data adapters.
5. Если брендовый объект остаётся нужен — сравнить poster/CSS и изолированную WebGL 2 сцену, затем принять или отклонить runtime 3D по бюджету и пользе.
6. WebGPU оставить экспериментом до появления измеримого преимущества в целевом Mini App.

Backend-контракт сохраняется: [API_CONTRACT на текущем backend reference](https://github.com/lex44lh/Studly/blob/d7a5ffa/API_CONTRACT.md), [REGISTRATION_API на reference прежней интеграции](https://github.com/lex44lh/Studly/blob/fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4/REGISTRATION_API.md). Никаких новых Next API routes взамен Django в технологическом выборе нет. Переключение visual quality не связано с Demo/Live; отказ GPU не переключает источник данных.

## 13. Источники и журнал проверки

Все веб-источники ниже прочитаны 17.10.2026; динамические manifests/registry фиксируют состояние на момент исследования, их будущий ответ может измениться.

- **N1:** [Next npm latest](https://registry.npmjs.org/next/latest); [Next 16.4, 06.10.2026](https://nextjs.org/blog/next-16-4); [security 14.10.2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
- **N2:** [Next client/server](https://nextjs.org/docs/app/getting-started/server-and-client-components); [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading); локальная installation guide установленного Next 16.3.4.
- **R1:** [React npm latest](https://registry.npmjs.org/react/latest); [React versions](https://react.dev/versions); [React 19.3](https://react.dev/blog/2026/09/09/react-19-3); [ViewTransition](https://react.dev/reference/react/ViewTransition).
- **T1:** [TypeScript npm latest](https://registry.npmjs.org/typescript/latest); [Microsoft 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/); [6.0 transition notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html).
- **G1:** [Three.js](https://threejs.org/); [Three registry](https://registry.npmjs.org/three/latest); [releases](https://github.com/mrdoob/three.js/releases); [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html); [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html); [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language).
- **F1:** [R3F introduction](https://r3f.docs.pmnd.rs/getting-started/introduction); [Canvas](https://r3f.docs.pmnd.rs/api/canvas); [performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance); [release list](https://github.com/pmndrs/react-three-fiber/releases); [v9.8.2 manifest](https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.8.2/packages/fiber/package.json).
- **M1:** [Motion changelog](https://motion.dev/changelog); [manifest](https://raw.githubusercontent.com/motiondivision/motion/main/packages/motion/package.json); [React](https://motion.dev/docs/react); [upgrade guide](https://motion.dev/docs/react-upgrade-guide); [bundle size](https://motion.dev/docs/react-reduce-bundle-size); [MotionConfig](https://motion.dev/docs/react-motion-config); [accessibility](https://motion.dev/docs/react-accessibility).
- **S1:** [GSAP registry](https://registry.npmjs.org/gsap); [блог релизов](https://gsap.com/blog/); [React integration](https://gsap.com/resources/React/); [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/); [Standard License](https://gsap.com/community/standard-license/).
- **B1:** [Babylon releases](https://github.com/BabylonJS/Babylon.js/releases); [WebGPU support](https://doc.babylonjs.com/setup/support/webGPU/).
- **W1:** [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API); [GPU BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json); [requestAdapter](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter); [GPUDevice.lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost).
- **W2:** [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [Chrome Android rollout](https://developer.chrome.com/blog/new-in-webgpu-121); [Android WebView management](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview).
- **W3:** [WebGL practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices); [context lost](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost); [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).
- **C1:** [WAAPI](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API); [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API); [Document BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Document.json).
- **C2:** [animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline); [его BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/animation-timeline.json); [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion); [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport); [CSS env](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).
- **TG1:** [Telegram Mini Apps SDK](https://core.telegram.org/bots/webapps).
- **Локальные:** `AGENTS.md`, `apps/web/AGENTS.md`, `apps/web/package.json`, `package-lock.json`, установленные manifests, `apps/web/INTEGRATION.md`, отчёт `frontend/api-integration/2026-10-16_15-08_backend-contract-audit.md`.

Недоступные registry endpoints Motion/R3F/Babylon не выдаются за прочитанные; вместо них использованы официальный changelog, tagged package manifest или GitHub releases. Страницы с beta/preview-формулировками сверялись с более поздними официальными stable announcements. Поисковые сниппеты без первоисточника не использовались как достаточное доказательство версии.

Проверка документа: матрица включает все 16 критериев для всех 13 технологий задания; версии/применимость отделены от результатов STUDLY. Код и Backend не менялись. Физические mobile/GPU тесты — **не запускались**. Граница этапа: ожидание утверждения, полный редизайн не начат.
