/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic fixture verification, not Backend execution. */
const assert = require('node:assert/strict');
const { createFixture, backend, provenance } = require('./contract-fixtures.cjs');
const key = '99999999-9999-4999-8999-999999999999';
(async () => {
  const fixture = createFixture();
  let token;
  async function request(method, path, body, headers = {}) {
    let response;
    const buffer = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    await fixture.intercept({
      request: () => ({ method: () => method, url: () => `http://127.0.0.1:3002${path}`, headers: () => ({ cookie: 'studly_qa_actor=701', ...(token ? { 'x-csrftoken': token } : {}), ...headers }),
        postData: () => buffer?.toString(), postDataBuffer: () => buffer, postDataJSON: () => JSON.parse(buffer.toString()) }),
      fulfill: async options => { response = { status: options.status, body: JSON.parse(options.body) }; },
      continue: async () => { throw new Error('Unexpected passthrough'); }, abort: async () => { throw new Error('Unexpected abort'); },
    }, 'http://127.0.0.1:3002');
    return response;
  }
  token = (await request('GET', '/api/v1/auth/csrf/')).body.csrf_token;
  const add = { title: 'Synthetic selfcheck new work', url: 'https://example.com/selfcheck', revision: 4, request_key: key };
  const created = await request('POST', '/api/v1/portfolio/', add);
  assert.equal(created.status, 201); assert.equal(created.body.moderation.revision, 5);
  const replay = await request('POST', '/api/v1/portfolio/', add);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, created.body); assert.equal(fixture.state.portfolio[701].length, 2);
  const stale = await request('POST', '/api/v1/portfolio/', { ...add, request_key: '88888888-8888-4888-8888-888888888888' });
  assert.equal(stale.status, 409);
  const edited = await request('PATCH', `/api/v1/portfolio/${created.body.example.id}/`, { revision: 5, request_key: key, title: 'Synthetic selfcheck changed work' });
  assert.equal(edited.status, 200); assert.equal(edited.body.moderation.revision, 6);
  const editReplay = await request('PATCH', `/api/v1/portfolio/${created.body.example.id}/`, { revision: 5, request_key: key, title: 'Synthetic selfcheck changed work' });
  assert.deepEqual(editReplay.body, edited.body);
  const file = new File([Buffer.from('synthetic upload transport bytes')], 'synthetic.png', { type: 'image/png' });
  const form = new FormData();
  form.append('revision', '6'); form.append('request_key', '77777777-7777-4777-8777-777777777777'); form.append('title', 'Synthetic file transport'); form.append('file', file);
  const encoded = new Response(form), bytes = Buffer.from(await encoded.arrayBuffer());
  const upload = await request('POST', '/api/v1/portfolio/', bytes, { 'content-type': encoded.headers.get('content-type') });
  assert.equal(upload.status, 201); assert.equal(upload.body.example.kind, 'file'); assert.equal(upload.body.example.size, file.size);
  assert.equal(upload.body.moderation.revision, 7);
  assert.deepEqual(fixture.state.errors, []);
  console.log(JSON.stringify({ pass: true, kind: 'Synthetic fixture selfcheck, NOT Django E2E', backend, provenance,
    checks: ['schema-valid link add', 'shared CAS increments', 'receipt replay precedes CAS', 'same-key creates no duplicate', 'new stale key gets409', 'existing edit increments', 'edit replay', 'multipart transport preserves file bytes and revision'], requests: fixture.state.requests.length }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
