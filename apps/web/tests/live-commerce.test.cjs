/* eslint-disable @typescript-eslint/no-require-imports -- Isolated contract and TSX harness executes actual integration modules. */
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
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file }).outputText;
    const local = name => {
      if (name in overrides) return overrides[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        return load([base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.tsx')].find(f => fs.existsSync(f) && fs.statSync(f).isFile()));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', js)(local, fixture, fixture.exports); return fixture.exports;
  }
  return load;
}
const apiLoad = loader();
const api = apiLoad(path.join(root, 'lib/api/commerce.ts'));
const { commerceClient: client, mergeMessages } = api;
const { ApiError } = apiLoad(path.join(root, 'lib/api/client.ts'));
const protocol = apiLoad(path.join(root, 'features/live-commerce/protocol.ts'));
const U = '00000000-0000-4000-8000-000000000001', V = '00000000-0000-4000-8000-000000000002', K = '00000000-0000-4000-8000-000000000003';
const extra = { id: V, title: 'Отчёт', price_amount: '300.00', extra_days: 1 };
const snapshot = () => ({ title: 'Серверная консультация', description: 'Сохранённые условия', included: ['Разбор'], duration_days: 4, currency: 'RUB', tariff_code: 'buyer-5-v1', base_price_amount: '1000.10', selected_extras: [extra], price_amount: '1300.10', buyer_fee_percent: '5.00', buyer_fee_amount: '65.01', total_amount: '1365.11' });
const quote = () => ({ ...snapshot(), quote_id: U, service_id: 42, service_revision: 3, performer_id: 7, extras_amount: '300.00' });
const order = () => ({ ...snapshot(), id: 12, service_id: 42, service_revision: 3, revision: 1, request_key: K, buyer: { id: 9, name: 'Заказчик' }, performer: { id: 7, name: 'Исполнитель' }, quote_id: U, available_actions: ['cancel'], payment_status: 'unpaid', status: 'pending_acceptance', created_at: '2026-10-26T10:00:00Z', accepted_at: null, closed_at: null });
const conversation = () => ({ id: U, kind: 'order', order_id: 12, service_id: 42, title: 'Серверный контекст', participant_ids: [9, 7], created_at: '2026-10-26T10:00:00Z' });
const message = (id = 1, sequence = id) => ({ id, sequence, conversation_id: U, sender_id: 9, client_message_id: K, text: 'Учебное сообщение', status: 'stored', categories: [], rules_version: 'offplatform-2026-10-24-v1', warning: null, security_case_id: null, created_at: '2026-10-26T10:00:00Z' });
const held = () => ({ ...message(), status: 'held', categories: ['external_payment'], warning: 'Сообщение удержано.', security_case_id: 4 });
const securityCase = () => ({ id: 4, message_id: 1, conversation_id: U, revision: 2, categories: ['external_payment'], rules_version: 'offplatform-2026-10-24-v1', appealed: false, appeal_reason: '', decision: null, decision_reason: '' });
const page = results => ({ count: results.length, next: null, previous: null, results });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const originalFetch = global.fetch, originalStorage = global.sessionStorage;
after(() => { global.fetch = originalFetch; if (originalStorage === undefined) delete global.sessionStorage; else global.sessionStorage = originalStorage; });

test('v2 quote and purchase use fresh v1 CSRF, exact server payloads and session cookies', async () => {
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, ...options }); return json(url.endsWith('/csrf/') ? { csrf_token: `csrf-${calls.length}` } : url.includes('/quotes/') ? quote() : order()); };
  assert.equal((await client.quote(42, [V])).total_amount, '1365.11');
  assert.equal((await client.purchase(U, K)).payment_status, 'unpaid');
  assert.deepEqual(calls.map(x => x.url), ['/api/v1/auth/csrf/', '/api/v2/quotes/', '/api/v1/auth/csrf/', '/api/v2/orders/']);
  assert.deepEqual(JSON.parse(calls[1].body), { service_id: 42, extra_ids: [V] });
  assert.deepEqual(JSON.parse(calls[3].body), { quote_id: U, request_key: K });
  assert.equal(calls[3].headers['X-CSRFToken'], 'csrf-3');
  assert.ok(calls.every(x => x.credentials === 'same-origin' && x.cache === 'no-store'));
});
test('409 and unknown purchase are exposed without automatic mutation replay', async () => {
  for (const status of [400, 401, 403, 404, 409, 500, 503]) {
    let writes = 0;
    global.fetch = async url => url.endsWith('/csrf/') ? json({ csrf_token: 'token' }) : (writes++, json({ detail: 'fixture error' }, status));
    await assert.rejects(client.purchase(U, K), error => error.status === status); assert.equal(writes, 1);
  }
  let calls = 0; global.fetch = async () => { calls++; throw new TypeError('offline'); };
  await assert.rejects(client.purchase(U, K), error => error.status === 0); assert.equal(calls, 1);
});
test('action, events, discussions, order conversation and appeals use their actual contract versions', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return json(url.endsWith('/csrf/') ? { csrf_token: 'token' } : url.includes('/appeal/') ? securityCase() : url.endsWith('/events/') ? page([]) : url.includes('/discussion') ? { ...conversation(), kind: 'discussion', order_id: null } : url.endsWith('/conversation/') ? conversation() : order());
  };
  await client.orderAction(12, 'cancel', 4, K); await client.events(12); await client.discussion(42, K); await client.orderConversation(12); await client.appeal(4, 2, K, 'Ошибка');
  const writes = calls.filter(x => x.method === 'POST');
  assert.deepEqual(writes.map(x => x.url), ['/api/v2/orders/12/cancel/', '/api/v1/discussions/', '/api/v1/security-cases/4/appeal/']);
  assert.deepEqual(JSON.parse(writes[0].body), { revision: 4, request_key: K });
  assert.deepEqual(JSON.parse(writes[2].body), { revision: 2, request_key: K, reason: 'Ошибка' });
  assert.ok(calls.some(x => x.url === '/api/v1/orders/12/events/')); assert.ok(calls.some(x => x.url === '/api/v1/orders/12/conversation/'));
});
test('cursor URLs preserve encoded cursor and reject cross-resource/version pagination', async () => {
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, ...options }); return json({ next: null, previous: null, results: [message()] }); };
  await client.messages(U, `http://backend.internal/api/v1/conversations/${U}/messages/?cursor=cD0xMjM%3D`);
  assert.equal(calls[0].url, `/api/v1/conversations/${U}/messages/?cursor=cD0xMjM%3D`);
  for (const next of ['/api/v2/conversations/' + U + '/messages/?cursor=x', '/api/v1/conversations/' + V + '/messages/?cursor=x', '/api/v1/staff/users/']) await assert.rejects(client.messages(U, next), error => error.status === 502);
  assert.equal(calls.length, 1);
});
test('malformed quote/order/state/message/participant DTOs fail closed', () => {
  assert.throws(() => api.readQuote({ ...quote(), total_amount: 1365.11 }), error => error.status === 502);
  assert.throws(() => api.readOrder({ ...order(), status: 'COMPLETED' }), error => error.status === 502);
  assert.throws(() => api.readOrder({ ...order(), payment_status: 'paid' }), error => error.status === 502);
  assert.throws(() => api.readOrder({ ...order(), available_actions: ['complete'] }), error => error.status === 502);
  assert.throws(() => api.readConversation({ ...conversation(), participant_ids: [9, 9] }), error => error.status === 502);
  assert.throws(() => api.readMessage({ ...held(), security_case_id: null }), error => error.status === 502);
});
test('financial and conversation responses must match the requested resource and intent', async () => {
  for (const [call, body] of [
    [() => client.quote(42, [V]), { ...quote(), service_id: 99 }],
    [() => client.quote(42, []), quote()],
    [() => client.quoteDetail(U), { ...quote(), quote_id: V }],
    [() => client.purchase(U, K), { ...order(), request_key: V }],
    [() => client.order(12), { ...order(), id: 99 }],
    [() => client.conversation(U), { ...conversation(), id: V }],
    [() => client.orderConversation(12), { ...conversation(), order_id: 99 }],
    [() => client.discussion(42, K), conversation()],
    [() => client.send(U, K, 'Text'), { ...message(), client_message_id: V }],
    [() => client.securityCase(4), { ...securityCase(), id: 99 }],
  ]) {
    global.fetch = async url => json(url.endsWith('/csrf/') ? { csrf_token: 'token' } : body);
    await assert.rejects(call(), error => error.status === 502);
  }
});
test('release merge replaces same message ID by newest sequence and never retains foreign held content', () => {
  const ownHeld = held(), released = { ...message(), sequence: 8 }, foreignHeld = { ...held(), id: 2, sequence: 2, sender_id: 7, text: 'PRIVATE' };
  assert.deepEqual(mergeMessages([ownHeld, message(3, 3)], [released, foreignHeld, { ...message(4, 4), conversation_id: V }], U, 9).map(x => [x.id, x.sequence, x.status]), [[3, 3, 'stored'], [1, 8, 'stored']]);
  assert.equal(mergeMessages([released], [ownHeld], U, 9)[0].status, 'stored');
});
test('action permissions derive from actual IDs and server state, with no UI-role impersonation', () => {
  const value = { ...order(), available_actions: ['accept', 'cancel', 'decline'] };
  assert.deepEqual(protocol.allowedOrderActions(value, 9), ['cancel']);
  assert.deepEqual(protocol.allowedOrderActions(value, 7), ['accept', 'decline']);
  assert.deepEqual(protocol.allowedOrderActions(value, 99), []);
  assert.deepEqual(protocol.allowedOrderActions({ ...value, status: 'cancelled' }, 9), []);
});
test('actual orders route initializes the requested role and adapter sends the matching server filter', async () => {
  const requested = [];
  global.fetch = async url => { requested.push(url); return json(page([])); };
  for (const [query, expected] of [['role=customer', 'customer'], ['role=performer', 'performer'], ['role=admin', 'all'], ['', 'all']]) {
    const received = [];
    const load = loader({ '@/lib/data-mode': { demoMode: false },
      '@/features/demo-workspace/Provider': { useOptionalDemoWorkspace: () => null }, '@/features/demo-workspace/Routing': { OrdersRoute: () => null },
      '@/features/live-commerce': { LiveOrders: props => { received.push(props.initialRole); return React.createElement('p', null, props.initialRole); } },
      '@/features/live/shared': { LiveState: () => React.createElement('p', null, 'Loading') },
      'next/navigation': { useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ push() {}, back() {} }) },
      'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    });
    const html = renderToStaticMarkup(React.createElement(load(path.join(root, 'app/orders/page.tsx')).default));
    assert.deepEqual(received, [expected]); assert.match(html, new RegExp(expected));
    await client.orders(received[0]); assert.equal(requested.at(-1), expected === 'all' ? '/api/v2/orders/' : `/api/v2/orders/?role=${expected}`);
  }
});
test('opaque purchase persistence is isolated by account and extras; no snapshot, text or credentials stored', () => {
  const storage = new Map(); global.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const key = protocol.purchaseStorageKey(9, '42', [V, U]);
  assert.equal(key, protocol.purchaseStorageKey(9, '42', [U, V]));
  protocol.savePurchaseIntent(key, { quoteId: U, requestKey: K, attempted: true });
  assert.deepEqual(protocol.readPurchaseIntent(key), { quoteId: U, requestKey: K, attempted: true });
  assert.equal(protocol.readPurchaseIntent(protocol.purchaseStorageKey(7, '42', [U, V])), null);
  assert.equal(protocol.readPurchaseIntent(protocol.purchaseStorageKey(9, '42', [])), null);
  assert.doesNotMatch(storage.get(key), /price|text|csrf|session|name|token/);
  protocol.savePurchaseIntent(key, null); assert.equal(protocol.readPurchaseIntent(key), null);
});

