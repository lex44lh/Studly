# STUDLY 2.0 — зависимости Backend и запрос сотруднику

Дата 26.10.2026, Europe/Moscow; основной сеанс начат 00:08:42. Integration workspace `/Users/alekspih/Projects/studly-integration`, ветка `codex/frontend-api-integration`, порт 3002. Контракт [`8999703fe60ef6714595614413faddc5a9308d44`](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), код `ebec0915a17e55033cc62093912244c13bf13782`. См. [основной отчёт](2026-10-26_00-08_django-live-integration.md) и [матрицу Frontend](2026-10-26_00-08_ROUTE_API_MATRIX.md).

**Сообщение ниже подготовлено для PO, сотруднику не отправлялось.** Подготовленность Frontend-кода и fixture-проверки не подтверждают настоящее окружение Django. PO подтвердил отсутствие изолированного runtime; production, чужие локальные данные и секреты не используются.

## 1. Что требуется для настоящего E2E

| Зависимость | Что конкретно требуется | Что проверяется после предоставления |
|---|---|---|
| Отдельный local/staging Backend | Подтверждённый commit SHA, адрес и ответственный за runtime; без изменений соседних Frontend checkout | `/api/v1/health/`, `/ready/`, версия доступного контракта |
| Изолированные PostgreSQL и media | Название/граница test DB, отдельный приватный MEDIA_ROOT, порядок наполнения/очистки синтетических fixtures | Сохранение/reload, ownership, upload/content, отсутствие production данных |
| Migration/dependency readiness | Backend-владелец подтверждает применённый опубликованный граф миграций и зависимости соответствующей версии | Portfolio, Conversation, receipts, tariffs и audit действительно созданы |
| Same-origin proxy | `/api/v1/` и `/api/v2/` направлены в один Django; `/staff` остаётся Next, Django `/admin/` сохранён отдельно | JSON вместо HTML, status/redirect, cookies и CSRF на реальном маршруте |
| Origins/cookies/HTTPS | Согласованный origin `http://localhost:3002` для подготовленного локального режима либо отдельный тестовый HTTPS/Mini App origin; список CSRF_TRUSTED_ORIGINS/ALLOWED_HOSTS | Login, сессия, Secure/SameSite/HttpOnly, CSRF rotation/403 и logout |
| Telegram test configuration | Настроенный отдельный тестовый bot/Mini App/website OIDC и callback/return paths; безопасный способ тестового входа без отключения подписи | Настоящий initData/OIDC, expiry/replay/next, reload/relogin; без записи токенов в отчёт |
| Тестовые аккаунты | Разрешённые синтетические customer, performer, dual-role; отдельный staff с минимальными permissions | Cross-account 404/403, роль против ownership, запрет self approval |
| Контрольные server данные | Видимые/скрытые реальные test services, профили draft/pending/approved/changes, link/file portfolio; согласованный специализационный справочник или явно пустой | Полный route flow, visibility после изменения профиля/работы |
| Тариф v2 | `buyer-5-v1` и рабочая конфигурация STUDLY_V2_BUYER_TARIFF; исторический test snapshot v1 | 5% quote/rounding, 409 смены условий, сохранность старых 3% |
| Reverse-proxy upload limit | Лимит больше 10 МиБ с multipart overhead; private media без публичного alias | Допустимый файл около верхней границы, 400 content и proxy 413 не маскируются |
| Security/staff fixtures | Два участника чата, held case и staff с case permission; утверждённые тестовые фразы | Sender-only held privacy, appeal, purpose audit, release sequence и self case запрет |

Frontend сам не устанавливает Python/Docker, не создаёт Backend checkout/.env, не применяет миграции и не выдаёт staff permissions. Конкретные запуск/seed/cleanup должны выполняться владельцем подготовленного Backend или по отдельному согласованному плану. Шаблон запуска от 19 октября остаётся историей подготовки, а не доказательством наличия runtime сейчас.

На локальном Frontend используются `/api/v1/` и `/api/v2/` того же browser origin, серверный `DJANGO_API_ORIGIN` задаёт адрес Django (обычный план — `http://127.0.0.1:8000`), а секреты не передаются в `NEXT_PUBLIC_*`. В опубликованном Backend `.env.example` указаны origins порта 3000; для Integration на 3002 это недостаточно. При использовании обоих локальных имён сотрудник должен согласовать `http://localhost:3002` и `http://127.0.0.1:3002`, либо выбрать одно имя и использовать его последовательно. `localhost` и `127.0.0.1` не следует смешивать в одном session flow. Для настоящего Mini App/OIDC нужен согласованный тестовый HTTPS и точный callback `.../api/v1/auth/telegram/callback/`; это не повод ослаблять Telegram, CSRF или cookie guards.

