# F1/F2/F3 — доказательства и воспроизведение

23.10.2026 Europe/Moscow. Основной новый browser origin — 127.0.0.1:3114, новый только тестовый профиль;3112 — ранее созданный авторский Demo snapshot, просмотрен без mutation.3001 не затронут.

- [Browser результаты F1/F2/F3](browser-results.json), [default Demo gates](browser-gates.json).
- [Прежний заказ/чат/портфолио](preserved-demo-content.json).
- [Source delta](source-changes.md), [hashes](f123-source-delta.json), [проверки границ](verification.json).
- [Все220 CJS tests](tests.log), [8 TS tests](registration-tests.log), [TypeScript](typescript.log), [ESLint](eslint.log).
- [Demo QA build](demo-qa-build.log), [default Demo build](demo-build.log), [Live build](live-build.log).
- [Live gates](production-live-gates.json), [Demo gates](production-demo-gates.json).
- [F1 red](f1-red.log): frozen AccountWorkspace bytes точно совпали с SHA прошлого manifest; загружены в тест только через временный fs loader, product source не откатывался. [Исходные bytes](f1-frozen-original.tsx.txt), [loader](f1-red-loader.cjs.txt).
- [F2 red](f2-red.log), [F2 adapter green](f2-adapter-green.log), [red отсутствующей recovery-кнопки](f2-remove-button-red.log);[F3 red](f3-red.log),[F3 green](f3-green.log).

## Браузер F1

В editable Demo-профиле: изменить имя→выбрать PNG/JPEG/WebP→сохранить имя→reload. Повторить с «Удалить аватар». Для настоящего conflict: изменить имя A, сохранить собственный аватар, затем во второй вкладке B сохранить другое имя и попытаться сохранить A. Должен остаться canonical B и локальный input A с conflict.

## Детерминированный browser F2

[Native lock controller](avatar-lock-controller.html.txt) — только QA, не часть поставляемого public. Для повторения временно сохранить как public/studly-avatar-qa.html, собрать явный Demo QA с admin flag и поднять на3114. Начинать с отдельного тестового профиля; открыть roles/profile A и profile B. После проверки удалить только этот временный HTML и повторить финальную сборку. Никаких clear/delete/migrate операций с пользовательской БД контроллер не содержит.

1. Открыть controller третьей вкладкой на том же origin; «Hold state and assets».
2. В B выбрать локальный PNG. Его настоящий Provider writer ждёт lock первым.
3. В A отредактировать город; его writer ждёт вторым.
4. Release: B commit → stale A conflict. A сохраняет input и предлагает «Загрузить актуальный черновик».
5. В controller «Hold assets only», затем в A «Загрузить актуальный черновик». Реальный getAsset остаётся pending. Форма показывает loading, поля и Next отсутствуют.
6. Release: avatar preview восстановлен. Нажать Next без нового редактирования; reload и завершение регистрации сохраняют исходный avatarId. Native snapshot перед/после содержит одинаковую reference.

Контроллер только держит/освобождает native transactions и читает state; app callbacks не подменялись. Failed getAsset и программные dispatch/Next до resolve проверены actual component tests; отдельный browser I/O-failure не заявляется.

## Browser F3 и пределы

В QA admin users открыть карточку при удержанном assets read; закрыть её до release, затем разрешить чтение и открыть снова. Повторено3 раза, новая карточка показывает корректный Blob image. All-created/all-revoked доказаны пятью actual effect tests, не browser heap counters.

## Скриншоты

- [f1-remove-name-reload.jpg](f1-remove-name-reload.jpg)
- [f1-true-conflict-retained-input.jpg](f1-true-conflict-retained-input.jpg)
- [f1-upload-name-reload.jpg](f1-upload-name-reload.jpg)
- [f2-after-reload.jpg](f2-after-reload.jpg)
- [f2-retry-loading.jpg](f2-retry-loading.jpg)
- [f3-admin-reopened-avatar.jpg](f3-admin-reopened-avatar.jpg)
- [production-demo-gate.jpg](production-demo-gate.jpg)
- [profile-390-dark.jpg](profile-390-dark.jpg)

Финальная сверка выявила недоступность обещанного удаления при failed preview. В error block добавлена отдельная кнопка «Удалить недоступный аватар». Существующий F2 test усилен: вызывает реальный отрисованный onClick и подтверждает явный remove intent, очистку reference и сохранность введённого текста. До кнопки test падал; после — PASS. Failed read по-прежнему проверен компонентно, не отдельным browser I/O-failure.

После последнего дополнения error-кнопки повторены все220 CJS+8 TS tests, TypeScript, ESLint и финальные production Live/default Demo builds. Browser screenshots/native-delay сценарии сняты до этой последней recovery-кнопки; её failed-read onClick проверен компонентно. Финальные static gates проверены повторно. QA admin-enabled build/log относится к браузерному этапу до добавления кнопки; отдельная повторная QA-сборка не запускалась.
