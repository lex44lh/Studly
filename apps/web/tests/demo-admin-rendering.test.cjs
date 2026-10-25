/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node harness renders the actual admin TSX and canonical domain without browser storage. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const jsxRuntime = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(options = {}) {
  const states = [];
  let cursor = 0;
  let nodes = [];
  let retries = 0;
  const calls = [];
  const provider = { state: null, ready: true, busy: false, error: '', notice: '', sandboxEnabled: true,
    retry() { retries++; }, getAsset: async () => undefined,
    async run(command, runOptions) {
      calls.push({ command, options: runOptions });
      if (runOptions.expectedRevision !== undefined && runOptions.expectedRevision !== provider.state.revision) {
        throw new domain.DemoError('Данные изменились. Повторно просмотрите заявку перед решением.', 'conflict');
      }
      const next = domain.applyCommand(provider.state, command, runOptions.actor, runOptions.actionId, now + 10000, true);
      provider.state = next.state;
      provider.notice = 'Сохранено в локальной Demo-модели.';
      return next.entityId;
    },
  };
  const hooks = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  } };
  const runtime = { ...jsxRuntime, jsx: (...args) => { const node = jsxRuntime.jsx(...args); if (typeof args[0] === 'string') nodes.push(node); return node; },
    jsxs: (...args) => { const node = jsxRuntime.jsxs(...args); if (typeof args[0] === 'string') nodes.push(node); return node; } };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const item = { exports: {} };
    cache.set(file, item);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file,
    }).outputText;
    const localRequire = name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return runtime;
      if (name === './Provider') return { useDemoWorkspace: () => provider };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.endsWith('.css')) return new Proxy({ __esModule: false }, { get: (target, key) => key === '__esModule' ? false : String(key) });
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const resolved = [base, `${base}.tsx`, `${base}.ts`].find(value => fs.existsSync(value) && fs.statSync(value).isFile());
        assert.ok(resolved, `Missing dependency: ${name}`);
        return load(resolved);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', compiled)(localRequire, item, item.exports);
    return item.exports;
  }
  const domain = load(path.join(__dirname, '../src/features/demo-workspace/domain.ts'));
  const model = load(path.join(__dirname, '../src/features/demo-workspace/model.ts'));
  const admin = load(path.join(__dirname, '../src/features/demo-workspace/AdminWorkspace.tsx'));
  provider.state = domain.emptyWorkspace();
  Object.assign(provider, options);
  function render() { cursor = 0; nodes = []; return renderToStaticMarkup(React.createElement(admin.default)); }
  function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); return React.isValidElement(node) ? React.Children.toArray(node.props.children).map(text).join('') : ''; }
  function find(type, predicate) { const node = nodes.find(item => item.type === type && predicate(item)); assert.ok(node, `Missing rendered ${type}`); return node; }
  function button(label) { return find('button', node => text(node).trim() === label); }
  function changeAccess(value) { find('select', node => text(node).includes('Все тестовые представления')).props.onChange({ target: { value } }); return render(); }
  function start() { render(); button('Открыть тестовое рабочее место').props.onClick(); return render(); }
  function command(command, actor, id, at = now) { provider.state = domain.applyCommand(provider.state, command, actor, id, at, true).state; }
  return { provider, calls, admin, model, domain, render, find, button, text, changeAccess, start, command, get retries() { return retries; } };
}