Доказательства состояния Backend: [API_CONTRACT](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), [INTEGRATION_HANDOFF](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/INTEGRATION_HANDOFF.md), [routes](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/apps/api/config/urls.py), [portfolio permissions](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/apps/api/accounts/portfolio_views.py), [quote/order implementation](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/apps/api/orders/workspace.py). Чужое рабочее окружение, упомянутое в старом RUN_LOCAL, не считается доступным окружением этого Mac.

## 2. Проверенные ограничения контракта

| Возможность | Фактическое ограничение | Поведение Frontend / следующий запрос |
|---|---|---|
| Avatar optimistic concurrency | POST/DELETE `registration/avatar/` не принимают performer_revision/request_key и не возвращают moderation DTO | Serial command; avatar недоступен при dirty text; неизвестный результат не replay. Для полной защиты concurrent avatar замен нужен согласованный server guard/receipt, без самостоятельного изменения Django |
| Атомарный профиль / revision | `registration/` и `account/` не возвращают revision модерируемого профиля в том же DTO; отдельный GET moderation может уже содержать чужую более позднюю редакцию. До появления PerformerProfile его revision отсутствует, а moderation возвращает условную revision=1 | Frontend окружает чтение двумя moderation GET, сравнивает ID/revision и после PATCH принимает только ожидаемый собственный touch. Это защищает версионируемый performer profile, но не является атомарной версией всего customer-only аккаунта до появления профиля. Нужен согласованный общий revision/ETag в профильном PATCH/GET; это запрос расширения, не изменение Django |
| Public performer | v1 возвращает только id/name/about; private portfolio/avatar не становятся публичными после approval | Не раскрывать закрытые файлы. Если нужен расширенный публичный профиль, отдельно утвердить поля/политику/route |
| Public rating/filter | Источника completed-order reviews/rating нет; min_rating отвергается | Не подставлять Demo rating и не обещать работу фильтра |
| Categories/universities | Category — строка, university — приватный свободный текст; утверждённых server directories нет | Существующие UI названия не объявляются server IDs; нужен отдельный справочник/миграционный план при изменении модели |
| Money lifecycle | Нет согласованных paid/provider/webhook/refund/payout/execution/completion/result commands | Только реальные неоплаченные accept/cancel/decline. Кнопки успешной оплаты/завершения не создаются |
| Поздние дополнения | Route additional-payment не поддержан server contract | Состав/деньги/срок исторического заказа не меняются локально |
| Отзывы/арбитраж | Completed review и арбитражные операции не включены | Недоступное состояние; продуктовые решения остаются у PO |
| Уведомления/push/read receipts | Server notifications, WebSocket/push, human read/delivery receipts отсутствуют | Чаты показывают stored/held, ручное обновление; stored не обещает доставку или чтение |
| Staff finance/analytics/settings | Нет revenue/analytics агрегатов и server settings mutations | Отдельные секции недоступны; суммы неоплаченных заказов не считаются выручкой |
| Staff общие жалобы/support | Реализованы только cases удержанных сообщений; общего support/dispute API нет | Не имитировать обработку произвольных обращений |
| Файлы чата/заказа | Attachment contract отсутствует | Не загружать portfolio bytes под видом chat attachment |

Эти зависимости не означают, что нужно срочно добавлять все перечисленные API. Сначала PO утверждает продуктовый сценарий и приёмку, Backend публикует контракт с SHA, затем Integration подключает его отдельным этапом.

## 3. Готовое сообщение Backend-разработчику

