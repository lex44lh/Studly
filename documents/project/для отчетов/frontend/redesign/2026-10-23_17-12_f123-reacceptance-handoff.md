# STUDLY 2.0 — готовый handoff F1/F2/F3 для повторной приёмки

Подготовлено:23.10.2026 17:33:41 Europe/Moscow. Для передачи PO в «Основная разработка Frontend»; автоматически в другой чат не отправлено.

Исправлен frozen candidate `6d7c86a330b1cb417809eeae941f9f0c4995440ff659d90d45e46de121bc2cce`, исходно REJECTED по F1/P2,F2/P2,F3/P3. Worktree `/Users/alekspih/Projects/studly-redesign`, branch `codex/frontend-redesign-campus`, HEAD `1888b9194827d00317fb9cf9d27218ef702999cb`, staged пуст.

- F1: avatar action использует viewed text base revision; exact committed revision возвращается Provider и условно продвигает тот же dirty base. Настоящий stale write по-прежнему отклоняется, input не теряется.
- F2: preview не определяет удаление avatarId; explicit remove intent, synchronous retry loading/ref guards, delayed/failed read handling, same-ID preview, queue generation/rejected-chain recovery и recheck после await. При failed preview есть явная recovery-кнопка удаления с тестом реального onClick.
- F3: live guard до createObjectURL, late reads не создают URL после cleanup.

Scope:4 feature source files +1 изменённый adapter test +3 новых tests; model/repository/API/Auth/DTO/CSRF/SDK/Django/Live деньги/порядок/gates/Campus CSS/package/lock/config неизменны.

Авторские проверки:228/228 tests (220+8), TS PASS, ESLint0errors/2прежних warnings, production Demo QA/default и Live builds PASS. Реальные browser F1 upload/remove+name+reload, external conflict+retained input; F2 две регистрационные вкладки и native IDB delay через отдельный временный lock controller→retry→Next→reload с прежним avatarId; F3 close-before-read/reopen. Прежние approved profile/portfolio/service/order snapshot/review/chat сохранены. Default Demo admin закрыт; Live registration/admin gates закрыты даже при flag. Настоящий Django не запускался.

Просьба проверить конкретный новый manifest и закрытие замечаний, не присваивать ACCEPTED по авторскому PASS. Полный22-route аудит не повторялся, потому что это узкий diff; прежние доказательства не выданы за новую браузерную проверку. New failed-read test — component, new URL allocation counts — actual effect, не browser heap.

Материалы:

- [Отчёт закрытия](2026-10-23_17-12_f123-closure.md).
- [Новый полный manifest](2026-10-23_17-12_f123-candidate.manifest.json); отдельный SHA будет указан в финальной передаче.
- [Новый source delta/доказательства](implementation/2026-10-23-f123/README.md).
- [Обновлённый основной completion report](2026-10-23_10-42_frontend-scenarios-completion.md).

Запреты сохранены: никакого commit/push/merge/rebase/reset/stash/git add/переноса в Integration. Исправления только в Redesign; временные test HTML удалены до final builds, QA processes остановлены,3001 сохранён. До повторной независимой приёмки и отдельного решения PO перенос не начинать.

Кандидат зафиксирован 2026-10-23T17:39:13+03:00 Europe/Moscow: 40 modified tracked +310 untracked, staged0/deleted0. После финальной error-кнопки повторены228 tests/TS/ESLint/production Live+default Demo builds; browser I/O-failure не заявляется.
