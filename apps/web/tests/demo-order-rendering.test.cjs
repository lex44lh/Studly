/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node regression harness renders the actual TSX views after their storage effects. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Each mount has private hooks/storage: no browser data, writes or migrations.
function mount(relativePath, order, props = {}) {
  const states = [];
  const effects = [];
  const storage = new Map([
    ['studly-orders', JSON.stringify([order])],
    ['studly-chats', JSON.stringify([{ id: 7, orderId: order.id, serviceTitle: 'Fixture', performerName: order.performerName }])],
  ]);
  const initialOrders = storage.get('studly-orders');
  const initialChats = storage.get('studly-chats');
  const originalStorage = global.localStorage;
  let cursor = 0;
  let collectEffects = true;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect) { if (collectEffects) effects.push(effect); },
    useRef() { return { current: null }; },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixture = { exports: {} };
    cache.set(file, fixture);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: file,
    }).outputText;
    const localRequire = name => {
      if (name === 'react') return hooks;
      if (name === '@/features/live-commerce') return new Proxy({}, { get: () => () => { throw new Error('A Demo regression view must not render a Live commerce branch'); } });
      if (name === '@/features/demo-workspace/Provider') return { useOptionalDemoWorkspace: () => null };
      if (name === 'next/navigation') return { useRouter: () => ({ push() {}, back() {} }), useParams: () => ({ id: String(order.id) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...rest }) => React.createElement('a', rest, children) };
      if (name === '@/lib/data-mode') return { demoMode: true };
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        return load([base, `${base}.tsx`, `${base}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', compiled)(localRequire, fixture, fixture.exports);
    return fixture.exports;
  }
  try {
    global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const Component = load(path.join(__dirname, '../src', relativePath)).default;
    // Route components now select a separate Demo/Live child. Execute the real
    // selected Demo view before collecting its legacy storage effects.
    const renderView = () => {
      let tree = Component(props);
      while (React.isValidElement(tree) && typeof tree.type === 'function') tree = tree.type(tree.props);
      return tree;
    };
    renderView(); // Initial render collects storage effects.
    effects.forEach(effect => effect());
    collectEffects = false;
    cursor = 0;
    const tree = renderView();
    const html = renderToStaticMarkup(tree);
    assert.equal(storage.get('studly-orders'), initialOrders, 'rendering must not rewrite persisted orders');
    assert.equal(storage.get('studly-chats'), initialChats, 'rendering must not rewrite persisted chats');
    return { html, tree };
  } finally {
    if (originalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalStorage;
  }
}

const views = [
  ['orders list', 'app/orders/page.tsx', {}],
  ['order detail', 'app/orders/[id]/page.tsx', {}],
  ['linked chat', 'components/ChatWindow.tsx', { chatId: '7', orderId: 1, user: undefined, service: 'Fixture' }],
];
const invalidStatuses = [undefined, null, 42, true, {}, [], 'UNRECOGNIZED', '__proto__', 'constructor', ''];
for (const [view, file, props] of views) {
  for (const status of invalidStatuses) {
    test(`${view}: renders persisted ${JSON.stringify(status) ?? 'missing'} status without inventing an action`, () => {
      const order = { id: 1, serviceTitle: 'Fixture', createdAt: 0 };
      if (status !== undefined) order.status = status;
      const { html } = mount(file, order, props);
      assert.match(html, /Статус (?:не указан|недоступен)/);
      assert.doesNotMatch(html, /Принять заказ|Работа выполнена|Всё в порядке|Удалить заказ/);
      assert.doesNotMatch(html, /activity-status--(?:pending|in_progress|review|completed)/);
    });
  }
  for (const [status, label, action] of [
    ['PENDING', 'Ожидает', 'Принять заказ'],
    ['IN_PROGRESS', 'В работе', 'Работа выполнена'],
    ['REVIEW', 'На рассмотрении', 'Всё в порядке'],
    ['COMPLETED', 'Завершён', 'Удалить заказ'],
  ]) {
    test(`${view}: preserves ${status} label, styling and existing action`, () => {
      const { html } = mount(file, { id: 1, serviceTitle: 'Fixture', performerName: 'Анна', status, createdAt: 0 }, props);
      assert.match(html, new RegExp(`activity-status--${status.toLowerCase()}`));
      assert.ok(html.includes(label));
      if (view === 'order detail') assert.ok(html.includes(action));
    });
  }
}
for (const performerName of [undefined, null, 42, {}, '', '   ', 'Анна']) {
  test(`order detail and chats: safe performer presentation for ${JSON.stringify(performerName) ?? 'missing'}`, () => {
    for (const file of ['app/orders/page.tsx', 'app/orders/[id]/page.tsx', 'app/chats/page.tsx']) {
      const { html } = mount(file, { id: 1, performerName, serviceTitle: 'Fixture', createdAt: 0, status: 'PENDING' });
      assert.match(html, performerName === 'Анна' ? /Анна/ : /Не указан/);
    }
    const { html } = mount('components/ChatWindow.tsx', { id: 1, status: 'PENDING' }, { chatId: '7', orderId: 1, user: performerName, service: 'Fixture' });
    assert.match(html, performerName === 'Анна' ? /Анна/ : /Не указан/);
  });
}
