# STUDLY — BACKEND HANDOFF: комплексные пользовательские сценарии

Дата: 22.10.2026, Europe/Moscow. **Черновик требований по результатам аудита; новые API/DTO не утверждены и не реализованы.** Подготовлен в Redesign, без записи в Django или соседние checkout.

Первичный источник после fetch: `origin/codex/backend` = **`d7a5ffa5abc1537301ced7275da9e45282d6b4f3`**. [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md), [REGISTRATION_API](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/REGISTRATION_API.md). Исследованы документы и код этого снимка, реальный Django не запускался.

## Подтверждённые продуктовые требования

- Единый аккаунт с customer/performer либо обеими ролями; активный режим UI не выдаёт серверных permissions.
- До публикации услуг исполнитель предоставляет примеры работ и проходит одобрение профиля.
- Новый тариф заказчика — **5%**; для нового Demo PO подтвердил базу «основная услуга + все выбранные дополнения», HALF_UP до копейки. Прошлые денежные снимки не пересчитывать.
- Новый Demo lifecycle по ответу PO: явная симуляция оплаты → PENDING → принятие → IN_PROGRESS → REVIEW → COMPLETED. **Порядок Live пока не меняется.** Требуется отдельное серверное решение о расхождении с нынешним принятием до оплаты.
- Отзыв: 1–5, текст необязателен, только после завершения, один на заказ, без редактирования/удаления; после арбитража запрещён. Точный момент запрета при споре остаётся вопросом PO.
- PO подтвердил для Demo: имя + описание + минимум один HTTP(S)-пример либо локальный PNG/JPEG/WebP/PDF ≤10 МиБ; решение модератора только явной Demo-панелью. **Эти Demo-лимиты не объявляются утверждёнными серверными upload-правилами.**

## Что уже существует в Backend

Все относительные пути далее начинаются с `/api/v1/`.

| API | Реальная возможность и граница |
|---|---|
| `auth/options/`, `auth/csrf/`, `auth/me/`, Telegram Mini App login, logout | Серверная сессия/CSRF; session user содержит identity, не полный кабинет или moderation permissions |
| GET/PATCH `registration/`, POST `registration/complete/` | Общие поля/обе роли/профиль исполнителя; роль можно отключить с сохранением данных. Минимум завершения: имя и хотя бы одна роль |
| GET/POST/DELETE `registration/avatar/` | Только свой аватар, PNG/JPEG/WebP ≤5 МиБ, ≤16 млн pixels, один кадр; не универсальный portfolio-upload |
| GET `specializations/` | Поиск, UUID, pagination 100; справочник по текущему контракту пуст |
| GET `services/`, `services/<id>/`, `services/<id>/quote/`, `performers/<id>/` | Каталог/quote; public performer только id/name/about |
| GET/POST `my/services/`, GET/PATCH `my/services/<id>/` | Существующие операции владельца; Frontend-клиент ещё не подключён. POST → pending; moderation admin → published/rejected; непустой PATCH → pending + новая revision |
| POST/GET `orders/`, GET `orders/<id>/`, POST actions accept/cancel/decline | Только неоплаченный цикл ниже; request_key/service_revision, снимок цены/комиссии/срока |

`performer_ready` = роль performer + имя + минимум одна специализация. Это **не одобрение модерации**, не проверка портфолио и не publish permission. Собственные услуги сейчас защищены IsAuthenticated, нового требования портфолио/одобрения там нет.

Услуги сейчас не имеют серверных draft/needs_changes, категории/дополнений/работ портфолио и публичной причины отказа. Портфолио регистрации — необязательная строка до 10000 символов, не коллекция работ/файлов.

Существующий серверный order lifecycle:

```text
pending_acceptance → awaiting_payment   performer accept
pending_acceptance → declined           performer decline
pending_acceptance|awaiting_payment → cancelled   customer cancel
```

Повтор успешного accept в awaiting_payment либо cancel/decline в своём конечном статусе идемпотентен. Посторонний/отсутствующий заказ — 404, неправильная роль участника — 403, конфликт состояния — 409. Создание: service_id + service_revision + UUID request_key; повтор с теми же условиями — 200, новый — 201, другие условия с тем же ключом — 409. Свои/Demo/неопубликованные/бесплатные услуги заказывать нельзя. Нет состояний оплаченного выполнения, результата, завершения, чатов, споров, отзывов или уведомлений.

## Требуемые новые операции — на согласование

Названия ниже описывают операции, а не обещают существующие URL. Окончательные endpoints, wire enum и DTO публикует Backend-разработчик с commit SHA. Общие mutation-требования: authenticated session + fresh CSRF, проверка участника/permissions на сервере, revision или иной concurrency control; UI не считает нажатие кнопки подтверждением успеха.

