# STUDLY 2.0 — остаточный L2/P2: связанные черновики профиля и портфолио

Начало: **28.10.2026 11:08:19 Europe/Moscow**. Окончание реализации и браузерных проверок: **28.10.2026 11:28:00 Europe/Moscow**, по системным часам. Git/отчётные gates выполняются после этих проверок, их timestamps сохраняются в evidence. Рабочая папка `/Users/alekspih/Projects/studly-integration`, ветка `codex/frontend-api-integration`, порт 3002.

База — опубликованный **339f2748a54d4afc5adab71dfb9c878c5dc34a6d**, REJECTED повторной приёмкой из-за одного клиентского L2/P2. PO разрешил исправление, проверки, кодовый/отчётный commits и обычный push только этой ветки. Начальное дерево чистое. Перенос Redesign и интеграция с нуля не повторялись.

## Причина и решение

Односторонний dirty guard запрещал portfolio-команды во время редактирования профиля, но не связывал уже заполненные формы с подтверждёнными собственными изменениями общей revision. Новая работа могла удерживать base=4 после собственного сохранения профиля до revision=5. Кроме того, `portfolio.data` исчезала на время reload, размонтируя `ExampleEditor` с несохранённым вводом.

Добавлен общий журнал **только подтверждённых собственных переходов revision** для текущего аккаунта. Dirty-форма сохраняет первоначальную base; перед командой она проходит непрерывную цепочку собственных переходов. Чужой разрыв не заполняется. Revision произвольного GET не присваивается черновику.

Для PATCH профиля сохраняется baseline регистрации, соответствующий исходной base. Существующий `registrationRevisionAfterSave` вычисляет точный собственный результат (+0/+1) по неизменному baseline и canonical response. Дополнительный GET moderation может лишь подтвердить ожидаемые actor/revision. Для portfolio add/edit/delete и submit применяется тот же принцип с опубликованной семантикой соответствующей операции. No-op не создаёт ложного +1. Expected actor берётся из исходного owner snapshot, а не из ответа mutation.

Если операция принята, но последующий GET ошибочен, уже показывает чужое изменение или другого actor, собственный переход не записывается. `OwnRevisionUnconfirmedError` переводит существующий writer в unknown/frozen состояние: ввод и первоначальный payload/key остаются, новые действия приостановлены. Profile PATCH остаётся non-replayable; versioned portfolio retry сохраняет исходный ключ. Обычный внешний CAS 409 до успешного ACK остаётся конфликтом; CAS/permissions/CSRF не ослаблялись.

Страницы портфолио сохраняются на время загрузки/ошибки. Dirty existing editors закреплены по ID, включая случай исчезновения строки при внешнем изменении. Они не размонтируются при собственном refresh. Новая форма и настоящий File input также сохраняются. Смена режима кабинета, аватар и пагинация существующих dirty-редакторов ограничены до save/cancel с объяснением; отключение performer при dirty-портфолио отклоняется до PATCH, чтобы собственное сохранение не уничтожило черновик. Явные discard/cancel сохраняют предупреждающие подписи. Это координация UI, не новая серверная бизнес-логика.

## Контракт и файлы

