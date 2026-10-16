# STUDLY — Frontend/Backend Integration Status

Дата: 2026-10-16 20:54:26 Europe/Moscow. Начало работ: 2026-10-16 20:42:13. Окончание проверок и публикации фиксируется в отчёте сеанса и git-отчёте.

## Реализовано на Frontend
Типизированный REST-клиент, cookie same-origin, CSRF перед каждой записью, multipart и DELETE. Ошибки 400/401/403/404/409/сеть, отмена чтения, блокировка повторного submit; мутации автоматически не повторяются. Авторизация принимает только raw initData. Секреты не пишутся в localStorage и логи.
Формы регистрации сохраняют шаги в Django: roles, profile, performer, skip, complete; восстановление GET и серверная завершённость, выбор всех страниц справочника, аватар. React Context отвечает за несохранённые поля; сохранённый прогресс — только серверный. Сохраняются поля на переходе, не каждый введённый символ. Production gate сохранён до настоящей совместной проверки; формы доступны в development.
Каталог, серверный поиск, детали услуги, quote и публичный исполнитель читают Backend. Цена/срок/сортировка поиска применяются только к текущей странице, с явной надписью; рейтинга нет. Никаких демоданных при ошибке сети. API is_demo явно помечается. Старый UI сохранён в явном режиме NEXT_PUBLIC_STUDLY_DATA_MODE=demo. Local favorites API отделено от demo-ключа, не является аккаунтной синхронизацией. Категории пока недоступны. Неподключённые legacy-процессы заказов/чатов/уведомлений/создания услуг закрыты в API-режиме, чтобы не создавать ложный успех.

## Подключённые Backend API
Все пути имеют префикс `/api/v1/`:
- GET auth/options/, auth/csrf/, auth/me/; POST auth/telegram/mini-app/, auth/logout/. Logout — операция контекста, новой кнопки в интерфейсе нет.
- GET/PATCH registration/; POST registration/complete/.
- GET specializations/ (все страницы; поиск по загруженному справочнику в UI).
- POST/DELETE registration/avatar/; GET изображения браузером с cookie, без серверной оптимизации Next/Image.
- GET services/ (search, performer, ids, page), services/<id>/, services/<id>/quote/, performers/<id>/.

## Какие запросы проверены реально
К настоящему Django: только неуспешная проверка доступности health — соединение localhost:8000 отклонено. Успешных запросов к Django в этом сеансе нет.
Реальные HTTP-запросы браузера через Next rewrite к тестовой фикстуре: me, registration GET/PATCH, csrf, complete, specializations, каталог, поиск, услуга, quote и исполнитель. Фикстура не проверяет криптографию Telegram и Django permissions; её результаты не выдаются за тесты Backend.

## Какие функции готовы только на уровне кода
Настоящий Mini App login/logout, CSRF Django и HttpOnly session-cookie, восстановление из PostgreSQL, avatar upload/delete/read, поведение серверной валидации и гонок не проверены end-to-end. 12 Node-тестов используют подмену fetch и проверяют контракт, ошибки, отмену, multipart, CSRF rotation и отсутствие автоматических повторов. Браузер проверил переходы, reload шага, skip+complete, каталог/поиск/404/quote на HTTP-фикстуре.

## Какие API отсутствуют
Регистрационные контракты теперь есть. Справочник специализаций по договорённости пуст до наполнения владельцем. Публичные категории, рейтинги/отзывы/статистика, изображения услуг, чаты, уведомления, серверное избранное и платежи не реализованы по актуальному контракту. Orders API существует, но эта публикация его не подключает. Новые регистрационные поля не расширяют публичный performer автоматически.

## Обнаруженные несовместимости
Next по умолчанию выдавал 308 без завершающего слеша API; исправлено skipTrailingSlashRedirect и Django-совместимым rewrite. Внутренний host пагинации преобразуется только в путь того же документированного ресурса; cookie не отправляются на адрес из ответа. Avatar blob/Telegram photo URL не записывается как серверный avatar_url. /auth/me/ не содержит статус регистрации: используется отдельный GET registration.
Локальный REGISTRATION_API сотрудника совпадает с опубликованным. Старые замечания FRONTEND_ISSUES относятся к прежнему main, а не подтверждают текущее состояние интеграции.

## Вопросы Backend-разработчику
1. Запустить актуальный Django/PostgreSQL и подтвердить HTTPS staging для совместной проверки. Какой общий Host/Origin должен быть в ALLOWED_HOSTS/CSRF_TRUSTED_ORIGINS? Серверные настройки Frontend не менял.
2. Проверить настоящий raw initData, ротацию CSRF, cookie во всех целевых Telegram-клиентах; текущий основной сайт и будущий Mini App требуют отдельных проверок.
3. Проверить multipart и приватный аватар через proxy, ограничения размера/пикселей и удаление.
4. Наполнить утверждённые специализации; подтвердить этап применения performer_ready к публикации услуг.
5. Согласовать OIDC callback redirect: сейчас JSON, браузерный вход не подключался к навигации регистрации.
6. Предоставить будущие контракты категорий/публичных полей/рейтинга, если эти элементы нужны в live UI.

## Backend commit, использованный для сверки
`fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4`.

## Frontend commit
Код интеграции: [`7a50ea4`](https://github.com/lex44lh/Studly/commit/7a50ea4441c638819242e1252fc285e615a1f2e3). Результат push подтверждён удалённым ref. Завершающий docs-коммит содержит этот статус и Git-отчёт, без изменений кода.

## Ссылки GitHub
- [Frontend](https://github.com/lex44lh/Studly/tree/codex/frontend-registration)
- [API contract](https://github.com/lex44lh/Studly/blob/fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4/API_CONTRACT.md)
- [Registration](https://github.com/lex44lh/Studly/blob/fd9011e5b557376c1bfe5a6f9e4379ca65e7eda4/REGISTRATION_API.md)
- [Подробный отчёт](./2026-10-16_20-43_integration-publish.md)
- [Инструкция подключения](https://github.com/lex44lh/Studly/blob/codex/frontend-registration/apps/web/INTEGRATION.md)

## Следующие шаги
Совместный прогон с Django и настоящим Telegram; после успешного полного сценария отдельно открыть production-регистрацию. Затем интегрировать создание услуг и серверные заказы по отдельным этапам. Не добавлять платежные успехи без реального API.
