/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real repository/domain without adding a test runtime dependency. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// This is a deliberately small semantic model, NOT native IndexedDB. It models
// this repository's overlapping store locks, request events, transactional local
// writes, commit/abort and structured clones. Browser IDB verification is separate.
function storageModel(seed) {
  const stores = new Map();
  let version = 0, active = null, holdNext = null, nextFailure = null;
  const pending = [], trace = [];
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const later = callback => setImmediate(callback);
  const wake = () => {
    if (active || !pending.length) return;
    active = pending.shift();
    active.start();
  };
  const finish = transaction => {
    if (active === transaction) active = null;
    wake();
  };
  function transaction(names, mode) {
    const scope = Array.isArray(names) ? names : [names];
    const requests = [], local = new Map();
    let started = false, ended = false, scheduled = false;
    const tx = {
      mode, error: null,
      objectStore(name) {
        assert.ok(scope.includes(name), 'repository must use stores in its transaction scope');
        function request(operation) {
          assert.equal(ended, false, 'no request may be queued after transaction completion');
          const result = { result: undefined, error: null };
          requests.push(() => {
            result.result = operation();
            result.onsuccess?.({ target: result });
          });
          schedule();
          return result;
        }
        return {
          get(key) { return request(() => clone(local.get(name).get(key))); },
          put(value, key) {
            assert.equal(mode, 'readwrite', 'readonly transactions cannot write');
            const copied = clone(value);
            return request(() => { local.get(name).set(key, copied); trace.push(['put', name, key]); return key; });
          },
        };
      },
      abort() {
        assert.equal(ended, false, 'only an active transaction can abort');
        ended = true;
        later(() => { trace.push(['abort', mode]); tx.onabort?.({ target: tx }); finish(tx); });
      },
      start() {
        started = true;
        scope.forEach(name => local.set(name, new Map([...stores.get(name)].map(([key, value]) => [key, clone(value)]))));
        trace.push(['start', mode]);
        schedule();
      },
    };
    function schedule() {
      if (!started || ended || scheduled) return;
      scheduled = true;
      later(() => {
        scheduled = false;
        if (ended) return;
        if (requests.length) {
          requests.shift()();
          schedule();
        } else {
          const commit = () => {
            if (ended) return;
            if (mode === 'readwrite' && nextFailure) {
              tx.error = nextFailure; nextFailure = null;
              tx.onerror?.({ target: tx }); tx.abort(); return;
            }
            ended = true;
            if (mode === 'readwrite') scope.forEach(name => stores.set(name, local.get(name)));
            trace.push(['complete', mode]); tx.oncomplete?.({ target: tx }); finish(tx);
          };
          if (mode === 'readwrite' && holdNext) {
            const gate = holdNext; holdNext = null;
            gate.ready(); gate.release = () => later(commit);
          } else commit();
        }
      });
    }
    pending.push(tx); later(wake);
    return tx;
  }
  const database = {
    objectStoreNames: { contains: name => stores.has(name) },
    createObjectStore(name) { stores.set(name, new Map()); },
    transaction,
    close() {},
  };
  return {
    indexedDB: {
      open() {
        const request = { result: database, error: null };
        later(() => {
          if (!version) {
            version = 1; request.onupgradeneeded?.({ target: request });
            if (seed !== undefined) stores.get('state').set('current', clone(seed));
          }
          request.onsuccess?.({ target: request });
        });
        return request;
      },
    },
    trace,
    stored: (name, key) => clone(stores.get(name)?.get(key)),
    holdCommit() {
      let ready;
      const waiting = new Promise(resolve => { ready = resolve; });
      const gate = { ready, release: null }; holdNext = gate;
      return { waiting, release: () => { assert.equal(typeof gate.release, 'function'); gate.release(); } };
    },
    failCommit(error = new DOMException('Storage quota exhausted', 'QuotaExceededError')) { nextFailure = error; return error; },
  };
}

