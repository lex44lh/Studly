/* eslint-disable @typescript-eslint/no-require-imports -- Contract and component harness loads actual isolated TypeScript integration modules. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../src');
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixture = { exports: {} }; cache.set(file, fixture);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file }).outputText;
    const local = name => {
      if (name in overrides) return overrides[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        return load([base, `${base}.ts`, `${base}.tsx`].find(f => fs.existsSync(f) && fs.statSync(f).isFile()));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', compiled)(local, fixture, fixture.exports); return fixture.exports;
  }
  return load;
}
const apiLoad = loader(), api = apiLoad(path.join(root, 'lib/api/staff.ts'));
const { staffClient: client, readStaffSession } = api;
const { ApiError } = apiLoad(path.join(root, 'lib/api/client.ts'));
const U = '00000000-0000-4000-8000-000000000001', K = '00000000-0000-4000-8000-000000000002';
const moderation = () => ({ user_id: 7, revision: 3, status: 'pending', reason: '', submitted_at: '2026-10-26T10:00:00Z', ready_to_submit: true, missing_fields: [], approved: false });
const performer = () => ({ ...moderation(), display_name: 'Проверяемый исполнитель', description: 'Описание профиля', examples: [] });
const service = () => ({ id: 42, title: 'Проверяемая услуга', description: 'Описание услуги', price_amount: '1000.00', currency: 'RUB', duration_days: 3, performer: { id: 7, name: 'Исполнитель' }, included: ['Разбор'], is_demo: false, revision: 3, category: 'Обучение', extras: [], status: 'pending', reason: '', portfolio_example_ids: [] });
const message = () => ({ id: 8, sequence: 8, conversation_id: U, sender_id: 7, client_message_id: K, text: 'PRIVACY TEST MESSAGE', status: 'held', categories: ['external_payment'], rules_version: 'offplatform-2026-10-24-v1', warning: 'Удержано', security_case_id: 4, created_at: '2026-10-26T10:00:00Z' });
const securityCase = () => ({ id: 4, message_id: 8, conversation_id: U, revision: 2, categories: ['external_payment'], rules_version: 'offplatform-2026-10-24-v1', appealed: false, appeal_reason: '', decision: null, decision_reason: '' });
const session = resources => ({ id: 100, display_name: 'Тестовый сотрудник', resources, unavailable: ['finance', 'analytics'] });
const page = results => ({ count: results.length, next: null, previous: null, results });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });

test('staff session validates Django resources and cannot be granted by arbitrary demo/admin flags', async () => {
  global.fetch = async () => json(session(['users', 'events']));
  assert.deepEqual((await client.me()).resources, ['users', 'events']);
  for (const value of [{ demo_admin: true }, session(['payments']), session(['users', 'users']), { ...session([]), id: 0 }]) assert.throws(() => readStaffSession(value), error => error.status === 502);
  global.fetch = async () => json({ detail: 'forbidden', demo_admin: true }, 403);
  await assert.rejects(client.me(), error => error.status === 403);
});
test('staff list validates paginated same-resource paths and exact public resource DTOs', async () => {
  let requested;
  global.fetch = async url => { requested = url; return json({ count: 1, next: 'http://internal/api/v1/staff/users/?page=2', previous: null, results: [{ id: 7, display_name: 'Имя', is_active: true, roles: ['customer'] }] }); };
  const result = await client.list('users', 'search=Name&page=1'); assert.equal(requested, '/api/v1/staff/users/?search=Name&page=1'); assert.equal(result.results[0].id, 7);
  for (const next of ['/api/v1/conversations/', '/api/v1/staff/orders/?page=2', '/api/v2/staff/users/?page=2']) {
    global.fetch = async () => json({ count: 0, next, previous: null, results: [] }); await assert.rejects(client.list('users'), error => error.status === 502);
  }
});
test('staff decisions send exact versioned paths and fresh CSRF without client permission declarations', async () => {
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, ...options }); return json(url.endsWith('/csrf/') ? { csrf_token: `token-${calls.length}` } : url.includes('/performers/') ? moderation() : url.includes('/services/') ? service() : securityCase()); };
  const version = { revision: 3, request_key: K, decision: 'changes', reason: 'Уточните описание' };
  await client.decideProfile(7, version); await client.decideService(42, version); await client.decideCase(4, { ...version, revision: 2, decision: 'keep' });
  const writes = calls.filter(x => x.method === 'POST');
  assert.deepEqual(writes.map(x => x.url), ['/api/v1/staff/performers/7/decision/', '/api/v1/staff/services/42/decision/', '/api/v1/staff/security-cases/4/']);
  assert.deepEqual(JSON.parse(writes[0].body), version); assert.deepEqual(JSON.parse(writes[1].body), version); assert.deepEqual(JSON.parse(writes[2].body), { ...version, revision: 2, decision: 'keep' });
  assert.deepEqual(writes.map(x => x.headers['X-CSRFToken']), ['token-1', 'token-3', 'token-5']); assert.ok(calls.every(x => x.credentials === 'same-origin' && x.cache === 'no-store'));
});
test('staff 400/401/403/404/409/5xx errors never replay a decision automatically', async () => {
  for (const status of [400, 401, 403, 404, 409, 500, 503]) {
    let writes = 0; global.fetch = async url => url.endsWith('/csrf/') ? json({ csrf_token: 'token' }) : (writes++, json({ detail: 'failure' }, status));
    await assert.rejects(client.decideCase(4, { revision: 2, request_key: K, decision: 'keep', reason: 'Проверено' }), error => error.status === status); assert.equal(writes, 1);
  }
});
test('case content requires bounded purpose and requests one audited case, never an unrestricted message list', async () => {
  const calls = []; global.fetch = async (url, options) => { calls.push({ url, ...options }); return json({ ...securityCase(), message: message() }); };
  for (const purpose of ['', '  ', 'x'.repeat(501)]) await assert.rejects(client.caseContent(4, purpose), error => error.status === 400);
  assert.equal(calls.length, 0);
  const result = await client.caseContent(4, '  Проверка обжалования №4  '); assert.equal(result.message.text, 'PRIVACY TEST MESSAGE');
  const url = new URL(calls[0].url, 'http://same-origin'); assert.equal(url.pathname, '/api/v1/staff/security-cases/4/'); assert.equal(url.searchParams.get('purpose'), 'Проверка обжалования №4'); assert.equal(calls.length, 1);
});
test('case content fails closed when message ID or conversation does not match the requested case', async () => {
  for (const bad of [{ ...message(), id: 99 }, { ...message(), conversation_id: K }]) {
    global.fetch = async () => json({ ...securityCase(), message: bad }); await assert.rejects(client.caseContent(4, 'Проверка'), error => error.status === 502);
  }
});
test('staff order and audit DTOs reject unsupported paid states and unsafe shapes', () => {
  assert.throws(() => api.readStaffRow('orders', { id: 1, title: '', status: 'COMPLETED' }), error => error.status === 502);
  assert.throws(() => api.readStaffRow('events', { id: 1, actor_id: null, operation: 'test', target: '1', details: [], created_at: '' }), error => error.status === 502);
  assert.throws(() => api.readStaffRow('users', { id: 1, display_name: 'Test', is_active: true, roles: ['staff'] }), error => error.status === 502);
});

function harness(overrides = {}) {
  const resources = new Map(), reloads = [], frames = new Map(); let current, effects, dirty, visited, tree;
  const hooks = { ...React,
    useState(initial) { const frame = current, i = frame.cursor++; if (!(i in frame.slots)) frame.slots[i] = typeof initial === 'function' ? initial() : initial; return [frame.slots[i], value => { const next = typeof value === 'function' ? value(frame.slots[i]) : value; if (!Object.is(next, frame.slots[i])) { frame.slots[i] = next; dirty = true; } }]; },
    useRef(initial) { const frame = current, i = frame.cursor++; return frame.slots[i] ??= { current: initial }; },
    useEffect(effect, deps) { const frame = current, i = frame.cursor++, old = frame.dependencies.get(i); if (!old || !deps || deps.some((x, j) => !Object.is(x, old.deps[j]))) effects.push(() => { old?.cleanup?.(); frame.dependencies.set(i, { deps, cleanup: effect() }); }); },
  };
  const load = loader({ react: hooks, '@/lib/api/staff': { ...api, staffClient: { ...client, ...overrides } }, '@/lib/api/client': apiLoad(path.join(root, 'lib/api/client.ts')),
    '@/components/studly/Icon': { Icon: () => React.createElement('span', { 'aria-hidden': true }) },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/features/live/shared': {
      LiveAccess: ({ children }) => children,
      LiveState: ({ error, loading }) => React.createElement('p', { role: error ? 'alert' : 'status' }, error ? 'Доступ запрещён' : loading ? 'Загружаем' : ''),
      useLiveResource: key => ({ data: resources.get(key)?.data, error: resources.get(key)?.error, loading: key !== null && !resources.has(key), reload: () => reloads.push(key) }),
    },
  });
  const views = load(path.join(root, 'features/live-staff/LiveStaffWorkspace.tsx'));
  function expand(element, location) {
    if (Array.isArray(element)) return element.map((node, i) => expand(node, `${location}/${node?.key ?? i}`));
    if (!React.isValidElement(element)) return element;
    const here = `${location}:${element.key ?? ''}`;
    if (element.type === React.Fragment) return expand(element.props.children, here + '/fragment');
    if (typeof element.type === 'function') {
      const id = `${here}/${element.type.name}`; visited.add(id); const frame = frames.get(id) ?? { cursor: 0, slots: [], dependencies: new Map() }; frames.set(id, frame); frame.cursor = 0;
      const before = current; current = frame; const value = element.type(element.props); current = before; return expand(value, id + '/child');
    }
    return React.createElement(element.type, { ...element.props, key: element.key }, expand(element.props.children, `${here}/${element.type}`));
  }
  function mount() {
    for (let i = 0; i < 12; i++) { effects = []; dirty = false; visited = new Set(); tree = expand(React.createElement(views.default), 'root'); for (const [id, frame] of frames) if (!visited.has(id)) { for (const dep of frame.dependencies.values()) dep.cleanup?.(); frames.delete(id); } effects.forEach(effect => effect()); if (!dirty) return tree; }
    throw Error('Effects failed to settle');
  }
  return { resources, reloads, mount, html: () => renderToStaticMarkup(tree), sections: views.staffSections };
}
function nodes(tree, predicate) { const result = []; const visit = value => { if (Array.isArray(value)) return value.forEach(visit); if (!React.isValidElement(value)) return; if (predicate(value)) result.push(value); visit(value.props.children); }; visit(tree); return result; }
function text(value) { return Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? text(value.props.children) : value == null || typeof value === 'boolean' ? '' : String(value); }
const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node).includes(label))[0];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('staff workspace preserves 12 sections and honestly disables unavailable operations', () => {
  const h = harness(); h.resources.set('staff-session', { data: session(['users']) }); let tree = h.mount(); assert.equal(h.sections.length, 12); const nav = nodes(tree, node => node.type === 'nav')[0]; assert.equal(nodes(nav, node => node.type === 'button').length, 12);
  button(tree, 'Финансы').props.onClick(); tree = h.mount(); assert.match(h.html(), /Платежи, возвраты, выплаты и финансовые отчёты пока недоступны/); assert.doesNotMatch(h.html(), /Подтвердить решение|Сумма дохода/);
  button(tree, 'Аналитика').props.onClick(); h.mount(); assert.match(h.html(), /Серверная аналитика пока недоступна/);
});
test('section access is derived only from Django session resources and cannot reveal cached records without permission', () => {
  const h = harness(); h.resources.set('staff-session', { data: session([]) }); h.resources.set('staff:users:', { data: page([{ id: 7, display_name: 'PRIVATE ACCOUNT', roles: [], is_active: true }]) }); let tree = h.mount(); button(tree, 'Пользователи').props.onClick(); h.mount(); assert.match(h.html(), /Нет доступа/); assert.doesNotMatch(h.html(), /PRIVATE ACCOUNT|Всего записей/);
});
test('staff 403 prevents the workspace even when a test fixture includes a demo admin flag', () => {
  const h = harness(); h.resources.set('staff-session', { error: new ApiError(403, { demo_admin: true }) }); h.mount(); assert.match(h.html(), /Доступ запрещён/); assert.doesNotMatch(h.html(), /Разделы рабочего места|Подтвердить решение/);
});
test('profile decision needs detail, explicit confirmation and preserves exact command across unknown outcome', async () => {
  const calls = []; const h = harness({ decideProfile: async (...args) => { calls.push(args); if (calls.length === 1) throw new ApiError(0, null); return { ...moderation(), status: 'approved' }; } });
  h.resources.set('staff-session', { data: session(['performers']) }); h.resources.set('staff:performers:', { data: page([performer()]) }); h.resources.set('staff-detail:performers:7:', { data: performer() }); let tree = h.mount(); button(tree, 'Профили на проверке').props.onClick(); tree = h.mount(); button(tree, 'Проверяемый исполнитель').props.onClick(); tree = h.mount();
  assert.equal(button(tree, 'Подтвердить решение').props.disabled, true); nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }); tree = h.mount(); const apply = button(tree, 'Подтвердить решение').props.onClick; apply(); apply(); await tick(); tree = h.mount(); assert.equal(calls.length, 1); assert.match(h.html(), /Ответ не подтверждён/); assert.equal(nodes(tree, node => node.type === 'fieldset')[0].props.disabled, true);
  button(tree, 'Повторить то же решение').props.onClick(); await tick(); h.mount(); assert.equal(calls.length, 2); assert.deepEqual(calls[0][1], calls[1][1]); assert.equal(calls[0][1].revision, 3); assert.equal(calls[0][1].decision, 'approved'); assert.match(h.html(), /Решение сохранено/);
});
test('security case metadata cannot expose message text until an explicit working purpose is supplied', () => {
  const h = harness(); h.resources.set('staff-session', { data: session(['security-cases']) }); h.resources.set('staff:security-cases:', { data: page([securityCase()]) }); h.resources.set('staff-detail:security-cases:4:Проверка обжалования', { data: { ...securityCase(), message: message() } });
  let tree = h.mount(); button(tree, 'Жалобы и безопасность').props.onClick(); tree = h.mount(); button(tree, 'Проверка сообщения').props.onClick(); tree = h.mount(); assert.doesNotMatch(h.html(), /PRIVACY TEST MESSAGE/); assert.equal(button(tree, 'Открыть сообщение по обращению').props.disabled, true);
  nodes(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Проверка обжалования' } }); tree = h.mount(); nodes(tree, node => node.type === 'form' && text(node).includes('Цель просмотра'))[0].props.onSubmit({ preventDefault() {} }); h.mount(); assert.match(h.html(), /PRIVACY TEST MESSAGE/); assert.match(h.html(), /Общая лента|Решение сотрудника/);
});
test('staff cannot moderate their own performer profile from UI', () => {
  const h = harness(); h.resources.set('staff-session', { data: session(['performers']) }); const own = { ...performer(), user_id: 100 }; h.resources.set('staff:performers:', { data: page([own]) }); h.resources.set('staff-detail:performers:100:', { data: own }); let tree = h.mount(); button(tree, 'Профили на проверке').props.onClick(); tree = h.mount(); button(tree, 'Проверяемый исполнитель').props.onClick(); h.mount(); assert.match(h.html(), /Сейчас решение недоступно/); assert.doesNotMatch(h.html(), /Подтвердить решение/);
});
