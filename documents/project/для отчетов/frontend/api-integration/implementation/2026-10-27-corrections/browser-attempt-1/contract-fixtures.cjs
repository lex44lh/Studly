/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic browser transport; never imports Frontend DTOs or runs Django. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const backend = '8999703fe60ef6714595614413faddc5a9308d44';
const root = path.resolve(__dirname, '../../../../../../..');
const fixtureSources = [
  'docs/workspace.openapi.json', 'docs/registration.openapi.json', 'API_CONTRACT.md',
  'apps/api/accounts/registration.py', 'apps/api/accounts/registration_serializers.py', 'apps/api/accounts/moderation.py',
  'apps/api/accounts/portfolio_views.py', 'apps/api/accounts/permissions.py', 'apps/api/operations/services.py',
  'apps/api/orders/workspace.py', 'apps/api/orders/pricing_v2.py', 'apps/api/orders/services.py',
  'apps/api/conversations/views.py', 'apps/api/conversations/rules.py',
];
function source(file) { return execFileSync('git', ['show', `${backend}:${file}`], { cwd: root, encoding: 'utf8' }); }
const documents = { workspace: JSON.parse(source(fixtureSources[0])), registration: JSON.parse(source(fixtureSources[1])) };
const provenance = fixtureSources.map(file => ({ file, sha256: createHash('sha256').update(source(file)).digest('hex'),
  url: `https://github.com/lex44lh/Studly/blob/${backend}/${file}` }));
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
function validate(value, schema, document = documents.workspace, location = '$') {
  if (!schema || !Object.keys(schema).length || value === null && schema.nullable) return;
  if (schema.$ref) {
    const [filename, pointer] = schema.$ref.split('#');
    const owner = filename ? documents.registration : document;
    const target = pointer.split('/').filter(Boolean).reduce((node, key) => node[key], owner);
    return validate(value, target, owner, location);
  }
  if (schema.allOf) schema.allOf.forEach(item => validate(value, item, document, location));
  if (schema.oneOf || schema.anyOf) {
    const successes = (schema.oneOf ?? schema.anyOf).filter(item => { try { validate(value, item, document, location); return true; } catch { return false; } });
    assert.ok(successes.length > 0, `${location} matches no published schema variant`); return;
  }
  if (schema.enum) assert.ok(schema.enum.includes(value), `${location} enum ${JSON.stringify(value)}`);
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${location} object`);
    for (const key of schema.required ?? []) assert.ok(key in value, `${location}.${key} required`);
    if (schema.minProperties) assert.ok(Object.keys(value).length >= schema.minProperties, `${location} minProperties`);
    for (const [key, entry] of Object.entries(value)) {
      if (schema.additionalProperties === false) assert.ok(key in (schema.properties ?? {}), `${location}.${key} not published`);
      if (schema.properties?.[key]) validate(entry, schema.properties[key], document, `${location}.${key}`);
    }
  }
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value), `${location} array`);
    if (schema.maxItems) assert.ok(value.length <= schema.maxItems, `${location} maxItems`);
    if (schema.uniqueItems) assert.equal(new Set(value.map(item => JSON.stringify(item))).size, value.length, `${location} uniqueItems`);
    value.forEach((item, index) => validate(item, schema.items, document, `${location}[${index}]`));
  }
  if (schema.type === 'integer') { assert.ok(Number.isSafeInteger(value), `${location} integer`); if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${location} minimum`); }
  if (schema.type === 'boolean') assert.equal(typeof value, 'boolean', `${location} boolean`);
  if (schema.type === 'string') {
    assert.equal(typeof value, 'string', `${location} string`);
    if (schema.format === 'uuid') assert.match(value, uuid, `${location} UUID`);
    if (schema.format === 'date-time') assert.ok(Number.isFinite(Date.parse(value)), `${location} timestamp`);
    if (schema.maxLength) assert.ok(value.length <= schema.maxLength, `${location} maxLength`);
    if (schema.minLength) assert.ok(value.length >= schema.minLength, `${location} minLength`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${location} pattern`);
  }
}
function operation(pathname, method) {
  for (const document of Object.values(documents)) for (const [template, verbs] of Object.entries(document.paths)) {
    const regex = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    if (regex.test(pathname) && verbs[method.toLowerCase()]) return { document, template, value: verbs[method.toLowerCase()] };
  }
  return null;
}
const now = '2026-10-27T09:35:00Z';
const specId = '99999999-9999-4999-8999-999999999999';
const extraId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const clone = value => structuredClone(value);
const paged = rows => ({ count: rows.length, next: null, previous: null, results: clone(rows) });
const names = { 701: 'Corrections Alpha', 702: 'Corrections Beta', 799: 'Corrections Gamma' };
function registration(id) {
  return { roles: id === 702 ? ['performer'] : ['customer', 'performer'],
    profile: { display_name: names[id], avatar_url: null, university: 'Synthetic university', city: 'Synthetic city', about: 'Synthetic account' },
    performer: { description: 'Synthetic performer', study_year: '2', portfolio: '', specializations: [{ id: specId, title: 'Программирование' }] },
    progress: { current_step: 'profile', performer_skipped: false, updated_at: now },
    status: { is_complete: true, completed_at: now, missing_fields: [], performer_ready: true, performer_missing_fields: [] } };
}
function moderatedFields(value) { return JSON.stringify([value.roles.includes('performer'), value.profile.display_name, value.profile.about, value.profile.university,
  value.profile.city, value.performer?.description ?? '', value.performer?.study_year ?? '', value.performer?.portfolio ?? '', (value.performer?.specializations ?? []).map(item => item.id).sort()]); }
function createFixture() {
  const example = { id: '33333333-3333-4333-8333-333333333333', title: 'Existing synthetic work', kind: 'link', url: 'https://example.com/existing-synthetic-work', content_url: null, content_type: null, size: 0, created_at: now };
  const state = { accounts: Object.fromEntries([701, 702, 799].map(id => [id, registration(id)])), revisions: { 701: 2, 702: 2, 799: 2 }, moderationStatuses: { 701: 'approved', 702: 'approved', 799: 'approved' },
    portfolio: Object.fromEntries([701, 702, 799].map(id => [id, [{ ...clone(example), id: `33333333-3333-4333-8333-${String(id).padStart(12, '0')}` }]])), quotes: new Map(), receipts: new Map(), orders: [], messages: [], requests: [],
    failures: { purchase: false, accept: false, message: false, quoteRead: false, csrfActor: null }, errors: [], events: [], sequence: 0, token: 0 };
  const extra = { id: extraId, title: 'Corrections extra', price_amount: '200.00', extra_days: 1 };
  const service = { id: 811, title: 'Corrections synthetic service', description: 'Contract-derived synthetic content', price_amount: '1000.00', currency: 'RUB', duration_days: 3,
    performer: { id: 702, name: names[702] }, included: ['Synthetic included item'], is_demo: false, revision: 3, category: 'Программирование', extras: [extra] };
  function moderation(id) {
    const value = state.accounts[id], missing = [...(!value.roles.includes('performer') ? ['roles.performer'] : []),
      ...(!value.profile.display_name.trim() ? ['profile.display_name'] : []), ...(!value.performer?.description.trim() ? ['performer.description'] : []),
      ...(!state.portfolio[id].length ? ['portfolio'] : [])];
    return { user_id: id, revision: state.revisions[id], status: state.moderationStatuses[id], reason: '', submitted_at: now,
      ready_to_submit: !missing.length, missing_fields: missing, approved: state.moderationStatuses[id] === 'approved' && !missing.length };
  }
  function capabilities(id) { const roles = state.accounts[id].roles; return { customer: roles.includes('customer'), performer: roles.includes('performer'), create_order: roles.includes('customer'),
    create_service: roles.includes('performer'), django_admin: false, moderate_services: false, moderate_performers: false }; }
  function quote(extras = []) {
    const selected = service.extras.filter(item => extras.includes(item.id)).sort((a, b) => a.id.localeCompare(b.id));
    const cents = selected.length ? 120000 : 100000, fee = Math.round(cents * 5 / 100);
    return { quote_id: randomUUID(), service_id: service.id, service_revision: service.revision, performer_id: service.performer.id,
      title: service.title, description: service.description, included: [...service.included], currency: 'RUB', duration_days: service.duration_days + selected.reduce((sum, item) => sum + item.extra_days, 0),
      tariff_code: 'buyer-5-v1', base_price_amount: '1000.00', selected_extras: clone(selected), extras_amount: selected.length ? '200.00' : '0.00',
      price_amount: (cents / 100).toFixed(2), buyer_fee_percent: '5.00', buyer_fee_amount: (fee / 100).toFixed(2), total_amount: ((cents + fee) / 100).toFixed(2) };
  }
  function order(quoted, actor, key) {
    const { performer_id, extras_amount, ...snapshot } = quoted;
    return { ...snapshot, id: 851 + state.orders.length, revision: 1, request_key: key, buyer: { id: actor, name: state.accounts[actor].profile.display_name },
      performer: { id: performer_id, name: state.accounts[performer_id].profile.display_name }, available_actions: ['cancel'], payment_status: 'unpaid',
      status: 'pending_acceptance', created_at: now, accepted_at: null, closed_at: null, closed_by: null };
  }
  function forViewer(value, actor) { return { ...clone(value), available_actions: value.buyer.id === actor && ['pending_acceptance', 'awaiting_payment'].includes(value.status) ? ['cancel'] :
    value.performer.id === actor && value.status === 'pending_acceptance' ? ['accept', 'decline'] : [] }; }
  const seededQuote = quote(); state.quotes.set(seededQuote.quote_id, { ...seededQuote, owner: 701 });
  state.orders.push(order(seededQuote, 701, '77777777-7777-4777-8777-777777777777'));
  const conversation = { id: conversationId, kind: 'order', order_id: 851, service_id: 811, title: service.title, participant_ids: [701, 702], created_at: now };
  const tokens = new Map();
  function actorOf(request) { const match = /(?:^|;\s*)studly_qa_actor=(\d+)/.exec(request.headers().cookie ?? ''); return match ? Number(match[1]) : null; }
  function externalProfileEdit(id, name) { state.accounts[id].profile.display_name = name; state.revisions[id]++; state.moderationStatuses[id] = 'pending'; state.events.push({ operation: 'external-profile-edit', actor: id, revision: state.revisions[id] }); }
  function externalCancel(id) { const row = state.orders.find(item => item.id === id); row.status = 'cancelled'; row.revision++; row.closed_at = now; row.closed_by = clone(row.buyer); state.events.push({ operation: 'external-cancel', id, revision: row.revision }); }
  function releaseMessage() { const row = state.messages.at(-1); Object.assign(row, { status: 'stored', sequence: ++state.sequence, warning: null, security_case_id: null }); state.events.push({ operation: 'external-message-release', id: row.id, sequence: row.sequence }); }
  async function intercept(route, base) {
    const request = route.request(), url = new URL(request.url()), method = request.method(), pathname = url.pathname;
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    if (url.origin !== base) return route.abort('blockedbyclient');
    if (!pathname.startsWith('/api/')) return route.continue();
    const body = request.postData() ? request.postDataJSON() : undefined, actor = actorOf(request), op = operation(pathname, method);
    const row = { sequence: state.requests.length + 1, method, path: pathname, query: url.search, actor, body: clone(body ?? null), csrfPresent: !!request.headers()['x-csrftoken'], status: null };
    state.requests.push(row);
    if (!op && !['/api/v1/auth/options/', '/api/v1/auth/me/', '/api/v1/auth/csrf/', '/api/v1/auth/logout/'].includes(pathname)) throw new Error(`Unpublished fixture operation ${method} ${pathname}`);
    if (op?.value.requestBody?.content?.['application/json'] && body !== undefined) validate(body, op.value.requestBody.content['application/json'].schema, op.document);
    async function respond(value, status = 200, headers = {}) {
      row.status = status;
      const schema = op?.value.responses?.[String(status)]?.content?.['application/json']?.schema;
      if (status >= 200 && status < 300 && status !== 204 && schema) validate(value, schema, op.document);
      return route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...headers }, body: status === 204 ? '' : JSON.stringify(value) });
    }
    const denied = (status = 403) => respond({ detail: 'Synthetic contract rejection' }, status);
    if (pathname === '/api/v1/auth/me/') return actor && state.accounts[actor] ? respond({ user: { id: actor, display_name: state.accounts[actor].profile.display_name, telegram_username: 'synthetic' } }) : denied();
    if (pathname === '/api/v1/auth/options/') return respond({ telegram_mini_app: false, telegram_website: false });
    if (pathname === '/api/v1/auth/csrf/') {
      const boundActor = state.failures.csrfActor ?? actor, headers = {};
      if (state.failures.csrfActor) { headers['Set-Cookie'] = `studly_qa_actor=${state.failures.csrfActor}; Path=/; SameSite=Lax`; state.events.push({ operation: 'csrf-session-switch', from: actor, to: boundActor }); state.failures.csrfActor = null; }
      const token = `synthetic-${boundActor}-${++state.token}`; tokens.set(token, boundActor); return respond({ csrf_token: token }, 200, headers);
    }
    if (pathname === '/api/v2/services/') return respond(paged([service]));
    if (pathname === '/api/v2/services/811/') return respond(clone(service));
    if (pathname === '/api/v1/specializations/') return respond(paged([{ id: specId, title: 'Программирование' }]));
    if (!actor || !state.accounts[actor]) return denied();
    if (!['GET', 'HEAD'].includes(method) && tokens.get(request.headers()['x-csrftoken']) !== actor) return denied();
    if (pathname === '/api/v1/auth/logout/') return respond(null, 204, { 'Set-Cookie': 'studly_qa_actor=; Max-Age=0; Path=/' });
    if (pathname === '/api/v1/account/') return respond({ id: actor, registration: clone(state.accounts[actor]), capabilities: capabilities(actor) });
    if (pathname === '/api/v1/performer/moderation/') return respond(moderation(actor));
    if (pathname === '/api/v1/registration/' && method === 'GET') return respond(clone(state.accounts[actor]));
    if (pathname === '/api/v1/registration/' && method === 'PATCH') {
      if (body.performer_revision !== undefined && body.performer_revision !== state.revisions[actor]) return denied(409);
      const value = state.accounts[actor], previous = moderatedFields(value);
      if (body.roles) value.roles = clone(body.roles);
      if (body.profile) Object.assign(value.profile, clone(body.profile));
      if (body.performer) { const { specialization_ids, ...fields } = body.performer; Object.assign(value.performer, fields); if (specialization_ids) value.performer.specializations = specialization_ids.map(id => ({ id, title: 'Программирование' })); }
      if (body.progress) Object.assign(value.progress, body.progress);
      if (previous !== moderatedFields(value)) { state.revisions[actor]++; state.moderationStatuses[actor] = 'pending'; }
      const missing = [...(!value.profile.display_name.trim() ? ['profile.display_name'] : []), ...(!value.roles.length ? ['roles'] : [])];
      if (missing.length) { value.status.is_complete = false; value.status.completed_at = null; }
      value.status.missing_fields = missing;
      value.status.performer_missing_fields = [...(!value.roles.includes('performer') ? ['roles.performer'] : []), ...(!value.profile.display_name.trim() ? ['profile.display_name'] : []), ...(!value.performer?.specializations.length ? ['performer.specialization_ids'] : [])];
      value.status.performer_ready = !value.status.performer_missing_fields.length; return respond(clone(value));
    }
    if (pathname === '/api/v1/cabinet/') { const role = url.searchParams.get('role'); if (!state.accounts[actor].roles.includes(role)) return denied();
      const orders = state.orders.filter(item => (role === 'customer' ? item.buyer.id : item.performer.id) === actor);
      const byStatus = Object.fromEntries(['pending_acceptance', 'awaiting_payment', 'cancelled', 'declined'].map(status => [status, orders.filter(item => item.status === status).length]));
      return respond({ role, account_id: actor, registration: clone(state.accounts[actor]), capabilities: capabilities(actor),
      orders: { count: orders.length, by_status: byStatus, url: `/api/v1/orders/?role=${role}` }, services: role === 'performer' ? { draft: 0, pending: 0, published: 0, rejected: 0, changes: 0 } : null,
      moderation: role === 'performer' ? moderation(actor) : null, statistics: { completed_orders: null, rating: null, review_count: null }, unavailable: ['execution', 'reviews', 'rating'] }); }
    if (pathname === '/api/v1/portfolio/' && method === 'GET') return respond(paged(state.portfolio[actor]));
    if (pathname === '/api/v1/portfolio/' && method === 'POST') {
      if (!capabilities(actor).performer) return denied(); if (body.revision !== state.revisions[actor]) return denied(409);
      const key = `${actor}:portfolio.add:${body.request_key}`;
      if (state.receipts.has(key)) return respond(clone(state.receipts.get(key)), 200);
      const value = { id: randomUUID(), title: body.title, kind: 'link', url: body.url, content_url: null, content_type: null, size: 0, created_at: now };
      state.portfolio[actor].push(value); state.revisions[actor]++; state.moderationStatuses[actor] = 'pending';
      const response = { example: value, moderation: moderation(actor) }; state.receipts.set(key, clone(response)); return respond(response, 201);
    }
    if (pathname === '/api/v1/favorites/') return respond(paged([]));
    if (pathname === '/api/v2/my/services/') return respond(paged([]));
    if (pathname === '/api/v2/quotes/' && method === 'POST') {
      if (!capabilities(actor).customer) return denied();
      const ids = body.extra_ids ?? [];
      if (new Set(ids).size !== ids.length || ids.some(id => !service.extras.some(extra => extra.id === id))) return denied(400);
      const value = quote(ids); state.quotes.set(value.quote_id, { ...value, owner: actor }); return respond(value, 201);
    }
    if (/^\/api\/v2\/quotes\/[^/]+\/$/.test(pathname)) {
      if (state.failures.quoteRead) return denied(404);
      const value = state.quotes.get(pathname.split('/')[4]); if (!value || value.owner !== undefined && value.owner !== actor) return denied(404);
      const { owner, ...snapshot } = value; return respond(clone(snapshot));
    }
    if (pathname === '/api/v2/orders/' && method === 'POST') {
      if (!capabilities(actor).customer) return denied(); const key = `${actor}:order.create.v2:${body.request_key}`;
      if (state.receipts.has(key)) return respond(clone(state.receipts.get(key)), 200);
      const quoted = state.quotes.get(body.quote_id); if (!quoted || quoted.owner !== actor) return denied(404);
      if (state.orders.some(item => item.quote_id === body.quote_id)) return denied(409);
      const { owner, ...snapshot } = quoted, value = order(snapshot, actor, body.request_key);
      state.orders.push(value); const frozen = forViewer(value, actor); state.receipts.set(key, clone(frozen));
      if (state.failures.purchase) { state.failures.purchase = false; return denied(503); }
      return respond(frozen, 201);
    }
    if (pathname === '/api/v2/orders/' && method === 'GET') { const role = url.searchParams.get('role'); return respond(paged(state.orders.filter(item => item.buyer.id === actor || item.performer.id === actor).filter(item => !role || (role === 'customer' ? item.buyer.id : item.performer.id) === actor).map(item => forViewer(item, actor)))); }
    const orderMatch = /^\/api\/v2\/orders\/(\d+)\/(?:(accept|cancel|decline)\/)?$/.exec(pathname);
    if (orderMatch) {
      const value = state.orders.find(item => item.id === Number(orderMatch[1])); if (!value || ![value.buyer.id, value.performer.id].includes(actor)) return denied(404);
      if (method === 'GET') return respond(forViewer(value, actor));
      const action = orderMatch[2], key = `${actor}:order.action.v2:${body.request_key}`;
      if (state.receipts.has(key)) return respond(clone(state.receipts.get(key)), 200);
      if (body.revision !== value.revision) return denied(409);
      if (!forViewer(value, actor).available_actions.includes(action)) return denied();
      value.revision++; value.status = action === 'accept' ? 'awaiting_payment' : action === 'cancel' ? 'cancelled' : 'declined';
      if (action === 'accept') value.accepted_at = now; else { value.closed_at = now; value.closed_by = { id: actor, name: names[actor] }; }
      const frozen = forViewer(value, actor); state.receipts.set(key, clone(frozen));
      if (action === 'accept' && state.failures.accept) { state.failures.accept = false; return denied(503); }
      return respond(frozen);
    }
    if (/^\/api\/v1\/orders\/\d+\/events\/$/.test(pathname)) return respond(paged([]));
    if (pathname === '/api/v1/orders/851/conversation/') return [701, 702].includes(actor) ? respond(clone(conversation)) : denied(404);
    if (pathname === '/api/v1/conversations/') return respond(paged([701, 702].includes(actor) ? [conversation] : []));
    if (pathname === `/api/v1/conversations/${conversationId}/`) return [701, 702].includes(actor) ? respond(clone(conversation)) : denied(404);
    if (pathname === `/api/v1/conversations/${conversationId}/messages/` && method === 'GET') return respond({ next: null, previous: null, results: clone(state.messages.filter(item => item.status === 'stored' || item.sender_id === actor).sort((a, b) => a.sequence - b.sequence)) });
    if (pathname === `/api/v1/conversations/${conversationId}/messages/` && method === 'POST') {
      if (![701, 702].includes(actor)) return denied(404);
      const key = `${actor}:message.send:${body.client_message_id}`;
      if (state.receipts.has(key)) return respond(clone(state.receipts.get(key)), 200);
      const held = body.text.includes('Оплатим напрямую');
      const value = { id: state.messages.length + 1, sequence: ++state.sequence, conversation_id: conversationId, sender_id: actor, client_message_id: body.client_message_id, text: body.text,
        status: held ? 'held' : 'stored', categories: held ? ['external_payment'] : [], rules_version: 'offplatform-2026-10-24-v1',
        warning: held ? 'Сообщение удержано. Можно сообщить об ошибке.' : null, security_case_id: held ? 901 : null, created_at: now };
      state.messages.push(value); state.receipts.set(key, clone(value));
      if (state.failures.message) { state.failures.message = false; return denied(503); }
      return respond(clone(value), 201);
    }
    if (pathname === '/api/v1/security-cases/901/appeal/') { const message = state.messages.at(-1); if (message.sender_id !== actor) return denied(404); return respond({ id: 901, message_id: message.id, conversation_id: conversationId, revision: 1, categories: ['external_payment'], rules_version: 'offplatform-2026-10-24-v1', appealed: false, appeal_reason: '', decision: 'release', decision_reason: 'Synthetic reviewer release' }); }
    throw new Error(`Fixture has no supported handler: ${method} ${pathname}`);
  }
  return { state, service, extraId, conversationId, moderation, externalProfileEdit, externalCancel, releaseMessage, intercept };
}
module.exports = { backend, provenance, createFixture, names, validate, documents };
