# Галерея и результаты сквозной проверки STUDLY 2.0

23.10.2026, Europe/Moscow. Изолированная production Demo QA-сборка на 127.0.0.1:3112; данные созданы только для тестирования, не являются аккаунтами и платежами STUDLY. Основной сервер3001 и старые пользовательские записи не изменялись.

- [Матрица всех22 исходных маршрутов + admin:184 комбинации](responsive-matrix.json):320/390/768/1440 × light/dark,0 overflow/errors, стабильный main.
- [12 административных разделов](admin-sections.json).
- [Native IndexedDB:8 проверок](native-idb-result.json): реальная browser IndexedDB, реальные скомпилированные domain/repository, только имя базы заменено на новый случайный QA namespace.
- [Исходник изолированного native harness](native-qa.html.txt); HTML убран из public после проверки.
- [Keyboard skip/error/reset](error-focus-result.json), [временный trigger](error-qa.tsx.txt), удалён из исходников перед финальными сборками.
- [Source delta этапа](source-changes.md), [машинные hashes](source-delta.json).
- [Tests](tests.log) и [8 TS registration tests](registration-tests.log), [ESLint](eslint.log).
- [Live build](production-live-build.log) / [его закрытые gates](production-live-gates.json). Live сервер/Django не запускались.
- [Default Demo build](production-demo-default-build.log) / [gates](production-demo-gates.json).
- [QA Demo build с явным admin flag](production-demo-qa-build.log), временный error route только в QA-артефакте, отсутствует в финальной сборке.

## Основные экраны

![Кабинет исполнителя,390dark](profile-390-dark.jpg)

![Чат,390dark](chat-390-dark.jpg)

![Рабочее место модератора,1440light](admin-1440-light.jpg)

## Все снимки

Фиксированная нижняя навигация в full-page снимке закреплена в пределах исходного viewport; длинный снимок не является единым экраном телефона. Фокусировка поля чата проверена отдельно: поле прокручивается выше навигации.

- [admin-1440-dark.jpg](admin-1440-dark.jpg)
- [admin-1440-light.jpg](admin-1440-light.jpg)
- [admin-320-dark.jpg](admin-320-dark.jpg)
- [admin-320-light.jpg](admin-320-light.jpg)
- [admin-390-dark.jpg](admin-390-dark.jpg)
- [admin-390-light.jpg](admin-390-light.jpg)
- [admin-768-dark.jpg](admin-768-dark.jpg)
- [admin-768-light.jpg](admin-768-light.jpg)
- [admin-users-1440-dark.jpg](admin-users-1440-dark.jpg)
- [chat-1440-dark.jpg](chat-1440-dark.jpg)
- [chat-1440-light.jpg](chat-1440-light.jpg)
- [chat-320-dark.jpg](chat-320-dark.jpg)
- [chat-320-light.jpg](chat-320-light.jpg)
- [chat-390-dark.jpg](chat-390-dark.jpg)
- [chat-390-light.jpg](chat-390-light.jpg)
- [chat-768-dark.jpg](chat-768-dark.jpg)
- [chat-768-light.jpg](chat-768-light.jpg)
- [chat-desktop-light.jpg](chat-desktop-light.jpg)
- [create-1440-dark.jpg](create-1440-dark.jpg)
- [create-1440-light.jpg](create-1440-light.jpg)
- [create-320-dark.jpg](create-320-dark.jpg)
- [create-320-light.jpg](create-320-light.jpg)
- [create-390-dark.jpg](create-390-dark.jpg)
- [create-390-light.jpg](create-390-light.jpg)
- [create-768-dark.jpg](create-768-dark.jpg)
- [create-768-light.jpg](create-768-light.jpg)
- [error-skip-focus.jpg](error-skip-focus.jpg)
- [order-completed-390-light.jpg](order-completed-390-light.jpg)
- [profile-1440-dark.jpg](profile-1440-dark.jpg)
- [profile-1440-light.jpg](profile-1440-light.jpg)
- [profile-320-dark.jpg](profile-320-dark.jpg)
- [profile-320-light.jpg](profile-320-light.jpg)
- [profile-390-dark.jpg](profile-390-dark.jpg)
- [profile-390-light.jpg](profile-390-light.jpg)
- [profile-768-dark.jpg](profile-768-dark.jpg)
- [profile-768-light.jpg](profile-768-light.jpg)
- [profile-cross-tab-conflict.jpg](profile-cross-tab-conflict.jpg)
- [registration-cross-tab.jpg](registration-cross-tab.jpg)
- [search-1440-dark.jpg](search-1440-dark.jpg)
- [search-1440-light.jpg](search-1440-light.jpg)
- [search-320-dark.jpg](search-320-dark.jpg)
- [search-320-light.jpg](search-320-light.jpg)
- [search-390-dark.jpg](search-390-dark.jpg)
- [search-390-light.jpg](search-390-light.jpg)
- [search-768-dark.jpg](search-768-dark.jpg)
- [search-768-light.jpg](search-768-light.jpg)
- [service-1440-dark.jpg](service-1440-dark.jpg)
- [service-1440-light.jpg](service-1440-light.jpg)
- [service-320-dark.jpg](service-320-dark.jpg)
- [service-320-light.jpg](service-320-light.jpg)
- [service-390-dark.jpg](service-390-dark.jpg)
- [service-390-light.jpg](service-390-light.jpg)
- [service-768-dark.jpg](service-768-dark.jpg)
- [service-768-light.jpg](service-768-light.jpg)
- [service-partial-390-dark.jpg](service-partial-390-dark.jpg)

- [Production Demo admin закрыт по умолчанию](production-demo-admin-closed.jpg)
- [Protected boundaries](protected-boundaries.json)
