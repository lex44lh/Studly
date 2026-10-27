# STUDLY — Backend handoff: identity, unknown purchase и recovery

Начало этапа: 27.10.2026 12:33:13 Europe/Moscow. Подготовлено в рамках исправления REJECTED Frontend `abe0efb2648ab34f19b9c23f3cf4427bd76e6e05`. Backend reference: **8999703fe60ef6714595614413faddc5a9308d44**. Окончание и Git-результат — в [исправительном отчёте](2026-10-27_12-33_live-integration-corrections.md). Этот текст подготовлен для сотрудника; автоматически никому не отправлялся.

## Запрос Backend-разработчику

Клиент исправляет наблюдаемую смену аккаунта: immutable actor/epoch для форм и операций, свежий `/auth/me/` перед CSRF и после него, отмена старых запросов, скрытие приватных данных и удаление черновика при смене identity. Focus, pageshow, visibility, BroadcastChannel и storage являются поводом проверить сервер, а не источником identity. Совпадение profile revision у разных пользователей не подтверждает принадлежность формы.

**Это не атомарная защита:** между последним GET `/api/v1/auth/me/` и mutation остаётся гонка общей session cookie. Отмена уже отправленного запроса также не откатывает серверную транзакцию. Просьба предоставить опубликованный контракт и commit SHA для серверной проверки expected actor/session context непосредственно при mutation, до её побочных эффектов, в том числе receipt replay. Текущий клиент не отправляет выдуманный header/поле, которое Django не проверяет.

Необходимо согласовать:

1. Как Django выдаёт проверяемый контекст actor и поколения сессии, и как клиент передаёт его для JSON и multipart операций. Не помещать session cookie, Telegram initData или секреты в localStorage/отчёты. Контекст не заменяет signed Telegram auth, CSRF и permissions.
2. Как сервер атомарно отклоняет контекст A при авторизованном B, а также старый контекст после logout/login того же actor. Проверка должна охватывать регистрацию, avatar, portfolio, favorites, service draft/submit, quotes/orders/actions, discussion/messages/appeals, staff decisions и logout.
3. Какой точный status/code означает session-context conflict; гарантировать отсутствие записи и receipt под новым actor. Не смешивать его с обычным profile revision CAS. Возврат сохранённого receipt тоже требует проверки контекста.
4. Транзакционные тесты: A/B с одинаковой revision; switch во время CSRF; switch после последнего `/me/`, до обработки mutation; A→B→A; expiry/logout и конкурентные запросы; запрос без контекста; multipart; исходный receipt под другой сессией. Представить серверные доказательства. Два клиентских GET эти тесты не заменяют.

### Unknown purchase

Клиент хранит только account/service-scoped opaque quote ID/request key/attempted flag в sessionStorage. После reload ищет прежний заказ по собственным paginated orders и перечитывает detail, либо восстанавливает quote/extras из GET. Повтор сохраняет исходный key; новое согласие обязательно. При недоступном quote, ошибке чтения, конфликтующих слотах или неоднозначном 409 после прежней попытки новое независимое оформление заблокировано.

Для намерения без доступного quote/заказа требуется согласованный способ окончательно установить результат (существующий диагностический путь сотрудника либо новый опубликованный Backend-контракт). Нельзя рекомендовать просто удалить storage и повторить новым ключом. Уточните срок хранения receipts/quotes и возможность окончательно отличить отсутствие побочного эффекта от недоступности ресурса. Новых endpoints Frontend не создавал. sessionStorage обеспечивает восстановление в той же вкладке после reload; это не межвкладочная транзакционная блокировка разных намерений и не защита после ручного удаления данных браузера.

### Recovery ранее incomplete аккаунтов

Новая валидация блокирует пустое после trim имя и ноль ролей до PATCH завершённого профиля. Она **не восстанавливает** пользователей, уже сохранённых как incomplete. Production registration gate сохраняется; wizard в production не открывался.

Нужен согласованный PO и Backend recovery: определить затронутые тестовые аккаунты, подтвердить owner/permissions, восстановить обязательные поля через разрешённый серверный инструмент или отдельный опубликованный self-service recovery-контракт. Не менять БД вручную из Frontend, не обходить gate, CSRF, Telegram или CAS. Для QA допустимо восстановление выделенного тестового аккаунта сотрудником или регистрация через уже разрешённый dev-сценарий; это отдельно от production recovery. Проверить сохранность avatar/portfolio/moderation, повторную полноту регистрации и отсутствие раскрытия чужих данных.

## Среда и настоящая совместная проверка

Просьба подготовить изолированные Django/PostgreSQL/private storage и безопасный seed без production-данных; указать Backend SHA, URL/порты, `/health/` и `/ready/`, CSRF trusted origin для `http://127.0.0.1:3002` (либо согласованного HTTPS origin), cookie domain/SameSite/Secure и настоящий тестовый Telegram способ входа. Секреты передавать только согласованным закрытым способом, не в отчёт/чат.

Нужны customer, performer, both, второй независимый участник, staff с каждым отдельным permission и staff без прав; A/B с одинаковой revision. Сначала переприёмка Frontend L1–L4/C1, затем реальные cookie/proxy/CSRF/Telegram, PostgreSQL concurrency/idempotency, portfolio upload/private access, stale receipt/release и recovery. Synthetic browser tests проверяют клиентский алгоритм, но не работу Django, signatures, storage, permissions и транзакций.

Предыдущие зависимости сохраняются: avatar CAS/receipt; лимит proxy больше 10 МиБ с multipart overhead для portfolio; provenance header API_CONTRACT; платежи/исполнение/результаты/завершение, отзывы, арбитраж, уведомления и финансы. Исходный контракт: [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), [REGISTRATION_API.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md). Правило исходного receipt: API_CONTRACT, «Общие редакции и намерения»; реализация — `apps/api/operations/services.py:17–30`. Django и его документация не менялись.