const now = Date.parse('2026-10-22T18:00:00Z');
const self = { id: 'demo-self', role: 'performer' };
const customer = { id: 'demo-guest-customer', role: 'customer' };
const moderator = { id: 'demo-moderator', role: 'moderator' };
function registration(h) {
  const draft = structuredClone(h.provider.state.draft);
  draft.roles = ['customer', 'performer'];
  draft.profile.displayName = 'Demo account';
  draft.profile.university = 'Test University';
  draft.performer.description = 'Confirmed profile description';
  h.command({ type: 'registration', draft }, { id: 'demo-self', role: 'customer' }, 'registration');
  h.command({ type: 'register' }, { id: 'demo-self', role: 'customer' }, 'register');
  h.command({ type: 'role', role: 'performer' }, { id: 'demo-self', role: 'customer' }, 'role');
  h.command({ type: 'example.add', example: { id: 'example-a', title: 'Example A', kind: 'link', url: 'https://example.org/work' } }, self, 'example');
  h.command({ type: 'profile.submit' }, self, 'profile-submit');
}
function approvedAccount(h) { registration(h); h.command({ type: 'profile.decide', decision: 'approved', reason: '' }, moderator, 'profile-approved'); }
function service(h, index = 0, status = 'pending') {
  h.command({ type: 'service.save', input: { title: `Service ${String(index).padStart(2, '0')}`, category: 'Code', description: 'Service description', included: ['One item'], price: 100000 + index * 100, days: 3, extras: [], exampleIds: ['example-a'] } }, self, `save-${index}`, now + index * 1000);
  const item = h.provider.state.services.at(-1);
  if (status !== 'draft') h.command({ type: 'service.submit', id: item.id }, self, `submit-${index}`, now + index * 1000);
  if (status === 'approved') h.command({ type: 'service.decide', id: item.id, decision: 'approved', reason: '' }, moderator, `approve-${index}`, now + index * 1000);
  return item.id;
}
function completedOrder(h) {
  approvedAccount(h);
  const id = service(h, 0, 'approved');
  h.command({ type: 'purchase', simulated: true, purchase: { serviceId: id, performerId: self.id, performerName: 'Demo account', title: 'Service 00', base: 100000, days: 3, extras: [] } }, customer, 'purchase');
  const orderId = h.provider.state.orders[0].id;
  h.command({ type: 'order.accept', id: orderId, revision: 0 }, self, 'accept');
  h.command({ type: 'order.result', id: orderId, revision: 1, text: 'PRIVATE_RESULT_MATERIAL' }, self, 'result');
  h.command({ type: 'order.complete', id: orderId, revision: 2 }, customer, 'complete');
  h.command({ type: 'review', orderId, rating: 5, text: 'Permitted review' }, customer, 'review');
  h.command({ type: 'message', conversationId: h.provider.state.orders[0].conversationId, text: 'PRIVATE_CHAT_NOT_VISIBLE' }, self, 'private-message');
  return orderId;
}

test('disabled admin sandbox renders a closed state and exposes no canonical account data or actions', () => {
  const h = harness({ sandboxEnabled: false }); registration(h);
  const html = h.render();
  assert.match(html, /Административный sandbox закрыт/);
  assert.doesNotMatch(html, /Demo account|Test University|Example A|Профили на проверке/);
  assert.equal(h.calls.length, 0);
});

test('enabled sandbox still requires an explicit start and rendering never invokes commands', () => {
  const h = harness(); registration(h);
  assert.match(h.render(), /Рабочее место модератора/);
  assert.doesNotMatch(h.render(), /Пользователей в workspace|Demo account/);
  const html = h.start();
  assert.match(html, /Пользователей в workspace/);
  assert.match(html, /Профиль ожидает проверки/);
  assert.equal(h.calls.length, 0);
});

test('initial storage errors show retry instead of an endless loading skeleton', () => {
  const h = harness({ state: null, ready: false, error: 'Storage unavailable' });
  const html = h.render();
  assert.match(html, /Storage unavailable/);
  assert.doesNotMatch(html, /Восстанавливаем единое локальное состояние/);
  h.button('Повторить загрузку').props.onClick();
  assert.equal(h.retries, 1);
  assert.equal(h.calls.length, 0);
});

test('profile rejection requires a reason and a separate confirmation before the canonical command runs', async () => {
  const h = harness(); registration(h); h.start();
  h.button('Профили на проверке1').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === 'Открыть: Demo account').props.onClick();
  let html = h.render();
  assert.match(html, /Example A/);
  h.find('select', node => h.text(node).includes('Отклонить с причиной')).props.onChange({ target: { value: 'rejected' } }); h.render();
  assert.equal(h.button('Проверить и подтвердить решение').props.disabled, true);
  h.find('textarea', () => true).props.onChange({ target: { value: 'Add a clearer example' } }); h.render();
  h.button('Проверить и подтвердить решение').props.onClick();
  html = h.render();
  assert.match(html, /Подтвердить: Отклонено/);
  assert.equal(h.calls.length, 0);
  h.button('Подтвердить Demo-решение').props.onClick(); await Promise.resolve();
  html = h.render();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].command.type, 'profile.decide');
  assert.equal(h.calls[0].options.expectedRevision, h.provider.state.revision - 1);
  assert.deepEqual(h.calls[0].options.actor, moderator);
  assert.equal(h.provider.state.account.moderation, 'rejected');
  assert.equal(h.provider.state.adminEvents.at(-1).reason, 'Add a clearer example');
  assert.doesNotMatch(html, /Проверить и подтвердить решение/);
});

