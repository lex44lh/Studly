# STUDLY — дополнение к техническому scope: административный Demo-интерфейс

22.10.2026, Europe/Moscow. Дополнение по прямому заданию PO к согласованию20:41; один автор общих файлов — root Redesign, код только в studly-redesign. Новая админка не заменяет группы A–H.

Новые изолированные `features/demo-workspace/AdminWorkspace.tsx`, CSS Module и проектный route `/admin`. Это проектный Frontend URL, не согласованный адрес публикации настоящей административной системы. В Live route закрыт без чтения Demo storage/данных/dispatch и не объявляет staff-доступ.

Demo sandbox доступен в development Demo либо отдельной QA production-сборке с явным `NEXT_PUBLIC_STUDLY_DEMO_ADMIN=enabled`. В обычной production Demo по умолчанию закрыт. Значение не берётся из localStorage/query/активной роли. Кнопка входа подтверждает локальную симуляцию, не выдаёт административные права. Auth/API/DTO/Django/CSRF не меняются.

Панель использует уже согласованный canonical Workspace и moderator simulation commands. Отдельных копий аккаунта/заявок/заказов нет. Provider дополнен только compile-gated `sandboxEnabled`; root подключает проектный route, ссылку только при доступном sandbox и отдельное представление shell без клиентской нижней навигации. Общий стабильный main/skip target сохраняется. Package/config/Live permissions не меняются.

Разделы: dashboard, пользователи, очереди профилей/услуг, заказы, споры, безопасность/обращения, отзывы, финансы, аналитика, настройки и журнал. Действующие Demo-команды — только ранее согласованное решение по pending профилю/услуге с причиной и подтверждением. Статусы заказа/денежные суммы/оплата/арбитраж/блокировки/отзывы вручную не изменяются. Просмотр переписки всем сотрудникам не предоставляется.

Зависимые арбитражные/финансовые/санкционные действия остаются недоступными до правил PO/Backend. Для security events — интерфейс будущего серверного алгоритмического контроля критических фраз, без AI и без фиктивного frontend monitoring. Пустые показатели честные, все metrics/ratings Demo вычисляются из canonical orders/reviews.

Проверки: canonical synchronization/reload, moderator gates/actor, повторные решения/конфликт, причины, search/filter/sort/page/detail, default-production-Demo и Live closed, mobile/light/dark/keyboard. Новые файлы включаются в итоговый manifest и независимую приёмку; переноса/публикации нет. Это дополнение для основного Frontend подготовлено до изменения общих архитектурных файлов; отдельные Live permissions и публичный URL этим не утверждаются.