Безопасный fetch подтвердил Backend **8999703fe60ef6714595614413faddc5a9308d44**. Чтение выполнялось через Git objects; Django не менялся и не запускался. Основание: [API_CONTRACT.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/API_CONTRACT.md), [REGISTRATION_API.md](https://github.com/lex44lh/Studly/blob/8999703fe60ef6714595614413faddc5a9308d44/REGISTRATION_API.md), `accounts/registration.py:66–107`, `accounts/moderation.py:8–26`, `accounts/portfolio_views.py:93–155`. Receipt replay возвращает исходный response; он не принимается за гарантированное текущее состояние.

| Путь в apps/web | Изменение |
|---|---|
| `src/features/live-account/revisions.ts:6`, `:23` | Новый own-transition journal и проверка строго ожидаемой собственной редакции |
| `src/features/live-account/LiveAccountWorkspace.tsx:32`, `:48`, `:73` | Неизменяемый profile baseline, разрешение own-chain, подтверждение перед очисткой формы |
| Тот же файл `:133`, `:161`, `:177`, `:194` | Existing edit/new work сохраняют base и ввод; страницы и dirty-editor IDs удерживаются при reload |
| Тот же файл `:66`, `:85`, `:228` | Защита от удаления собственных черновиков сменой роли/режима/аватара; общий journal на account lifetime |
| `src/features/live-account/useAccountWriter.ts:6` | Понятное сообщение для принятой, но пока не согласованной операции; прежняя unknown/retry семантика сохранена |
| `tests/live-account-corrections.test.cjs` | 28 correction cases, включая оба порядка, existing editor, sibling drafts, no-op, foreign gap и post-ACK error |
| `tests/live-account-revision.test.cjs` | 5 новых own-chain controls |
| `tests/live-account.test.cjs` | Минимальная адаптация существующего profile fixture к подтверждающему GET, без удаления проверок |

Итого **6 Frontend-путей**: два изменённых и один новый исходник; два изменённых и один новый тест. Общие API DTO/клиент, авторизация, контракты, конфигурации/dependencies, CSS/Campus и Demo не менялись. Новых endpoints/Next API routes нет. Используются прежние GET account/moderation/portfolio, PATCH registration, portfolio POST/PATCH/DELETE и moderation POST.

## Проверки

Полные журналы, metadata с command/exit/start/finish/env и screenshots находятся в [implementation/2026-10-28-l2](implementation/2026-10-28-l2/). [verification-summary.json](implementation/2026-10-28-l2/verification-summary.json) связывает evidence хешами; [publication-gate.json](implementation/2026-10-28-l2/publication-gate.json) содержит итоговые scope/diff/secret/preservation checks.

| Проверка | Результат |
|---|---|
| A: имя → save → новая работа | **PASS**: profile 4→5, add отправляет 5, ложного 409 нет |
| Б: заранее заполненное портфолио → имя/save → прежняя работа | **PASS**: title/URL не потеряны, base 4 проходит только собственный переход до 5, add отправляет 5 |
| Dirty existing work → profile save → edit save | **PASS**, DOM editor/input сохраняется во время reload; edit использует подтверждённую собственную revision |
| Соседние portfolio drafts | **PASS**, сохранение одной работы позволяет другой пройти собственный переход, не теряя ввод |
| Настоящий внешний CAS-control клиента | **PASS**, вторая реальная вкладка меняет shared revision; обе старые формы отправляют прежнюю base и получают 409, ввод остаётся. Это настоящий внешний конфликт в synthetic модели, не PostgreSQL E2E |
| Внешняя revision после собственного ACK до проверочного GET | **PASS**, чужая 6 не присваивается; дальнейшие записи заморожены, оба черновика сохранены |
| API 400/503 | **PASS**, ввод сохранён; после after-commit 503 повтор использует тот же key/payload и не создаёт дубль |
| File, reload, account switch | **PASS**, выбранный File/байты multipart сохраняются через внутренний refresh; browser reload восстанавливает подтверждённые серверные данные; другой аккаунт не получает прежний draft |
| Целевой L2 browser | **14/14 PASS**, 114 assertions, 435 synthetic API requests, zero page/fixture/schema errors; `browser-l2-results.json` |
| Сохранность L1/L3/C1 и клиентских L4 guards | **11/11 browser PASS**, 62 assertions; `browser-corrections-results.json` |
| Полный CJS suite | **393/393 PASS**, `tests.log` |
| Отдельный TS registration suite | **8/8 PASS**, свежая компиляция; `registration-tests.log` |
| Итого distinct automated tests | **401 PASS**; targeted repeats не прибавляются повторно; +23 к прежним 378 |
| TypeScript | **PASS**, `typescript.log` |
| ESLint | **PASS**, 0 errors, 2 прежних no-img-element warnings в unchanged create-service |
| Три production builds | **PASS**: Demo/admin disabled, Demo/admin enabled, Live/admin enabled; `build-demo`, `build-demo-admin`, `build-live` |
| Demo/Campus/F1/F2/F3 | **184+48=232 route/viewport/theme combinations PASS**, UI registration/avatar/order/chat/admin-avatar persistence; zero API/page/hydration errors |
| Общая Live synthetic regression | **69 UI checks**, 627 assertions, 506 fixture requests PASS; production gates, permissions/UI states и poisoned Demo isolation |
| Git diff/cached diff, сохранность, credential patterns | **PASS**: source staged diff/индекс, поиск credential patterns, preservation; окончательный docs staged gate выполняется перед push |
| Django/PostgreSQL/Telegram/настоящие CSRF/permissions/storage | **Не запускалась**; отсутствует подготовленная изолированная среда, вне этого Frontend-исправления |

Новые browser fixtures расширяют предыдущий pinned-contract runner только недостающими portfolio PATCH/DELETE/multipart/error cases, сохраняют receipt-before-CAS semantics и валидируют опубликованные request/response schemas. Корректность реального multipart validation/normalization на Django этим не утверждается. В этом этапе не было проваленных обязательных проверок продукта; первоначальный scoped ESLint был вызван из корня без workspace config, затем корректно выполнен из apps/web, полный lint PASS. Проверки не маскировались изменением ожиданий продукта.

## Manifest и сохранность

Новый [source manifest](implementation/2026-10-28-l2/source-manifest.json) содержит **173 файла apps/web**, SHA-256/modes/размеры, rejected base и Backend reference. Generated .next/node_modules/env исключены. Sources заморожены для окончательных проверок и повторно сверяются с кодовым commit перед публикацией.

**Manifest SHA-256: `7e0ca72a1f3bdbebfa9ec5e1639b5918af26905a660cc7e6aa8f75e01dfda546`.**

Accepted Redesign manifest остаётся `ef7afc71711a6341238c0cab3e99ccbe4ebe2187012e8f516532cfb204022e65`. Все **629** прежних отчётных артефактов, Campus/Demo/F1/F2/F3, L1/L3/C1 и клиентский L4 сохраняются; прежние утверждения/документы независимой приёмки не переписываются. Нет Backend/config/dependency/env изменений, новых миграций, production-данных, секретов или настоящих initData/cookies в evidence. Все имена/ID/файлы в сценариях synthetic.

## Границы и Git

Исправление относится к координации client drafts и к CAS опубликованного API. Журнал живёт только в текущем account lifetime; он не заменяет серверный CAS, не соединяет чужие revision и не хранит секреты. Удержание черновиков проверено при внутренних refresh/loading/error. Reload-тест подтверждает восстановление уже сохранённых данных; сохранение незаписанного File после закрытия браузера не заявляется. При смене identity действует прежнее явное удаление старого private context.

Серверный L4 guard, Django/PostgreSQL и recovery прежних incomplete аккаунтов не решались. [Предыдущий Backend handoff](2026-10-27_12-33_backend-identity-recovery-handoff.md) сохранён без изменений. Synthetic browser tests не являются настоящим Django E2E.

Разрешена только публикация нового кандидата в [codex/frontend-api-integration](https://github.com/lex44lh/Studly/tree/codex/frontend-api-integration). Кодовый commit: **b960e054c34bb9bd88540025e7409881b48dc122** — `fix(integration): coordinate profile and portfolio draft revisions` (6 путей). Отчётный commit создаётся после evidence/staged gate; финальные SHA/local=remote/чистота сообщаются PO после обычного push без рекурсивных post-push commits. Merge/rebase/reset/stash/force/deployment не выполнялись; соседние worktrees и Backend не менялись. Собственные frontend/Chrome процессы на 3002 после проверки остановлены.

Кандидат предназначен для **целевой независимой переприёмки L2**, включая обе последовательности и внешний CAS. Production/Django-ready не заявляется.