test('service moderation uses the shared canonical service and never a manual order or payment command', async () => {
  const h = harness(); approvedAccount(h); const id = service(h); h.start();
  h.button('Услуги1').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === 'Открыть: Service 00').props.onClick(); h.render();
  h.button('Проверить и подтвердить решение').props.onClick(); h.render();
  h.button('Подтвердить Demo-решение').props.onClick(); await Promise.resolve(); h.render();
  assert.equal(h.provider.state.services.find(item => item.id === id).status, 'approved');
  assert.deepEqual(h.calls.map(call => call.command.type), ['service.decide']);
  assert.equal(h.calls[0].options.expectedRevision, h.provider.state.revision - 1);
  assert.equal(h.provider.state.adminEvents.at(-1).type, 'service');
});

for (const target of ['profile', 'service']) test(`a queued change between the ${target} confirmation check and repository execution cannot be approved`, async () => {
  const h = harness();
  if (target === 'profile') registration(h);
  else { approvedAccount(h); service(h); }
  h.start();
  h.button(target === 'profile' ? 'Профили на проверке1' : 'Услуги1').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === `Открыть: ${target === 'profile' ? 'Demo account' : 'Service 00'}`).props.onClick(); h.render();
  const reviewedRevision = h.provider.state.revision;
  h.button('Проверить и подтвердить решение').props.onClick(); h.render();
  const run = h.provider.run;
  h.provider.run = async (command, options) => {
    // A queued write completes after confirmDecision's synchronous UI check.
    // The real repository's revision precondition must still see the reviewed
    // revision; re-rendering the confirmation is deliberately not part of this race.
    h.command({ type: 'role', role: 'customer' }, self, `queued-role-${target}`);
    return run(command, options);
  };
  h.button('Подтвердить Demo-решение').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const html = h.render();
  assert.equal(h.calls[0].options.expectedRevision, reviewedRevision);
  assert.match(html, /Данные изменились/);
  assert.equal(target === 'profile' ? h.provider.state.account.moderation : h.provider.state.services[0].status, 'pending');
  assert.equal(h.provider.state.adminEvents.filter(event => event.type === target).length, 0);
  assert.equal(h.provider.notice, '');
});

test('a workspace change after reviewing a profile blocks the old confirmation until another review', async () => {
  const h = harness(); registration(h); h.start();
  h.button('Профили на проверке1').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === 'Открыть: Demo account').props.onClick(); h.render();
  h.button('Проверить и подтвердить решение').props.onClick(); h.render();
  h.command({ type: 'role', role: 'customer' }, self, 'concurrent-role');
  h.render();
  h.button('Подтвердить Demo-решение').props.onClick(); await Promise.resolve();
  const html = h.render();
  assert.match(html, /Данные изменились/);
  assert.equal(h.provider.state.account.moderation, 'pending');
  assert.equal(h.provider.state.adminEvents.length, 0);
  assert.equal(h.calls.length, 0);
});

test('failed persistence keeps the moderation reason and never displays a successful decision', async () => {
  const h = harness(); registration(h); h.start();
  h.button('Профили на проверке1').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === 'Открыть: Demo account').props.onClick(); h.render();
  h.find('select', node => h.text(node).includes('Отклонить с причиной')).props.onChange({ target: { value: 'changes' } }); h.render();
  h.find('textarea', () => true).props.onChange({ target: { value: 'Preserve this reason' } }); h.render();
  h.button('Проверить и подтвердить решение').props.onClick(); h.render();
  h.provider.run = async () => { throw new Error('Storage write failed'); };
  h.button('Подтвердить Demo-решение').props.onClick(); await Promise.resolve();
  const html = h.render();
  assert.match(html, /Storage write failed/);
  assert.doesNotMatch(html, /Сохранено в локальной Demo-модели/);
  assert.equal(h.find('textarea', () => true).props.value, 'Preserve this reason');
  assert.equal(h.provider.state.account.moderation, 'pending');
  assert.equal(h.provider.state.adminEvents.length, 0);
});

