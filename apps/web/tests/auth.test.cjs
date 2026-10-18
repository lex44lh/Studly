/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness loads isolated transpiled TypeScript fixtures. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studly-auth-'));
fs.mkdirSync(path.join(dir, 'api'));
const modeSource = fs.readFileSync(path.join(__dirname, '../src/lib/data-mode.ts'), 'utf8');
fs.writeFileSync(path.join(dir, 'data-mode.js'), ts.transpileModule(modeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
for (const name of ['client', 'auth', 'registration', 'catalog']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/api', name + '.ts'), 'utf8');
  fs.writeFileSync(path.join(dir, 'api', name + '.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { authClient, getTelegramInitData } = require(path.join(dir, 'api', 'auth.js'));
const { apiRequest, ApiError } = require(path.join(dir, 'api', 'client.js'));
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; delete global.window; fs.rmSync(dir, { recursive: true }); });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('login and logout fetch fresh CSRF and preserve cookie credentials', async () => {
  const calls = [];
  const responses = [json({ csrf_token: 'before' }), json({ user: { id: 1, display_name: 'Test', telegram_username: 'test' } }), json({ csrf_token: 'rotated' }), new Response(null, { status: 204 })];
  global.fetch = async (url, options) => { calls.push({ url, ...options }); return responses.shift(); };
  await authClient.login('signed-test-value');
  await authClient.logout();
  assert.deepEqual(calls.map(c => c.url), ['/api/v1/auth/csrf/', '/api/v1/auth/telegram/mini-app/', '/api/v1/auth/csrf/', '/api/v1/auth/logout/']);
  assert.ok(calls.every(c => c.credentials === 'same-origin' && c.cache === 'no-store'));
  assert.equal(calls[1].headers['X-CSRFToken'], 'before');
  assert.deepEqual(JSON.parse(calls[1].body), { init_data: 'signed-test-value' });
  assert.equal(calls[3].headers['X-CSRFToken'], 'rotated');
});
test('401 and CSRF 403 preserve status and code without success', async () => {
  for (const status of [401, 403]) {
    global.fetch = async () => json({ code: 'csrf_failed' }, status);
    await assert.rejects(authClient.me(), e => e instanceof ApiError && e.status === status && e.payload.code === 'csrf_failed');
  }
});
test('network and non-JSON responses fail', async () => {
  global.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(authClient.options(), e => e.status === 0);
  global.fetch = async () => new Response('<html>missing proxy</html>');
  await assert.rejects(authClient.options(), ApiError);
});
test('abort signal reaches fetch and remains an abort', async () => {
  const controller = new AbortController(); controller.abort();
  global.fetch = async (_, options) => { assert.equal(options.signal, controller.signal); throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(apiRequest('auth/me/', { signal: controller.signal }), { name: 'AbortError' });
});
test('raw initData only, unsafe data cannot authenticate', () => {
  global.window = { Telegram: { WebApp: { initDataUnsafe: { user: { id: 123 } } } } };
  assert.equal(getTelegramInitData(), '');
  global.window.Telegram.WebApp.initData = 'raw-signed';
  assert.equal(getTelegramInitData(), 'raw-signed');
});

test('malformed 200 cannot become an authenticated session', async () => {
  global.fetch = async () => json({ user: { id: 1 } });
  await assert.rejects(authClient.me(), e => e.status === 502);
});

const { registrationClient, toDraft } = require(path.join(dir, 'api', 'registration.js'));
const { catalogClient } = require(path.join(dir, 'api', 'catalog.js'));
const registration = () => ({
  roles: ['customer', 'performer'], profile: { display_name: 'Server name', avatar_url: null, university: '', city: '', about: '' },
  performer: { description: 'About', study_year: '2', portfolio: '', specializations: [{ id: 'uuid-1', title: 'From server' }] },
  progress: { current_step: 'performer', performer_skipped: false, updated_at: null },
  status: { is_complete: false, completed_at: null, missing_fields: [], performer_ready: true, performer_missing_fields: [] },
});
test('registration restore maps wire fields and preserves server progress', async () => {
  global.fetch = async () => json(registration());
  const response = await registrationClient.loadDraft();
  const draft = toDraft(response);
  assert.equal(draft.profile.displayName, 'Server name');
  assert.equal(draft.performer.studyYear, '2');
  assert.equal(draft.performer.specializations[0].id, 'uuid-1');
  assert.equal(response.progress.current_step, 'performer');
  assert.equal(draft.profile.avatarFile, null);
});
test('PATCH is not complete; complete requires server confirmation', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf/')) return json({ csrf_token: 'test' });
    return json(registration());
  };
  await registrationClient.save({ roles: ['customer'], progress: { current_step: 'profile' } });
  assert.equal(calls[1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].body), { roles: ['customer'], progress: { current_step: 'profile' } });
  await assert.rejects(registrationClient.complete(), e => e.status === 502);
});
test('avatar uses multipart without JSON Content-Type and DELETE gets fresh CSRF', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf/')) return json({ csrf_token: 'test' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    const value = registration(); value.profile.avatar_url = '/api/v1/registration/avatar/'; return json(value);
  };
  await registrationClient.uploadAvatar(new File(['image'], 'avatar.png', { type: 'image/png' }));
  assert.ok(calls[1].body instanceof FormData);
  assert.equal(calls[1].body.get('avatar').name, 'avatar.png');
  assert.equal(calls[1].headers['Content-Type'], undefined);
  await registrationClient.deleteAvatar();
  assert.equal(calls[3].method, 'DELETE'); assert.equal(calls[3].body, undefined);
});
test('specializations loads all pages on same origin and rejects foreign paths', async () => {
  const calls = [];
  global.fetch = async url => {
    calls.push(url);
    return json({ results: [{ id: String(calls.length), title: 'Option' }], next: calls.length === 1 ? 'http://internal:8000/api/v1/specializations/?page=2' : null });
  };
  assert.equal((await registrationClient.listSpecializations(new AbortController().signal)).length, 2);
  assert.equal(calls[1], '/api/v1/specializations/?page=2');
  global.fetch = async () => json({ results: [], next: 'https://untrusted.example/steal' });
  await assert.rejects(registrationClient.listSpecializations(new AbortController().signal), e => e.status === 502);
});
test('empty specializations remain empty; validation/409/403 writes are never retried', async () => {
  global.fetch = async () => json({ results: [], next: null });
  assert.deepEqual(await registrationClient.listSpecializations(new AbortController().signal), []);
  for (const status of [400, 403, 409]) {
    let writes = 0;
    global.fetch = async url => url.endsWith('/csrf/') ? json({ csrf_token: 'test' }) : (writes++, json({ detail: 'test' }, status));
    await assert.rejects(registrationClient.save({ roles: ['customer'] }), e => e.status === status);
    assert.equal(writes, 1);
  }
});
test('catalog sends server search, rejects missing records and never falls back to demo', async () => {
  let url;
  global.fetch = async value => { url = value; return json({ count: 0, next: null, previous: null, results: [] }); };
  assert.deepEqual((await catalogClient.list('search=Python')).results, []);
  assert.equal(url, '/api/v1/services/?search=Python');
  global.fetch = async () => json({ detail: 'Not found' }, 404);
  await assert.rejects(catalogClient.service('42'), e => e.status === 404);
});

const { resolveDataMode } = require(path.join(dir, 'data-mode.js'));
test('demo is explicit, missing mode stays live even for production', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(resolveDataMode(undefined), 'live');
    assert.equal(resolveDataMode(''), 'live');
    assert.equal(resolveDataMode('live'), 'live');
    assert.equal(resolveDataMode('api'), 'live');
    assert.equal(resolveDataMode('demo'), 'demo');
    assert.throws(() => resolveDataMode('demoo'));
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
