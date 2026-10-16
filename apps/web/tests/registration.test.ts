import test from "node:test";
import assert from "node:assert/strict";
import { createDraftState, draftReducer, prerequisitePath, filterSpecializations, toggleSpecialization } from "../src/lib/registration/draft";
import { getTelegramProfilePrefill } from "../src/lib/telegram/profile-prefill";

test("one or both roles can be toggled without duplicates", () => {
  let state = createDraftState();
  state = draftReducer(state, { type: "role", role: "customer" });
  state = draftReducer(state, { type: "role", role: "performer" });
  assert.deepEqual(state.draft.roles, ["customer", "performer"]);
  state = draftReducer(state, { type: "role", role: "customer" });
  assert.deepEqual(state.draft.roles, ["performer"]);
});

test("editing roles preserves profile and performer drafts", () => {
  let state = draftReducer(createDraftState(), { type: "profile", patch: { displayName: "Черновик", city: "Тест" } });
  state = draftReducer(state, { type: "performer", patch: { description: "Описание" } });
  state = draftReducer(state, { type: "role", role: "performer" });
  state = draftReducer(state, { type: "role", role: "performer" });
  assert.equal(state.draft.profile.city, "Тест");
  assert.equal(state.draft.performer.description, "Описание");
});

test("late Telegram hints cannot overwrite a manually edited or cleared name/avatar", () => {
  let state = draftReducer(createDraftState(), { type: "prefill", data: { displayName: "Подсказка", avatarUrl: "https://example.invalid/a.jpg" } });
  assert.equal(state.draft.profile.displayName, "Подсказка");
  state = draftReducer(state, { type: "profile", patch: { displayName: "", avatarUrl: "", avatarFile: null } });
  state = draftReducer(state, { type: "prefill", data: { displayName: "Поздняя подсказка", avatarUrl: "https://example.invalid/b.jpg" } });
  assert.equal(state.draft.profile.displayName, "");
  assert.equal(state.draft.profile.avatarUrl, "");
});

test("direct entry requires roles, a non-whitespace name and performer role", () => {
  const state = createDraftState();
  assert.equal(prerequisitePath(state.draft, "profile"), "/register/roles");
  state.draft.roles = ["performer"];
  state.draft.profile.displayName = "   ";
  assert.equal(prerequisitePath(state.draft, "performer"), "/register/profile");
  state.draft.profile.displayName = "Черновик";
  assert.equal(prerequisitePath(state.draft, "performer"), null);
  state.draft.roles = ["customer"];
  assert.equal(prerequisitePath(state.draft, "performer"), "/register/profile");
});

test("specialization search ignores case and whitespace; supports empty and no-match queries", () => {
  const options = [{ id: "a", title: "Тестовая область А" }, { id: "b", title: "Другая область" }];
  assert.deepEqual(filterSpecializations(options, "  ТЕСТОВАЯ  "), [options[0]]);
  assert.deepEqual(filterSpecializations(options, ""), options);
  assert.deepEqual(filterSpecializations(options, "нет совпадений"), []);
});

test("selection has no count limit; stable IDs remove duplicates", () => {
  const options = Array.from({ length: 200 }, (_, id) => ({ id: String(id), title: `Тест ${id}` }));
  const selected = options.reduce((items, option) => toggleSpecialization(items, option), [] as typeof options);
  assert.equal(selected.length, 200);
  assert.equal(toggleSpecialization(selected, { id: "0", title: "Другое название" }).length, 199);
});

test("a fresh context contains no account data from a previous session", () => {
  const first = createDraftState();
  first.draft.roles.push("customer");
  first.draft.profile.displayName = "Черновик";
  assert.equal(createDraftState().draft.profile.displayName, "");
  assert.deepEqual(createDraftState().draft.roles, []);
});

test("Telegram hints handle absent SDK, malformed data and unsafe avatar URLs", () => {
  assert.deepEqual(getTelegramProfilePrefill(), {});
  const globals = globalThis as unknown as { window?: unknown };
  try {
    globals.window = { Telegram: { WebApp: { initDataUnsafe: { user: { first_name: "Тест", last_name: 42, photo_url: "javascript:void(0)" } } } } };
    assert.deepEqual(getTelegramProfilePrefill(), { displayName: "Тест", avatarUrl: undefined });
    globals.window = { Telegram: { WebApp: { initDataUnsafe: { user: { first_name: "Тест", photo_url: "https://example.invalid/avatar.jpg" } } } } };
    assert.equal(getTelegramProfilePrefill().avatarUrl, "https://example.invalid/avatar.jpg");
  } finally { delete globals.window; }
});
