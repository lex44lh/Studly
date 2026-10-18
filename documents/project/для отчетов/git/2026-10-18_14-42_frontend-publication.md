# STUDLY — публикация готового Frontend

- Дата: **18.10.2026**, Europe/Moscow, начало общего сеанса **14:42:13**, системные часы.
- Статус этой записи: **проверки пройдены, два коммита созданы; готовится документационный коммит и push. Фактическая сверка после push будет добавлена отдельным обновлением**.
- Текущая ветка: `codex/frontend-registration`; разрешённая цель: **origin/codex/frontend-registration**.
- Авторизация: основной текст первоначально запрещал commit/push, вложение требовало публикацию. После прямого уточнения пользователь явно выбрал «После проверок выполнить commit и push в codex/frontend-registration».

## Исходное состояние и сохранность

Исходный HEAD/origin Frontend: `24117052e6091efb391c8840e3d98b2708b773c3`, fetch выполнен, расхождение0/0. Проверены status/branch/log/diff, текущий и новые файлы, в том числе незакоммиченные исправления предыдущих сеансов. Ничего не удалялось, merge/rebase/reset/force push не выполнялись.

Backend remote snapshot: `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`. Main: `ccfde590b6e722d1eeb0694747e10afc7958acb1`. Backend-код и настройки не менялись; Python Backend отсутствует в этой рабочей папке. Документация сотрудника прочитана из remote snapshot, не переносилась в Frontend как собственные Backend-файлы.

## Коммиты

| Коммит | Содержание |
|---|---|
| [202fa99f8c63ff9c5d887211d5ced851fed7d358](https://github.com/lex44lh/Studly/commit/202fa99f8c63ff9c5d887211d5ced851fed7d358) | Дизайн-система, каталог «Кампус», Telegram platform metadata, search tests; сохранённые Demo/Live и регистрационные guards, исправления старых страниц, legacy api→live |
| [781770d27e624097e722bef41bbb73720dbe7d02](https://github.com/lex44lh/Studly/commit/781770d27e624097e722bef41bbb73720dbe7d02) | Два проверяемых запуска, port/API diagnostics, graceful stop,7 launcher tests, root LOCAL_START и web README |

Разделение регистрации/Demo и каталога на отдельные commits не делалось: AppShell импортирует новые Campus-компоненты, общие mode/провайдеры связывают изменения. Полный согласованный исходник сохранён одним связным Frontend-коммитом. Команды запуска выделены отдельно. AGENTS.md и apps/web/AGENTS.md уже отслеживались в исходном HEAD и сохранены без изменений.

Документационный пакет включает все семь исследований, три исторических прототипа и их исходные dist HTML/CSS/JS, screenshots, отчёт реализации Campus, прежний Demo/Live regression report, текущую инструкцию/проверки запуска и индексы. Исторические другие дизайн-направления хранятся как история; утверждён только «Кампус».

## Проверки перед публикацией

- **45 тестов PASS**:37 штатных CJS, включая7 новых launcher tests, и8 отдельных registration TS tests.
- TypeScript PASS, ESLint0 errors/2 прежних no-img warnings create-service429/589.
- Production build `NEXT_PUBLIC_STUDLY_DATA_MODE=live` PASS; отдельный build со старым `api` PASS.
- Demo root command PASS: port3000, `/search`,17 услуг в браузере;22 прежних representative HTTP routes=200.
- Занятый3000: честный отказ, без автоматического переноса порта/чужого kill.
- Local Live без Django: ожидаемый ECONNREFUSED, Next не запускается, нет Demo fallback.
- **Настоящий публичный Django**: health/ready/services/options200, Next proxy/CSRF-cookie/me подтверждены GET; browser LIVE count0. Это не fixture. Локальная Python/PostgreSQL-среда не создавалась.
- Явный Demo перекрывает прежнее `api`, не требует корректного Django origin; CLI `--port 3001` проходит из корня.
- Ctrl+C завершает тестовые серверы,3000/3001 освобождены. `.env` и секреты не перезаписывались.
- `git diff --check` и staged diff-check PASS.

Полные детали, endpoints, ограничения и инструкция: [отчёт запуска](../frontend/local-launch/2026-10-18_14-42_demo-live-startup.md), [Campus](../frontend/redesign/2026-10-18_13-21_campus-search-implementation.md), [LOCAL_START](../../../../LOCAL_START.md).

## Безопасность включённых файлов

Список файлов отобран по областям `apps/web`, Frontend reports, root launch/docs/settings. Изучены diffs существующих страниц/Auth/Registration/API, новые launcher/UI/platform modules, отчёты и prototype packaging/server sources. Прежние registration screenshots просмотрены: персональных профилей/секретов не обнаружено. Новые Campus/screenshots созданы на публичных или вымышленных данных.

Текстовые кандидаты проверены на private-key blocks, GitHub/OpenAI/AWS/Telegram token patterns, запрещённые пути и env/database/archive/key extensions. Совпадений, требующих исключения, не выявлено. Тестовые csrf_token значения синтетические и явно test-only. Секретные значения из production API и Set-Cookie не сохраняются; launcher проверяет только контракт и HttpOnly.

Не включаются:

- `studly-logo-files.zip` — оригинальный локальный архив, сохранён и явно исключён `.gitignore`;
- `.env*` с приватными настройками, node_modules, .next, временные `/tmp` scripts/baselines, локальные базы и backup/media;
- личные документы и материалы Backend-разработчика, не предназначенные для Frontend-публикации.

16 файлов прототипов внутри `documents/.../prototypes/2026-10-18-search/dist` намеренно разрешены узким исключением в `.gitignore`: это проверенный самостоятельный визуальный артефакт, а не .next/node_modules. Без этого предыдущий общий dist-ignore исключал нужные HTML/CSS/JS из публикации. Архив логотипов не распаковывался и в Git не добавлялся.

## Оставшиеся ограничения

Сервер production возвращает пустой каталог и выключенные Telegram login flags. Реальные login/registration/session mutations и физический Telegram не проверены; готовность публичных GET не равна успешному пользовательскому входу. Новые страницы не переделывались. Release/security gate прошлого исследования перед развёртыванием сайта остаётся отдельным этапом; Git push не развёртывает приложение в интернете.

Backend и main не будут целями push. При неизвестном изменении удалённой Frontend-ветки публикация останавливается; force push не применяется.