function moduleLoader() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixtureModule = { exports: {} }; cache.set(file, fixtureModule);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = name => {
      if (name.startsWith('.') || name.startsWith('@/')) {
        const stem = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const target = [stem, `${stem}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!target) throw new Error(`Cannot resolve repository fixture ${name}`);
        return load(target);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, fixtureModule, fixtureModule.exports);
    return fixtureModule.exports;
  }
  const base = path.resolve(__dirname, '../src/features/demo-workspace');
  return { repository: () => load(path.join(base, 'repository.ts')), domain: () => load(path.join(base, 'domain.ts')) };
}

function setup(t, seed) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const storage = storageModel(seed);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: storage.indexedDB });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'indexedDB', original); else delete globalThis.indexedDB; });
  const first = moduleLoader(), second = moduleLoader();
  return { storage, first: first.repository(), second: second.repository(), ...first.domain() };
}

const customer = { id: 'demo-self', role: 'customer' };
const performer = { id: 'demo-self', role: 'performer' };
const moderator = { id: 'demo-moderator', role: 'moderator' };
function registration(emptyWorkspace, name = 'Локальное имя') {
  const draft = emptyWorkspace().draft; draft.roles = ['customer', 'performer'];
  draft.profile.displayName = name; draft.performer.description = 'Описание работы';
  return { type: 'registration', draft };
}
async function registered(h) {
  const initial = await h.first.execute(registration(h.emptyWorkspace), customer, 'draft-1', 0, false);
  return h.first.execute({ type: 'register' }, customer, 'register-1', initial.state.revision, false);
}

test('repository model: an empty load does not create a stored workspace', async t => {
  const h = setup(t);
  const loaded = await h.first.loadWorkspace();
  assert.equal(loaded.revision, 0);
  assert.equal(h.storage.stored('state', 'current'), undefined);
  assert.equal(h.storage.trace.some(event => event[0] === 'put'), false);
});

test('repository model: success is withheld until the transaction commits', async t => {
  const h = setup(t); await h.first.loadWorkspace();
  const gate = h.storage.holdCommit(); let settled = false;
  const saving = h.first.execute(registration(h.emptyWorkspace), customer, 'draft-1', 0, false).finally(() => { settled = true; });
  await gate.waiting;
  assert.equal(settled, false, 'request success alone must not become application success');
  assert.equal(h.storage.stored('state', 'current'), undefined, 'uncommitted writes must not be visible');
  gate.release(); const saved = await saving;
  assert.equal(saved.state.revision, 1);
  assert.deepEqual(h.storage.stored('state', 'current'), saved.state);
});

test('repository model: two independent modules at the same revision have exactly one winner', async t => {
  const h = setup(t);
  const results = await Promise.allSettled([
    h.first.execute(registration(h.emptyWorkspace, 'Первая вкладка'), customer, 'draft-a', 0, false),
    h.second.execute(registration(h.emptyWorkspace, 'Вторая вкладка'), customer, 'draft-b', 0, false),
  ]);
  const winners = results.filter(result => result.status === 'fulfilled');
  const losers = results.filter(result => result.status === 'rejected');
  assert.equal(winners.length, 1); assert.equal(losers.length, 1);
  assert.equal(losers[0].reason.code, 'conflict');
  assert.equal(h.storage.stored('state', 'current').revision, 1);
  assert.equal(Object.keys(h.storage.stored('state', 'current').applied).length, 1);
  assert.equal((await h.second.loadWorkspace()).draft.profile.displayName, winners[0].value.state.draft.profile.displayName);
});

test('repository model: concurrent retries of one intent replay a single canonical entity', async t => {
  const h = setup(t); const account = await registered(h);
  const command = { type: 'purchase', purchase: { ...h.sellable(account.state, 1), extras: [] }, simulated: true };
  const [first, replay] = await Promise.all([
    h.first.execute(command, customer, 'payment-intent', account.state.revision, false),
    h.second.execute(command, customer, 'payment-intent', account.state.revision, false),
  ]);
  assert.equal(first.entityId, replay.entityId);
  assert.equal(replay.state.revision, first.state.revision);
  assert.equal(replay.state.orders.length, 1); assert.equal(replay.state.conversations.length, 1);
  const reload = moduleLoader().repository();
  const later = await reload.execute(command, customer, 'payment-intent', 0, false);
  assert.equal(later.entityId, first.entityId, 'the durable intent precedes the stale workspace revision check');
  assert.equal(later.state.orders.length, 1);
  await assert.rejects(reload.execute({ ...command, purchase: { ...command.purchase, base: 1 } }, customer, 'payment-intent', 0, false), error => error.code === 'conflict');
  assert.equal((await reload.loadWorkspace()).revision, first.state.revision);
});

test('repository model: a late commit failure rolls back both the workspace and its Blob', async t => {
  const h = setup(t); const before = await registered(h);
  const file = new Blob(['local portfolio'], { type: 'image/png' });
  const failure = h.storage.failCommit();
  await assert.rejects(h.first.execute({ type: 'example.add', example: { id: 'example-1', title: 'Работа', kind: 'file', assetId: 'asset-1', mime: file.type, size: file.size } }, performer, 'upload-1', before.state.revision, false, { id: 'asset-1', blob: file }), error => error === failure);
  assert.ok(h.storage.trace.some(event => event[0] === 'put' && event[1] === 'assets'), 'failure occurs after the put request, before commit');
  assert.deepEqual(h.storage.stored('state', 'current'), before.state);
  assert.equal(await h.first.readAsset('asset-1'), undefined);
  const retried = await h.first.execute({ type: 'example.add', example: { id: 'example-1', title: 'Работа', kind: 'file', assetId: 'asset-1', mime: file.type, size: file.size } }, performer, 'upload-1', before.state.revision, false, { id: 'asset-1', blob: file });
  assert.equal(retried.state.account.examples.length, 1, 'failed writes must not record an applied intent');
  assert.equal(await (await h.first.readAsset('asset-1')).text(), 'local portfolio');
});

test('repository model: missing or mismatched files cannot become a saved example', async t => {
  const h = setup(t); const before = await registered(h);
  const example = { id: 'example-1', title: 'Работа', kind: 'file', assetId: 'asset-1', mime: 'image/png', size: 7 };
  await assert.rejects(h.first.execute({ type: 'example.add', example }, performer, 'missing-file', before.state.revision, false), error => error.code === 'storage');
  await assert.rejects(h.first.execute({ type: 'example.add', example }, performer, 'mismatched-file', before.state.revision, false, { id: 'asset-1', blob: new Blob(['wrong'], { type: 'image/webp' }) }), error => error.code === 'storage');
  assert.deepEqual(h.storage.stored('state', 'current'), before.state);
  assert.equal(h.storage.stored('assets', 'asset-1'), undefined);
});

test('repository model: approval rechecks that the referenced persisted file still exists', async t => {
  const h = setup(t); let saved = await registered(h);
  const example = { id: 'example-1', title: 'Работа', kind: 'file', assetId: 'asset-1', mime: 'application/pdf', size: 4 };
  saved = await h.first.execute({ type: 'example.add', example }, performer, 'example-1', saved.state.revision, false, { id: 'asset-1', blob: new Blob(['work'], { type: example.mime }) });
  saved = await h.first.execute({ type: 'profile.submit' }, performer, 'submit-1', saved.state.revision, false);
  const pending = structuredClone(saved.state);
  // A new model seeded with metadata but no corresponding assets represents a
  // damaged/restricted browser store; it must never silently approve a portfolio.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const lostAssets = storageModel(pending);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: lostAssets.indexedDB });
  const afterReload = moduleLoader().repository();
  try {
    await assert.rejects(afterReload.execute({ type: 'profile.decide', decision: 'approved', reason: '' }, moderator, 'approve-1', pending.revision, true), error => error.code === 'storage');
    assert.deepEqual(lostAssets.stored('state', 'current'), pending);
  } finally { Object.defineProperty(globalThis, 'indexedDB', original); }
});

test('repository model: invalid stored envelopes reject reads/writes without repairing the source', async t => {
  const source = { schemaVersion: 2, revision: 12, account: { id: 'broken' } };
  const h = setup(t, source);
  await assert.rejects(h.first.loadWorkspace(), error => error.code === 'storage');
  await assert.rejects(h.first.execute(registration(h.emptyWorkspace), customer, 'overwrite-corrupt', 12, false), error => error.code === 'storage');
  assert.deepEqual(h.storage.stored('state', 'current'), source);
  assert.equal(h.storage.trace.some(event => event[0] === 'put'), false);
});

test('repository model: participant/role/revision failures abort without consuming the intent', async t => {
  const h = setup(t); let saved = await registered(h);
  saved = await h.first.execute({ type: 'purchase', purchase: { ...h.sellable(saved.state, 1), extras: [] }, simulated: true }, customer, 'purchase-1', saved.state.revision, false);
  const order = saved.state.orders[0], command = { type: 'order.accept', id: order.id, revision: order.revision };
  for (const actor of [customer, { id: 'outsider', role: 'performer' }, { id: order.performerId, role: 'customer' }]) {
    await assert.rejects(h.first.execute(command, actor, 'accept-retry', saved.state.revision, false), error => error.code === 'forbidden');
    assert.deepEqual(h.storage.stored('state', 'current'), saved.state);
  }
  await assert.rejects(h.first.execute({ ...command, revision: 99 }, { id: order.performerId, role: 'performer' }, 'accept-retry', saved.state.revision, false), error => error.code === 'conflict');
  const accepted = await h.first.execute(command, { id: order.performerId, role: 'performer' }, 'accept-retry', saved.state.revision, false);
  assert.equal(accepted.state.orders[0].status, 'IN_PROGRESS');
  assert.equal(accepted.state.orders[0].events.length, 2);
});

function canonicalFixture(withService = false) {
  const domain = moduleLoader().domain(); let state = domain.emptyWorkspace(), nextId = 0;
  const act = (command, actor = customer, admin = false) => {
    state = domain.applyCommand(state, command, actor, `fixture-${++nextId}`, 1000 + nextId, admin).state;
  };
  act(registration(domain.emptyWorkspace)); act({ type: 'register' });
  if (withService) {
    act({ type: 'example.add', example: { id: 'example-1', title: 'Работа', kind: 'link', url: 'https://example.test/work' } }, performer);
    act({ type: 'profile.submit' }, performer);
    act({ type: 'profile.decide', decision: 'approved', reason: '' }, moderator, true);
    act({ type: 'service.save', input: { title: 'Услуга', category: 'Код', description: 'Описание', included: ['Консультация'], price: 10000, days: 2, extras: [{ id: 'extra-1', title: 'Объяснение', price: 100, extraDays: 0 }], exampleIds: ['example-1'] } }, performer);
  }
  act({ type: 'purchase', purchase: { ...domain.sellable(state, 1), extras: [] }, simulated: true });
  return state;
}

const malformedRelationships = [
  ['swapped order participant roles', state => state.conversations[0].participants.reverse()],
  ['order conversation service mismatch', state => { state.conversations[0].serviceId = 2; }],
  ['review without a submitted result', state => { state.orders[0].status = 'REVIEW'; }],
  ['completion without a submitted result', state => { state.orders[0].status = 'COMPLETED'; }],
  ['completion with unresolved remarks', state => { state.orders[0].status = 'COMPLETED'; state.orders[0].result = 'Result'; state.orders[0].remarks = 'Not resolved'; }],
  ['duplicate portfolio IDs', state => { state.account.examples.push({ ...state.account.examples[0], title: 'Другая работа' }); }],
  ['portfolio URL without a hostname', state => { state.account.examples[0].url = 'https://'; }],
  ['portfolio URL with embedded credentials', state => { state.account.examples[0].url = 'https://local:placeholder@example.test'; }],
  ['service with a missing portfolio reference', state => { state.services[0].exampleIds = ['missing-example']; }],
  ['service with duplicate portfolio references', state => { state.services[0].exampleIds.push('example-1'); }],
  ['service with duplicate extras', state => { state.services[0].extras.push({ ...state.services[0].extras[0] }); }],
];
for (const [description, corrupt] of malformedRelationships) test(`repository model: rejects ${description} and preserves the damaged source`, async t => {
  const state = canonicalFixture(true); corrupt(state);
  const h = setup(t, state);
  await assert.rejects(h.first.loadWorkspace(), error => error.code === 'storage');
  await assert.rejects(h.first.execute({ type: 'role', role: 'customer' }, customer, 'overwrite-corrupt', state.revision, false), error => error.code === 'storage');
  assert.deepEqual(h.storage.stored('state', 'current'), state);
  assert.equal(h.storage.trace.some(event => event[0] === 'put'), false);
});

test('repository: retry opens storage after an initially unavailable IndexedDB API becomes available', async t => {
  const h = setup(t);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  const repository = moduleLoader().repository();
  await assert.rejects(repository.loadWorkspace(), error => error.code === 'storage');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: h.storage.indexedDB });
  assert.equal((await repository.loadWorkspace()).revision, 0);
  assert.equal(h.storage.stored('state', 'current'), undefined);
});