> Подготовлен Frontend Integration STUDLY 2.0 по опубликованному контракту `8999703fe60ef6714595614413faddc5a9308d44` (код `ebec0915a17e55033cc62093912244c13bf13782`). Подключены account/cabinet/registration, portfolio/profile moderation, services v2/favorites, saved quotes/orders v2, conversations/messages/appeals и существующие staff resources. Demo отдельно; production registration gate сохранён; Next `/staff` не занимает Django `/admin/`. Настоящий Django E2E ещё не проводился — нет подготовленного изолированного окружения.
>
> Для совместной проверки просим подтвердить:
>
> 1. Актуальный Backend SHA и адрес local/staging runtime; доступность обоих `/api/v1/` и `/api/v2/`, health/ready. Применён ли полный опубликованный граф миграций, готовы ли PostgreSQL/receipts/tariffs/private media? Какая отдельная test DB и кто управляет seed/cleanup?
> 2. Разрешённый browser origin для Integration на 3002 и тестовый HTTPS/Telegram origin. Подтвердите CSRF trusted origins, hosts и cookie/proxy настройки без их ослабления; как сохраняется Django `/admin/` отдельно от Next `/staff`?
> 3. Есть ли отдельный тестовый bot/Mini App/OIDC callback для настоящего входа? Просим безопасный способ проверки без production токенов и без отключения Telegram/CSRF. Секреты не нужны в Git или переписке отчёта.
> 4. Нужны синтетические customer, performer, dual-role и отдельный staff с минимальными `accounts.view_user`, `accounts.moderate_performer`, `catalog.moderate_service`, `orders.view_order`, `operations.view_auditevent`, `conversations.review_security_case`; подтвердите допустимые тестовые действия и очистку.
> 5. Подготовьте/согласуйте набор видимых и скрытых test услуг, профилей/portfolio, accepted/rejected/changes сценариев, тариф `buyer-5-v1` и отдельный исторический v1 заказ. Справочник специализаций можно оставить пустым, если это ожидаемое состояние — просим подтвердить.
> 6. Подтвердите reverse-proxy upload limit больше 10 МиБ + overhead и полностью приватный MEDIA_ROOT. Нужно проверить разрешённые изображения/PDF, ошибку контента, foreign access и закрытый download после approval.
> 7. В avatar POST/DELETE текущего контракта нет revision guard/receipt. Frontend сериализует записи, запрещает avatar mutation при dirty text и не повторяет неизвестный результат автоматически. Планируется ли server optimistic guard для конкурентной замены аватара? До согласованного расширения этот предел явно отмечен.
> 8. Для held/appeal/release нужны два участника и отдельный reviewer; подтвердите допустимые синтетические фразы, порядок audit purpose и проверку release с новым sequence. Универсальный доступ staff к личным чатам не предполагается.
> 9. Можно ли в будущем вернуть revision модерируемого профиля атомарно вместе с `registration/` и `account/` snapshot/ответом PATCH? Сейчас отдельный moderation GET может увидеть более позднее изменение из другой вкладки; Frontend блокирует конфликтный случай, но общий атомарный DTO/ETag упростит надёжное восстановление. Аналогичный server guard нужен для concurrent avatar replacement.
>
> Финансовый provider, paid/результаты/completed/reviews/refunds/payouts, arbitration, notifications и расширенные staff агрегаты сейчас не имитируются. Новые продуктовые правила в этом запросе не утверждаем. После получения окружения пройдём общую матрицу на двух аккаунтах и staff, включая stale/replay/CSRF/ownership, и запишем реальные E2E отдельно от fixture tests.

## 4. Что можно продолжить независимо

Frontend source/DTO/component/fixture-browser проверки, Demo/Live isolation, gates, сборки, отсутствие секретов и сохранность отчётности выполняются без запуска Django. После успеха допустима разрешённая PO публикация конкретного клиентского объёма в Integration с явным ограничением реального E2E. Нельзя объявлять систему production-ready, снимать registration gate, создавать fake endpoints или выполнять production mutations ради проверки.

## 5. Порядок настоящей совместной проверки после подготовки среды

До начала сотрудник подтверждает test-only границы БД/media, актуальный SHA и разрешённые операции. Frontend работает на 3002; тестирование закрытой регистрации выполняется только в разрешённом development/test режиме. Production registration/admin gates не снимаются.