function uiHarness(apiOverrides = {}) {
  const resources = new Map(), calls = [], frames = new Map();
  const auth = { state: { status: 'authenticated', user: { id: 9, display_name: 'Fixture' } } };
  let current, currentName, currentProps, tree, dirty = false, effects = [], visited;
  const hooks = { ...React,
    useState(initial) { const frame = current, i = frame.cursor++; if (!(i in frame.slots)) frame.slots[i] = typeof initial === 'function' ? initial() : initial; return [frame.slots[i], value => { const next = typeof value === 'function' ? value(frame.slots[i]) : value; if (!Object.is(next, frame.slots[i])) { frame.slots[i] = next; dirty = true; } }]; },
    useRef(initial) { const frame = current, i = frame.cursor++; return frame.slots[i] ??= { current: initial }; },
    useEffect(effect, deps) { const frame = current, i = frame.cursor++, previous = frame.dependencies.get(i); if (!previous || !deps || deps.some((x, n) => !Object.is(x, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); frame.dependencies.set(i, { deps, cleanup: effect() }); }); },
    useCallback(fn) { return fn; },
  };
  // HTTP receipts are frozen acknowledgements. The component now follows them
  // with GETs; keep the test transport's current server state separately.
  let lastOrder, lastMessage, lastCase;
  const latestOrder = id => {
    const supplied = resources.get(`order:${id}`);
    return supplied && (!lastOrder || supplied.revision >= lastOrder.revision) ? supplied : lastOrder ?? order();
  };
  const commerceMock = { ...api, commerceClient: { ...client,
    order: async id => latestOrder(id), orders: async () => page([]),
    messages: async (id, next) => ({ next: null, previous: null, results: [...(next ? [] : resources.get(`messages:${id}`)?.results ?? []), ...(lastMessage ? [lastMessage] : [])] }),
    securityCase: async id => lastCase ?? resources.get(`security-appeal:${id}`) ?? securityCase(),
    ...apiOverrides,
    ...(apiOverrides.purchase ? { purchase: async (...args) => { const response = await apiOverrides.purchase(...args); lastOrder = { ...response, quote_id: args[0], request_key: args[1] }; return lastOrder; } } : {}),
    ...(apiOverrides.orderAction ? { orderAction: async (...args) => { lastOrder = await apiOverrides.orderAction(...args); return lastOrder; } } : {}),
    ...(apiOverrides.send ? { send: async (...args) => { lastMessage = { ...await apiOverrides.send(...args), client_message_id: args[1] }; return lastMessage; } } : {}),
    ...(apiOverrides.appeal ? { appeal: async (...args) => { lastCase = await apiOverrides.appeal(...args); return lastCase; } } : {}),
  } };
  const load = loader({ react: hooks, '@/context/AuthContext': { useAuth: () => auth }, '@/lib/api/client': apiLoad(path.join(root, 'lib/api/client.ts')), '@/lib/api/commerce': commerceMock,
    '@/features/live/shared': {
      LiveAccess: ({ children }) => auth.state.status === 'authenticated' ? React.createElement(React.Fragment, { key: auth.state.user.id }, children) : React.createElement('p', null, 'Войдите'),
      LiveState: ({ error, loading, retry }) => React.createElement('div', { role: error ? 'alert' : 'status' }, error ? 'Ошибка API' : loading ? 'Загружаем' : 'Нет данных', error && React.createElement('button', { onClick: retry }, 'Повторить')),
      useLiveResource: key => ({ data: resources.get(`${auth.state.user?.id}:${key}`) ?? resources.get(key), error: null, loading: !resources.has(key) && !resources.has(`${auth.state.user?.id}:${key}`), reload: () => calls.push({ reload: key }) }),
    },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  });
  const views = load(path.join(root, 'features/live-commerce/index.tsx'));
  const useWrite = load(path.join(root, 'features/live-commerce/useWrite.ts')).useWrite;
  function expand(element, location) {
    if (Array.isArray(element)) return element.map((child, i) => expand(child, `${location}/${child?.key ?? i}`));
    if (!React.isValidElement(element)) return element;
    const here = `${location}:${element.key ?? ''}`;
    if (element.type === React.Fragment) return expand(element.props.children, `${here}/fragment`);
    if (typeof element.type === 'function') {
      const id = `${here}/${element.type.name}`; visited.add(id);
      const frame = frames.get(id) ?? { slots: [], dependencies: new Map(), cursor: 0 }; frames.set(id, frame); frame.cursor = 0;
      const previous = current; current = frame; const value = element.type(element.props); current = previous;
      return expand(value, `${id}/child`);
    }
    return React.createElement(element.type, { ...element.props, key: element.key }, expand(element.props.children, `${here}/${element.type}`));
  }
  function mount(name = currentName, props = currentProps ?? {}) {
    currentName = name; currentProps = props;
    for (let attempt = 0; attempt < 12; attempt++) {
      effects = []; dirty = false; visited = new Set();
      tree = expand(React.createElement(typeof name === 'function' ? name : views[name], props), 'root');
      for (const [key, frame] of frames) if (!visited.has(key)) { for (const dep of frame.dependencies.values()) dep.cleanup?.(); frames.delete(key); }
      effects.forEach(effect => effect()); if (!dirty) return tree;
    }
    throw Error('effects failed to settle');
  }
  return { auth, resources, calls, mount, rerender: () => mount(), html: () => renderToStaticMarkup(tree), useWrite };
}
function nodes(tree, predicate) { const result = []; const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!React.isValidElement(node)) return; if (predicate(node)) result.push(node); visit(node.props.children); }; visit(tree); return result; }
function text(node) { return Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node); }
const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node).includes(label))[0];
const checkbox = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0];
const tick = () => new Promise(resolve => setImmediate(resolve));
const freshStorage = () => { const map = new Map(); global.sessionStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; return map; };

