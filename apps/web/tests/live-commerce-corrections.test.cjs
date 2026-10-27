/* eslint-disable @typescript-eslint/no-require-imports -- Independent synthetic contract regressions load actual API/TSX; no Django E2E. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.join(__dirname, '../src');
const Q = '66666666-6666-4666-8666-666666666666', K = '77777777-7777-4777-8777-777777777777', E = '11111111-1111-4111-8111-111111111111', C = '88888888-8888-4888-8888-888888888888';
const at = '2026-10-26T19:20:00Z', clone = value => JSON.parse(JSON.stringify(value));
const extra = { id: E, title: 'Independent extra', price_amount: '200.00', extra_days: 1 };
const quote = () => ({ quote_id: Q, service_id: 811, service_revision: 3, performer_id: 702, title: 'Independent API service', description: 'Contract-aligned synthetic service', included: ['Independent scope'], currency: 'RUB', duration_days: 4, tariff_code: 'buyer-5-v2', base_price_amount: '1000.00', selected_extras: [extra], extras_amount: '200.00', price_amount: '1200.00', buyer_fee_percent: '5.00', buyer_fee_amount: '60.00', total_amount: '1260.00' });
const order = (key = K) => ({ ...quote(), id: 852, request_key: key, revision: 1, buyer: { id: 701, name: 'Synthetic Alpha' }, performer: { id: 702, name: 'Synthetic Beta' }, available_actions: ['cancel'], payment_status: 'unpaid', status: 'pending_acceptance', created_at: at, accepted_at: null, closed_at: null });
const message = (id = 1, sequence = id) => ({ id, sequence, conversation_id: C, sender_id: 701, client_message_id: K, text: 'Synthetic stored message', status: 'stored', categories: [], rules_version: 'offplatform-2026-10-24-v1', warning: null, security_case_id: null, created_at: at });
const conversation = () => ({ id: C, kind: 'order', order_id: 852, service_id: 811, title: 'Independent API service', participant_ids: [701, 702], created_at: at });
const page = results => ({ count: results.length, next: null, previous: null, results });
const tick = () => new Promise(resolve => setImmediate(resolve));
function storage() { const data = new Map(); return { data, get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }; }
const originalFetch = global.fetch, originalStorage = global.sessionStorage;
after(() => { global.fetch = originalFetch; if (originalStorage === undefined) delete global.sessionStorage; else global.sessionStorage = originalStorage; });
function loadModules(overrides = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixture = { exports: {} }; cache.set(file, fixture);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    function local(name) {
      if (name in overrides) return overrides[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.startsWith('@/') || name.startsWith('.')) { const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name); return load([base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.tsx')].find(value => fs.existsSync(value) && fs.statSync(value).isFile())); }
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(local, fixture, fixture.exports); return fixture.exports;
  }
  return load;
}
const pureLoad = loadModules(), protocol = pureLoad(path.join(root, 'features/live-commerce/protocol.ts'));
function harness(actor = 701) {
  const auth = { state: { status: 'authenticated', user: { id: actor } } }, resources = new Map(), frames = new Map(), calls = [];
  const server = { orders: [], currentOrder: null, purchaseReceipts: new Map(), actionReceipts: new Map(), messageReceipts: new Map(), messages: [message()], failPurchase: false, purchaseConflict: false, failAction: false, failMessage: false, quoteError: 0, getOrderError: 0, messagePages: false, quoteValue: quote() };
  let frame, effects, dirty, visited, currentName, props, tree;
  const hooks = { ...React,
    useState(initial) { const owner = frame, index = owner.cursor++; if (!(index in owner.values)) owner.values[index] = typeof initial === 'function' ? initial() : initial; return [owner.values[index], value => { const next = typeof value === 'function' ? value(owner.values[index]) : value; if (!Object.is(next, owner.values[index])) { owner.values[index] = next; dirty = true; } }]; },
    useRef(initial) { const index = frame.cursor++; return frame.values[index] ??= { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(effect, dependencies) { const owner = frame, index = owner.cursor++, old = owner.effects.get(index); if (!old || !dependencies || dependencies.some((value, i) => !Object.is(value, old.dependencies[i]))) effects.push(() => { old?.cleanup?.(); owner.effects.set(index, { dependencies, cleanup: effect() }); }); },
  };
  const load = loadModules({ react: hooks, '@/context/AuthContext': { useAuth: () => auth }, '@/features/live/shared': {
    LiveAccess: ({ children }) => auth.state.status === 'authenticated' ? React.createElement(React.Fragment, { key: auth.state.user.id }, children) : React.createElement('p', null, 'Sign in'),
    LiveState: ({ error, loading }) => React.createElement('p', { role: error ? 'alert' : 'status' }, error ? 'API error' : loading ? 'Loading' : ''),
    useLiveResource: key => ({ data: resources.get(key) ?? (key?.startsWith('order-events:') ? page([]) : key?.startsWith('order-conversation:') ? conversation() : undefined), error: null, loading: !resources.has(key), reload() {} }),
  } });
  const views = load(path.join(root, 'features/live-commerce/index.tsx'));
  const api = load(path.join(root, 'lib/api/commerce.ts'));
  const reconcile = load(path.join(root, 'features/live-commerce/reconcile.ts'));
  async function network(url, options) {
    const parsed = new URL(url, 'http://synthetic.invalid'), body = options.body ? JSON.parse(options.body) : {}, method = options.method;
    calls.push({ path: parsed.pathname, query: parsed.search, method, body, signal: options.signal });
    const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (parsed.pathname === '/api/v1/auth/csrf/') return response({ csrf_token: 'synthetic-only' });
    if (parsed.pathname === '/api/v1/auth/me/') return response({ user: { id: auth.state.user.id, display_name: 'Synthetic', telegram_username: '' } });
    if (parsed.pathname === `/api/v2/quotes/${Q}/`) return server.quoteError ? response({}, server.quoteError) : response(server.quoteValue);
    if (parsed.pathname === '/api/v2/quotes/') return response(server.quoteValue, 201);
    if (parsed.pathname === '/api/v2/orders/' && method === 'GET') return response(page(server.orders));
    if (parsed.pathname === '/api/v2/orders/' && method === 'POST') {
      if (server.purchaseConflict) return response({}, 409);
      if (!server.purchaseReceipts.has(body.request_key)) { const created = { ...order(body.request_key), quote_id: body.quote_id }; server.currentOrder = clone(created); server.orders = [clone(created)]; server.purchaseReceipts.set(body.request_key, clone(created)); }
      if (server.failPurchase) { server.failPurchase = false; return response({}, 503); }
      return response(server.purchaseReceipts.get(body.request_key));
    }
    if (parsed.pathname === '/api/v2/orders/852/') return server.getOrderError ? response({}, server.getOrderError) : response(server.currentOrder);
    if (/^\/api\/v2\/orders\/852\/(accept|cancel|decline)\/$/.test(parsed.pathname)) {
      if (!server.actionReceipts.has(body.request_key)) { const changed = { ...server.currentOrder, revision: 2, status: 'awaiting_payment', accepted_at: at, available_actions: [] }; server.currentOrder = clone(changed); server.actionReceipts.set(body.request_key, clone(changed)); }
      if (server.failAction) { server.failAction = false; return response({}, 503); }
      // operations.execute returns the original response even after current state changes.
      return response(server.actionReceipts.get(body.request_key));
    }
    if (parsed.pathname === `/api/v1/conversations/${C}/messages/` && method === 'POST') {
      if (!server.messageReceipts.has(body.client_message_id)) { const created = { ...message(2), client_message_id: body.client_message_id, text: body.text, status: 'held', categories: ['external_payment'], warning: 'Synthetic held warning', security_case_id: 4 }; server.messages.push(clone(created)); server.messageReceipts.set(body.client_message_id, clone(created)); }
      if (server.failMessage) { server.failMessage = false; return response({}, 503); }
      return response(server.messageReceipts.get(body.client_message_id));
    }
    if (parsed.pathname === `/api/v1/conversations/${C}/messages/`) {
      const second = parsed.searchParams.has('cursor'); return response({ next: server.messagePages && !second ? `/api/v1/conversations/${C}/messages/?cursor=next` : null, previous: null, results: server.messagePages ? server.messages.filter(value => second ? value.sequence >= 8 : value.sequence < 8) : server.messages });
    }
    throw Error(`Unexpected synthetic request ${method} ${url}`);
  }
  function expand(node, location) {
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${location}/${child?.key ?? index}`));
    if (!React.isValidElement(node)) return node;
    const here = `${location}:${node.key ?? ''}`;
    if (node.type === React.Fragment) return expand(node.props.children, here + '/fragment');
    if (typeof node.type === 'function') { const id = `${here}/${node.type.name}`; visited.add(id); const owner = frames.get(id) ?? { values: [], effects: new Map(), cursor: 0 }; frames.set(id, owner); owner.cursor = 0; const previous = frame; frame = owner; const value = node.type(node.props); frame = previous; return expand(value, `${id}/child`); }
    return React.createElement(node.type, { ...node.props, key: node.key }, expand(node.props.children, `${here}/${node.type}`));
  }
  function mount(name = currentName, nextProps = props ?? {}) {
    global.fetch = network; currentName = name; props = nextProps;
    for (let i = 0; i < 12; i++) { effects = []; dirty = false; visited = new Set(); tree = expand(React.createElement(views[name], props), 'root'); for (const [id, owner] of frames) if (!visited.has(id)) { for (const effect of owner.effects.values()) effect.cleanup?.(); frames.delete(id); } effects.forEach(effect => effect()); if (!dirty) return tree; }
    throw Error('Effects did not settle');
  }
  return { auth, server, resources, calls, api, reconcile, mount, html: () => renderToStaticMarkup(tree), useNetwork: () => { global.fetch = network; } };
}
function nodes(tree, predicate) { const result = []; function visit(value) { if (Array.isArray(value)) return value.forEach(visit); if (!React.isValidElement(value)) return; if (predicate(value)) result.push(value); visit(value.props.children); } visit(tree); return result; }
function text(value) { return Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? text(value.props.children) : value == null || typeof value === 'boolean' ? '' : String(value); }
const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node).includes(label))[0];
const checkbox = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0];
const keyFor = () => protocol.pendingPurchaseStorageKey(701, '811');

test('L1: reload discovers legacy attempted extras independently of empty selection and migrates only opaque IDs', async () => {
  global.sessionStorage = storage(); const legacy = protocol.purchaseStorageKey(701, '811', [E]); protocol.savePurchaseIntent(legacy, { quoteId: Q, requestKey: K, attempted: true });
  let restored, locked; const h = harness(); let tree = h.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [], onRestoreExtras: ids => { restored = ids; }, onLockChange: value => { locked = value; } });
  assert.equal(button(tree, 'Получить расчёт').props.disabled, true); await tick(); tree = h.mount();
  assert.deepEqual(restored, [E]); assert.equal(locked, true); assert.match(h.html(), /Independent extra/); assert.equal(button(tree, 'Обновить расчёт').props.disabled, true); assert.equal(checkbox(tree).props.checked, false);
  assert.deepEqual(JSON.parse(sessionStorage.getItem(keyFor())), { quoteId: Q, requestKey: K, attempted: true }); assert.doesNotMatch(sessionStorage.getItem(keyFor()), /price|amount|text|csrf|token|name/);
});
test('L1 exact regression: server creates extra order, loses response, reload reconciles same receipt to one current order', async () => {
  global.sessionStorage = storage(); const h = harness(); h.server.failPurchase = true;
  let tree = h.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [extra] }); await tick(); tree = h.mount(); button(tree, 'Получить расчёт').props.onClick(); await tick(); tree = h.mount(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.mount(); button(tree, 'Создать заказ').props.onClick(); await tick(); tree = h.mount();
  assert.match(h.html(), /Результат запроса неизвестен/); const original = JSON.parse(sessionStorage.getItem(keyFor())); assert.equal(original.attempted, true); assert.equal(h.server.orders.length, 1);
  const reload = harness(); reload.server.orders = clone(h.server.orders); reload.server.currentOrder = clone(h.server.currentOrder); let restored;
  reload.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [], onRestoreExtras: ids => { restored = ids; } }); await tick(); reload.mount();
  assert.deepEqual(restored, [E]); assert.match(reload.html(), /Заказ №852 сохранён сервером/); assert.equal(reload.calls.filter(call => call.path === '/api/v2/orders/' && call.method === 'POST').length, 0); assert.equal(h.calls.filter(call => call.path === '/api/v2/orders/' && call.method === 'POST').length, 1); assert.equal(sessionStorage.getItem(keyFor()), null);
});
test('L1: absent result retains original quote/extras/key through manual retry, including changed service revision', async () => {
  global.sessionStorage = storage(); protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: true }); const h = harness();
  let tree = h.mount('LiveQuote', { serviceId: '811', serviceRevision: 4, performerId: 702, extras: [] }); await tick(); tree = h.mount(); assert.match(h.html(), /Редакция услуги изменилась/); assert.equal(button(tree, 'Обновить расчёт').props.disabled, true);
  checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.mount(); button(tree, 'Повторить создание с прежним ключом').props.onClick(); await tick(); h.mount(); const writes = h.calls.filter(call => call.path === '/api/v2/orders/' && call.method === 'POST'); assert.deepEqual(writes[0].body, { quote_id: Q, request_key: K }); assert.equal(h.server.orders.length, 1);
});
test('L1: unavailable quote blocks every new purchase until a matching server order is reconciled', async () => {
  global.sessionStorage = storage(); protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: true }); const h = harness(); h.server.quoteError = 404;
  let tree = h.mount('LiveQuote', { serviceId: '811', serviceRevision: 4, performerId: 702, extras: [] }); await tick(); tree = h.mount(); assert.equal(button(tree, 'Получить расчёт').props.disabled, true); assert.match(h.html(), /Новое оформление заблокировано/); assert.equal(checkbox(tree), undefined);
  h.server.orders = [order()]; h.server.currentOrder = { ...order(), status: 'cancelled', revision: 3, closed_at: at, available_actions: [] }; button(tree, 'Повторить чтение').props.onClick(); h.mount(); await tick(); h.mount(); assert.match(h.html(), /Отменён заказчиком/); assert.equal(h.calls.some(call => call.path === '/api/v2/orders/' && call.method === 'POST'), false);
});
test('L1: another account cannot discover pending identity; mismatched quote/service/performer fail closed', async () => {
  global.sessionStorage = storage(); protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: true }); const other = harness(702); other.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, extras: [] }); await tick(); const otherTree = other.mount(); assert.equal(other.calls.some(call => call.path.includes('/quotes/')), false); assert.equal(button(otherTree, 'Получить расчёт').props.disabled, false);
  for (const patch of [{ service_id: 999 }, { performer_id: 701 }, { performer_id: 799 }]) {
    const h = harness(); h.server.quoteValue = { ...quote(), ...patch }; h.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [] }); await tick(); const tree = h.mount(); assert.equal(button(tree, 'Получить расчёт').props.disabled, true); assert.equal(checkbox(tree), undefined);
  }
});
test('L1: corrupted or ambiguous attempted storage is not silently replaced by a new independent key', () => {
  global.sessionStorage = storage(); sessionStorage.setItem(keyFor(), '{invalid'); assert.equal(protocol.discoverPurchaseIntent(701, '811').blocked, true);
  sessionStorage.removeItem(keyFor()); protocol.savePurchaseIntent(protocol.purchaseStorageKey(701, '811', [E]), { quoteId: Q, requestKey: K, attempted: true }); protocol.savePurchaseIntent(protocol.purchaseStorageKey(701, '811', []), { quoteId: C, requestKey: E, attempted: true }); assert.equal(protocol.discoverPurchaseIntent(701, '811').blocked, true);
});
test('L1: an unattempted stale quote is discarded, while another service never inherits the pending quote', async () => {
  global.sessionStorage = storage(); protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: false }); const stale = harness(); stale.mount('LiveQuote', { serviceId: '811', serviceRevision: 4, performerId: 702, extras: [] }); await tick(); let tree = stale.mount(); assert.equal(checkbox(tree), undefined); assert.equal(button(tree, 'Получить расчёт').props.disabled, false); assert.equal(sessionStorage.getItem(keyFor()), null);
  protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: true }); const active = harness(); active.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [] }); await tick(); tree = active.mount(); assert.ok(checkbox(tree)); tree = active.mount('LiveQuote', { serviceId: '812', serviceRevision: 1, performerId: 799, extras: [] }); assert.equal(checkbox(tree), undefined); await tick(); tree = active.mount(); assert.equal(button(tree, 'Получить расчёт').props.disabled, false); assert.ok(sessionStorage.getItem(keyFor()));
});
test('L1: storage access failure blocks new checkout rather than losing an uncertain purchase key', async () => {
  global.sessionStorage = { getItem() { throw Error('Storage disabled'); }, setItem() { throw Error('Storage disabled'); }, removeItem() {} }; const h = harness(); h.mount('LiveQuote', { serviceId: '811', serviceRevision: 3, performerId: 702, extras: [] }); await tick(); const tree = h.mount(); assert.equal(button(tree, 'Получить расчёт').props.disabled, true); assert.match(h.html(), /Новое оформление заблокировано/); assert.equal(h.calls.some(call => call.method === 'POST'), false);
});
test('L1: 409 after an unknown purchase plus an empty order list cannot release the unresolved intent', async () => {
  global.sessionStorage = storage(); protocol.savePurchaseIntent(keyFor(), { quoteId: Q, requestKey: K, attempted: true }); const h = harness(); h.server.purchaseConflict = true;
  let tree = h.mount('LiveQuote', { serviceId: '811', serviceRevision: 4, performerId: 702, extras: [] }); await tick(); tree = h.mount(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.mount(); button(tree, 'Повторить создание с прежним ключом').props.onClick(); await tick(); tree = h.mount();
  assert.equal(button(tree, 'Обновить расчёт').props.disabled, true); assert.equal(checkbox(tree).props.checked, false); assert.match(h.html(), /результат предыдущего оформления пока не подтверждён/); assert.deepEqual(JSON.parse(sessionStorage.getItem(keyFor())), { quoteId: Q, requestKey: K, attempted: true }); assert.equal(h.calls.some(call => call.path === '/api/v2/quotes/' && call.method === 'POST'), false);
});
test('C1: immutable accept receipt replay is followed by GET and displays the later cancellation, not awaiting_payment', async () => {
  global.sessionStorage = storage(); const h = harness(702); const initial = { ...order(), available_actions: ['accept', 'decline'] }; h.server.currentOrder = clone(initial); h.server.failAction = true; h.resources.set('order:852', initial);
  let tree = h.mount('LiveOrderDetail', { id: '852' }); button(tree, 'Принять заказ').props.onClick(); tree = h.mount(); button(tree, 'Подтвердить действие').props.onClick(); await tick(); tree = h.mount(); assert.match(h.html(), /Результат запроса неизвестен/);
  h.server.currentOrder = { ...order(), status: 'cancelled', revision: 3, accepted_at: at, closed_at: at, available_actions: [] }; button(tree, 'Повторить с прежним ключом').props.onClick(); await tick(); h.mount();
  assert.equal([...h.server.actionReceipts.values()][0].status, 'awaiting_payment'); assert.match(h.html(), /Отменён заказчиком/); assert.doesNotMatch(h.html(), /Ожидает оплаты/); const writes = h.calls.filter(call => call.path.endsWith('/accept/')); assert.equal(writes.length, 2); assert.equal(writes[0].body.request_key, writes[1].body.request_key); assert.equal(h.calls.at(-1).path, '/api/v2/orders/852/');
});
test('C1: failed reconciliation never promotes old receipt into a current order and retains same-key retry', async () => {
  global.sessionStorage = storage(); const h = harness(702); const initial = { ...order(), available_actions: ['accept'] }; h.server.currentOrder = clone(initial); h.server.getOrderError = 502; h.resources.set('order:852', initial);
  let tree = h.mount('LiveOrderDetail', { id: '852' }); button(tree, 'Принять заказ').props.onClick(); tree = h.mount(); button(tree, 'Подтвердить действие').props.onClick(); await tick(); tree = h.mount(); assert.doesNotMatch(h.html(), /Ожидает оплаты/); assert.match(h.html(), /Результат запроса неизвестен/); assert.equal(button(tree, 'Принять заказ').props.disabled, true);
  h.server.getOrderError = 0; button(tree, 'Повторить с прежним ключом').props.onClick(); await tick(); h.mount(); const writes = h.calls.filter(call => call.path.endsWith('/accept/')); assert.equal(writes[0].body.request_key, writes[1].body.request_key); assert.match(h.html(), /Ожидает оплаты/);
});
test('C1: message retry reads every cursor page; immutable held receipt cannot regress released same-ID sequence', async () => {
  global.sessionStorage = storage(); const h = harness(); h.server.failMessage = true; h.resources.set(`conversation:${C}`, conversation()); h.resources.set(`messages:${C}`, { next: null, previous: null, results: [message()] });
  let tree = h.mount('LiveConversation', { id: C }); nodes(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Synthetic held then released' } }); tree = h.mount(); nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick(); tree = h.mount();
  const held = clone(h.server.messages[1]); assert.equal(held.status, 'held'); h.server.messages[1] = { ...held, status: 'stored', sequence: 8, warning: null, security_case_id: null }; h.server.messagePages = true;
  nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick(); tree = h.mount(); assert.equal([...h.server.messageReceipts.values()][0].status, 'held'); assert.equal(nodes(tree, node => node.type === 'li' && text(node).includes('Synthetic held then released')).length, 1); assert.match(h.html(), /№8/); assert.doesNotMatch(h.html(), /Synthetic held warning|Посмотреть случай и обжаловать/);
  const posts = h.calls.filter(call => call.path.endsWith('/messages/') && call.method === 'POST'); assert.equal(posts[0].body.client_message_id, posts[1].body.client_message_id); assert.ok(h.calls.some(call => call.path.endsWith('/messages/') && call.query === '?cursor=next'));
});
