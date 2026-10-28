/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic transport extension, not Django or application code. */
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const original = require('../2026-10-27-corrections/contract-fixtures.cjs');
const clone = value => structuredClone(value);

// Reuse the earlier independently contract-derived read fixture. Extend only
// portfolio mutations and deliberate faults needed by the residual L2 probes.
// Authoritative behavior is pinned portfolio_views.py + operations/services.py:
// an identical saved receipt is replayed before the callback/CAS check.
function createFixture() {
  const fixture = original.createFixture();
  for (const id of Object.keys(fixture.state.revisions)) fixture.state.revisions[id] = 4;
  const controls = { failPortfolioBefore: 0, failPortfolioAfter: 0, failProfileBefore: 0, externalAfterProfile: false };
  const tokens = new Map();
  const receipts = new Map();
  const baseIntercept = fixture.intercept;
  const actorOf = request => Number(/(?:^|;\s*)studly_qa_actor=(\d+)/.exec(request.headers().cookie ?? '')?.[1]) || null;
  async function intercept(route, base) {
    const request = route.request(), url = new URL(request.url()), method = request.method(), pathname = url.pathname;
    const actor = actorOf(request);
    if (url.origin === base && pathname === '/api/v1/registration/' && method === 'PATCH' && controls.failProfileBefore) {
      const body = request.postDataJSON();
      original.validate(body, original.documents.registration.paths[pathname].patch.requestBody.content['application/json'].schema, original.documents.registration);
      const status = actor && tokens.get(request.headers()['x-csrftoken']) === actor ? controls.failProfileBefore : 403; controls.failProfileBefore = 0;
      fixture.state.requests.push({ sequence: fixture.state.requests.length + 1, method, path: pathname, query: url.search, actor,
        body, csrfPresent: !!request.headers()['x-csrftoken'], status });
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ profile: { display_name: ['Synthetic profile validation failure'] } }) });
    }
    const match = /^\/api\/v1\/portfolio\/(?:([0-9a-f-]+)\/)?$/.exec(pathname);
    if (url.origin === base && match && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      let body, uploaded;
      const multipart = (request.headers()['content-type'] ?? '').startsWith('multipart/form-data');
      if (multipart) {
        const form = await new Request(request.url(), { method, headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
        body = Object.fromEntries([...form].filter(([key]) => key !== 'file'));
        body.revision = Number(body.revision);
        const file = form.get('file');
        if (file && typeof file !== 'string') {
          const bytes = Buffer.from(await file.arrayBuffer());
          uploaded = { name: file.name, type: file.type, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
        }
      } else body = request.postDataJSON();
      const operation = method === 'POST' ? original.documents.workspace.paths['/api/v1/portfolio/'].post
        : original.documents.workspace.paths['/api/v1/portfolio/{uuid}/'][method.toLowerCase()];
      const content = multipart ? 'multipart/form-data' : 'application/json';
      original.validate({ ...body, ...(uploaded ? { file: uploaded.name } : {}) }, operation.requestBody.content[content].schema);
      const row = { sequence: fixture.state.requests.length + 1, method, path: pathname, query: url.search, actor,
        body: clone(body), upload: uploaded ?? null, csrfPresent: !!request.headers()['x-csrftoken'], status: null };
      fixture.state.requests.push(row);
      async function respond(value, status = 200) {
        row.status = status;
        const schema = operation.responses[String(status)]?.content?.['application/json']?.schema;
        if (status < 300 && schema) original.validate(value, schema);
        return route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(value) });
      }
      const denied = status => respond({ detail: 'Synthetic portfolio rejection' }, status);
      if (!actor || !fixture.state.accounts[actor]?.roles.includes('performer') || tokens.get(request.headers()['x-csrftoken']) !== actor) return denied(403);
      const key = `${actor}:${method}:${match[1] ?? 'add'}:${body.request_key}`;
      const signature = JSON.stringify([body, uploaded?.sha256]);
      const saved = receipts.get(key);
      if (saved) {
        if (saved.signature !== signature) return denied(409);
        fixture.state.events.push({ operation: 'portfolio-receipt-replay', actor, key, revision: saved.value.moderation.revision });
        return respond(clone(saved.value));
      }
      if (controls.failPortfolioBefore) { const status = controls.failPortfolioBefore; controls.failPortfolioBefore = 0; return denied(status); }
      if (body.revision !== fixture.state.revisions[actor]) return denied(409);
      let example;
      if (method === 'POST') {
        const id = randomUUID();
        example = { id, title: body.title, kind: uploaded ? 'file' : 'link', url: uploaded ? null : body.url,
          content_url: uploaded ? `/api/v1/portfolio/${id}/content/` : null, content_type: uploaded ? uploaded.type : null,
          size: uploaded?.size ?? 0, created_at: '2026-10-28T09:00:00Z' };
        fixture.state.portfolio[actor].push(example);
        fixture.state.revisions[actor]++;
      } else {
        example = fixture.state.portfolio[actor].find(item => item.id === match[1]);
        if (!example) return denied(404);
        if (method === 'DELETE') { fixture.state.portfolio[actor] = fixture.state.portfolio[actor].filter(item => item !== example); fixture.state.revisions[actor]++; }
        else {
          const changed = ['title', 'url'].some(key => key in body && body[key] !== example[key]);
          for (const key of ['title', 'url']) if (key in body) example[key] = body[key];
          if (changed) fixture.state.revisions[actor]++;
        }
      }
      fixture.state.moderationStatuses[actor] = 'pending';
      const value = { ...(method === 'DELETE' ? {} : { example: clone(example) }), moderation: fixture.moderation(actor) };
      receipts.set(key, { signature, value: clone(value) });
      if (controls.failPortfolioAfter) { const status = controls.failPortfolioAfter; controls.failPortfolioAfter = 0; return denied(status); }
      return respond(value, method === 'POST' ? 201 : 200);
    }
    const delegated = {
      request: () => request,
      abort: (...args) => route.abort(...args),
      continue: (...args) => route.continue(...args),
      fulfill: async options => {
        if (pathname === '/api/v1/auth/csrf/' && options.status === 200) {
          const token = JSON.parse(options.body).csrf_token;
          const tokenActor = Number(/^synthetic-(\d+)-/.exec(token)?.[1]);
          assert.ok(tokenActor); tokens.set(token, tokenActor);
        }
        if (pathname === '/api/v1/registration/' && method === 'PATCH' && options.status === 200 && controls.externalAfterProfile) {
          controls.externalAfterProfile = false;
          fixture.externalProfileEdit(actor, 'External change after own confirmation');
        }
        return route.fulfill(options);
      },
    };
    return baseIntercept(delegated, base);
  }
  return { ...fixture, controls, intercept };
}
module.exports = { ...original, createFixture };