test('finance view shows preserved money snapshots without exposing private results or messages', () => {
  const h = harness(); const orderId = completedOrder(h); h.start(); h.changeAccess('finance');
  h.button('Финансы').props.onClick(); h.render();
  h.find('button', node => node.props['aria-label'] === 'Открыть: Service 00').props.onClick();
  const html = h.render();
  assert.match(html, /Симуляция|симуляции/);
  assert.match(html, /Комиссия в снимке · 5%/);
  assert.doesNotMatch(html, /PRIVATE_RESULT_MATERIAL|PRIVATE_CHAT_NOT_VISIBLE|Позиция исполнителя/);
  assert.equal(h.provider.state.orders.find(order => order.id === orderId).money.total, 105000);
  assert.equal(h.calls.length, 0);
});

test('support security view has no general chat browser, AI monitoring, working sanctions or fake cases', () => {
  const h = harness(); completedOrder(h); h.start(); h.changeAccess('support');
  h.button('Жалобы и безопасность').props.onClick();
  const html = h.render();
  assert.match(html, /Обращения не подключены/);
  assert.match(html, /AI-модерация отложена/);
  assert.doesNotMatch(html, /PRIVATE_CHAT_NOT_VISIBLE|PRIVATE_RESULT_MATERIAL/);
  assert.equal(h.button('Ограничить аккаунт').props.disabled, true);
});

test('view scopes restrict projections and global search to available sections', () => {
  const h = harness(); completedOrder(h);
  assert.deepEqual(h.admin.adminRows(h.provider.state, 'users', 'finance'), []);
  assert.deepEqual(h.admin.adminRows(h.provider.state, 'profiles', 'support'), []);
  assert.deepEqual(h.admin.adminRows(h.provider.state, 'events', 'support'), []);
  assert.ok(h.admin.adminRows(h.provider.state, 'finance', 'finance').length);
  h.start(); h.changeAccess('finance');
  h.find('input', node => node.props.id === 'admin-global-search').props.onChange({ target: { value: 'Test University' } });
  assert.match(h.render(), /В доступных данных совпадений нет/);
});

test('metrics derive users, permitted reviews and money from canonical records without reading messages', () => {
  const h = harness(); completedOrder(h);
  Object.defineProperty(h.provider.state, 'messages', { get() { throw new Error('Admin must not read private messages'); } });
  const metrics = h.admin.adminMetrics(h.provider.state);
  assert.equal(metrics.users, 1);
  assert.equal(metrics.customers, 1);
  assert.equal(metrics.performers, 1);
  assert.equal(metrics.completedOrders, 1);
  assert.equal(metrics.activeOrders, 0);
  assert.equal(metrics.fees, 5000);
  assert.equal(metrics.turnover, 105000);
  assert.equal(metrics.reviews.length, 1);
});

test('filtering combines section/global query, statuses, roles and MSK dates without mutating records', () => {
  const h = harness(); approvedAccount(h); service(h, 0); service(h, 1, 'draft');
  const rows = h.admin.adminRows(h.provider.state, 'services', 'all');
  const original = JSON.stringify(rows);
  const view = { query: 'Service', status: 'pending', role: '', from: '2026-10-22', to: '2026-10-22', sort: 'name', page: 1 };
  assert.deepEqual(h.admin.filterAdminRows(rows, view, '00').map(row => row.title), ['Service 00']);
  assert.deepEqual(h.admin.filterAdminRows(rows, { ...view, role: 'customer' }), []);
  assert.deepEqual(h.admin.filterAdminRows(rows, { ...view, from: '2026-10-23', to: '' }), []);
  assert.equal(JSON.stringify(rows), original);
});

test('pagination and per-section query survive navigating away and back without changing canonical data', () => {
  const h = harness(); approvedAccount(h); for (let i = 0; i < 12; i++) service(h, i, 'draft');
  const snapshot = JSON.stringify(h.provider.state);
  h.start(); h.button('Услуги').props.onClick();
  let html = h.render();
  assert.equal((html.match(/data-label="Запись"/g) || []).length, 10);
  h.button('Далее').props.onClick(); html = h.render();
  assert.equal((html.match(/data-label="Запись"/g) || []).length, 2);
  h.find('input', node => node.props.placeholder === 'Название, имя или ID').props.onChange({ target: { value: 'Service 01' } });
  html = h.render();
  assert.equal((html.match(/data-label="Запись"/g) || []).length, 1);
  h.button('Пользователи').props.onClick(); h.render(); h.button('Услуги').props.onClick(); html = h.render();
  assert.match(html, /value="Service 01"/);
  assert.equal((html.match(/data-label="Запись"/g) || []).length, 1);
  assert.equal(JSON.stringify(h.provider.state), snapshot);
});