| Шаг | Действия с настоящим Django | Критерий результата |
|---|---|---|
| 1. Доступность | Получить JSON health/ready прямо от Backend и через Frontend `/api/v1/`; прочитать публичный v2 каталог | Health и readiness успешны, v1/v2 proxy не возвращает Next HTML; upstream и browser origin задокументированы без секретов |
| 2. Гость / вход | Проверить гостевой `/auth/me/`, Mini App или OIDC login, повторное `/me/`, reload, logout | До входа 403 ожидаем; после настоящего входа ID из Django; подпись/expiry/state/PKCE/nonce не обходятся; logout убирает приватное состояние |
| 3. CSRF | В разрешённой тестовой среде проверить отсутствующий/неверный CSRF и чужой Origin; затем обычную запись со свежим токеном после login | Неверная mutation отклоняется 403; штатная проходит; не происходит автоматического повторного POST |
| 4. Два аккаунта / роли | Создать разрешённые test account A/B и dual-role сценарий; переключить пользователя/кабинет, обновить страницу, запросить чужие ID | Одно лицо с двумя ролями сохраняет один ID; чужие draft/order/file/conversation/case не выдаются; никакого возврата данных A в UI B |
| 5. Профиль / портфолио | Сохранить имя/описание/роли/специализации; загрузить разрешённые картинки и PDF; изменить/удалить работу; приватно скачать владельцем и staff | Состояние переживает reload; server revision/readiness меняются по контракту; чужой download закрыт; неверные/слишком большие файлы дают явную ошибку |
| 6. Модерация профиля | Отправить полный профиль; отдельным staff проверить файлы/ссылки, одобрить/вернуть на изменения с причиной; проверить self/no-permission | Решение/причина/редакция серверные; own decision и отсутствующее permission отклоняются; дальнейшая правка approved-профиля запускает повторную проверку |
| 7. Услуги / visibility | Создать неполный v2 draft, reload по server ID; добавить extras и собственные portfolio IDs; сохранить/submit/approve; изменить approved-профиль | Пока нет обоих approvals, услуга не видна. Поиск/category/price/duration/order применяются ко всему server queryset до pagination; после invalidation услуга скрывается |
| 8. Избранное | A PUT/DELETE/повтор PUT на видимой услуге, reload, B login; скрыть услугу | Idempotent membership переживает reload только у нужного аккаунта; скрытая услуга не выдаётся. Локальные Demo IDs не становятся серверными записями |
| 9. Quote / order | Получить 5% quote с extras, сверить server decimal snapshot, подтвердить согласие; повторить тот же request_key; проверить unknown response и reload | Один неоплаченный заказ/один order conversation; повтор использует прежний key/quote. Изменение service/tariff даёт 409 и требует нового quote/согласия; исторические v1 суммы сохраняются |
| 10. Неоплаченный lifecycle | Двумя сторонами проверить accept/decline/cancel, старую revision и конкурирующие команды | Только разрешённая сторона/available_actions; ожидаемые 403/409, конечные server states, история событий без дублей; paid не выставляется |
| 11. Чаты / security | Создать discussion отдельно от order chat; send/retry UUID, cursor pages, held warning, sender appeal; staff purpose read и keep/release | Одна server message на intention; stored не объявлен доставкой. Held текст виден отправителю/уполномоченному reviewer, не адресату; release сохраняет ID и выдаётся с новой sequence |
| 12. Staff / gates | Открыть 12 разделов с разными выданными permissions, проверить чужой/self case, readonly ресурсы и unsupported панели; проверить `/admin`, `/staff`, `/register` | Demo flag не создаёт Live прав. Ресурсы/решения защищены Django; недоступные платежи/споры/отзывы/аналитика не имитируются; production gates сохранены |
| 13. Ошибки / представление | На тестовом upstream проверить offline, 400/401/403/404/409/5xx, повтор и восстановление; desktop/mobile, light/dark, reload | Campus остаётся читаемым; нет hidden fallback, двойной записи, чужих приватных данных или сообщения о фиктивном финансовом успехе |

Для каждого шага сохраняются время Europe/Moscow, test account aliases без персональных данных, Backend/Frontend SHA, операция и HTTP status, обезличенный итог и browser evidence. Raw initData, cookies, CSRF tokens, пароли, приватные файлы и личная переписка в Git/отчёт не записываются. Реальные E2E failures передаются Backend-владельцу с точным endpoint/методом/кодом/редакцией; Frontend defects исправляются отдельно с повтором затронутой проверки. Seed/cleanup выполняет согласованный владелец тестовой среды.

Git, фактическое окончание этапа и окончательные проверки фиксируются в [основном отчёте](2026-10-26_00-08_django-live-integration.md); этот запрос самостоятельно не отправлялся.

Приложение дополнительно сверено с текущим кодом и опубликованным Backend 26.10.2026, 00:28:27 MSK. В этой сессии все перечисленные настоящие Django E2E шаги **не запускались**: отсутствует подготовленное изолированное окружение и разрешённый тестовый вход.

Повторная сверка после возобновления: 26.10.2026, 12:44:10 MSK. Исправленный Frontend обнаруживает несовместимый snapshot и не принимает произвольную более позднюю revision после своего PATCH; просьба об атомарном серверном DTO остаётся улучшением контракта. Backend-исходники, среда, миграции и permissions этим анализом не изменялись; сообщение сотруднику не отправлялось.
