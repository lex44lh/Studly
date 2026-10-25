# Инициализация API Integration

Дата: 2026-10-19, Europe/Moscow.
Начало/окончание фиксации отчёта: 00:21:13; системные часы. Точное время начала предшествующего чтения не фиксировалось.

## Цель и окружение
Изучение контекста без реализации. cwd и Git root: /Users/alekspih/Projects/studly-integration. Ветка codex/frontend-api-integration; HEAD и общая организационная база 1888b9194827d00317fb9cf9d27218ef702999cb. Порт направления 3002; сервер не запускался. Проверены pwd, root, branch, status, worktree list и log. До отчёта дерево чистое; HEAD и origin направления совпадают (0/0).

## Действия и контракт
Прочитаны обязательные инструкции, handoff, TEAM_WORKFLOW, CODEX_DESKTOP, LOCAL_START и индекс; изучены API client, auth/registration contexts, DTO, Demo/Live, proxy, launcher, существующие тесты и интеграционные отчёты.
Безопасный git fetch origin выполнен. Первая попытка получила sandbox EPERM на общий FETCH_HEAD; повтор с разрешением успешен. Backend origin/codex/backend: d7a5ffa5abc1537301ced7275da9e45282d6b4f3, без новых commits относительно handoff. Документация читалась через git show, без checkout и изменений Django.

Контракты: [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md), [REGISTRATION_API](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/REGISTRATION_API.md).

Клиент использует /api/v1/: auth/options/, auth/csrf/, auth/me/, auth/telegram/mini-app/, auth/logout/; registration/, registration/complete/, registration/avatar/; specializations/; services/, services/<id>/, services/<id>/quote/, performers/<id>/. Основные маршруты и wire DTO соответствуют прочитанному контракту. Same-origin session cookies, свежий CSRF перед записью, multipart avatar и отсутствие автоматического повтора записи сохранены.

Demo выбирается явно; default/legacy api означает Live без fallback. Регистрация закрыта в production. Серверные orders и my/services пока не подключены. Категории, рейтинги, чаты и уведомления не обеспечены нужным клиенту API. Справочник специализаций по контракту пуст до утверждённого наполнения.

## Ограничения и исторические результаты
Локальный Django не подготовлен; Live не запускался. Настоящие Telegram login, session/CSRF mutations, сохранение/восстановление регистрации PostgreSQL и avatar E2E не подтверждены. Подмена fetch и HTTP-фикстура этого не доказывают.
Отчёт 18 октября ранее зафиксировал GET-проверки настоящего публичного Django; это исторический результат, не новая проверка и не подтверждение входа. Старые упоминания JSON-only OIDC callback устарели: текущий Backend поддерживает next и redirect. В apps/web/INTEGRATION.md осталась ссылка на прежний Backend fd9011e; актуальные handoff/LOCAL_START используют d7a5ffa. Документы в этом этапе не переписывались.

## Проверки, файлы и следующие действия
TypeScript, ESLint, build, автотесты, браузер, Demo и Live: Не запускалась. Выполнено только чтение и Git-проверки; совпадение policy-файлов с origin/codex/frontend-main-dev проверено diff (пусто).
Созданы: этот отчёт. Изменён: индекс README.md отчётов. Код, дизайн и Backend не менялись. Commit/push/merge не выполнялись.
Привязка этой сессии Integration подтверждена фактическим cwd; другие сессии этим не проверены. Готовность к следующей задаче подтверждена; реализацию не начинать автоматически. Следующий совместный этап требует подготовленного Django и согласованного HTTPS/Telegram/origin для порта 3002.
