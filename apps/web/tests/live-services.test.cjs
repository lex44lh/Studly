/* eslint-disable @typescript-eslint/no-require-imports -- Load actual isolated TypeScript adapters and render components without a network server. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map(), sourceRoot = path.resolve(__dirname, '../src');
function load(relative, mocks = {}) {
  const base = path.join(sourceRoot, relative);
  const file = [base, `${base}.ts`, `${base}.tsx`].find(item => fs.existsSync(item) && fs.statSync(item).isFile());
  if (!Object.keys(mocks).length && cache.has(file)) return cache.get(file).exports;
  const fixture = { exports: {} };
  if (!Object.keys(mocks).length) cache.set(file, fixture);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  function localRequire(name) {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.module.css')) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name.startsWith('@/')) return load(name.slice(2), mocks);
    if (name.startsWith('.')) return load(path.relative(sourceRoot, path.resolve(path.dirname(file), name)), mocks);
    return require(name);
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports);
  return fixture.exports;
}
const { servicesClient, favoritesClient, readServiceV2 } = load('lib/api/services');
const { liveSearchQuery } = load('features/live-services/search');
const { serviceForm, draftFields } = load('features/live-services/model');
const { ApiError } = load('lib/api/client');
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
const uuid = '8e0183f4-6107-4ba6-ae19-711000000001';
const service = () => ({ id: 41, title: 'Server service', description: 'Server description', price_amount: '1000.00', currency: 'RUB', duration_days: 3,
  performer: { id: 12, name: 'Test performer' }, included: ['First item'], is_demo: false, revision: 7, category: 'Programming',
  extras: [{ id: uuid, title: 'Extra', price_amount: '100.25', extra_days: 1 }] });
const own = () => ({ ...service(), status: 'draft', reason: '', portfolio_example_ids: [uuid] });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const page = (results, next = null) => ({ count: results.length, next, previous: null, results });

test('public services use v2, preserve revision/category/extras and constrain pagination to the v2 resource', async () => {
  const calls = [];
  global.fetch = async url => { calls.push(url); return json(url.includes('/41/') ? service() : page([service()], 'http://internal:8000/api/v2/services/?page=2')); };
  assert.equal((await servicesClient.list('category=Programming')).results[0].revision, 7);
  assert.equal((await servicesClient.detail(41)).extras[0].price_amount, '100.25');
  assert.deepEqual(calls, ['/api/v2/services/?category=Programming', '/api/v2/services/41/']);
  for (const next of ['http://internal/api/v1/services/?page=2', 'https://example.com/steal', '/api/v2/my/services/?page=2']) {
    global.fetch = async () => json(page([], next));
    await assert.rejects(servicesClient.list(), error => error.status === 502);
  }
});
test('v2 rejects malformed DTO fields instead of synthesizing Demo data or ratings', () => {
  for (const patch of [{ revision: 0 }, { category: null }, { extras: null }, { price_amount: 1.23 }, { duration_days: 0 },
    { extras: [{ id: 'invalid', title: 'Invalid', price_amount: '0.00', extra_days: 0 }] },
    { extras: [{ id: uuid, title: 'Invalid', price_amount: '1.001', extra_days: 0 }] },
    { extras: [{ id: uuid, title: 'Invalid', price_amount: '1.00', extra_days: -1 }] }, { extras: [...service().extras, ...service().extras] }]) {
    assert.throws(() => readServiceV2({ ...service(), ...patch }), error => error instanceof ApiError && error.status === 502);
  }
});
test('own mutations preserve exact revision/request_key/portfolio/extras payload and get fresh v1 CSRF for v2 writes', async () => {
  const calls = [], input = { ...draftFields(serviceForm(own())), request_key: uuid, revision: 7 };
  global.fetch = async (url, options) => { calls.push({ url, ...options }); return json(url.endsWith('/csrf/') ? { csrf_token: 'test-csrf' } : url.endsWith('/my/services/') && options.method === 'GET' ? page([own()]) : own()); };
  await servicesClient.myList(); await servicesClient.myDetail(41);
  await servicesClient.create({ ...input, revision: 0 }); await servicesClient.patch(41, input); await servicesClient.submit(41, { revision: 7, request_key: uuid });
  const writes = calls.filter(call => ['POST', 'PATCH'].includes(call.method));
  assert.deepEqual(writes.map(call => [call.url, call.method]), [['/api/v2/my/services/', 'POST'], ['/api/v2/my/services/41/', 'PATCH'], ['/api/v2/my/services/41/submit/', 'POST']]);
  assert.deepEqual(JSON.parse(writes[1].body), input);
  assert.deepEqual(JSON.parse(writes[2].body), { revision: 7, request_key: uuid });
  assert.equal(calls.filter(call => call.url === '/api/v1/auth/csrf/').length, 3);
  assert.ok(calls.every(call => call.credentials === 'same-origin' && call.cache === 'no-store'));
  assert.ok(writes.every(call => call.headers['X-CSRFToken'] === 'test-csrf'));
  assert.ok(!('currency' in JSON.parse(writes[1].body)));
});
test('mutations preserve server errors and do not auto-retry 400/401/403/404/409/5xx or network failures', async () => {
  for (const status of [400, 401, 403, 404, 409, 503]) {
    let writes = 0;
    global.fetch = async url => url.endsWith('/csrf/') ? json({ csrf_token: 'test' }) : (writes++, json({ detail: 'server rejection' }, status));
    await assert.rejects(servicesClient.patch(41, { revision: 7, request_key: uuid, title: 'Changed' }), error => error.status === status);
    assert.equal(writes, 1);
  }
  global.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(servicesClient.myList(), error => error.status === 0);
});
test('favorites load all pages; membership uses server PUT/DELETE with same-origin pagination, and cycles fail', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf/')) return json({ csrf_token: 'rotated' });
    if (options.method !== 'GET') return new Response(null, { status: 204 });
    return json(page([{ ...service(), id: url.includes('page=2') ? 42 : 41 }], url.includes('page=2') ? null : 'http://internal:8000/api/v1/favorites/?page=2'));
  };
  assert.deepEqual((await favoritesClient.all()).map(item => item.id), [41, 42]);
  await favoritesClient.add(41); await favoritesClient.remove(41);
  assert.equal(calls[1].url, '/api/v1/favorites/?page=2');
  assert.deepEqual(calls.filter(call => ['PUT', 'DELETE'].includes(call.method)).map(call => [call.url, call.method, JSON.parse(call.body)]),
    [['/api/v1/favorites/41/', 'PUT', {}], ['/api/v1/favorites/41/', 'DELETE', {}]]);
  global.fetch = async () => json(page([], '/api/v1/favorites/?page=2'));
  await assert.rejects(favoritesClient.all(), error => error.status === 502);
});
test('abort signal reaches reads/writes and preserves AbortError', async () => {
  const controller = new AbortController(); controller.abort();
  global.fetch = async (_, options) => { assert.equal(options.signal, controller.signal); throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(servicesClient.detail(41, controller.signal), { name: 'AbortError' });
  await assert.rejects(favoritesClient.add(41, controller.signal), { name: 'AbortError' });
});
test('Live search sends published server-wide filter names and never sends a synthetic rating', () => {
  const filters = { query: ' Python ', category: ' Coding ', minPrice: '10.50', maxPrice: '2000', duration: '3', rating47: true, sort: 'priceDesc' };
  assert.deepEqual(Object.fromEntries(new URLSearchParams(liveSearchQuery(filters))), { search: 'Python', category: 'Coding', min_price: '10.50', max_price: '2000', max_duration: '3', ordering: 'price_desc' });
  assert.equal(new URLSearchParams(liveSearchQuery({ ...filters, sort: 'duration' })).get('ordering'), 'duration_asc');
});
test('draft projection preserves portfolio UUIDs and decimal strings; incomplete drafts are supported', () => {
  const form = serviceForm(own()); form.price = '123,40';
  const input = draftFields(form);
  assert.equal(input.price_amount, '123.40'); assert.equal(input.duration_days, 3);
  assert.deepEqual(input.portfolio_example_ids, [uuid]); assert.equal(input.extras[0].id, uuid);
  assert.equal(draftFields(serviceForm()).title, '');
  for (const price of ['1.001', '-1', '1e3', '100000000', 'NaN']) assert.throws(() => draftFields({ ...form, price }));
  for (const days of ['0', '1.5', '32768', '-1']) assert.throws(() => draftFields({ ...form, days }));
});
test('Campus editor restores server status, moderation reason, values and selected own portfolio', () => {
  const { EditorForm } = load('features/live-services/LiveServiceEditor', {
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  });
  const html = renderToStaticMarkup(React.createElement(EditorForm, { initial: { ...own(), status: 'changes', reason: 'Improve scope' }, examples: [{ id: uuid, title: 'Server portfolio item' }], reload() {} }));
  assert.ok(html.includes('Server service')); assert.ok(html.includes('Improve scope')); assert.ok(html.includes('версия 7'));
  assert.ok(html.includes('Server portfolio item')); assert.ok(html.includes('checked=""')); assert.ok(html.includes('Отправить на модерацию'));
  assert.ok(!html.includes('демо-модерацию')); assert.ok(!html.includes('Сохранён в этом браузере'));
});

test('unknown draft creation freezes new intentions and explicit retry keeps the exact original body and key', async () => {
  const slots = []; let cursor = 0;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect) { const index = cursor++; if (!(index in slots)) { slots[index] = true; effect(); } },
  };
  const bodies = [];
  const { EditorForm } = load('features/live-services/LiveServiceEditor', {
    react: hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/features/live/shared': {},
    '@/lib/api/account': {},
    '@/lib/api/client': load('lib/api/client'),
    '@/lib/api/services': { servicesClient: { async create(input) {
      bodies.push(structuredClone(input)); if (bodies.length === 1) throw new ApiError(0, null); return own();
    } } },
  });
  const render = () => { cursor = 0; return EditorForm({ examples: [], reload() {} }); };
  const all = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node, ...all(node.props?.children)];
  const button = (tree, text) => all(tree).find(node => node.type === 'button' && node.props.children === text);
  let tree = render(); button(tree, 'Сохранить черновик').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.equal(button(tree, 'Сохранить черновик').props.disabled, true);
  assert.ok(all(tree).some(node => node.type === 'fieldset' && node.props.disabled));
  button(tree, 'Повторить исходную операцию с тем же ключом').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.equal(bodies.length, 2); assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].revision, 0); assert.match(bodies[0].request_key, /^[a-f0-9-]{36}$/);
  assert.equal(button(tree, 'Сохранить черновик').props.disabled, false);
});

test('own-service list restores discoverable server draft links, statuses/reasons and server pagination', () => {
  const LiveOwnServices = load('features/live-services/LiveOwnServices', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/features/live/shared': { LiveAccess: ({ children }) => children, LiveState: () => null,
      useLiveResource: () => ({ data: page([{ ...own(), status: 'changes', reason: 'Improve scope' }], '/api/v2/my/services/?page=2'), reload() {} }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(LiveOwnServices));
  assert.ok(html.includes('href="/create-service?id=41"')); assert.ok(html.includes('Improve scope'));
  assert.ok(html.includes('Требуются изменения')); assert.ok(html.includes('Далее')); assert.ok(!html.includes('href="/service/41"'));
});