test('quote UI uses server snapshot, needs explicit consent and coalesces double purchase', async () => {
  freshStorage(); const purchases = [];
  let resolve;
  const h = uiHarness({ quote: async () => quote(), purchase: (...args) => { purchases.push(args); return new Promise(done => { resolve = done; }); } });
  let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender();
  button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender();
  assert.match(h.html(), /1\s*365,11/); assert.equal(button(tree, 'Создать заказ').props.disabled, true);
  button(tree, 'Создать заказ').props.onClick(); await tick(); assert.equal(purchases.length, 0);
  checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  const buy = button(tree, 'Создать заказ').props.onClick; buy(); buy(); await tick(); assert.equal(purchases.length, 1);
  assert.equal(purchases[0][0], U); assert.match(purchases[0][1], /^[a-f0-9-]{36}$/);
  resolve(order()); await tick(); h.rerender(); assert.match(h.html(), /Заказ №12 сохранён сервером/); assert.doesNotMatch(h.html(), /Оплата успешна|Доставлено/);
});
test('unknown purchase outcome retains exact key, forbids replacing quote, and manual retry deduplicates', async () => {
  const storage = freshStorage(), keys = [];
  const h = uiHarness({ quote: async () => quote(), purchase: async (_id, key) => { keys.push(key); if (keys.length === 1) throw new ApiError(0, null); return order(); } });
  let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender(); button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender(); button(tree, 'Создать заказ').props.onClick(); await tick(); tree = h.rerender();
  assert.match(h.html(), /Результат запроса неизвестен/); assert.equal(button(tree, 'Обновить расчёт').props.disabled, true); assert.ok([...storage.values()].some(value => JSON.parse(value).attempted));
  button(tree, 'Повторить создание').props.onClick(); await tick(); h.rerender(); assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]); assert.equal(storage.size, 0);
});
test('409 invalidates consent and requires a fresh reviewed quote before another order', async () => {
  freshStorage(); let quotes = 0, purchases = 0;
  const h = uiHarness({ quote: async () => ({ ...quote(), quote_id: ++quotes === 1 ? U : V }), purchase: async () => { purchases++; throw new ApiError(409, null); } });
  let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender(); button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender(); button(tree, 'Создать заказ').props.onClick(); await tick(); tree = h.rerender();
  assert.equal(checkbox(tree), undefined); assert.match(h.html(), /новое согласие/);
  button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender(); assert.equal(checkbox(tree).props.checked, false); assert.equal(button(tree, 'Создать заказ').props.disabled, true); assert.equal(purchases, 1);
});
test('reload restores quote from GET and retains attempted key without automatic purchase or inherited consent', async () => {
  freshStorage(); const key = protocol.purchaseStorageKey(9, '42', [V]); protocol.savePurchaseIntent(key, { quoteId: U, requestKey: K, attempted: true });
  const calls = []; const h = uiHarness({ quoteDetail: async id => { calls.push(['GET', id]); return quote(); }, purchase: async (_id, requestKey) => { calls.push(['POST', requestKey]); return order(); } });
  let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender(); assert.deepEqual(calls, [['GET', U]]); assert.equal(checkbox(tree).props.checked, false); assert.equal(button(tree, 'Обновить расчёт').props.disabled, true);
  checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender(); button(tree, 'Повторить создание с прежним ключом').props.onClick(); await tick(); h.rerender(); assert.deepEqual(calls.at(-1), ['POST', K]);
});
test('changing extras invalidates quote display and consent without changing server totals locally', async () => {
  freshStorage(); const h = uiHarness({ quote: async () => quote() }); let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender(); button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  tree = h.mount('LiveQuote', { serviceId: '42', extras: [] }); assert.equal(checkbox(tree), undefined); assert.doesNotMatch(h.html(), /1\s*365,11/);
});
test('private order and chat views hide foreign records and expose no financial completion controls', () => {
  freshStorage(); const h = uiHarness(); h.resources.set('order:12', { ...order(), buyer: { id: 99, name: 'Private buyer' }, performer: { id: 98, name: 'Private performer' } }); h.mount('LiveOrderDetail', { id: '12' }); assert.match(h.html(), /Нет доступа/); assert.doesNotMatch(h.html(), /Сохранённые условия|Private buyer/);
  h.resources.set(`conversation:${U}`, { ...conversation(), participant_ids: [98, 99] }); h.mount('LiveConversation', { id: U }); assert.match(h.html(), /Нет доступа/); assert.doesNotMatch(h.html(), /Серверный контекст|Сообщение/);
  h.resources.set('order:12', order()); h.resources.set('order-events:12:1:', page([])); h.resources.set('order-conversation:12', conversation()); h.mount('LiveOrderDetail', { id: '12' }); assert.match(h.html(), /Оплата недоступна/); assert.doesNotMatch(h.html(), /Завершить заказ|Оставить отзыв|Симулировать/);
});
test('orders role selector reflects the route-supplied role and never infers participant identity from it', () => {
  for (const role of ['customer', 'performer', 'all']) {
    freshStorage(); const h = uiHarness(); h.resources.set(`orders:9:${role}:`, page([]));
    const tree = h.mount('LiveOrders', { initialRole: role }); assert.equal(nodes(tree, node => node.type === 'select')[0].props.value, role); assert.match(h.html(), /Заказов пока нет/);
  }
});
test('account replacement unmounts an in-flight write and prevents stale completion from entering the new account', async () => {
  freshStorage(); let finish, signal, oldCalls = 0, captured;
  const h = uiHarness(); function Probe() { captured = h.useWrite('probe'); return React.createElement('button', { onClick: () => captured.run('x', (_key, passedSignal) => { signal = passedSignal; return new Promise(resolve => { finish = resolve; }); }).then(result => { if (result?.ok) oldCalls++; }) }, 'Write'); }
  let tree = h.mount(Probe); button(tree, 'Write').props.onClick(); await tick();
  h.auth.state = { status: 'authenticated', user: { id: 7 } }; tree = h.mount(() => React.createElement(React.Fragment, { key: 7 }, React.createElement(Probe))); assert.equal(signal.aborted, true);
  finish('stale account response'); await tick(); assert.equal(oldCalls, 0); assert.equal(captured.busy, false);
});
test('message UI merges release by ID, keeps held sender privacy, and uses stored wording', () => {
  freshStorage(); const h = uiHarness(); h.resources.set(`conversation:${U}`, conversation()); h.resources.set(`messages:${U}`, { next: null, previous: null, results: [held(), { ...held(), id: 2, sequence: 2, sender_id: 7, text: 'FOREIGN HELD PRIVATE' }, message(3, 3)] });
  h.mount('LiveConversation', { id: U }); assert.match(h.html(), /Удержано/); assert.match(h.html(), /Сохранено/); assert.doesNotMatch(h.html(), /FOREIGN HELD PRIVATE|Доставлено|Прочитано/);
  h.resources.set(`messages:${U}`, { next: null, previous: null, results: [{ ...message(), sequence: 10 }] }); h.rerender(); assert.equal((h.html().match(/Учебное сообщение/g) ?? []).length, 1); assert.doesNotMatch(h.html(), /Удержано/);
});
test('message unknown outcome freezes text and retries same client_message_id without duplicate optimistic messages', async () => {
  freshStorage(); const calls = []; const h = uiHarness({ send: async (id, key, text) => { calls.push({ id, key, text }); if (calls.length === 1) throw new ApiError(0, null); return { ...message(), text }; } });
  h.resources.set(`conversation:${U}`, conversation()); h.resources.set(`messages:${U}`, { next: null, previous: null, results: [] });
  let tree = h.mount('LiveConversation', { id: U }); nodes(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Точный текст' } }); tree = h.rerender(); nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick(); tree = h.rerender();
  assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.disabled, true); assert.doesNotMatch(h.html(), /<p>Точный текст<\/p>/);
  nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick(); h.rerender(); assert.equal(calls.length, 2); assert.equal(calls[0].key, calls[1].key); assert.equal(calls[0].text, calls[1].text); assert.equal((h.html().match(/<p>Точный текст<\/p>/g) ?? []).length, 1);
});
test('changing extras aborts pending quote and late response cannot lock or replace the new selection', async () => {
  freshStorage(); const calls = []; let finish;
  const h = uiHarness({ quote: (_id, ids, signal) => { calls.push({ ids, signal }); return calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ ...quote(), selected_extras: [] }); } });
  let tree = h.mount('LiveQuote', { serviceId: '42', extras: [extra] }); await tick(); tree = h.rerender(); button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.rerender();
  assert.equal(button(tree, 'Получаем расчёт').props.disabled, true);
  tree = h.mount('LiveQuote', { serviceId: '42', extras: [] }); assert.equal(calls[0].signal.aborted, true);
  finish(quote()); await tick(); tree = h.rerender(); assert.equal(button(tree, 'Получить расчёт').props.disabled, false); assert.equal(checkbox(tree), undefined);
  button(tree, 'Получить расчёт').props.onClick(); await tick(); h.rerender(); assert.equal(calls.length, 2); assert.deepEqual(calls[1].ids, []);
});
test('cursor append merges released same-ID message by new sequence without duplicate bubbles', async () => {
  freshStorage(); const calls = [];
  const next = `/api/v1/conversations/${U}/messages/?cursor=next`;
  const h = uiHarness({ messages: async (id, cursor) => { calls.push({ id, cursor }); return { next: null, previous: next, results: [{ ...message(), sequence: 8 }] }; } });
  h.resources.set(`conversation:${U}`, conversation()); h.resources.set(`messages:${U}`, { next, previous: null, results: [held(), message(3, 3)] });
  let tree = h.mount('LiveConversation', { id: U }); button(tree, 'Загрузить следующие').props.onClick(); await tick(); tree = h.rerender();
  assert.deepEqual(calls, [{ id: U, cursor: next }]); assert.equal(nodes(tree, node => node.type === 'li').length, 2); assert.doesNotMatch(h.html(), /Удержано/); assert.match(h.html(), /№8/);
});
test('uncertain order action remains manually retryable with its original revision after a server refresh', async () => {
  freshStorage(); const calls = [];
  const h = uiHarness({ orderAction: async (...args) => { calls.push(args); if (calls.length === 1) throw new ApiError(0, null); return { ...order(), status: 'cancelled', revision: 2, available_actions: [], closed_at: '2026-10-26T11:00:00Z' }; } });
  h.resources.set('order:12', order()); h.resources.set('order-events:12:1:', page([])); h.resources.set('order-events:12:2:', page([])); h.resources.set('order-conversation:12', conversation());
  let tree = h.mount('LiveOrderDetail', { id: '12' }); button(tree, 'Отменить заказ').props.onClick(); tree = h.rerender(); button(tree, 'Подтвердить действие').props.onClick(); await tick(); tree = h.rerender();
  h.resources.set('order:12', { ...order(), status: 'cancelled', revision: 2, available_actions: [], closed_at: '2026-10-26T11:00:00Z' }); button(tree, 'Обновить заказ').props.onClick(); tree = h.rerender(); button(tree, 'Повторить с прежним ключом').props.onClick(); await tick(); h.rerender();
  assert.equal(calls.length, 2); assert.equal(calls[0][2], 1); assert.equal(calls[1][2], 1); assert.equal(calls[0][3], calls[1][3]); assert.match(h.html(), /Отменён заказчиком/);
});
test('held sender appeal GET reads exact case and POST preserves revision/reason with no second appeal after success', async () => {
  freshStorage(); const calls = [];
  const h = uiHarness({ appeal: async (...args) => { calls.push(args); return { ...securityCase(), appealed: true, revision: 3 }; } });
  h.resources.set(`conversation:${U}`, conversation()); h.resources.set(`messages:${U}`, { next: null, previous: null, results: [held()] }); h.resources.set('security-appeal:4', securityCase());
  let tree = h.mount('LiveConversation', { id: U }); button(tree, 'Посмотреть случай').props.onClick(); tree = h.rerender(); const textarea = nodes(tree, node => node.type === 'textarea')[0]; textarea.props.onChange({ target: { value: 'Учебный пример, прошу проверить' } }); tree = h.rerender();
  nodes(tree, node => node.type === 'form' && text(node).includes('Причина обжалования'))[0].props.onSubmit({ preventDefault() {} }); await tick(); tree = h.rerender();
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 4); assert.equal(calls[0][1], 2); assert.equal(calls[0][3], 'Учебный пример, прошу проверить'); assert.match(h.html(), /Обжалование сохранено/); assert.equal(button(tree, 'Отправить обжалование'), undefined);
});