| Операция / предлагаемый HTTP method | Actor и вход | Необходимый ответ и UI | Ошибки / идемпотентность / серверные проверки |
|---|---|---|---|
| Список своих работ GET; добавить ссылку/файл POST; изменить PATCH; удалить DELETE | Владелец performer; title, kind, URL или multipart file, client operation key, revision | ID работы, тип, metadata, допустимый viewer URL, ownership/visibility, revision; UI list/preview/retry | Форматы/лимиты/минимум/удаление после подачи согласовать. 400/413/415/403/404/409; безопасное хранение/доступ/валидация контента, повтор POST без дубля |
| Состояние модерации профиля GET; submit/resubmit POST | Владелец; viewed profile revision, idempotency key | Явные moderation state/reason/revision/next actions; UI not-ready/pending/approved/rejected/needs-changes | Сервер проверяет обязательные поля/примеры; duplicate submit не создаёт новую заявку. 400/403/409; утверждённый профиль нельзя подменить после просмотра |
| Решение модератора POST | Только подтверждённый staff permission; request/revision, решение, причина | Автор/время/состояние/причина, новая revision, аудит | Участник не принимает решение о себе. 403/404/409, идемпотентное решение. Состав полномочий и последствия редактирования требуют PO |
| Своя услуга GET/POST/PATCH + submit/resubmit, если потребуется | Владелец; существующие поля + согласованные category, extras, portfolio refs, draft revision | Статус/причина/revision/publish capability и подтверждённый catalog visibility | Проверять portfolio + approved performer **на сервере** при применимых операциях. Не выдать клиентский disabled за защиту. PATCH опубликованной услуги сейчас снимает её с каталога — сохранить либо изменить только по решению |
| Новый quote и заказ POST, расширение существующих операций | Customer; существующие service_id/revision/request_key + только утверждённые поля выбранных дополнений/подтверждения quote | Серверный money snapshot, tariff/quote version, order state, participant capabilities, conversation reference | Ни одна клиентская сумма не авторитетна. Повтор одного намерения возвращает прежний order; 409 на изменённых условиях, повторное согласие перед изменившейся ценой |
| Создание попытки оплаты POST; её состояние GET; provider confirmation | Customer для attempt; сервер/provider для подтверждения. Order ID, idempotency key, согласованная попытка | pending/confirmed/failed и серверное order state; UI ждёт подтверждения, не локальный paid | Проверка webhook/provider signature, суммы/валюты/order, повторов, позднего подтверждения, гонки cancel/accept; серверная транзакция. Возвраты/порядок/сроки требуют PO |
| Передать результат POST; запросить доработку POST; повторно передать POST; подтвердить завершение POST | Только соответствующий participant; order/revision, текст/согласованные файлы, action key | Результат/замечание, immutable event history, состояние/capabilities, срок если определён контрактом | Ownership/state/revision/double actions/вложение в нужный заказ. 403/404/409; число доработок/сроки не придумывать |
| Conversation GET; messages GET/POST; attachments POST при поддержке | Только participants; order context, cursor, client_message_id, текст/файл | Canonical conversation ID и participants, server message IDs/times/sender, delivery state; UI pending/error/retry | Один согласованный контекст заказа для обеих сторон; уникальный client_message_id, pagination/ordering, размер/доступ файлов, постороннему 404 |
| Открыть/прочитать спор POST/GET; передать арбитру/решить POST по согласованию | Participant для обращения; арбитр для решения; order/revision, reason/evidence, key | Раздельные discussion/revision/dispute/reviewed/decision states, причины и разрешённые следующие действия | Полномочия, сроки, деньги, возможность отзыва и повторного спора определяет PO. Серверный журнал/идемпотентность; не изображать клиентский возврат средств |
| Оставить отзыв POST; посмотреть GET; публичные агрегаты GET | Только customer завершённого order; rating 1–5, optional text, key | Review ID/order/author/performer/rating/text/time + server aggregate/count/completed count | Уникальность order на уровне БД, COMPLETED, проверка arbitration rule, ownership. Нет edit/delete. 400/403/404/409; повтор того же намерения не создаёт второй отзыв |

## Отдельное обязательное требование: комиссия заказчика 5%

Изменить ставку с 3% на **5% во всех применимых серверных расчётах и платёжных сценариях**, с согласованной базой, округлением HALF_UP до копейки и тестами. Текущий сервер считает 3.00% от основной цены, дополнений в quote/order модели нет. Live до новой версии контракта показывает именно server buyer_fee_percent/buyer_fee_amount/total_amount, без локальной подмены.

Нужна защита от смены тарифа между quote и созданием. Сейчас service_revision версионирует только услугу; создание заново берёт текущую ставку. Смена комиссии без редактирования услуги может незаметно изменить неподтверждённый итог. Backend и PO должны выбрать тарифную/quote revision либо другой механизм повторного согласия. Исторические orders и idempotent repeats сохраняют старый snapshot.

Тесты: 1000 + 50 = 1050; 1000+300 дополнений → база1300, fee65, total1365; пограничные копейки HALF_UP; нулевая/отрицательная/огромная цена; не-RUB; изменение услуги/тарифа между quote/create; повтор request_key; concurrency и сохранность старых 3% orders. Поздняя докупка дополнений — отдельное неутверждённое правило, не пересчёт старого снимка.

## Live lifecycle: варианты для отдельного решения

1. Сохранить существующее принятие до оплаты и согласовать его с продуктовым UX. Дальнейшее выполнение только после настоящего payment confirmation.
2. Перейти к оплате до принятия. Требуются правила непринятия/отказа после списания, ожидания, отмены, позднего webhook и возврата. Без этих решений нельзя перенести Demo PENDING как server state.

PO выбрал второй порядок **только для Demo**; это не разрешение автоматически менять Live.

## Открытые решения и приёмка

Нужно уточнить: последствия изменения одобренного профиля/примеров для старых услуг; начало запрета отзыва при арбитраже; кто открывает/закрывает спор, сроки/лимиты/финансовые полномочия; докупки после заказа; server limits/visibility портфолио. Нужен опубликованный новый контракт и тестовый Backend/аккаунты/HTTPS origin, без production secrets.

Реальная проверка должна включать server permissions, обе роли/чужие записи, конкурентные и повторные requests, денежные snapshots, настоящую сессию/CSRF/Telegram, загрузки и error responses. Frontend Demo, build и synthetic fixtures этого не подтверждают. Реализация Backend и передача этого запроса сотруднику не выполнялись.
