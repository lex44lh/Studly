/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launchOptions, backendOrigin, checkApi } = require('../scripts/dev-support.cjs');

test('explicit launcher modes preserve port forwarding and reject silent port/mode changes', () => {
  assert.deepEqual(launchOptions(['demo'], {}), { mode: 'demo', port: 3000, hostname: '127.0.0.1', nextArgs: [] });
  assert.equal(launchOptions(['live'], { PORT: '3001' }).port, 3001);
  assert.equal(launchOptions(['live', '--port', '3120'], { PORT: '3001' }).port, 3120);
  for (const args of [['api'], ['live', '--port', '0'], ['live', '--port'], ['live', '--port', 'x'], ['live', '--port', '65536'], ['demo', '--unknown'], ['demo', '--hostname', '0.0.0.0']]) assert.throws(() => launchOptions(args, {}));
});

test('proxy origin is validated without echoing supplied credentials or paths', () => {
  assert.equal(backendOrigin(undefined), 'http://127.0.0.1:8000');
  assert.equal(backendOrigin('https://example.test/'), 'https://example.test');
  for (const origin of ['file:///tmp', 'https://user:superprivate@example.test', 'http://localhost:8000/api/', 'http://localhost:8000/?secret=superprivate', 'invalid']) {
    assert.throws(() => backendOrigin(origin), error => !error.message.includes('superprivate'));
  }
});

const service = { id: 42, title: 'Contract test', description: 'Synthetic test only', price_amount: '500.00', currency: 'RUB', duration_days: 3, performer: { id: 7, name: 'Fixture' }, included: [], is_demo: false };
function fixture(overrides = {}, calls = []) {
  return async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    if (overrides[path]) return overrides[path]();
    if (path.endsWith('/services/')) return Response.json({ count: 1, results: [service], next: null, previous: null });
    if (path.endsWith('/options/')) return Response.json({ telegram_mini_app: false, telegram_website: false });
    if (path.endsWith('/csrf/')) return Response.json({ csrf_token: 'test-only-token' }, { headers: { 'Set-Cookie': 'csrftoken=test-only; Path=/; HttpOnly; SameSite=Lax' } });
    if (path.endsWith('/me/')) return Response.json({ detail: 'Guest' }, { status: 403 });
    return Response.json({ status: 'ok' });
  };
}

test('live readiness checks real API shapes, guest auth and proxied HttpOnly CSRF using only GET', async () => {
  const calls = [];
  assert.deepEqual(await checkApi('http://localhost:3000', { session: true, fetcher: fixture({}, calls) }), { miniApp: false, website: false, count: 1 });
  assert.equal(calls.length, 6);
  for (const { options } of calls) {
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Accept, 'application/json'); assert.equal(options.headers.Cookie, undefined);
  }
});

test('empty Django catalog is valid and never replaced with demo records', async () => {
  const fetcher = fixture({ '/api/v1/services/': () => Response.json({ count: 0, results: [], next: null, previous: null }) });
  assert.equal((await checkApi('http://localhost:8000', { fetcher })).count, 0);
});

test('database unavailability, malformed catalog and invalid auth options prevent live readiness', async () => {
  for (const [path, response] of [
    ['/api/v1/ready/', () => Response.json({ status: 'unavailable' }, { status: 503 })],
    ['/api/v1/health/', () => Response.json({ status: 'unavailable' })],
    ['/api/v1/services/', () => Response.json({ count: 1, results: [{ id: 42 }] })],
    ['/api/v1/services/', () => Response.json({ count: 1, results: [{ ...service, price_amount: '500' }], next: null, previous: null })],
    ['/api/v1/services/', () => Response.json({ count: 1, results: [service], next: '/wrong/', previous: null })],
    ['/api/v1/auth/options/', () => Response.json({ telegram_mini_app: 'yes' })],
  ]) await assert.rejects(checkApi('http://localhost:8000', { fetcher: fixture({ [path]: response }) }));
});

test('proxy must preserve CSRF cookie contract and guest/me semantics', async () => {
  for (const cookie of ['', 'csrftoken=test-only; Path=/']) {
    await assert.rejects(checkApi('http://localhost:3000', { session: true, fetcher: fixture({ '/api/v1/auth/csrf/': () => Response.json({ csrf_token: 'test-only-token' }, { headers: { 'Set-Cookie': cookie } }) }) }), /CSRF-cookie/);
  }
  await assert.rejects(checkApi('http://localhost:3000', { session: true, fetcher: fixture({ '/api/v1/auth/me/': () => Response.json({ user: {} }) }) }), /auth\/me/);
});

test('connection errors, HTML and redirects cannot become ready or expose response bodies', async () => {
  await assert.rejects(checkApi('http://localhost:8000', { fetcher: async () => { throw Object.assign(new Error('sensitive body'), { cause: { code: 'ECONNREFUSED' } }); } }), e => e.message.includes('ECONNREFUSED') && !e.message.includes('sensitive body'));
  await assert.rejects(checkApi('http://localhost:8000', { fetcher: async () => new Response('<html>private debug</html>', { status: 500 }) }), e => e.message.includes('ожидался JSON') && !e.message.includes('private debug'));
  await assert.rejects(checkApi('http://localhost:8000', { fetcher: async () => Response.json({}, { status: 302 }) }));
});
