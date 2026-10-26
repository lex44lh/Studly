/* eslint-disable @typescript-eslint/no-require-imports -- Execute production client/hooks with isolated React hook state. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
const clientFile = path.join(root, 'lib/api/client.ts');
const sharedFile = path.join(root, 'features/live/shared.tsx');
const drain = () => new Promise(resolve => setImmediate(resolve));
function compile(file, override = () => undefined) {
  const fixture = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    const value = override(name); if (value !== undefined) return value;
    return require(name);
  }, fixture, fixture.exports);
  return fixture.exports;
}
const client = compile(clientFile);
async function network(replies, work) {
  const previous = global.fetch; const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options }); const reply = replies.shift(); assert.ok(reply, `Unexpected request ${url}`);
    if (reply.error) throw reply.error;
    if (reply.response) return reply.response;
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  try { await work(calls); assert.equal(replies.length, 0); } finally { global.fetch = previous; }
}
test('v2 reads retain session cookies, no-store, JSON Accept and redirect rejection', async () => {
  const controller = new AbortController();
  await network([{ body: { id: 42 } }], async calls => {
    assert.deepEqual(await client.apiRequest('services/42/', { version: 2, signal: controller.signal }), { id: 42 });
    assert.equal(calls[0].url, '/api/v2/services/42/'); assert.equal(calls[0].method, 'GET'); assert.equal(calls[0].credentials, 'same-origin');
    assert.equal(calls[0].cache, 'no-store'); assert.equal(calls[0].redirect, 'error'); assert.equal(calls[0].headers.Accept, 'application/json');
    assert.equal(calls[0].headers['Content-Type'], undefined); assert.equal(calls[0].signal, controller.signal);
  });
});
test('existing callers remain on v1 without specifying a version', async () => {
  await network([{ body: { user: { id: 7 } } }], async calls => {
    await client.apiRequest('auth/me/'); assert.equal(calls[0].url, '/api/v1/auth/me/');
  });
});
test('each v2 mutation gets a fresh v1 CSRF token, including PUT', async () => {
  await network([{ body: { csrf_token: 'first-fixture' } }, { status: 204 }, { body: { csrf_token: 'second-fixture' } }, { body: { id: 1 } }], async calls => {
    await client.apiMutation('favorites/42/', 'PUT', {}, undefined, 2);
    await client.apiMutation('orders/', 'POST', { quote_id: 'fixture-quote' }, undefined, 2);
    assert.deepEqual(calls.map(call => call.url), ['/api/v1/auth/csrf/', '/api/v2/favorites/42/', '/api/v1/auth/csrf/', '/api/v2/orders/']);
    assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].headers['X-CSRFToken'], 'first-fixture'); assert.equal(calls[3].headers['X-CSRFToken'], 'second-fixture');
    assert.equal(calls[1].headers['Content-Type'], 'application/json'); assert.equal(calls[1].body, '{}');
  });
});
test('multipart mutations keep real file bytes and omit Content-Type so the browser creates the boundary', async () => {
  const body = new FormData(); body.append('file', new File(['fixture-bytes'], 'work.pdf', { type: 'application/pdf' }));
  await network([{ body: { csrf_token: 'upload-fixture' } }, { body: { saved: true } }], async calls => {
    await client.apiMutation('portfolio/', 'POST', body);
    assert.equal(calls[1].body, body); assert.equal(calls[1].headers['Content-Type'], undefined);
    assert.equal(await calls[1].body.get('file').text(), 'fixture-bytes'); assert.equal(calls[1].redirect, 'error');
  });
});
test('CSRF denial or an invalid token prevents the write entirely', async () => {
  for (const reply of [{ status: 403, body: { detail: 'Denied' } }, { body: {} }, { body: { csrf_token: '' } }]) {
    await network([reply], async calls => {
      await assert.rejects(client.apiMutation('orders/', 'POST', {}, undefined, 2), error => error instanceof client.ApiError && [403, 502].includes(error.status));
      assert.equal(calls.length, 1);
    });
  }
});
test('mutations never replay automatically on permission, conflict, server or transport errors', async () => {
  for (const status of [400, 401, 403, 404, 409, 500, 503]) {
    await network([{ body: { csrf_token: 'fixture' } }, { status, body: { code: 'fixture_error' } }], async calls => {
      await assert.rejects(client.apiMutation('orders/', 'POST', { request_key: 'stable-fixture' }, undefined, 2), error => error.status === status);
      assert.equal(calls.length, 2);
    });
  }
  await network([{ body: { csrf_token: 'fixture' } }, { error: new TypeError('Network failure') }], async calls => {
    await assert.rejects(client.apiMutation('orders/', 'POST', {}, undefined, 2), error => error.status === 0);
    assert.equal(calls.length, 2);
  });
});
test('abort remains an AbortError instead of being converted into a server error or retried', async () => {
  const controller = new AbortController(); controller.abort();
  const aborted = new DOMException('Fixture abort', 'AbortError');
  await network([{ error: aborted }], async calls => {
    await assert.rejects(client.apiRequest('account/', { signal: controller.signal }), error => error === aborted);
    assert.equal(calls.length, 1);
  });
});
test('successful HTML is a protocol failure; unsuccessful HTML retains its HTTP status', async () => {
  for (const status of [200, 503]) {
    await network([{ response: new Response('<html>Fixture proxy error</html>', { status, headers: { 'Content-Type': 'text/html' } }) }], async () => {
      await assert.rejects(client.apiRequest('account/'), error => error instanceof client.ApiError && error.status === (status === 200 ? 502 : status));
    });
  }
});
test('204 actions succeed without trying to decode an empty JSON body', async () => {
  await network([{ status: 204 }], async () => { assert.equal(await client.apiRequest('favorites/42/', { method: 'DELETE' }), undefined); });
});
test('client rejects unsafe literal and encoded resource paths before fetch while query encoding remains valid', async () => {
  const unsafe = ['/account/', '//outside.invalid/account/', '../account/', 'services/../account/', 'services/./42/', 'services\\42/',
    'services/#fragment', 'services/\u0000', 'services/%2e%2e/account/', 'services/%2Faccount/', 'https://outside.invalid/account/'];
  await network([], async calls => {
    for (const resource of unsafe) await assert.rejects(client.apiRequest(resource), error => error instanceof client.ApiError && error.status === 502, resource);
    assert.equal(calls.length, 0);
  });
  await network([{ body: { results: [] } }], async calls => {
    await client.apiRequest('services/?search=%D0%A2%D0%B5%D1%81%D1%82%2F%3A', { version: 2 });
    assert.equal(calls[0].url, '/api/v2/services/?search=%D0%A2%D0%B5%D1%81%D1%82%2F%3A');
  });
});
test('pagination strips the internal host and remains on its declared version/resource', () => {
  assert.equal(client.pagePath('http://django.internal:8000/api/v2/orders/?page=2', 'orders/', 2), 'orders/?page=2');
  assert.equal(client.pagePath('/api/v1/conversations/?cursor=fixture%3D', 'conversations/'), 'conversations/?cursor=fixture%3D');
  for (const next of ['https://outside.invalid/api/v1/orders/?page=2', 'https://outside.invalid/api/v2/account/',
    'https://user:pass@outside.invalid/api/v2/orders/', 'file:///api/v2/orders/', 'https://outside.invalid/api/v2/orders/#leak', 'not a URL']) {
    assert.throws(() => client.pagePath(next, 'orders/', 2), error => error.status === 502, next);
  }
});
test('request keys are distinct UUID v4 values; error messages do not expose raw server payloads', () => {
  const first = client.requestKey(); const second = client.requestKey(); assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  for (const status of [0, 400, 401, 403, 404, 409, 500]) {
    const message = client.apiErrorMessage(new client.ApiError(status, { internal: 'DO_NOT_DISPLAY_FIXTURE' }));
    assert.doesNotMatch(message, /DO_NOT_DISPLAY_FIXTURE/); assert.ok(message.length > 10);
  }
});

function hooksRuntime() {
  const slots = [], effects = [], cleanups = []; let cursor = 0;
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useEffect(effect, deps) { const index = cursor++; const previous = slots[index]; if (!previous || !deps || deps.some((value, at) => value !== previous.value?.[at])) { slots[index] = { value: deps }; effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); }); } },
  };
  return { hooks, render(callback) { cursor = 0; const result = callback(); while (effects.length) effects.shift()(); return result; }, unmount() { cleanups.forEach(cleanup => cleanup?.()); } };
}
function deferred() { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
function sharedHarness() {
  const runtime = hooksRuntime(); const mode = { demoMode: false }; let auth = { status: 'authenticated', user: { id: 7 }, message: 'Fixture session' };
  const shared = compile(sharedFile, name => name === 'react' ? runtime.hooks : name === '@/context/AuthContext' ? { useAuth: () => ({ state: auth, refresh() {} }) } :
    name === '@/lib/api/auth' ? { authClient: { async options() { return { telegram_website: false }; } } } : name === '@/lib/api/client' ? client : name === '@/lib/data-mode' ? mode :
      name === 'next/link' ? { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) } : undefined);
  return { module: shared, mode, runtime, setAuth(value) { auth = value; }, render(key, load) { return runtime.render(() => shared.useLiveResource(key, load)); } };
}
test('resource scopes prevent account A data from being rendered immediately after an account switch', async () => {
  const h = sharedHarness(); const requests = [];
  const load = signal => { const value = deferred(); requests.push({ ...value, signal }); return value.promise; };
  assert.equal(h.render('account', load).loading, true); requests[0].resolve({ account: 'A' }); await drain();
  assert.deepEqual(h.render('account', load).data, { account: 'A' });
  h.setAuth({ status: 'authenticated', user: { id: 8 } });
  const switched = h.render('account', load); assert.equal(switched.data, undefined); assert.equal(switched.loading, true); assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ account: 'B' }); await drain(); assert.deepEqual(h.render('account', load).data, { account: 'B' });
});
test('an obsolete response cannot overwrite a newer role/resource or leak an earlier account', async () => {
  const h = sharedHarness(); const requests = [];
  const load = signal => { const value = deferred(); requests.push({ ...value, signal }); return value.promise; };
  h.render('cabinet:customer', load); h.render('cabinet:performer', load);
  assert.equal(requests[0].signal.aborted, true); requests[1].resolve({ role: 'performer' }); await drain();
  requests[0].resolve({ role: 'customer', stale: true }); await drain();
  assert.deepEqual(h.render('cabinet:performer', load).data, { role: 'performer' });
});
test('manual reload hides the old result immediately and a prior request cannot restore it', async () => {
  const h = sharedHarness(); const requests = [];
  const load = signal => { const value = deferred(); requests.push({ ...value, signal }); return value.promise; };
  let current = h.render('portfolio', load); requests[0].resolve({ revision: 1 }); await drain(); current = h.render('portfolio', load);
  current.reload(); current = h.render('portfolio', load); assert.equal(current.data, undefined); assert.equal(current.loading, true); assert.equal(requests.length, 2);
  requests[1].resolve({ revision: 2 }); await drain(); assert.deepEqual(h.render('portfolio', load).data, { revision: 2 });
});
test('errors are scoped to their request and a manual read retry replaces the error without writes', async () => {
  const h = sharedHarness(); const requests = [];
  const load = signal => { const value = deferred(); requests.push({ ...value, signal }); return value.promise; };
  h.render('cabinet', load); requests[0].reject(new client.ApiError(503, null)); await drain(); let current = h.render('cabinet', load);
  assert.equal(current.error.status, 503); assert.equal(current.loading, false); current.reload(); current = h.render('cabinet', load);
  assert.equal(current.error, undefined); assert.equal(current.loading, true); requests[1].resolve({ ready: true }); await drain();
  assert.deepEqual(h.render('cabinet', load).data, { ready: true });
});
test('resource unmount aborts the pending read and ignores its late fulfillment', async () => {
  const h = sharedHarness(); const request = deferred(); let signal;
  h.render('account', value => { signal = value; return request.promise; }); h.runtime.unmount();
  assert.equal(signal.aborted, true); request.resolve({ private: 'late-fixture' }); await drain();
});
test('Demo and disabled resource keys make no API/loader requests', async () => {
  const h = sharedHarness(); let calls = 0; const load = async () => { calls++; return {}; };
  const disabled = h.render(null, load); assert.equal(disabled.loading, false); assert.equal(calls, 0);
  h.mode.demoMode = true; const demo = h.render('account', load); await drain(); assert.equal(demo.loading, false); assert.equal(demo.data, undefined); assert.equal(calls, 0);
});
test('session recheck immediately hides old resource data even while retaining the same user ID', async () => {
  const h = sharedHarness(); const requests = []; const load = signal => { const value = deferred(); requests.push({ ...value, signal }); return value.promise; };
  h.render('account', load); requests[0].resolve({ account: 'A' }); await drain(); assert.ok(h.render('account', load).data);
  h.setAuth({ status: 'loading', user: { id: 7 } }); const rechecking = h.render('account', load);
  assert.equal(rechecking.data, undefined); assert.equal(requests[0].signal.aborted, true);
});
test('LiveAccess unmounts all private children while loading, anonymous, error, missing user, or Demo', () => {
  const h = sharedHarness(); const secret = React.createElement('div', { id: 'private-child' }, 'Private fixture');
  for (const state of [{ status: 'loading', user: { id: 7 } }, { status: 'anonymous', user: null }, { status: 'error', user: null }, { status: 'authenticated', user: null }]) {
    h.setAuth(state); const tree = h.module.LiveAccess({ children: secret }); assert.notEqual(tree.type, React.Fragment); assert.notEqual(tree.props.children, secret);
  }
  h.mode.demoMode = true; h.setAuth({ status: 'authenticated', user: { id: 7 } });
  const demo = h.module.LiveAccess({ children: secret }); assert.equal(demo.type, 'p'); assert.notEqual(demo.props.children, secret);
});
test('LiveAccess uses a server-account key so switching accounts remounts private form state', () => {
  const h = sharedHarness(); const child = React.createElement('div');
  const first = h.module.LiveAccess({ children: child }); assert.equal(first.type, React.Fragment); assert.equal(first.key, '7'); assert.equal(first.props.children, child);
  h.setAuth({ status: 'authenticated', user: { id: 8 } }); const next = h.module.LiveAccess({ children: child }); assert.equal(next.key, '8');
});
test('shared feedback is absent on success, exposes retry only for errors and labels loading separately', () => {
  const h = sharedHarness(); assert.equal(h.module.LiveState({}), null);
  const loading = renderToStaticMarkup(h.module.LiveState({ loading: true })); assert.match(loading, /role="status"/); assert.match(loading, /aria-busy="true"/); assert.doesNotMatch(loading, /<button/);
  const failure = renderToStaticMarkup(h.module.LiveState({ error: new client.ApiError(403, null), retry() {} })); assert.match(failure, /role="alert"/); assert.match(failure, /Повторить загрузку/);
});
