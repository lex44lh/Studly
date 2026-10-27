/* eslint-disable @typescript-eslint/no-require-imports -- Contract and hook tests execute the actual TypeScript modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
const componentPath = path.join(root, 'features/live-account/LiveAccountWorkspace.tsx');
const registrationPath = path.join(root, 'context/RegistrationContext.tsx');
const uuid = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const drain = () => new Promise(resolve => setImmediate(resolve));
function loader(override = () => undefined) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixture = { exports: {} }; cache.set(file, fixture);
    let source = fs.readFileSync(file, 'utf8');
    if (file === componentPath) source += '\nexport { ModerationPanel, CabinetPanel, PortfolioPanel, ExampleEditor, AccountBody };';
    if (file === registrationPath) source += '\nexport { RegistrationSession };';
    const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      const value = override(name, file); if (value !== undefined) return value;
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name === 'next/image') return { __esModule: true, default: props => { const imageProps = { ...props }; delete imageProps.unoptimized; return React.createElement('img', imageProps); } };
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {}, replace() {} }) };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const stem = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        const child = [stem, `${stem}.ts`, `${stem}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!child) throw new Error(`Cannot resolve ${name}`);
        return load(child);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports);
    return fixture.exports;
  };
}
function registration() {
  return { roles: ['customer', 'performer'], profile: { display_name: 'Fixture', avatar_url: null, university: '', city: '', about: '' },
    performer: { description: 'Server description', study_year: '', portfolio: '', specializations: [] },
    progress: { current_step: 'profile', performer_skipped: false, updated_at: null },
    status: { is_complete: true, completed_at: null, missing_fields: [], performer_ready: false, performer_missing_fields: ['performer.specialization_ids'] } };
}
function moderation(patch = {}) {
  return { user_id: 7, revision: 4, status: 'draft', reason: '', submitted_at: null, ready_to_submit: true, missing_fields: [], approved: false, ...patch };
}
const capabilities = { customer: true, performer: true, create_order: true, create_service: true, django_admin: false, moderate_services: false, moderate_performers: false };
function account() { return { id: 7, registration: registration(), capabilities: { ...capabilities } }; }
function link() { return { id, title: 'Private example', kind: 'link', url: 'https://example.invalid/work', content_url: null, content_type: null, size: 0, created_at: '2026-10-26T00:00:00Z' }; }
function upload() { return { ...link(), kind: 'file', url: null, content_url: `/api/v1/portfolio/${id}/content/`, content_type: 'application/pdf', size: 512 }; }
function cabinet(role = 'customer') {
  return { role, account_id: 7, registration: registration(), capabilities: { ...capabilities }, orders: { count: 2, by_status: { PENDING: 2 }, url: `/api/v1/orders/?role=${role}` },
    services: role === 'performer' ? { draft: 1, pending: 2 } : null, moderation: moderation(),
    statistics: { completed_orders: null, rating: null, review_count: null }, unavailable: ['execution', 'reviews', 'rating'] };
}
const load = loader();
const api = load(path.join(root, 'lib/api/account.ts'));
const { ApiError } = load(path.join(root, 'lib/api/client.ts'));
const registrationApi = load(path.join(root, 'lib/api/registration.ts'));
async function network(replies, work) {
  const original = global.fetch; const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const reply = replies.shift(); assert.ok(reply, `Unexpected request ${url}`);
    if (reply.error) throw reply.error;
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  try { await work(calls); assert.equal(replies.length, 0); } finally { global.fetch = original; }
}
test('account adapter reads the server account and exact capability booleans', async () => {
  await network([{ body: account() }], async calls => {
    const result = await api.accountClient.account(); assert.equal(result.id, 7); assert.equal(result.capabilities.django_admin, false);
    assert.equal(calls[0].url, '/api/v1/account/'); assert.equal(calls[0].credentials, 'same-origin'); assert.equal(calls[0].cache, 'no-store');
  });
  const malformed = account(); malformed.capabilities.create_service = 'true';
  assert.throws(() => api.readAccount(malformed), error => error.status === 502);
});
test('cabinet preserves unavailable statistics as null and rejects the other role response', () => {
  assert.equal(api.readCabinet(cabinet(), 'customer').statistics.rating, null);
  assert.throws(() => api.readCabinet(cabinet('performer'), 'customer'), error => error.status === 502);
  const foreign = cabinet(); foreign.orders.url = '/api/v1/orders/?user_id=8';
  assert.throws(() => api.readCabinet(foreign, 'customer'), error => error.status === 502);
});
test('moderation requires a positive server revision and does not infer approval from readiness', () => {
  assert.equal(api.readModeration(moderation()).approved, false);
  assert.throws(() => api.readModeration(moderation({ revision: 0 })), error => error.status === 502);
  assert.throws(() => api.readModeration(moderation({ status: 'published' })), error => error.status === 502);
});
test('portfolio files only link to the exact authenticated content route; URLs reject active schemes and credentials', () => {
  assert.equal(api.readExample(upload()).content_url, `/api/v1/portfolio/${id}/content/`);
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@example.invalid', 'file:///tmp/work']) {
    assert.throws(() => api.safePortfolioUrl(url), error => error.status === 502);
  }
  for (const content_url of ['https://outside.invalid/private.pdf', `/api/v1/portfolio/${uuid}/content/`, '/api/v1/registration/avatar/']) {
    assert.throws(() => api.readExample({ ...upload(), content_url }), error => error.status === 502);
  }
});
test('portfolio pagination follows the same API resource and rejects escaped resources', async () => {
  await network([{ body: { count: 21, next: null, previous: 'http://django.internal/api/v1/portfolio/?page=1', results: [link()] } }], async calls => {
    const result = await api.accountClient.portfolio(undefined, 'http://django.internal/api/v1/portfolio/?page=2');
    assert.equal(result.count, 21); assert.equal(calls[0].url, '/api/v1/portfolio/?page=2');
  });
  await assert.rejects(api.accountClient.portfolio(undefined, 'https://outside.invalid/api/v1/staff/users/'), error => error.status === 502);
});
test('adding a portfolio link sends only the version, title and URL after obtaining fresh CSRF', async () => {
  await network([{ body: { csrf_token: 'fixture-csrf' } }, { status: 201, body: { example: link(), moderation: moderation({ revision: 5 }) } }], async calls => {
    const result = await api.accountClient.addExample({ title: 'Work', url: link().url }, { revision: 4, request_key: uuid });
    assert.equal(result.moderation.revision, 5); assert.equal(calls[0].url, '/api/v1/auth/csrf/');
    assert.equal(calls[1].headers['X-CSRFToken'], 'fixture-csrf');
    assert.deepEqual(JSON.parse(calls[1].body), { revision: 4, request_key: uuid, title: 'Work', url: link().url });
  });
});
test('portfolio upload uses actual multipart bytes and keeps the browser-generated boundary', async () => {
  const file = new File(['fixture-pdf-bytes'], 'work.pdf', { type: 'application/pdf' });
  await network([{ body: { csrf_token: 'fixture-csrf' } }, { status: 201, body: { example: upload(), moderation: moderation({ revision: 5 }) } }], async calls => {
    await api.accountClient.addExample({ title: 'File', file }, { revision: 4, request_key: uuid });
    assert.ok(calls[1].body instanceof FormData); assert.equal(calls[1].headers['Content-Type'], undefined);
    assert.equal(calls[1].body.get('revision'), '4'); assert.equal(calls[1].body.get('request_key'), uuid);
    assert.equal(await calls[1].body.get('file').text(), 'fixture-pdf-bytes');
    assert.deepEqual([...calls[1].body.keys()].sort(), ['file', 'request_key', 'revision', 'title']);
  });
});
test('editing/deleting uses the viewed revision, targets its UUID and retains the server moderation response', async () => {
  await network([{ body: { csrf_token: 'a' } }, { body: { example: link(), moderation: moderation({ revision: 5, status: 'pending' }) } },
    { body: { csrf_token: 'b' } }, { body: { moderation: moderation({ revision: 6, status: 'pending' }) } }], async calls => {
    await api.accountClient.editExample(id, { title: 'Changed' }, { revision: 4, request_key: uuid });
    const result = await api.accountClient.deleteExample(id, { revision: 5, request_key: id });
    assert.equal(result.moderation.status, 'pending'); assert.equal(calls[1].method, 'PATCH'); assert.equal(calls[3].method, 'DELETE');
    assert.deepEqual(JSON.parse(calls[3].body), { revision: 5, request_key: id }); assert.equal(calls[1].url, `/api/v1/portfolio/${id}/`);
  });
});
test('profile submission gets CSRF and accepts only the server moderation outcome', async () => {
  await network([{ body: { csrf_token: 'fixture' } }, { body: moderation({ revision: 5, status: 'pending', ready_to_submit: true }) }], async calls => {
    const result = await api.accountClient.submit({ revision: 4, request_key: uuid });
    assert.equal(result.status, 'pending'); assert.equal(result.approved, false); assert.equal(calls[1].url, '/api/v1/performer/moderation/');
  });
});
test('server permission/conflict errors are never replaced with demo or automatic writes', async () => {
  for (const status of [400, 401, 403, 404, 409, 503]) {
    await network([{ body: { csrf_token: 'fixture' } }, { status, body: { detail: 'Fixture rejection' } }], async calls => {
      await assert.rejects(api.accountClient.deleteExample(id, { revision: 4, request_key: uuid }), error => error.status === status);
      assert.equal(calls.length, 2);
    });
  }
});
test('registration parser rejects malformed specialization/missing-fields DTOs instead of runtime TypeErrors', () => {
  const malformed = registration(); malformed.performer.specializations = {};
  assert.throws(() => registrationApi.readRegistration(malformed), error => error.status === 502);
  const invalid = registration(); invalid.status.performer_missing_fields = [7];
  assert.throws(() => registrationApi.readRegistration(invalid), error => error.status === 502);
});
test('registration PATCH carries performer_revision and only dirty nested fields', async () => {
  await network([{ body: { csrf_token: 'fixture' } }, { body: registration() }], async calls => {
    await registrationApi.registrationClient.save({ performer_revision: 4, performer: { description: 'Changed' } });
    assert.deepEqual(JSON.parse(calls[1].body), { performer_revision: 4, performer: { description: 'Changed' } });
  });
});
test('account snapshot brackets its registration data with moderation reads and rejects a concurrent revision', async () => {
  await network([{ body: moderation() }, { body: account() }, { body: moderation({ revision: 5 }) }], async calls => {
    await assert.rejects(api.accountClient.snapshot(), error => error.status === 409 && error.payload.code === 'profile_snapshot_changed');
    assert.deepEqual(calls.map(call => call.url), ['/api/v1/performer/moderation/', '/api/v1/account/', '/api/v1/performer/moderation/']);
  });
});
test('a stable account snapshot carries matching content/revision and rejects a session switch with the same revision', async () => {
  await network([{ body: moderation() }, { body: account() }, { body: moderation() }], async () => {
    const result = await api.accountClient.snapshot(); assert.equal(result.account.id, result.moderation.user_id); assert.equal(result.moderation.revision, 4);
  });
  await network([{ body: moderation() }, { body: account() }, { body: moderation({ user_id: 8 }) }], async () => {
    await assert.rejects(api.accountClient.snapshot(), error => error.status === 409);
  });
});
test('registration snapshot never pairs old fields with a newer moderation revision', async () => {
  await network([{ body: moderation() }, { body: registration() }, { body: moderation({ revision: 5 }) }], async calls => {
    await assert.rejects(api.accountClient.registrationSnapshot(), error => error.status === 409);
    assert.deepEqual(calls.map(call => call.url), ['/api/v1/performer/moderation/', '/api/v1/registration/', '/api/v1/performer/moderation/']);
  });
  const current = registration(); current.profile.display_name = 'Latest canonical name';
  await network([{ body: moderation({ revision: 5 }) }, { body: current }, { body: moderation({ revision: 5 }) }], async () => {
    const result = await api.accountClient.registrationSnapshot(); assert.equal(result.registration.profile.display_name, 'Latest canonical name'); assert.equal(result.moderation.revision, 5);
  });
});
test('own revision prediction reflects actual moderated-field changes, including no-op and absent performer profile', () => {
  const before = registration(); const after = structuredClone(before); after.profile.display_name = 'Own saved name';
  assert.equal(registrationApi.registrationRevisionAfterSave(before, after, 4), 5);
  assert.equal(registrationApi.registrationRevisionAfterSave(before, structuredClone(before), 4), 4);
  const customerRoleOnly = structuredClone(before); customerRoleOnly.roles = ['performer'];
  assert.equal(registrationApi.registrationRevisionAfterSave(before, customerRoleOnly, 4), 4);
  const noProfileBefore = registration(); noProfileBefore.performer = null;
  const noProfileAfter = structuredClone(noProfileBefore); noProfileAfter.profile.display_name = 'Changed without a performer row';
  assert.equal(registrationApi.registrationRevisionAfterSave(noProfileBefore, noProfileAfter, 1), 1);
  const specializationOrder = registration(); specializationOrder.performer.specializations = [{ id: uuid, title: 'One' }, { id, title: 'Two' }];
  const reordered = structuredClone(specializationOrder); reordered.performer.specializations.reverse();
  assert.equal(registrationApi.registrationRevisionAfterSave(specializationOrder, reordered, 4), 4);
});

function hookRuntime() {
  const slots = []; let cursor = 0; const effects = []; const cleanup = [];
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useCallback(callback) { cursor++; return callback; },
    useReducer(reducer, initialArg, init) { const index = cursor++; if (!slots[index]) slots[index] = { value: init ? init(initialArg) : initialArg }; return [slots[index].value, action => { slots[index].value = reducer(slots[index].value, action); }]; },
    useEffect(effect, deps) { const index = cursor++; const previous = slots[index]; if (!previous || !deps || deps.some((item, at) => item !== previous.value?.[at])) { effects.push(() => { cleanup[index]?.(); cleanup[index] = effect(); }); slots[index] = { value: deps }; } },
  };
  return { hooks, render: callback => { cursor = 0; const value = callback(); while (effects.length) effects.shift()(); return value; }, unmount: () => cleanup.forEach(run => run?.()) };
}
function find(tree, predicate) {
  const visit = node => { if (!node || typeof node !== 'object') return undefined; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props?.children)) { const match = visit(child); if (match) return match; } };
  const result = visit(tree); assert.ok(result, 'Expected an actual component control'); return result;
}
function profileHarness() {
  const runtime = hookRuntime(); const calls = []; let snapshot = { account: account(), moderation: moderation() }; let tree;
  const writer = { blocked: false, refresh() {}, async execute(work) { try { await work(new AbortController().signal); return true; } catch { return false; } } };
  const overrides = name => name === 'react' ? runtime.hooks : name === '@/lib/api/registration' ? { registrationClient: {
    async save(patch) { calls.push(patch); if (patch.performer_revision !== snapshot.moderation.revision) throw new ApiError(409, null); return snapshot.account.registration; },
  } } : name === '@/features/live/shared' ? { useLiveResource: () => ({ data: [], loading: false, reload() {} }), LiveState: () => null } : name === '@/context/AuthContext' ? {} : undefined;
  const component = loader(overrides)(componentPath).LiveProfileEditor;
  function render() { tree = runtime.render(() => component({ snapshot, writer })); return tree; }
  render();
  return { calls, render, input: name => find(tree, node => node.props?.id === name),
    setSnapshot(value) { snapshot = value; render(); },
    async save() { await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    edit(name, value) { find(tree, node => node.props?.id === name).props.onChange({ target: { value } }); render(); },
    roles: () => find(tree, node => node.type === 'fieldset' && node.props.className === 'roleFieldset'), snapshot: () => snapshot };
}
test('profile editor sends the first viewed server revision after concurrent refreshed data and preserves dirty input on conflict', async () => {
  const h = profileHarness(); h.edit('live-account-name', 'Unsaved fixture');
  h.setSnapshot({ account: { ...account(), registration: { ...registration(), profile: { ...registration().profile, display_name: 'External update' } } }, moderation: moderation({ revision: 5 }) });
  await h.save(); assert.equal(h.calls[0].performer_revision, 4); assert.equal(h.calls[0].profile.display_name, 'Unsaved fixture');
  assert.equal(h.input('live-account-name').props.value, 'Unsaved fixture');
});
test('profile editor keeps avatar operations unavailable until dirty text is saved', async () => {
  const h = profileHarness(); assert.equal(h.input('live-account-avatar').props.disabled, false);
  h.edit('live-account-about', 'Unsaved description'); assert.equal(h.input('live-account-avatar').props.disabled, true);
  await h.save(); assert.equal(h.input('live-account-avatar').props.disabled, false);
  assert.deepEqual(h.calls[0], { performer_revision: 4, profile: { about: 'Unsaved description' } });
});
test('role editing preserves both server roles until explicit checkbox changes and submits a guarded role patch', async () => {
  const h = profileHarness(); const performer = find(h.roles(), node => node.type === 'input' && node.props.checked === true);
  performer.props.onChange(); h.render(); await h.save();
  assert.equal(h.calls[0].performer_revision, 4); assert.deepEqual(h.calls[0].roles, ['performer']);
  assert.equal(h.calls[0].profile, undefined);
});
test('approved profile is editable and explains server remoderation rather than using Demo locks', () => {
  const h = profileHarness(); h.setSnapshot({ account: account(), moderation: moderation({ status: 'approved', approved: true }) });
  h.edit('live-account-description', 'Changed live description');
  assert.equal(h.input('live-account-description').props.value, 'Changed live description');
});
function writerHarness() {
  const runtime = hookRuntime(); let reloaded = 0;
  const fixtureLoad = loader(name => name === 'react' ? runtime.hooks : undefined);
  const useWriter = fixtureLoad(path.join(root, 'features/live-account/useAccountWriter.ts')).useAccountWriter;
  const identity = fixtureLoad(path.join(root, 'lib/api/session.ts'));
  const render = () => runtime.render(() => useWriter(() => { reloaded++; }, 7));
  return { render, identity, unmount: runtime.unmount, reloaded: () => reloaded };
}
test('account writer serializes same-frame operations and reloads only after server success', async () => {
  const h = writerHarness(); let release; let calls = 0;
  const pending = new Promise(resolve => { release = resolve; }); const writer = h.render();
  const first = writer.execute(async () => { calls++; await pending; }); const second = await writer.execute(async () => { calls++; });
  assert.equal(second, false); assert.equal(calls, 1); assert.equal(h.render().busy, true); release(); assert.equal(await first, true);
  assert.equal(h.reloaded(), 1); assert.equal(h.render().blocked, false);
});
test('unknown portfolio outcome retains the exact original request key and payload for manual retry', async () => {
  const h = writerHarness(); const attempted = []; const intent = { revision: 4, request_key: uuid }; let fail = true;
  const work = async () => { attempted.push(structuredClone(intent)); if (fail) throw new Error('Disconnected after write'); };
  assert.equal(await h.render().execute(work), false); assert.equal(h.render().uncertain, true);
  assert.equal(await h.render().execute(async () => { throw new Error('Must not start another intention'); }), false);
  fail = false; h.render().retry(); await drain();
  assert.deepEqual(attempted, [intent, intent]); assert.equal(h.render().uncertain, false); assert.equal(h.reloaded(), 1);
});
test('non-receipted profile/avatar unknown outcomes are not replayed; explicit refresh reads state', async () => {
  const h = writerHarness(); let calls = 0;
  await h.render().execute(async () => { calls++; throw new Error('Unknown result'); }, false);
  h.render().retry(); await drain(); assert.equal(calls, 1); assert.equal(h.render().replayable, false);
  h.render().refresh(); assert.equal(h.render().uncertain, false); assert.equal(h.reloaded(), 1);
});
test('account writer aborts its pending request at unmount without updating another account', async () => {
  const h = writerHarness(); let signal; let release;
  const pending = new Promise(resolve => { release = resolve; });
  const write = h.render().execute(async value => { signal = value; await pending; });
  h.unmount(); assert.equal(signal.aborted, true); release(); assert.equal(await write, false); assert.equal(h.reloaded(), 0);
});
test('account writer keeps the original form actor lease and refuses a new-session mutation before invoking work', async () => {
  const h = writerHarness(); const dispose = h.identity.configureIdentityGuard({ readActor: async () => 7, onInvalidated() {} });
  try {
    h.identity.confirmIdentity(7); const writer = h.render(); h.identity.confirmIdentity(8); let calls = 0;
    assert.equal(await writer.execute(async () => { calls++; }), false); assert.equal(calls, 0); assert.equal(h.reloaded(), 0);
  } finally { dispose(); }
});
test('account writer cannot replay an old actor unknown-outcome closure after the session changes', async () => {
  const h = writerHarness(); const dispose = h.identity.configureIdentityGuard({ readActor: async () => 7, onInvalidated() {} });
  try {
    h.identity.confirmIdentity(7); let calls = 0;
    await h.render().execute(async () => { calls++; throw new Error('Unknown fixture outcome'); }); assert.equal(h.render().uncertain, true);
    h.identity.confirmIdentity(8); h.render().retry(); await drain(); assert.equal(calls, 1); assert.equal(h.reloaded(), 0);
  } finally { dispose(); }
});
test('registration and favorites remount private state when the same actor receives a new identity epoch', () => {
  let auth = { status: 'authenticated', user: { id: 7 }, identityEpoch: 1 };
  const fixtureLoad = loader(name => name === '@/context/AuthContext' ? { useAuth: () => ({ state: auth }) }
    : name === '@/lib/data-mode' || name === '@/lib/api/catalog' ? { demoMode: false } : undefined);
  const { RegistrationProvider } = fixtureLoad(registrationPath);
  const { FavoritesProvider } = fixtureLoad(path.join(root, 'context/FavoritesContext.tsx'));
  const registrationKey = () => RegistrationProvider({ children: null }).key;
  const favoritesKey = () => { const live = FavoritesProvider({ children: null }); return live.type(live.props).key; };
  const firstRegistration = registrationKey(), firstFavorites = favoritesKey();
  auth = { ...auth, identityEpoch: 2 };
  assert.notEqual(registrationKey(), firstRegistration); assert.notEqual(favoritesKey(), firstFavorites);
  assert.match(registrationKey(), /authenticated:7:2$/); assert.match(favoritesKey(), /authenticated:7:2$/);
});
test('moderation UI reads missing fields/reason and cannot resubmit a pending or unready profile', () => {
  const components = loader(name => name === '@/features/live/shared' ? {} : name === '@/context/AuthContext' ? {} : undefined)(componentPath);
  const writer = { blocked: false };
  const pending = renderToStaticMarkup(React.createElement(components.ModerationPanel, { moderation: moderation({ status: 'pending', reason: 'Server reason' }), writer }));
  assert.match(pending, /Server reason/); assert.match(pending, /disabled=""/);
  const unready = renderToStaticMarkup(React.createElement(components.ModerationPanel, { moderation: moderation({ ready_to_submit: false, missing_fields: ['portfolio'] }), writer }));
  assert.match(unready, /Хотя бы один пример работы/); assert.match(unready, /disabled=""/);
});
test('cabinet renders server counts and unavailable ratings without invented zero ratings', () => {
  const components = loader(name => name === '@/features/live/shared' ? { LiveState: () => null, useLiveResource: () => ({ data: cabinet('performer'), loading: false, reload() {} }) } : name === '@/context/AuthContext' ? {} : undefined)(componentPath);
  const html = renderToStaticMarkup(React.createElement(components.CabinetPanel, { role: 'performer', snapshot: { account: account(), moderation: moderation() }, refreshKey: 'fixture' }));
  assert.match(html, /<strong>—<\/strong><span>Средняя оценка/); assert.match(html, /Черновики: 1/);
  assert.match(html, /href="\/orders\?role=performer"/); assert.match(html, /Создать черновик услуги/);
});
test('private file example uses authenticated same-origin download and no public inline file embedding', () => {
  const components = loader(name => name === '@/features/live/shared' ? {} : name === '@/context/AuthContext' ? {} : undefined)(componentPath);
  const html = renderToStaticMarkup(React.createElement(components.ExampleEditor, { example: upload(), revision: 4, writer: { blocked: false } }));
  assert.match(html, new RegExp(`/api/v1/portfolio/${id}/content/`)); assert.match(html, /download=""/);
  assert.doesNotMatch(html, /<iframe|<object|src=/);
});

function registrationHarness({ complete = false, failSave = false, afterSaveRevisionBump = false, snapshotError = false, failPostSaveRead = false, foreignAvatarFields = false } = {}) {
  const runtime = hookRuntime(); const calls = []; const routes = []; let tree;
  const initial = registration(); initial.status.is_complete = complete;
  const router = { replace: route => routes.push(route), push: route => routes.push(route) };
  let revision = 4; let stored = structuredClone(initial); let completeCalls = 0; let avatarCalls = 0; let bumpRemaining = afterSaveRevisionBump;
  const client = { async loadDraft() { return structuredClone(stored); }, async save(patch) {
    calls.push(patch); if (failSave || patch.performer_revision !== revision) throw new ApiError(409, null);
    const before = structuredClone(stored); const after = structuredClone(stored);
    if (patch.roles) after.roles = [...patch.roles];
    if (patch.profile) Object.assign(after.profile, patch.profile);
    if (patch.performer) {
      const { specialization_ids, ...fields } = patch.performer;
      after.performer ??= { description: '', study_year: '', portfolio: '', specializations: [] };
      Object.assign(after.performer, fields);
      if (specialization_ids) after.performer.specializations = specialization_ids.map(value => ({ id: value, title: 'Fixture specialization' }));
    }
    if (patch.progress) Object.assign(after.progress, patch.progress);
    // Independent server fixture for the tested scenarios: a changed profile
    // touches once, while the progress-only skip does not change revision.
    if (after.performer && patch.profile && Object.entries(patch.profile).some(([key, value]) => before.profile[key] !== value)) revision++;
    stored = after;
    const response = structuredClone(after);
    if (bumpRemaining) { bumpRemaining = false; revision++; stored.profile.display_name = 'Another writer canonical name'; }
    return response;
  },
    async complete() { completeCalls++; return { ...stored, status: { ...stored.status, is_complete: true } }; },
    async uploadAvatar() { avatarCalls++; revision++; stored.profile.avatar_url = '/api/v1/registration/avatar/';
      if (foreignAvatarFields) { revision++; stored.profile.display_name = 'Another writer during avatar'; }
      return structuredClone(stored);
    }, async deleteAvatar() { revision++; stored.profile.avatar_url = null; } };
  const accountFixture = {
    async registrationSnapshot() { if (snapshotError) throw new ApiError(409, { code: 'profile_snapshot_changed' }); return { registration: structuredClone(stored), moderation: moderation({ revision }) }; },
    async moderation() { if (failPostSaveRead && calls.length) throw new ApiError(503, null); return moderation({ revision }); },
  };
  const modules = loader(name => name === 'react' ? runtime.hooks : name === '@/lib/data-mode' ? { demoMode: false } : name === '@/features/demo-workspace/RegistrationAdapter' ? { DemoRegistrationBridge: () => null } :
    name === '@/context/AuthContext' ? { useAuth: () => ({ state: { status: 'authenticated', user: { id: 7 } } }) } : name === '@/lib/api/client' ? load(path.join(root, 'lib/api/client.ts')) : name === 'next/navigation' ? { useRouter: () => router } :
      name === '@/lib/api/registration' ? { ...registrationApi, registrationClient: client } : name === '@/lib/api/account' ? { accountClient: accountFixture } : name === '@/lib/api/auth' ? { authClient: {} } : undefined)(registrationPath);
  const render = () => { tree = runtime.render(() => modules.RegistrationSession({ children: null })); return tree.props.value; };
  return { render, calls, routes, completeCalls: () => completeCalls, avatarCalls: () => avatarCalls, stored: () => structuredClone(stored), revision: () => revision,
    async ready() { render(); await drain(); return render(); } };
}
test('completed registration resumes into the real profile cabinet', async () => {
  const h = registrationHarness({ complete: true }); await h.ready(); assert.deepEqual(h.routes, ['/profile']);
});
test('registration completion saves with the exact loaded performer guard and redirects to profile', async () => {
  const h = registrationHarness(); const context = await h.ready(); await context.saveStep('performer', true);
  assert.equal(h.calls[0].performer_revision, 4); assert.equal(h.calls[0].progress.performer_skipped, true); assert.equal(h.routes.at(-1), '/profile');
});
test('registration conflict preserves the form and never automatically resends the save', async () => {
  const h = registrationHarness({ failSave: true }); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Unsaved fixture' } }); context = h.render(); await context.saveStep('profile');
  context = h.render(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].performer_revision, 4); assert.equal(context.draft.profile.displayName, 'Unsaved fixture');
  assert.match(context.error, /Данные изменились/); assert.notEqual(h.routes.at(-1), '/profile');
});
test('registration avatar upload advances only its own known performer touch before guarded text save', async () => {
  const h = registrationHarness(); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Name with avatar', avatarFile: new File(['fixture'], 'avatar.png', { type: 'image/png' }) } });
  context = h.render(); await context.saveStep('profile');
  assert.equal(h.calls[0].performer_revision, 5); assert.equal(h.calls[0].profile.display_name, 'Name with avatar');
  assert.equal(h.routes.at(-1), '/register/performer');
});
test('a concurrent write after our PATCH is never adopted as the guard for old fields in the next registration step', async () => {
  const h = registrationHarness({ afterSaveRevisionBump: true }); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Our saved step' } }); context = h.render(); await context.saveStep('profile');
  context = h.render(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].performer_revision, 4); assert.equal(h.revision(), 6);
  assert.equal(context.ready, false); assert.match(context.error, /Данные изменились/); assert.equal(context.draft.profile.displayName, 'Our saved step');
  await context.saveStep('performer'); assert.equal(h.calls.length, 1); assert.equal(h.completeCalls(), 0);
  assert.equal(h.stored().profile.display_name, 'Another writer canonical name');
  assert.notEqual(h.routes.at(-1), '/register/performer');
});
test('explicit stable reload after a post-save conflict restores the other writer fields before assigning their revision', async () => {
  const h = registrationHarness({ afterSaveRevisionBump: true }); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Our first step' } }); context = h.render(); await context.saveStep('profile');
  context = h.render(); assert.equal(context.ready, false); context.retry(); h.render(); await drain(); context = h.render();
  assert.equal(context.ready, true); assert.equal(context.draft.profile.displayName, 'Another writer canonical name');
  context.dispatch({ type: 'profile', patch: { city: 'New explicit city edit' } }); context = h.render(); await context.saveStep('profile');
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].performer_revision, 6); assert.equal(h.calls[1].profile.display_name, 'Another writer canonical name');
  assert.equal(h.stored().profile.display_name, 'Another writer canonical name'); assert.equal(h.stored().profile.city, 'New explicit city edit');
  assert.equal(h.routes.at(-1), '/register/performer');
});
test('an unstable initial registration snapshot cannot become an editable draft or save guard', async () => {
  const h = registrationHarness({ snapshotError: true }); const context = await h.ready();
  assert.equal(context.ready, false); assert.equal(context.loading, false); assert.match(context.error, /Данные изменились/);
  await context.saveStep('roles'); assert.equal(h.calls.length, 0); assert.equal(h.completeCalls(), 0);
});
test('a failed post-PATCH moderation read blocks further writes instead of trusting an unverified revision', async () => {
  const h = registrationHarness({ failPostSaveRead: true }); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Own committed field' } }); context = h.render(); await context.saveStep('profile');
  context = h.render(); assert.equal(context.ready, false); assert.equal(h.stored().profile.display_name, 'Own committed field');
  await context.saveStep('performer'); assert.equal(h.calls.length, 1); assert.equal(h.completeCalls(), 0);
});
test('a concurrent moderated field observed in an avatar response never authorizes a following stale text PATCH', async () => {
  const h = registrationHarness({ foreignAvatarFields: true }); let context = await h.ready();
  context.dispatch({ type: 'profile', patch: { displayName: 'Unsaved local name', avatarFile: new File(['fixture'], 'avatar.png', { type: 'image/png' }) } });
  context = h.render(); await context.saveStep('profile'); context = h.render();
  assert.equal(h.avatarCalls(), 1); assert.equal(h.calls.length, 0); assert.equal(context.ready, false);
  assert.equal(context.draft.profile.displayName, 'Unsaved local name'); assert.equal(h.stored().profile.display_name, 'Another writer during avatar');
});
