/* eslint-disable @typescript-eslint/no-require-imports -- The isolated Node harness executes actual TSX with private Provider/Next adapters. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness({ hooks = false, storage = new Map() } = {}) {
  const root = path.join(__dirname, '../src');
  const cache = new Map();
  const calls = [], navigations = [], slots = [], dependencies = new Map();
  let context, cursor = 0, effects = [], dirty = false, currentTree, currentComponent, currentProps;
  const isolatedHooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, values) {
      const index = cursor++, previous = dependencies.get(index);
      if (!previous || !values || values.some((value, i) => !Object.is(value, previous[i]))) effects.push(effect);
      dependencies.set(index, values);
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixture = { exports: {} };
    cache.set(file, fixture);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file }).outputText;
    const requireLocal = name => {
      if (name === 'react') return hooks ? isolatedHooks : React;
      if (name === './Provider') return { useDemoWorkspace: () => context };
      if (name === 'next/navigation') return { useRouter: () => ({ push: value => navigations.push(value), back() {} }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        return load([base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', compiled)(requireLocal, fixture, fixture.exports);
    return fixture.exports;
  }
  const views = load(path.join(root, 'features/demo-workspace/CommerceWorkspace.tsx'));
  const domain = load(path.join(root, 'features/demo-workspace/domain.ts'));
  context = {
    state: { ...domain.emptyWorkspace(), account: { id: 'demo-self', name: 'Fixture', university: '', city: '', about: '', description: 'Fixture', roles: ['customer', 'performer'], activeRole: 'customer', createdAt: 1, moderation: 'approved', moderationReason: '', examples: [{ id: 'example1', kind: 'link', title: 'Work', url: 'https://example.com' }] } },
    ready: true, busy: false, error: '', notice: '', retry() {}, sandboxEnabled: false,
    run: async (command, options) => { calls.push({ command, options }); return null; },
  };
  context.state.orders.push({ id: 'order1', customerId: 'demo-self', customerName: 'Fixture', performerId: 'fixture:1', performerName: 'Counterparty', serviceId: 1, serviceTitle: 'Test service', serviceDescription: 'Frozen description', serviceIncluded: ['Frozen item'], selectedExtras: [], money: domain.quoteMoney(100000, 0), days: 3, status: 'PENDING', revision: 0, conversationId: 'chat1', createdAt: 1, simulation: true, result: '', remarks: '', events: [], arbitration: null });
  context.state.conversations.push({ id: 'chat1', serviceId: 1, title: 'Test service', participants: ['demo-self', 'fixture:1'], participantNames: { 'demo-self': 'Fixture', 'fixture:1': 'Counterparty' }, orderId: 'order1', createdAt: 1 });
  function expand(element) {
    if (Array.isArray(element)) return element.map(expand);
    if (!React.isValidElement(element)) return element;
    if (typeof element.type === 'function') return expand(element.type(element.props));
    return React.createElement(element.type, { ...element.props, key: element.key }, expand(element.props.children));
  }
  function mount(name, props = currentProps ?? {}) {
    currentComponent = name; currentProps = props;
    for (let attempt = 0; attempt < 10; attempt++) {
      cursor = 0; effects = []; dirty = false;
      currentTree = expand(React.createElement(views[name], props));
      effects.forEach(effect => effect());
      if (!dirty) return currentTree;
    }
    throw Error('Component effects did not settle');
  }
  return {
    context, calls, navigations, storage, domain,
    html: (name, props = {}) => renderToStaticMarkup(React.createElement(views[name], props)),
    mount, rerender: () => mount(currentComponent, currentProps),
  };
}

function nodes(tree, predicate) {
  const result = [];
  function visit(value) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!React.isValidElement(value)) return;
    if (predicate(value)) result.push(value);
    visit(value.props.children);
  }
  visit(tree); return result;
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  return React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
}
const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node).includes(label))[0];
const checkbox = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0];
const tick = () => new Promise(resolve => setImmediate(resolve));
const ownService = (status = 'approved') => ({ id: 1000000000, performerId: 'demo-self', performerName: 'Fixture', title: 'Own service', category: 'Программирование', description: 'Description', included: ['Item'], price: 100000, days: 1, extras: [], exampleIds: ['example1'], status, reason: '', createdAt: 1, revision: 7 });
function control(tree, labelText) {
  const label = nodes(tree, node => node.type === 'label' && text(Array.isArray(node.props.children) ? node.props.children[0] : node.props.children) === labelText)[0];
  assert.ok(label, `label not found: ${labelText}`);
  return nodes(label, node => ['input', 'textarea', 'select'].includes(node.type))[0];
}
function connectDomain(h) {
  let sequence = 0;
  h.context.run = async (command, options = {}) => {
    h.calls.push({ command, options });
    try {
      const actor = options.actor ?? { id: h.context.state.account.id, role: h.context.state.account.activeRole };
      const result = h.domain.applyCommand(h.context.state, command, actor, `render-command-${++sequence}`, sequence);
      h.context.state = result.state; h.context.error = ''; h.context.notice = 'Сохранено в локальной Demo-модели.';
      return result.entityId;
    } catch (error) { h.context.error = error.message; throw error; }
  };
}
async function withSession(storage, operation) {
  const before = global.sessionStorage;
  global.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  try { return await operation(); }
  finally { if (before === undefined) delete global.sessionStorage; else global.sessionStorage = before; }
}

test('buyer/performer modes use exact participant IDs; role switching does not impersonate another account', () => {
  const h = harness();
  assert.doesNotMatch(h.html('OrderDetail', { id: 'order1' }), /Принять демо-заказ/);
  h.context.state.account.activeRole = 'performer';
  assert.doesNotMatch(h.html('OrderDetail', { id: 'order1' }), /Принять демо-заказ/);
  Object.assign(h.context.state.orders[0], { customerId: 'demo-guest-customer', performerId: 'demo-self' });
  assert.match(h.html('OrderDetail', { id: 'order1' }), /Принять демо-заказ/);
});

test('foreign orders and chats never reveal their contents or mutation controls', () => {
  const h = harness(); h.context.state.orders[0].customerId = 'someone-else'; h.context.state.conversations[0].participants = ['a', 'b'];
  const order = h.html('OrderDetail', { id: 'order1' }), chat = h.html('ChatDetail', { id: 'chat1' });
  assert.match(order, /Нет доступа к заказу/); assert.doesNotMatch(order, /Frozen description/);
  assert.match(chat, /Нет доступа к переписке/); assert.doesNotMatch(chat, /workspace-message/);
});

test('result/remarks iteration preserves REVIEW and blocks completion until corrected result', () => {
  const h = harness(); Object.assign(h.context.state.orders[0], { status: 'REVIEW', result: 'Done' });
  assert.match(h.html('OrderDetail', { id: 'order1' }), /Всё в порядке/);
  h.context.state.orders[0].remarks = 'Please fix';
  assert.doesNotMatch(h.html('OrderDetail', { id: 'order1' }), /Всё в порядке/);
  h.context.state.account.activeRole = 'performer'; Object.assign(h.context.state.orders[0], { customerId: 'demo-guest-customer', performerId: 'demo-self' });
  assert.match(h.html('OrderDetail', { id: 'order1' }), /Передать исправленный результат/);
});

test('one completed-order review is immutable and arbitration prohibits new review', () => {
  const h = harness(); h.context.state.orders[0].status = 'COMPLETED';
  assert.equal((h.html('OrderDetail', { id: 'order1' }).match(/type="radio"/g) ?? []).length, 5);
  h.context.state.reviews.push({ id: 'review1', orderId: 'order1', rating: 5, text: 'Good' });
  assert.match(h.html('OrderDetail', { id: 'order1' }), /Отзыв уже оставлен/);
  assert.doesNotMatch(h.html('OrderDetail', { id: 'order1' }), /type="radio"/);
  h.context.state.reviews = []; h.context.state.orders[0].arbitration = { stage: 'open', reason: 'Fixture' };
  assert.match(h.html('OrderDetail', { id: 'order1' }), /После арбитража отзыв запрещён/);
});

test('new commerce views render frozen composition and keep legacy activity classes isolated', () => {
  const h = harness();
  for (const [name, props] of [['OrderList', {}], ['OrderDetail', { id: 'order1' }], ['ChatList', {}], ['ChatDetail', { id: 'chat1' }]]) {
    const html = h.html(name, props); assert.doesNotMatch(html, /activity-/);
    if (name === 'OrderDetail') { assert.match(html, /Frozen description/); assert.match(html, /Frozen item/); }
    if (name === 'ChatDetail') assert.match(html, /\/orders\/order1/);
  }
});

test('storage failure offers retry instead of indefinite loading', () => {
  const h = harness(); h.context.ready = false; h.context.state = null; h.context.error = 'Storage unavailable';
  const html = h.html('OrderList'); assert.match(html, /Storage unavailable/); assert.match(html, /Повторить загрузку/); assert.doesNotMatch(html, /aria-busy="true"/);
});

test('service composer enforces profile approval and read-only pending/approved revisions', () => {
  const h = harness(); h.context.state.account.activeRole = 'performer'; h.context.state.account.moderation = 'pending';
  assert.match(h.html('ServiceComposer'), /Сначала подготовьте профиль/);
  h.context.state.account.moderation = 'approved';
  const service = { id: 1000000000, performerId: 'demo-self', performerName: 'Fixture', title: 'Draft', category: 'Программирование', description: 'Description', included: ['Item'], price: 100000, days: 1, extras: [], exampleIds: ['example1'], status: 'pending', reason: '', createdAt: 1, revision: 1 };
  h.context.state.services = [service];
  assert.match(h.html('ServiceComposer', { id: service.id }), /<fieldset disabled=/);
  service.status = 'approved'; assert.match(h.html('ServiceComposer', { id: service.id }), /Изменение опубликованной услуги пока недоступно/);
});

test('checkout shows confirmed 5% quote but blocks self-purchase', () => {
  const h = harness();
  const purchase = { serviceId: 1, performerId: 'fixture:1', performerName: 'Other', title: 'Service', base: 100000, days: 1, extras: [] };
  assert.match(h.html('DemoCheckout', { purchase }), /Комиссия STUDLY · 5%/);
  assert.match(h.html('DemoCheckout', { purchase }), /Симуляция оплаты, реальные деньги не списываются/);
  purchase.performerId = 'demo-self'; const html = h.html('DemoCheckout', { purchase });
  assert.match(html, /Оформить заказ у самого себя нельзя/); assert.doesNotMatch(html, /Симулировать оплату и создать заказ/);
});

test('explicit counterpart opt-in changes only command actor and keeps canonical conversation', async () => {
  const h = harness({ hooks: true });
  let tree = h.mount('ChatDetail', { id: 'chat1' });
  const input = () => nodes(tree, node => node.type === 'input' && node.props.id === 'workspace-message')[0];
  input().props.onChange({ target: { value: 'From owner' } }); tree = h.rerender();
  nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(h.calls[0].options.actor.id, 'demo-self');
  tree = h.rerender(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  input().props.onChange({ target: { value: 'From counterpart' } }); tree = h.rerender();
  const submit = nodes(tree, node => node.type === 'form')[0].props.onSubmit;
  submit({ preventDefault() {} }); submit({ preventDefault() {} }); await tick();
  assert.equal(h.calls.length, 2, 'double submit must not append a second message');
  assert.deepEqual(h.calls[1].options.actor, { id: 'fixture:1', role: 'performer' });
  assert.equal(h.calls[0].command.conversationId, h.calls[1].command.conversationId);
  assert.equal(h.context.state.account.activeRole, 'customer');
});

test('checkout requires consent, deduplicates double click and preserves intent across reload', async () => {
  const storage = new Map();
  await withSession(storage, async () => {
    const purchase = { revision: 0, serviceId: 1, performerId: 'fixture:1', performerName: 'Other', title: 'Service', base: 100000, days: 1, extras: [] };
    const h = harness({ hooks: true, storage }); let tree = h.mount('DemoCheckout', { purchase });
    button(tree, 'Симулировать оплату').props.onClick(); await tick(); assert.equal(h.calls.length, 0);
    checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
    const pay = button(tree, 'Симулировать оплату').props.onClick; pay(); pay(); await tick();
    assert.equal(h.calls.length, 1); const actionId = h.calls[0].options.actionId; assert.ok(actionId);
    const reload = harness({ hooks: true, storage }); tree = reload.mount('DemoCheckout', { purchase });
    checkbox(tree).props.onChange({ target: { checked: true } }); tree = reload.rerender();
    button(tree, 'Симулировать оплату').props.onClick(); await tick(); assert.equal(reload.calls[0].options.actionId, actionId);
    reload.context.state.applied[actionId] = { signature: 'fixture', entityId: 'existing-order' }; tree = reload.rerender();
    assert.ok(nodes(tree, node => node.type === 'a' && node.props.href === '/orders/existing-order').length);
    button(tree, 'Новый заказ').props.onClick(); tree = reload.rerender();
    assert.equal(checkbox(tree).props.checked, false); checkbox(tree).props.onChange({ target: { checked: true } }); tree = reload.rerender();
    button(tree, 'Симулировать оплату').props.onClick(); await tick(); assert.notEqual(reload.calls.at(-1).options.actionId, actionId);
  });
});

test('changing checkout conditions invalidates consent and obtains a different stable intent', async () => {
  await withSession(new Map(), async () => {
    const h = harness({ hooks: true }); const purchase = { serviceId: 1, performerId: 'fixture:1', performerName: 'Other', title: 'Service', base: 100000, days: 1, extras: [] };
    let tree = h.mount('DemoCheckout', { purchase }); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
    tree = h.mount('DemoCheckout', { purchase: { ...purchase, base: 200000, revision: 2 } });
    assert.equal(checkbox(tree).props.checked, false); assert.equal(button(tree, 'Симулировать оплату').props.disabled, true);
    assert.equal(h.calls.length, 0);
  });
});

test('incoming-order simulation requires an approved own service and the performer mode', () => {
  const h = harness(), service = ownService();
  const purchase = { revision: service.revision, serviceId: service.id, performerId: service.performerId, performerName: service.performerName, title: service.title, base: service.price, days: service.days, extras: [] };
  assert.equal(h.html('IncomingDemoOrder', { purchase }), '', 'absent/unapproved own service cannot expose a purchase simulator');
  h.context.state.services = [service];
  assert.match(h.html('IncomingDemoOrder', { purchase }), /Переключитесь в режим исполнителя/);
  h.context.state.account.activeRole = 'performer';
  const html = h.html('IncomingDemoOrder', { purchase });
  assert.match(html, /Включить тестового участника/); assert.doesNotMatch(html, /Симулировать оплату и создать заказ/);
  service.status = 'pending'; assert.equal(h.html('IncomingDemoOrder', { purchase }), '');
});

test('incoming order needs both explicit opt-ins, uses a separate guest actor and deduplicates after reload', async () => {
  const storage = new Map();
  await withSession(storage, async () => {
    const service = ownService(), purchase = { revision: service.revision, serviceId: service.id, performerId: service.performerId, performerName: service.performerName, title: service.title, base: service.price, days: service.days, extras: [] };
    const h = harness({ hooks: true }); h.context.state.account.activeRole = 'performer'; h.context.state.services = [service];
    let tree = h.mount('IncomingDemoOrder', { purchase });
    assert.equal(button(tree, 'Симулировать оплату'), undefined);
    checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
    assert.equal(button(tree, 'Симулировать оплату').props.disabled, true);
    const checks = nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox');
    checks[1].props.onChange({ target: { checked: true } }); tree = h.rerender();
    const pay = button(tree, 'Симулировать оплату').props.onClick; pay(); pay(); await tick();
    assert.equal(h.calls.length, 1); assert.deepEqual(h.calls[0].options.actor, { id: 'demo-guest-customer', role: 'customer' });
    assert.equal(h.calls[0].command.purchase.performerId, 'demo-self');
    assert.equal(h.context.state.account.id, 'demo-self'); assert.equal(h.context.state.account.activeRole, 'performer');
    const actionId = h.calls[0].options.actionId;
    const reload = harness({ hooks: true }); reload.context.state.account.activeRole = 'performer'; reload.context.state.services = [service];
    tree = reload.mount('IncomingDemoOrder', { purchase }); checkbox(tree).props.onChange({ target: { checked: true } }); tree = reload.rerender();
    nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } }); tree = reload.rerender();
    button(tree, 'Симулировать оплату').props.onClick(); await tick();
    assert.equal(reload.calls[0].options.actionId, actionId, 'reload preserves the incoming purchase intent');
  });
});

test('performer-owned order simulates customer remarks/completion/review only through an explicit counterpart opt-in', async () => {
  const h = harness({ hooks: true });
  h.context.state.account.activeRole = 'performer';
  const order = h.context.state.orders[0];
  Object.assign(order, { customerId: 'demo-guest-customer', customerName: 'Demo customer', performerId: 'demo-self', performerName: 'Fixture', status: 'REVIEW', result: 'Initial result' });
  let tree = h.mount('OrderDetail', { id: order.id });
  assert.equal(button(tree, 'Всё в порядке'), undefined);
  h.context.state.account.activeRole = 'customer'; tree = h.rerender();
  assert.equal(button(tree, 'Всё в порядке'), undefined, 'ordinary role switch must not change the participant identity');
  h.context.state.account.activeRole = 'performer'; tree = h.rerender();
  checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  const remarks = nodes(tree, node => node.type === 'textarea' && node.props.placeholder === 'Объясните, что требуется исправить')[0];
  remarks.props.onChange({ target: { value: 'Please revise' } }); tree = h.rerender();
  nodes(tree, node => node.type === 'form' && text(node).includes('Передать замечания'))[0].props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(h.calls.at(-1).command.type, 'order.remarks'); assert.deepEqual(h.calls.at(-1).options.actor, { id: 'demo-guest-customer', role: 'customer' });
  order.remarks = 'Please revise'; order.revision++;
  tree = h.rerender(); assert.equal(button(tree, 'Всё в порядке'), undefined);
  checkbox(tree).props.onChange({ target: { checked: false } }); tree = h.rerender();
  assert.ok(button(tree, 'Передать исправленный результат'));
  order.remarks = ''; order.result = 'Corrected result'; order.revision++;
  tree = h.rerender(); checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  button(tree, 'Всё в порядке').props.onClick(); await tick();
  assert.equal(h.calls.at(-1).command.type, 'order.complete'); assert.deepEqual(h.calls.at(-1).options.actor, { id: 'demo-guest-customer', role: 'customer' });
  order.status = 'COMPLETED'; tree = h.rerender();
  nodes(tree, node => node.type === 'input' && node.props.type === 'radio' && node.props.value === 5)[0].props.onChange(); tree = h.rerender();
  nodes(tree, node => node.type === 'form' && text(node).includes('Оставить демо-отзыв'))[0].props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(h.calls.at(-1).command.type, 'review'); assert.equal(h.calls.at(-1).command.rating, 5);
  assert.deepEqual(h.calls.at(-1).options.actor, { id: 'demo-guest-customer', role: 'customer' });
  assert.equal(h.context.state.account.activeRole, 'performer');
});

test('editing a saved service passes its optimistic revision rather than silently overwriting', async () => {
  const h = harness({ hooks: true }), service = ownService('draft');
  h.context.state.account.activeRole = 'performer'; h.context.state.services = [service];
  const tree = h.mount('ServiceComposer', { id: service.id });
  button(tree, 'Сохранить черновик').props.onClick(); await tick();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].command.type, 'service.save');
  assert.equal(h.calls[0].command.id, service.id); assert.equal(h.calls[0].command.revision, service.revision);
});

test('incomplete new form saves raw fields without creating/publishing a service and restores on reload', async () => {
  const h = harness({ hooks: true }); h.context.state.account.activeRole = 'performer'; connectDomain(h);
  let tree = h.mount('ServiceComposer');
  control(tree, 'Название услуги').props.onChange({ target: { value: 'Незавершённый пример' } }); tree = h.rerender();
  control(tree, 'Цена, ₽').props.onChange({ target: { value: 'ещё не выбрана' } }); tree = h.rerender();
  const save = button(tree, 'Сохранить черновик').props.onClick; save(); save(); await tick(); tree = h.rerender();
  assert.equal(h.calls.length, 1, 'double save of an incomplete form must be coalesced');
  assert.equal(h.calls[0].command.type, 'service.form'); assert.equal(h.calls[0].command.key, 'new');
  assert.equal(h.calls[0].command.revision, null); assert.equal(h.calls[0].command.serviceRevision, null);
  assert.equal(h.context.state.services.length, 0); assert.equal(h.context.state.composerDrafts.new.form.price, 'ещё не выбрана');
  assert.equal(button(tree, 'Отправить на демо-модерацию').props.disabled, true);
  assert.match(text(tree), /Незаполненная форма сохранена/);
  const reload = harness({ hooks: true }); reload.context.state = structuredClone(h.context.state);
  tree = reload.mount('ServiceComposer');
  assert.equal(control(tree, 'Название услуги').props.value, 'Незавершённый пример');
  assert.equal(control(tree, 'Цена, ₽').props.value, 'ещё не выбрана');
  assert.match(text(tree), /форма восстановлена/); assert.equal(button(tree, 'Отправить на демо-модерацию').props.disabled, true);
});

test('completing a recovered form creates one valid draft and clears its partial buffer atomically', async () => {
  const h = harness({ hooks: true }); h.context.state.account.activeRole = 'performer';
  h.context.state.composerDrafts = { new: { revision: 3, serviceRevision: null, form: { title: 'Recovered', category: '', description: '', included: '', price: '', days: '', extras: [], exampleIds: [] } } }; connectDomain(h);
  let tree = h.mount('ServiceComposer');
  for (const [label, value] of [['Категория', 'Программирование'], ['Описание', 'Description'], ['Что входит в услугу', 'Item\nReview'], ['Цена, ₽', '10,25'], ['Срок, дней', '3']]) {
    control(tree, label).props.onChange({ target: { value } }); tree = h.rerender();
  }
  checkbox(tree).props.onChange({ target: { checked: true } }); tree = h.rerender();
  button(tree, 'Сохранить черновик').props.onClick(); await tick(); tree = h.rerender();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].command.type, 'service.save'); assert.equal(h.calls[0].command.formRevision, 3);
  assert.equal(h.context.state.services.length, 1); assert.equal(h.context.state.services[0].price, 1025);
  assert.deepEqual(h.context.state.services[0].included, ['Item', 'Review']); assert.equal(h.context.state.composerDrafts.new, undefined);
  assert.equal(h.context.state.services[0].status, 'draft');
  assert.ok(h.navigations.includes(`/create-service?edit=${h.context.state.services[0].id}`));
});

test('an external partial-buffer update is not silently adopted or overwritten by stale editor fields', async () => {
  const h = harness({ hooks: true }), service = ownService('draft'); h.context.state.account.activeRole = 'performer'; h.context.state.services = [service];
  const key = String(service.id), original = { title: 'Original partial', category: '', description: '', included: '', price: '', days: '', extras: [], exampleIds: [] };
  h.context.state.composerDrafts = { [key]: { revision: 1, serviceRevision: service.revision, form: original } }; connectDomain(h);
  let tree = h.mount('ServiceComposer', { id: service.id });
  h.context.state.composerDrafts[key] = { revision: 2, serviceRevision: service.revision, form: { ...original, title: 'Other tab partial' } };
  tree = h.rerender(); assert.equal(control(tree, 'Название услуги').props.value, 'Original partial');
  assert.match(text(tree), /изменилась в другой вкладке/);
  button(tree, 'Сохранить черновик').props.onClick(); await tick(); tree = h.rerender();
  assert.equal(h.calls[0].command.revision, 1); assert.equal(h.context.state.composerDrafts[key].revision, 2);
  assert.equal(h.context.state.composerDrafts[key].form.title, 'Other tab partial');
  assert.equal(control(tree, 'Название услуги').props.value, 'Original partial');
  button(tree, 'Загрузить сохранённую версию').props.onClick(); tree = h.rerender();
  assert.equal(control(tree, 'Название услуги').props.value, 'Other tab partial');
});

test('a valid stale editor uses its captured service revision after external state refresh', async () => {
  const h = harness({ hooks: true }), service = ownService('draft'); h.context.state.account.activeRole = 'performer'; h.context.state.services = [service]; connectDomain(h);
  let tree = h.mount('ServiceComposer', { id: service.id });
  control(tree, 'Название услуги').props.onChange({ target: { value: 'My unsaved change' } }); tree = h.rerender();
  h.context.state.services[0] = { ...service, revision: 8, title: 'Saved by another tab' };
  tree = h.rerender(); assert.equal(control(tree, 'Название услуги').props.value, 'My unsaved change');
  button(tree, 'Сохранить черновик').props.onClick(); await tick(); tree = h.rerender();
  assert.equal(h.calls[0].command.revision, 7); assert.equal(h.context.state.services[0].revision, 8);
  assert.equal(h.context.state.services[0].title, 'Saved by another tab');
  assert.equal(control(tree, 'Название услуги').props.value, 'My unsaved change');
});

test('a partial buffer from a different service revision is preserved but not restored over current service fields', () => {
  const h = harness({ hooks: true }), service = ownService('draft'); h.context.state.account.activeRole = 'performer'; h.context.state.services = [service];
  h.context.state.composerDrafts = { [String(service.id)]: { revision: 1, serviceRevision: service.revision - 1, form: { title: 'Outdated partial', category: '', description: '', included: '', price: '', days: '', extras: [], exampleIds: [] } } };
  const tree = h.mount('ServiceComposer', { id: service.id });
  assert.equal(control(tree, 'Название услуги').props.value, service.title);
  assert.match(text(tree), /относится к другой редакции/); assert.equal(h.context.state.composerDrafts[String(service.id)].form.title, 'Outdated partial');
  assert.equal(button(tree, 'Отправить на демо-модерацию').props.disabled, true);
});

test('moderation submission captures the rendered workspace revision before another queued mutation', async () => {
  const h = harness({ hooks: true }), service = ownService('draft'); h.context.state.account.activeRole = 'performer'; h.context.state.services = [service];
  const tree = h.mount('ServiceComposer', { id: service.id });
  const viewedRevision = h.context.state.revision;
  h.context.state = { ...h.context.state, revision: viewedRevision + 1 };
  button(tree, 'Отправить на демо-модерацию').props.onClick(); await tick();
  assert.equal(h.calls[0].command.type, 'service.submit');
  assert.equal(h.calls[0].options.expectedRevision, viewedRevision);
});
