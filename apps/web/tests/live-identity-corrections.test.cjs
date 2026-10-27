/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual session/client modules against cookie-session transitions. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function loadModules() {
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const fixture = { exports: {} }; cache.set(name, fixture.exports);
    const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/api', `${name}.ts`), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(name => load(name.replace('./', '')), fixture, fixture.exports);
    return fixture.exports;
  }
  return { session: load('session'), client: load('client'), auth: load('auth').authClient };
}
async function scenario(work) {
  const original = global.fetch; const { session, client, auth } = loadModules();
  let serverActor = 701, notices = 0; const calls = []; let duringCsrf = false;
  global.fetch = async (url, options) => {
    calls.push({ url, method: options.method, actor: serverActor, body: options.body });
    if (url.endsWith('/csrf/')) { if (duringCsrf) serverActor = 702; return Response.json({ csrf_token: 'synthetic-csrf' }); }
    if (url.endsWith('/me/')) return serverActor === null ? Response.json({}, { status: 403 }) : Response.json({ user: { id: serverActor, display_name: 'Synthetic', telegram_username: '' } });
    return new Response(null, { status: 204 });
  };
  const cleanup = session.configureIdentityGuard({ readActor: async signal => { try { return (await auth.me(signal)).user.id; } catch (error) { if (error.status === 403) return null; throw error; } }, onInvalidated() { notices++; } });
  session.confirmIdentity(701);
  try { await work({ session, client, auth, calls, actor(value) { serverActor = value; }, notices: () => notices, duringCsrf() { duringCsrf = true; } }); }
  finally { cleanup(); global.fetch = original; }
}
test('L4 equal revisions do not bind identity: dirty A cannot PATCH server B', async () => scenario(async h => {
  const lease = h.session.captureIdentity(701), controller = h.session.createIdentityController(lease);
  h.actor(702);
  await assert.rejects(h.client.apiMutation('registration/', 'PATCH', { performer_revision: 2, profile: { display_name: 'Only A' } }, controller.signal), { name: 'IdentityChangedError' });
  assert.equal(h.calls.filter(c => c.method !== 'GET').length, 0); assert.equal(h.notices(), 1);
}));
test('L4 changing session during fresh CSRF is detected before the write', async () => scenario(async h => {
  const controller = h.session.createIdentityController(h.session.captureIdentity(701)); h.duringCsrf();
  await assert.rejects(h.client.apiMutation('registration/', 'PATCH', { performer_revision: 2 }, controller.signal), { name: 'IdentityChangedError' });
  assert.deepEqual(h.calls.map(c => c.url), ['/api/v1/auth/me/', '/api/v1/auth/csrf/', '/api/v1/auth/me/']); assert.equal(h.notices(), 1);
}));
test('L4 confirmed same actor writes with fresh CSRF, original key and two identity observations', async () => scenario(async h => {
  const controller = h.session.createIdentityController(h.session.captureIdentity(701));
  await h.client.apiMutation('orders/', 'POST', { request_key: 'original-intention' }, controller.signal, 2);
  assert.deepEqual(h.calls.map(c => c.url), ['/api/v1/auth/me/', '/api/v1/auth/csrf/', '/api/v1/auth/me/', '/api/v2/orders/']);
  assert.deepEqual(JSON.parse(h.calls.at(-1).body), { request_key: 'original-intention' });
}));
test('L4 identity epoch expires old callbacks even after A → B → A', async () => scenario(async h => {
  const lease = h.session.captureIdentity(701);
  h.session.confirmIdentity(702); h.session.confirmIdentity(701);
  const controller = h.session.createIdentityController(lease); assert.equal(controller.signal.aborted, true);
  await assert.rejects(h.client.apiMutation('registration/', 'PATCH', {}, controller.signal), { name: 'IdentityChangedError' }); assert.equal(h.calls.length, 0);
}));
test('L4 unbound private writer and incorrect actor lease fail closed', async () => scenario(async h => {
  assert.equal(h.session.captureIdentity(702), null);
  assert.equal(h.session.createIdentityController(null).signal.aborted, true);
  await assert.rejects(h.client.apiMutation('registration/', 'PATCH', {}), { name: 'IdentityChangedError' }); assert.equal(h.calls.length, 0);
}));
test('L4 missing or unverifiable session invalidates all old pending intentions', async () => {
  for (const offline of [false, true]) await scenario(async h => {
    const controller = h.session.createIdentityController(h.session.captureIdentity(701));
    if (offline) global.fetch = async () => { throw Error('offline'); }; else h.actor(null);
    await assert.rejects(h.client.apiMutation('registration/', 'PATCH', {}, controller.signal), { name: 'IdentityChangedError' });
    assert.equal(h.session.captureIdentity(701), null); assert.equal(h.notices(), 1);
  });
});
test('L4 logout also fences a changed cookie identity before posting', async () => scenario(async h => {
  const controller = h.session.createIdentityController(h.session.captureIdentity(701)); h.actor(702);
  await assert.rejects(h.auth.logout(controller.signal), { name: 'IdentityChangedError' }); assert.ok(h.calls.every(c => c.method === 'GET'));
}));
test('L4 invalidation aborts an already dispatched bound request and suppresses its result', async () => scenario(async h => {
  const controller = h.session.createIdentityController(h.session.captureIdentity(701)); let signal;
  let finish; global.fetch = async (_, options) => { signal = options.signal; await new Promise(resolve => { finish = resolve; }); return Response.json({ private: true }); };
  const pending = h.client.apiRequest('account/', { signal: controller.signal });
  h.session.invalidateIdentity(); assert.equal(signal.aborted, true); finish();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(h.session.createIdentityController(h.session.captureIdentity(701)).signal.aborted, true);
}));

