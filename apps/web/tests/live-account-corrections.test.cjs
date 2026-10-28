/* eslint-disable @typescript-eslint/no-require-imports -- Execute the real account coordinator and profile form with isolated React hooks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const source = path.resolve(__dirname, '../src/features/live-account/LiveAccountWorkspace.tsx');
function sourceModule(file, override = () => undefined) {
  const fixture = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => override(name) ?? (name === './client' ? { ApiError } : require(name)), fixture, fixture.exports);
  return fixture.exports;
}
const drain = () => new Promise(resolve => setImmediate(resolve));
const uuid = '00000000-0000-4000-8000-000000000001';
class ApiError extends Error { constructor(status, payload) { super('Fixture API error'); this.status = status; this.payload = payload; } }
const registrationApi = sourceModule(path.resolve(__dirname, '../src/lib/api/registration.ts'));
function hooksRuntime() {
  const slots = [], effects = [], cleanup = []; let cursor = 0;
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useEffect(effect, dependencies) { const index = cursor++; const previous = slots[index]; if (!previous || !dependencies || dependencies.some((value, at) => value !== previous.value?.[at])) { slots[index] = { value: dependencies }; effects.push(() => { cleanup[index]?.(); cleanup[index] = effect(); }); } },
  };
  return { hooks, render(work) { cursor = 0; const result = work(); while (effects.length) effects.shift()(); return result; } };
}
function initialSnapshot() {
  return { account: { id: 7, capabilities: { customer: true, performer: true, create_order: true, create_service: true, django_admin: false, moderate_services: false, moderate_performers: false },
    registration: { roles: ['customer', 'performer'], profile: { display_name: 'Before', university: '', city: '', about: '', avatar_url: null },
      performer: { description: 'Server description', study_year: '', portfolio: '', specializations: [] },
      progress: { current_step: 'performer', performer_skipped: false, updated_at: null },
      status: { is_complete: true, completed_at: '2026-10-26T00:00:00Z', missing_fields: [], performer_ready: false, performer_missing_fields: [] } } },
    moderation: { user_id: 7, revision: 4, status: 'draft', reason: '', submitted_at: null, ready_to_submit: true, missing_fields: [], approved: false } };
}
function find(tree, predicate, required = true) {
  const visit = node => { if (!node || typeof node !== 'object') return undefined; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props?.children)) { const match = visit(child); if (match) return match; } };
  const result = visit(tree); if (required) assert.ok(result, 'Expected actual account control'); return result;
}
function textContent(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? React.Children.toArray(tree.props?.children).map(textContent).join(' ') : '';
}
function harness() {
  const accountHooks = hooksRuntime(), editorHooks = hooksRuntime(), portfolioHooks = hooksRuntime(), exampleHooks = new Map(); let currentHooks = accountHooks;
  const state = { snapshot: initialSnapshot(), patches: [], related: [], examples: [], reload: () => {}, tree: null, editor: null,
    saveError: null, exampleError: null, afterSaveAck: null, afterExampleAck: null, moderationReads: 0 };
  const page = () => ({ count: state.examples.length, results: structuredClone(state.examples), next: null, previous: null });
  const commands = { blocked: false, busy: false, uncertain: false, replayable: false, error: '', notice: '',
    async execute(work) {
      if (commands.blocked) return false;
      try { commands.error = ''; await work(new AbortController().signal); state.reload(); return true; }
      catch (error) { commands.error = error.status === 409 ? 'Данные изменились' : error.message; commands.uncertain = !(error instanceof ApiError) || error.status === 0 || error.status >= 500; commands.blocked = commands.uncertain; return false; }
    },
    refresh() { commands.error = ''; commands.blocked = false; commands.uncertain = false; state.reload(); }, retry() {} };
  const accountClient = { async snapshot() { return structuredClone(state.snapshot); },
    async portfolio() { return page(); },
    async moderation() { state.moderationReads++; return structuredClone(state.snapshot.moderation); },
    async submit(input) { state.related.push({ operation: 'submit', input }); return state.snapshot.moderation; },
    async addExample(input, version) {
      state.related.push({ operation: 'add', input: structuredClone(input), version: structuredClone(version) });
      if (state.exampleError) throw state.exampleError;
      if (version.revision !== state.snapshot.moderation.revision) throw new ApiError(409, null);
      const example = { id: state.examples.some(value => value.id === uuid) ? '00000000-0000-4000-8000-000000000003' : uuid, title: input.title, kind: 'link', url: input.url, content_url: null, content_type: null, size: 0, created_at: '2026-10-28T00:00:00Z' };
      state.examples.push(example); state.snapshot.moderation.revision++;
      const result = { example: structuredClone(example), moderation: structuredClone(state.snapshot.moderation) };
      state.afterExampleAck?.(); return result;
    },
    async editExample(id, patch, version) {
      state.related.push({ operation: 'edit', id, patch: structuredClone(patch), version: structuredClone(version) });
      if (state.exampleError) throw state.exampleError;
      if (version.revision !== state.snapshot.moderation.revision) throw new ApiError(409, null);
      const example = state.examples.find(value => value.id === id); assert.ok(example, 'Fixture example exists');
      if (Object.entries(patch).some(([key, value]) => example[key] !== value)) state.snapshot.moderation.revision++;
      Object.assign(example, patch); const result = { example: structuredClone(example), moderation: structuredClone(state.snapshot.moderation) };
      state.afterExampleAck?.(); return result;
    },
    async deleteExample(id, version) { state.related.push({ operation: 'delete', id, version }); return { moderation: structuredClone(state.snapshot.moderation) }; } };
  const registrationClient = { async save(patch) {
    state.patches.push(structuredClone(patch));
    if (state.saveError) throw state.saveError;
    if (patch.performer_revision !== state.snapshot.moderation.revision) throw new ApiError(409, null);
    const before = structuredClone(state.snapshot.account.registration);
    if (patch.profile) Object.assign(state.snapshot.account.registration.profile, patch.profile);
    if (patch.roles) state.snapshot.account.registration.roles = [...patch.roles];
    if (patch.performer) {
      const { specialization_ids, ...fields } = patch.performer; Object.assign(state.snapshot.account.registration.performer, fields);
      if (specialization_ids) state.snapshot.account.registration.performer.specializations = specialization_ids.map(id => ({ id, title: 'Fixture specialization' }));
    }
    state.snapshot.moderation.revision = registrationApi.registrationRevisionAfterSave(before, state.snapshot.account.registration, patch.performer_revision);
    const result = structuredClone(state.snapshot.account.registration); state.afterSaveAck?.(); return result;
  } };
  const shared = { LiveAccess: ({ children }) => children, LiveState: () => null,
    useLiveResource(key, loader) {
      if (key === 'account-specializations') return { data: [{ id: uuid, title: 'Fixture specialization' }], loading: false, reload() {} };
      currentHooks.hooks.useEffect(() => { const controller = new AbortController(); void loader(controller.signal); return () => controller.abort(); }, [key]);
      return { data: key.startsWith('portfolio:') ? page() : undefined, loading: false, reload() {} };
    } };
  const moduleValue = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(source, 'utf8') + '\nexport { AccountBody, PortfolioPanel, ModerationPanel, ExampleEditor };', { fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return new Proxy(React, { get: (target, key) => currentHooks.hooks[key] ?? target[key] });
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === 'next/link' || name === 'next/image') return { __esModule: true, default: () => null };
    if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams('role=performer'), useRouter: () => ({ replace() {} }) };
    if (name === '@/context/AuthContext') return { useAuth: () => ({ state: { status: 'authenticated', user: { id: 7 } }, logout() {} }) };
    if (name === '@/components/studly/Icon') return { Icon: () => null };
    if (name === '@/features/live/shared') return shared;
    if (name === '@/lib/api/account') return { accountClient, safePortfolioUrl: value => value, portfolioContentPath: (_, value) => value };
    if (name === '@/lib/api/registration') return { ...registrationApi, registrationClient };
    if (name === './revisions') return sourceModule(path.resolve(path.dirname(source), 'revisions.ts'), dependency => dependency === '@/lib/api/account' ? { accountClient } : undefined);
    if (name === '@/lib/api/client') return { ApiError, requestKey: () => uuid };
    if (name === './useAccountWriter') return { useAccountWriter: reload => { state.reload = reload; return commands; } };
    if (name === '@/features/live-services/LiveOwnServices') return { __esModule: true, default: () => null };
    return require(name);
  }, moduleValue, moduleValue.exports);
  const components = moduleValue.exports;
  function renderAccount() { currentHooks = accountHooks; state.tree = accountHooks.render(() => components.AccountBody()); return state.tree; }
  function renderEditor() {
    renderAccount(); const entry = find(state.tree, node => node.type === components.LiveProfileEditor);
    currentHooks = editorHooks; state.editor = editorHooks.render(() => components.LiveProfileEditor(entry.props)); return state.editor;
  }
  function renderPortfolio() {
    renderAccount(); const entry = find(state.tree, node => node.type === components.PortfolioPanel);
    currentHooks = portfolioHooks; state.portfolio = portfolioHooks.render(() => components.PortfolioPanel(entry.props)); return state.portfolio;
  }
  function renderExample(id = uuid) {
    renderPortfolio(); const entry = find(state.portfolio, node => node.type === components.ExampleEditor && node.props.example.id === id);
    if (!exampleHooks.has(id)) exampleHooks.set(id, hooksRuntime());
    const runtime = exampleHooks.get(id); currentHooks = runtime; state.example = runtime.render(() => components.ExampleEditor(entry.props)); return state.example;
  }
  const input = id => find(state.editor, node => node.props?.id === id);
  function role(role) { return find(state.editor, node => node.type === 'label' && textContent(node).trim() === (role === 'customer' ? 'Заказчик' : 'Исполнитель')).props.children[0]; }
  return { state, components, accountClient, commands, renderAccount, renderEditor, renderPortfolio, renderExample,
    editPortfolio(id, value) { renderPortfolio(); find(state.portfolio, node => node.props?.id === id).props.onChange({ target: { value } }); renderPortfolio(); },
    async addPortfolio() { renderPortfolio(); await find(state.portfolio, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); renderAccount(); await drain(); renderPortfolio(); },
    openExample(id = uuid) { renderExample(id); find(state.example, node => node.type === 'button' && node.props.children === 'Изменить работу').props.onClick(); renderExample(id); },
    editExample(id, value) { find(state.example, node => node.props?.id === id).props.onChange({ target: { value } }); renderExample(); },
    async saveExample() { await find(state.example, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); renderAccount(); await drain(); renderExample(); },
    async ready() { renderAccount(); await drain(); renderEditor(); },
    input, edit(id, value) { input(id).props.onChange({ target: { value } }); renderEditor(); },
    toggleRole(value) { role(value).props.onChange(); renderEditor(); },
    async save() { await find(state.editor, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); renderAccount(); await drain(); renderEditor(); },
    async discard() { find(state.editor, node => node.type === 'button' && String(node.props.children).startsWith('Загрузить актуальные данные')).props.onClick(); renderAccount(); await drain(); renderEditor(); },
    writer() { return find(state.tree, node => node.type === components.ModerationPanel).props.writer; },
    async reread() { commands.refresh(); renderAccount(); await drain(); renderEditor(); },
  };
}

test('L2: dirty profile blocks portfolio add/edit/delete and moderation, including an already captured sibling writer', async () => {
  const h = harness(); await h.ready(); const capturedWriter = h.writer();
  h.edit('live-account-name', 'Unsaved own text'); const related = h.writer();
  assert.equal(related.blocked, true); assert.match(textContent(h.state.tree), /Сначала сохраните/);
  for (const operation of ['add', 'edit', 'delete', 'submit']) {
    const write = signal => operation === 'submit' ? h.accountClient.submit({ revision: 4 }, signal)
      : operation === 'add' ? h.accountClient.addExample({ title: 'New' }, { revision: 4 }, signal)
      : operation === 'edit' ? h.accountClient.editExample(uuid, { title: 'Edited' }, { revision: 4 }, signal)
      : h.accountClient.deleteExample(uuid, { revision: 4 }, signal);
    assert.equal(await capturedWriter.execute(write), false, `stale ${operation} command must observe current dirty scope`);
    assert.equal(await related.execute(write), false);
  }
  assert.equal(h.state.related.length, 0); assert.equal(h.state.patches.length, 0);
  assert.equal(h.input('live-account-name').props.value, 'Unsaved own text');
});
test('L2: saving text first unlocks the related command at the new canonical revision without a self-conflict', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-name', 'Saved own text'); h.renderPortfolio();
  assert.equal(find(h.state.portfolio, node => node.type === 'fieldset').props.disabled, true);
  await find(h.state.portfolio, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(h.state.related.length, 0);
  await h.save();
  assert.equal(h.state.patches[0].performer_revision, 4); assert.equal(h.state.snapshot.moderation.revision, 5);
  assert.equal(h.writer().blocked, false); assert.equal(h.input('live-account-name').props.value, 'Saved own text');
  h.renderPortfolio();
  find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.onChange({ target: { value: 'Work after profile' } }); h.renderPortfolio();
  find(h.state.portfolio, node => node.props?.id === 'live-example-url').props.onChange({ target: { value: 'https://example.invalid/work' } }); h.renderPortfolio();
  await find(h.state.portfolio, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.state.related[0].version.revision, 5); assert.equal(h.commands.error, '');
});
test('L2: explicit discard releases sibling commands and drops only the discarded profile edits', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-about', 'Discard this draft'); assert.equal(h.writer().blocked, true);
  await h.discard(); assert.equal(h.writer().blocked, false); assert.equal(h.input('live-account-about').props.value, ''); assert.equal(h.state.patches.length, 0);
  await h.writer().execute(signal => h.accountClient.submit({ revision: 4 }, signal)); assert.equal(h.state.related.length, 1);
});
test('L2: role and specialization edits also lock shared-revision siblings', async () => {
  const h = harness(); await h.ready(); h.toggleRole('customer'); assert.equal(h.writer().blocked, true); await h.discard();
  const specialization = find(h.state.editor, node => node.type === 'label' && textContent(node).trim() === 'Fixture specialization').props.children[0];
  specialization.props.onChange(); h.renderEditor(); assert.equal(h.writer().blocked, true);
});
test('L2: external CAS conflicts remain detectable and do not adopt a later revision into dirty text', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-name', 'Keep local text');
  h.state.snapshot.moderation.revision = 5; h.state.snapshot.account.registration.profile.display_name = 'External name'; await h.reread();
  await h.save(); assert.equal(h.state.patches[0].performer_revision, 4); assert.equal(h.state.snapshot.account.registration.profile.display_name, 'External name');
  assert.equal(h.input('live-account-name').props.value, 'Keep local text'); assert.equal(h.writer().blocked, true); assert.match(h.commands.error, /Данные изменились/);
});
test('L3: completed accounts reject an empty name before PATCH and keep editable state', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-name', ''); await h.save();
  assert.equal(h.state.patches.length, 0); assert.equal(h.state.snapshot.account.registration.status.is_complete, true);
  assert.equal(h.input('live-account-name').props['aria-invalid'], true); assert.match(textContent(h.state.editor), /Укажите непустое имя/);
});
test('L3: whitespace-only names are rejected before PATCH instead of losing registration completion', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-name', ' \t\n '); await h.save();
  assert.equal(h.state.patches.length, 0); assert.equal(h.state.snapshot.account.registration.profile.display_name, 'Before'); assert.equal(h.state.snapshot.account.registration.status.is_complete, true);
  assert.match(textContent(h.state.editor), /Укажите непустое имя/);
});
test('L3: removing both roles is rejected before PATCH with an accessible field error', async () => {
  const h = harness(); await h.ready(); h.toggleRole('customer'); h.toggleRole('performer'); await h.save();
  assert.equal(h.state.patches.length, 0); assert.deepEqual(h.state.snapshot.account.registration.roles, ['customer', 'performer']);
  const error = find(h.state.editor, node => node.props?.id === 'live-account-roles-error'); assert.equal(error.props.role, 'alert'); assert.match(textContent(error), /хотя бы одну роль/);
});
test('L3: correcting validation errors permits a trimmed valid name and one remaining role', async () => {
  const h = harness(); await h.ready(); h.edit('live-account-name', ' '); h.toggleRole('customer'); h.toggleRole('performer'); await h.save();
  assert.equal(h.state.patches.length, 0); h.edit('live-account-name', '  Valid restored name  '); h.toggleRole('performer'); await h.save();
  assert.deepEqual(h.state.patches[0], { performer_revision: 4, roles: ['performer'], profile: { display_name: 'Valid restored name' } });
  assert.equal(h.state.snapshot.account.registration.status.is_complete, true); assert.equal(h.input('live-account-name').props['aria-invalid'], false);
});
test('L3: an already incomplete production account still cannot mount the editor or bypass the registration gate', async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    const h = harness(); h.state.snapshot.account.registration.status.is_complete = false;
    h.renderAccount(); await drain(); h.renderAccount();
    assert.equal(find(h.state.tree, node => node.type === h.components.LiveProfileEditor, false), undefined);
    assert.match(textContent(h.state.tree), /Регистрация скоро появится/); assert.equal(h.state.patches.length, 0);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

function fillNewExample(h, title = 'Retained portfolio draft') {
  h.editPortfolio('live-example-title', title);
  h.editPortfolio('live-example-url', 'https://example.invalid/retained');
}
function existingExample() {
  return { id: uuid, title: 'Original example', kind: 'link', url: 'https://example.invalid/original', content_url: null, content_type: null, size: 0, created_at: '2026-10-28T00:00:00Z' };
}

test('L2 residual B: a prefilled new portfolio draft survives a successful own profile save and submits its proven new revision', async () => {
  const h = harness(); await h.ready(); fillNewExample(h);
  h.edit('live-account-name', 'Own profile rename'); await h.save();
  h.renderPortfolio(); assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.value, 'Retained portfolio draft');
  assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-url').props.value, 'https://example.invalid/retained');
  await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 5); assert.equal(h.state.examples.length, 1);
  assert.equal(h.state.examples[0].title, 'Retained portfolio draft'); assert.equal(h.commands.error, '');
});
test('L2 residual: a long-lived portfolio draft follows two consecutive verified own profile saves', async () => {
  const h = harness(); await h.ready(); fillNewExample(h);
  h.edit('live-account-name', 'First own rename'); await h.save();
  h.edit('live-account-about', 'Second own edit'); await h.save();
  assert.deepEqual(h.state.patches.map(patch => patch.performer_revision), [4, 5]);
  await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 6); assert.equal(h.state.snapshot.moderation.revision, 7);
});
test('L2 residual: an already-open existing portfolio editor retains draft title and URL across an own profile save', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); h.openExample();
  h.editExample(`example-title-${uuid}`, 'Unsaved existing title'); h.editExample(`example-url-${uuid}`, 'https://example.invalid/edited');
  h.edit('live-account-name', 'Name saved while example stays open'); await h.save(); h.renderExample();
  assert.equal(find(h.state.example, node => node.props?.id === `example-title-${uuid}`).props.value, 'Unsaved existing title');
  assert.equal(find(h.state.example, node => node.props?.id === `example-url-${uuid}`).props.value, 'https://example.invalid/edited');
  await h.saveExample(); assert.equal(h.state.related[0].version.revision, 5); assert.equal(h.state.examples[0].title, 'Unsaved existing title');
  assert.equal(h.state.examples[0].url, 'https://example.invalid/edited'); assert.equal(h.commands.error, '');
});
test('L2 residual: an own profile no-op uses its canonical unchanged revision rather than inventing an increment', async () => {
  const h = harness(); await h.ready(); fillNewExample(h);
  h.edit('live-account-name', 'Before'); await h.save(); assert.equal(h.state.snapshot.moderation.revision, 4);
  await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 4); assert.equal(h.commands.error, '');
});
test('L2 external control: an arbitrary newer GET cannot promote the revision of a prefilled new portfolio draft', async () => {
  const h = harness(); await h.ready(); fillNewExample(h);
  h.state.snapshot.moderation.revision = 5; h.state.snapshot.account.registration.profile.display_name = 'External writer'; await h.reread();
  await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 4); assert.equal(h.state.examples.length, 0); assert.match(h.commands.error, /Данные изменились/);
  assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.value, 'Retained portfolio draft');
});
test('L2 external control: external advancement after an own PATCH acknowledgement prevents trusting its revision transition', async () => {
  const h = harness(); await h.ready(); fillNewExample(h); h.state.afterSaveAck = () => { h.state.snapshot.moderation.revision++; };
  h.edit('live-account-name', 'Confirmed PATCH before external write'); await h.save();
  assert.equal(h.state.snapshot.moderation.revision, 6); assert.match(h.commands.error, /текущая редакция не подтверждена/); assert.equal(h.commands.uncertain, true);
  assert.equal(h.input('live-account-name').props.value, 'Confirmed PATCH before external write');
  await h.reread(); await h.discard(); await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 4); assert.equal(h.state.examples.length, 0); assert.match(h.commands.error, /Данные изменились/);
});
test('L2 external control: after a proven own 4→5 transition, a real external 5→6 change still conflicts at 5', async () => {
  const h = harness(); await h.ready(); fillNewExample(h); h.edit('live-account-name', 'Own before external'); await h.save();
  h.state.snapshot.moderation.revision = 6; await h.reread(); await h.addPortfolio();
  assert.equal(h.state.related[0].version.revision, 5); assert.equal(h.state.examples.length, 0); assert.match(h.commands.error, /Данные изменились/);
});
test('L2 external control: an existing dirty example does not adopt a newer revision from a refreshed snapshot', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); h.openExample(); h.editExample(`example-title-${uuid}`, 'Retain edit on conflict');
  h.state.snapshot.moderation.revision = 5; await h.reread(); h.renderExample(); await h.saveExample();
  assert.equal(h.state.related[0].version.revision, 4); assert.equal(h.state.examples[0].title, 'Original example');
  assert.equal(find(h.state.example, node => node.props?.id === `example-title-${uuid}`).props.value, 'Retain edit on conflict'); assert.match(h.commands.error, /Данные изменились/);
});
for (const status of [400, 503]) {
  test(`L2 API ${status}: a failed profile write keeps both drafts and never advances the sibling portfolio revision`, async () => {
    const h = harness(); await h.ready(); fillNewExample(h); h.state.saveError = new ApiError(status, null);
    h.edit('live-account-name', 'Retained name after error'); await h.save();
    assert.equal(h.state.snapshot.moderation.revision, 4); assert.equal(h.input('live-account-name').props.value, 'Retained name after error');
    h.renderPortfolio(); assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.value, 'Retained portfolio draft');
    assert.equal(h.writer().blocked, true); assert.equal(h.state.related.length, 0);
    await h.reread(); await h.discard(); h.state.saveError = null; await h.addPortfolio(); assert.equal(h.state.related[0].version.revision, 4);
  });
  test(`L2 API ${status}: a failed portfolio add keeps its fields and does not reset to a later server revision`, async () => {
    const h = harness(); await h.ready(); fillNewExample(h); h.state.exampleError = new ApiError(status, null); await h.addPortfolio();
    assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.value, 'Retained portfolio draft');
    h.state.exampleError = null; h.state.snapshot.moderation.revision = 5; await h.reread(); await h.addPortfolio();
    assert.deepEqual(h.state.related.map(value => value.version.revision), [4, 4]); assert.equal(h.state.examples.length, 0); assert.match(h.commands.error, /Данные изменились/);
  });
}
test('L2 related siblings: editing an existing example advances an already-prefilled new example only after its own verified ACK', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); fillNewExample(h); h.openExample(); h.editExample(`example-title-${uuid}`, 'Own edited existing');
  await h.saveExample(); await h.addPortfolio(); assert.deepEqual(h.state.related.map(value => value.version.revision), [4, 5]); assert.equal(h.state.examples.length, 2); assert.equal(h.commands.error, '');
});
test('L2 reload: a fresh account mount uses the canonical current revision without carrying another mount’s draft or chain', async () => {
  const first = harness(); await first.ready(); fillNewExample(first); first.edit('live-account-name', 'Own before reload'); await first.save();
  const reloaded = harness(); reloaded.state.snapshot = structuredClone(first.state.snapshot); await reloaded.ready(); reloaded.renderPortfolio();
  assert.equal(find(reloaded.state.portfolio, node => node.props?.id === 'live-example-title').props.value, '');
  fillNewExample(reloaded, 'New draft after reload'); await reloaded.addPortfolio(); assert.equal(reloaded.state.related[0].version.revision, 5); assert.equal(reloaded.commands.error, '');
});

test('L2 related siblings: adding a new example advances a separately open existing editor through the same own revision chain', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); h.openExample(); h.editExample(`example-title-${uuid}`, 'Draft survives sibling add');
  fillNewExample(h, 'New sibling example'); await h.addPortfolio(); h.renderExample();
  assert.equal(find(h.state.example, node => node.props?.id === `example-title-${uuid}`).props.value, 'Draft survives sibling add');
  await h.saveExample(); assert.deepEqual(h.state.related.map(value => value.version.revision), [4, 5]); assert.equal(h.commands.error, '');
});
test('L2 related siblings: a canonical no-op edit of an existing example leaves a prefilled add at the same valid revision', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); fillNewExample(h, 'New after no-op'); h.openExample(); await h.saveExample();
  assert.equal(h.state.snapshot.moderation.revision, 4); await h.addPortfolio(); assert.deepEqual(h.state.related.map(value => value.version.revision), [4, 4]); assert.equal(h.commands.error, '');
});
test('L2 API failure: a failed existing-example edit preserves the opened draft and never advances another dirty form', async () => {
  const h = harness(); h.state.examples.push(existingExample()); await h.ready(); fillNewExample(h); h.openExample(); h.editExample(`example-title-${uuid}`, 'Keep failed existing edit');
  h.state.exampleError = new ApiError(400, { title: ['Rejected fixture title'] }); await h.saveExample();
  assert.equal(find(h.state.example, node => node.props?.id === `example-title-${uuid}`).props.value, 'Keep failed existing edit'); assert.equal(h.state.snapshot.moderation.revision, 4);
  h.state.exampleError = null; await h.addPortfolio(); assert.deepEqual(h.state.related.map(value => value.version.revision), [4, 4]); assert.equal(h.state.examples.length, 2);
});
test('L2 account change control: a different actor in the post-write moderation read cannot confirm an own revision transition', async () => {
  const h = harness(); await h.ready(); fillNewExample(h); h.state.afterSaveAck = () => { h.state.snapshot.moderation.user_id = 8; };
  h.edit('live-account-name', 'Old actor pending profile'); await h.save();
  assert.match(h.commands.error, /текущая редакция не подтверждена/); assert.equal(h.commands.uncertain, true); assert.equal(h.input('live-account-name').props.value, 'Old actor pending profile');
  assert.equal(h.writer().blocked, true); h.renderPortfolio(); assert.equal(find(h.state.portfolio, node => node.props?.id === 'live-example-title').props.value, 'Retained portfolio draft');
});
