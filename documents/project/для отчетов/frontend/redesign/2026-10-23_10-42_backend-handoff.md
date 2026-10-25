# STUDLY 2.0 — BACKEND HANDOFF после реализации Frontend

Начало реализации:22.10.2026 20:51:25 Europe/Moscow. Возобновление:23.10.2026 10:42:08. Документ записан:23.10.2026 11:14:56 Europe/Moscow.

Это запрос будущего контракта, **не утверждённые endpoints и не реализация Django**. Backend после повторного fetch23.10 остаётся `d7a5ffa5abc1537301ced7275da9e45282d6b4f3`: [API_CONTRACT](https://github.com/lex44lh/Studly/blob/d7a5ffa5abc1537301ced7275da9e45282d6b4f3/API_CONTRACT.md).

[Подробная таблица необходимых операций, methods, actors, inputs, responses, errors и idempotency](2026-10-22_18-09_backend-handoff.md) сохраняется. Ни один предложенный URL не включён в API-клиент этой задачей. [Отдельный admin handoff](2026-10-22_20-51_admin-backend-handoff.md) описывает все12 разделов, permissions, аудит и privacy.

## Фактически реализованный Demo и серверный эквивалент

- Отдельный `features/demo-workspace` хранит одну account identity, drafts, portfolio refs/Blob, service revisions, canonical orders/conversations/participants/messages/reviews. IndexedDB-транзакция state+assets и action IDs — локальная демонстрация, не серверная защита.
- Регистрация сохраняет прогресс и аватар; выбранные роли не равны staff permissions. Server account/roles/profile должны приходить из существующего auth/registration API.
- Profile approval и service approval раздельны. `performer_ready` не является ни одним из них. До серверного publish проверять актуальную approval и неизменённую просмотренную редакцию.
- Quote и order snapshot: integer minor units, 5% от услуги+выбранных extras, HALF_UP. Backend сейчас возвращает3%; Live их сохраняет. Нужны согласованная тарифная/quote revision и повторное согласие при изменении суммы. Исторические snapshots неизменяемы.
- Demo payment simulation→PENDING→accept→IN_PROGRESS→result→REVIEW→complete→COMPLETED **не переносится автоматически в Live**. Нынешний Backend pending_acceptance→awaiting_payment остаётся прежним.
- Каждому заказу соответствует свой conversation с точными participant IDs. Отдельное обсуждение услуги не перепривязывается к следующему заказу. Нужны server message IDs, sender, timestamps, pagination и client_message_id. При ошибке неизвестного исхода повторять то же намерение, а не создавать новый заказ/сообщение.
- Замечания и повторные результаты сохраняются в истории. Завершение недоступно до исправлений. Арбитражные powers/сроки/возвраты не реализованы до решения PO.
- Отзывы: только подтверждённый завершённый заказ внутри STUDLY, ровно один,1–5, optional text, no edit/delete. Проверять ownership, order status, arbitration policy и uniqueness в БД. Внешние договорённости не создают review. Public aggregates — только серверные подтверждённые reviews/orders.

## Проверка критических фраз в переписке — обязательное будущее серверное требование

AI-модерация отложена до STUDLY3.0. Для2.0 Backend должен проверить возможность детерминированной серверной проверки явных попыток обхода: предложение перейти в другой мессенджер, передача контактов, предложение оплаты вне STUDLY и аналогичные критические фразы. Нормализацию текста/URL/контактов, набор правил, исключения и последствия согласовать с PO. Frontend не реализует фиктивный блокировщик и не меняет текущую доставку.

Для будущего результата проверки нужны: message/conversation ID, код категории/правила, версия правил, время, понятный outcome и допустимые действия. Конкретные endpoints/methods, авторитетный allow/block/warning порядок, статусы/ошибки, повтор client_message_id и порядок сохранения сообщения публикует Backend. Не превращать предположение rule engine в автоматически утверждённую санкцию.

Доступ к переписке — только у участников либо у отдельно разрешённого сотрудника в контексте жалобы/спора, с серверным object permission и аудитом причины доступа. Не вводить универсальный просмотр всех личных чатов, не записывать полный текст в технические логи. Политику хранения evidence и минимизацию персональных данных согласовать. Обычный Demo admin сейчас не читает коллекцию messages.

## Открытые решения и приёмка

PO: изменение approved profile/examples и судьба published services; точный запрет reviews при споре; открытие/закрытие/решение спора и финансы; legacy actions; поздние extras. В текущем UI зависимые действия закрыты с объяснением, остальной Demo работает.

Backend отдельно определяет, какие операции удобнее оставить в стандартной Django Admin, а какие требуют специального STUDLY UI. Публикация Live admin допускается только после server staff auth, RBAC/object permissions, CSRF, аудита и реальных server tests. Ни переключатель Demo-представления, ни build-флаг не являются Live-ролью.

Проверки Django/Telegram/payment provider в этой задаче **Не запускались**. Потребуются подготовленный тестовый Backend, согласованные origins и аккаунты обеих сторон/модератора, опубликованный новый contract SHA. Не использовать synthetic fixture или Demo как доказательство интеграции.