function authHarness({ demo = false } = {}) {
  const React = require('react'); const { session } = loadModules();
  const slots = [], effects = [], cleanups = []; let cursor = 0;
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) { slots[i] = { deps }; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
  };
  const previous = { window: global.window, document: global.document, BroadcastChannel: global.BroadcastChannel, localStorage: global.localStorage };
  const win = new EventTarget(), doc = new EventTarget(); doc.visibilityState = 'visible';
  const channels = [], writes = []; global.window = win; global.document = doc;
  global.BroadcastChannel = class { constructor() { channels.push(this); } postMessage(value) { writes.push(value); } close() {} };
  global.localStorage = { setItem(key, value) { writes.push({ key, value }); } };
  let actor = 701, reads = 0, logins = 0, logouts = 0;
  const authClient = { async me() { reads++; if (actor === null) throw new client.ApiError(403, null); return { user: { id: actor, display_name: 'Synthetic', telegram_username: '' } }; },
    async options() { return { telegram_mini_app: true, telegram_website: false }; }, async login() { logins++; }, async logout() { logouts++; actor = null; } };
  const client = loadModules().client;
  const file = path.resolve(__dirname, '../src/context/AuthContext.tsx'); const fixture = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(name => ({ react: hooks, '@/lib/api/auth': { authClient, getTelegramInitData: () => 'synthetic-signed-input' }, '@/lib/api/client': client,
    '@/lib/api/session': session, '@/lib/data-mode': { demoMode: demo }, 'next/script': { default: () => null } }[name] ?? require(name)), fixture, fixture.exports);
  function render() { cursor = 0; const value = fixture.exports.AuthProvider({ children: null }).props.value; while (effects.length) effects.shift()(); return value; }
  const flush = async () => { await new Promise(resolve => setTimeout(resolve, 5)); return render(); };
  return { session, win, doc, channels, writes, render, flush, actor(value) { actor = value; }, reads: () => reads, logins: () => logins, logouts: () => logouts,
    close() { cleanups.forEach(fn => fn?.()); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } } };
}
test('L4 focus discards A private context, requires explicit confirmation and remounts B', async () => {
  const h = authHarness(); try {
    h.render(); const initial = await h.flush(); assert.equal(initial.state.user.id, 701); const old = h.session.captureIdentity(701);
    h.actor(702); h.win.dispatchEvent(new Event('focus')); const changed = await h.flush();
    assert.equal(changed.state.user, null); assert.equal(changed.state.status, 'error'); assert.match(changed.state.message, /Аккаунт изменился/);
    assert.equal(h.logins(), 0); changed.refresh(); const next = await h.flush(); assert.equal(next.state.user.id, 702);
    assert.equal(h.session.createIdentityController(old).signal.aborted, true); assert.notEqual(next.state.identityEpoch, initial.state.identityEpoch);
  } finally { h.close(); }
});
test('L4 channel and storage notifications re-read server identity; same-actor hint retains forms', async () => {
  for (const mechanism of ['channel', 'storage']) { const h = authHarness(); try {
    h.render(); const first = await h.flush(); const reads = h.reads();
    const notify = () => { if (mechanism === 'channel') h.channels[0].onmessage({ data: { actor: 999 } }); else { const event = new Event('storage'); Object.defineProperty(event, 'key', { value: 'studly.session.changed' }); h.win.dispatchEvent(event); } };
    notify(); let state = (await h.flush()).state; assert.equal(state.user.id, 701); assert.equal(state.identityEpoch, first.state.identityEpoch); assert.ok(h.reads() > reads);
    h.actor(702); notify(); state = (await h.flush()).state; assert.equal(state.user, null); assert.match(state.message, /Несохранённые данные/);
  } finally { h.close(); } }
});
test('L4 visibility/pageshow recheck and explicit logout do not auto-login or revive old leases', async () => {
  const h = authHarness(); try {
    h.render(); await h.flush(); h.actor(702); h.doc.dispatchEvent(new Event('visibilitychange')); assert.equal((await h.flush()).state.user, null);
    h.render().refresh(); await h.flush(); const lease = h.session.captureIdentity(702);
    h.render().logout(); const out = await h.flush(); assert.equal(out.state.status, 'anonymous'); assert.equal(h.logouts(), 1);
    h.win.dispatchEvent(new Event('pageshow')); await h.flush(); assert.equal(h.logins(), 0); assert.equal(h.session.createIdentityController(lease).signal.aborted, true);
  } finally { h.close(); }
});
test('L4 Demo does not install session listeners or call authentication', async () => {
  const h = authHarness({ demo: true }); try { h.render(); await h.flush(); h.win.dispatchEvent(new Event('focus')); await h.flush(); assert.equal(h.reads(), 0); assert.equal(h.channels.length, 0); } finally { h.close(); }
});
