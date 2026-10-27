/* eslint-disable @typescript-eslint/no-require-imports -- Execute the real account coordinator and profile form with isolated React hooks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const source = path.resolve(__dirname, '../src/features/live-account/LiveAccountWorkspace.tsx');
const drain = () => new Promise(resolve => setImmediate(resolve));
const uuid = '00000000-0000-4000-8000-000000000001';
class ApiError extends Error { constructor(status, payload) { super('Fixture API error'); this.status = status; this.payload = payload; } }
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
  const accountHooks = hooksRuntime(), editorHooks = hooksRuntime(), portfolioHooks = hooksRuntime(); let currentHooks = accountHooks;
  const state = { snapshot: initialSnapshot(), patches: [], related: [], reload: () => {}, tree: null, editor: null };
  const commands = { blocked: false, busy: false, uncertain: false, replayable: false, error: '', notice: '',
    async execute(work) { try { await work(new AbortController().signal); state.reload(); return true; } catch (error) { commands.error = error.status === 409 ? 'Данные изменились' : error.message; return false; } },
    refresh() { state.reload(); }, retry() {} };
  const accountClient = { async snapshot() { return structuredClone(state.snapshot); },
    async portfolio() { return { count: 0, results: [], next: null, previous: null }; },
    async submit(input) { state.related.push({ operation: 'submit', input }); return state.snapshot.moderation; },
    async addExample(input, version) { state.related.push({ operation: 'add', input, version }); return {}; },
    async editExample(id, patch, version) { state.related.push({ operation: 'edit', id, patch, version }); return {}; },
    async deleteExample(id, version) { state.related.push({ operation: 'delete', id, version }); return {}; } };
  const registrationClient = { async save(patch) {
    state.patches.push(structuredClone(patch));
    if (patch.performer_revision !== state.snapshot.moderation.revision) throw new ApiError(409, null);
    if (patch.profile) Object.assign(state.snapshot.account.registration.profile, patch.profile);
    if (patch.roles) state.snapshot.account.registration.roles = [...patch.roles];
    if (patch.performer) Object.assign(state.snapshot.account.registration.performer, patch.performer);
    state.snapshot.moderation.revision++; return structuredClone(state.snapshot.account.registration);
  } };
  const shared = { LiveAccess: ({ children }) => children, LiveState: () => null,
    useLiveResource(key, loader) {
      if (key === 'account-specializations') return { data: [{ id: uuid, title: 'Fixture specialization' }], loading: false, reload() {} };
      currentHooks.hooks.useEffect(() => { const controller = new AbortController(); void loader(controller.signal); return () => controller.abort(); }, [key]);
      return { loading: false, reload() {} };
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
    if (name === '@/lib/api/registration') return { registrationClient };
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
  const input = id => find(state.editor, node => node.props?.id === id);
  function role(role) { return find(state.editor, node => node.type === 'label' && textContent(node).trim() === (role === 'customer' ? 'Заказчик' : 'Исполнитель')).props.children[0]; }
  return { state, components, accountClient, commands, renderAccount, renderEditor, renderPortfolio,
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
