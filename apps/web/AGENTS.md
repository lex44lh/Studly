<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend STUDLY

Соблюдать root AGENTS и `documents/project/TEAM_WORKFLOW.md` своего checkout. Сохранять дизайн «Кампус», страницы, прототипы, API-клиент и явные Demo/Live. Общие компоненты, layout/AppShell, типы, конфигурация и package/lock требуют согласования пересекающихся правок между направлениями. Backend — отдельный Django; Next.js не заменяет его серверную бизнес-логику.

Запуск: `LOCAL_START.md`; порты основной/редизайн/API — 3000/3001/3002, отдельные node_modules и .next. Проверки выбирать по задаче и разрешению пользователя: TypeScript, ESLint, production build через Webpack, существующие тесты и Demo. Указывать фактически запущенные проверки; Demo не подтверждает настоящий Telegram login, оплату или Live.
