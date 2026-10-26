/* eslint-disable @typescript-eslint/no-require-imports -- Reproducible isolated Playwright contract smoke; no Django or HTTP fixture server. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/Users/alekspih/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.STUDLY_BROWSER_BASE || 'http://127.0.0.1:3002';
const out = process.env.STUDLY_BROWSER_OUT || __dirname;
const phase = process.argv[2] || 'full';
const evidencePrefix = phase === 'role-query' ? 'browser-live-role-query' : 'browser-live-contract';
const U = '00000000-0000-4000-8000-000000000001', E = '00000000-0000-4000-8000-000000000002', P = '00000000-0000-4000-8000-000000000004';
const now = '2026-10-26T10:00:00Z';
const result = { kind: 'synthetic browser contract smoke', phase, djangoTested: false, realTelegramTested: false, backendReference: '8999703fe60ef6714595614413faddc5a9308d44',
  fixtureSources: ['apps/web/tests/live-account.test.cjs', 'apps/web/tests/live-services.test.cjs', 'apps/web/tests/live-commerce.test.cjs', 'apps/web/tests/live-staff.test.cjs'],
  startedAt: new Date().toISOString(), assertions: 0, checks: [], routes: [], requests: [], blockedExternal: [], unhandledApi: [], fixtureErrors: [], pageErrors: [], hydrationErrors: [], screenshots: [] };
let browser, context, page;
const clone = value => JSON.parse(JSON.stringify(value));
const ok = (condition, message) => { result.assertions++; assert.ok(condition, message); };
const eq = (actual, expected, message) => { result.assertions++; assert.deepEqual(actual, expected, message); };
const record = (name, details = {}) => { result.checks.push({ name, pass: true, ...details }); console.log(`PASS ${name}`); };
const userNames = { 9: 'Contract Account A', 7: 'Contract Account B', 100: 'Contract Staff' };
const registration = id => ({ roles: ['customer', 'performer'], profile: { display_name: userNames[id], avatar_url: null, university: 'Synthetic campus', city: '', about: '' }, performer: { description: 'Synthetic performer description', study_year: '2', portfolio: '', specializations: [] }, progress: { current_step: 'profile', performer_skipped: false, updated_at: null }, status: { is_complete: true, completed_at: now, missing_fields: [], performer_ready: true, performer_missing_fields: [] } });
const capabilities = id => ({ customer: true, performer: true, create_order: true, create_service: true, django_admin: id === 100, moderate_services: id === 100, moderate_performers: id === 100 });
const moderation = id => ({ user_id: id, revision: 4, status: id === 7 ? 'pending' : 'approved', reason: '', submitted_at: now, ready_to_submit: true, missing_fields: [], approved: id !== 7 });
const extra = { id: E, title: 'Contract extra report', price_amount: '300.00', extra_days: 1 };
const publicService = { id: 42, title: 'Contract Python consultation', description: 'Synthetic server service description', price_amount: '1000.10', currency: 'RUB', duration_days: 3, performer: { id: 7, name: userNames[7] }, included: ['Server included item'], is_demo: false, revision: 3, category: 'Программирование', extras: [extra] };
const ownService = { ...clone(publicService), id: 43, title: 'Contract own draft', performer: { id: 9, name: userNames[9] }, status: 'draft', reason: '', portfolio_example_ids: [P] };
const work = { id: P, title: 'Contract portfolio link', kind: 'link', url: 'https://example.invalid/synthetic-work', content_url: null, content_type: null, size: 0, created_at: now };
const snapshot = (quoteId, selected = true) => ({ quote_id: quoteId, service_id: 42, service_revision: 3, performer_id: 7, title: publicService.title, description: publicService.description, included: publicService.included, duration_days: selected ? 4 : 3, currency: 'RUB', tariff_code: 'buyer-5-v1', base_price_amount: '1000.10', selected_extras: selected ? [extra] : [], extras_amount: selected ? '300.00' : '0.00', price_amount: selected ? '1300.10' : '1000.10', buyer_fee_percent: '5.00', buyer_fee_amount: selected ? '65.01' : '50.01', total_amount: selected ? '1365.11' : '1050.11' });
const conversation = () => ({ id: U, kind: 'order', order_id: 12, service_id: 42, title: publicService.title, participant_ids: [9, 7], created_at: now });
const message = (id, sequence, sender, text, held = false) => ({ id, sequence, conversation_id: U, sender_id: sender, client_message_id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, text, status: held ? 'held' : 'stored', categories: held ? ['external_payment'] : [], rules_version: 'offplatform-2026-10-24-v1', warning: held ? 'Сообщение удержано. Можно сообщить об ошибке.' : null, security_case_id: held ? 4 : null, created_at: now });
const securityCase = { id: 4, message_id: 2, conversation_id: U, revision: 2, categories: ['external_payment'], rules_version: 'offplatform-2026-10-24-v1', appealed: false, appeal_reason: '', decision: null, decision_reason: '' };
const state = { actor: 9, registrations: { 9: registration(9), 7: registration(7), 100: registration(100) }, moderations: { 9: moderation(9), 7: moderation(7), 100: moderation(100) },
  portfolio: { 9: [work], 7: [], 100: [] }, own: clone(ownService), staffService: { ...clone(ownService), id: 44, title: 'Contract staff service', performer: { id: 7, name: userNames[7] }, status: 'pending' }, favorites: { 9: [], 7: [], 100: [] }, quotes: new Map(), receipts: new Map(), orders: [], quoteSequence: 0,
  conversations: [conversation()], messages: [message(1, 1, 7, 'Contract stored initial'), message(2, 2, 9, 'Contract held private', true), message(3, 3, 7, 'Contract cursor page')], case: clone(securityCase),
  failNext: null, orderConflict: false, orderUnknown: false, messageUnknown: false, staffResources: ['users', 'performers', 'services', 'orders', 'events', 'security-cases'], csrfIssued: 0, csrfTokens: new Set() };
const paged = rows => ({ count: rows.length, next: null, previous: null, results: rows });
const ownOrders = () => state.orders.filter(order => order.buyer.id === state.actor || order.performer.id === state.actor);
const orderForViewer = order => ({ ...order, available_actions: order.buyer.id === state.actor && ['pending_acceptance', 'awaiting_payment'].includes(order.status) ? ['cancel'] : order.performer.id === state.actor && order.status === 'pending_acceptance' ? ['accept', 'decline'] : [] });
const caseForStaff = () => ({ ...clone(state.case), message: clone(state.messages.find(row => row.id === state.case.message_id)) });
function makeOrder(body) {
  if (state.receipts.has(body.request_key)) return clone(state.receipts.get(body.request_key));
  const quote = state.quotes.get(body.quote_id); if (!quote) return null;
  const value = { ...quote, id: 12, service_id: 42, service_revision: 3, revision: 1, request_key: body.request_key, buyer: { id: 9, name: userNames[9] }, performer: { id: 7, name: userNames[7] }, quote_id: body.quote_id, available_actions: ['cancel'], payment_status: 'unpaid', status: 'pending_acceptance', created_at: now, accepted_at: null, closed_at: null, closed_by: null };
  delete value.performer_id; delete value.extras_amount;
  state.orders.push(value); state.receipts.set(body.request_key, clone(value)); return value;
}
async function intercept(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method(), pathname = url.pathname;
  if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
  if (url.origin !== base) { result.blockedExternal.push(url.origin + pathname); return route.abort('blockedbyclient'); }
  if (!pathname.startsWith('/api/')) return route.continue();
  const body = request.postDataJSON() ?? {};
  result.requests.push({ path: pathname, query: url.search, method, actor: state.actor, bodyKeys: Object.keys(body), request_key: body.request_key ?? body.client_message_id ?? null, quote_id: body.quote_id ?? null, csrf: !!request.headers()['x-csrftoken'] });
  const respond = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: status === 204 ? '' : JSON.stringify(value) });
  const denied = (status = 403) => respond({ detail: 'Synthetic permission/error fixture' }, status);
  if (state.failNext && pathname === state.failNext.path) { const fail = state.failNext; return fail.network ? route.abort('failed') : denied(fail.status); }
  if (pathname === '/api/v1/auth/csrf/') { const token = `synthetic-csrf-${++state.csrfIssued}`; state.csrfTokens.add(token); return respond({ csrf_token: token }); }
  if (pathname === '/api/v1/auth/options/') return respond({ telegram_mini_app: false, telegram_website: false });
  if (pathname === '/api/v1/auth/me/') return state.actor ? respond({ user: { id: state.actor, display_name: state.registrations[state.actor].profile.display_name, telegram_username: 'synthetic' } }) : denied();
  if (!['GET', 'HEAD'].includes(method)) { ok(state.csrfTokens.has(request.headers()['x-csrftoken']), `CSRF supplied before ${method} ${pathname}`); }
  if (pathname === '/api/v1/auth/logout/') { state.actor = null; return respond(null, 204); }
  if (pathname === '/api/v1/health/' || pathname === '/api/v1/ready/') return respond({ status: 'ok' });
  if (pathname === '/api/v1/performers/7/') return respond({ id: 7, name: userNames[7], about: 'Synthetic public performer' });
  if (pathname === '/api/v2/services/') {
    let rows = [clone(publicService)]; const search = url.searchParams.get('search'); if (search) rows = rows.filter(x => `${x.title} ${x.description}`.toLowerCase().includes(search.toLowerCase()));
    const category = url.searchParams.get('category'); if (category) rows = rows.filter(x => x.category === category);
    return respond(paged(rows));
  }
  if (pathname === '/api/v2/services/42/') return respond(publicService);
  if (!state.actor) return denied();
  if (pathname === '/api/v1/specializations/') return respond(paged([]));
  if (pathname === '/api/v1/account/') return respond({ id: state.actor, registration: state.registrations[state.actor], capabilities: capabilities(state.actor) });
  if (pathname === '/api/v1/registration/' && method === 'GET') return respond(state.registrations[state.actor]);
  if (pathname === '/api/v1/registration/' && method === 'PATCH') {
    if (body.performer_revision !== state.moderations[state.actor].revision) return denied(409);
    const value = state.registrations[state.actor]; if (body.profile) Object.assign(value.profile, body.profile); if (body.performer) Object.assign(value.performer, body.performer); if (body.roles) value.roles = body.roles;
    const mod = state.moderations[state.actor]; mod.revision++; mod.status = 'pending'; mod.approved = false; return respond(value);
  }
  if (pathname === '/api/v1/performer/moderation/') return respond(state.moderations[state.actor]);
  if (pathname === '/api/v1/cabinet/') { const role = url.searchParams.get('role'); return respond({ role, account_id: state.actor, registration: state.registrations[state.actor], capabilities: capabilities(state.actor), orders: { count: ownOrders().length, by_status: {}, url: `/api/v1/orders/?role=${role}` }, services: role === 'performer' ? { draft: 1, pending: 0, published: 0 } : null, moderation: role === 'performer' ? state.moderations[state.actor] : null, statistics: { completed_orders: null, rating: null, review_count: null }, unavailable: ['execution', 'reviews', 'rating'] }); }
  if (pathname === '/api/v1/portfolio/' && method === 'GET') return respond(paged(state.portfolio[state.actor]));
  if (pathname === '/api/v1/portfolio/' && method === 'POST') { const example = { ...clone(work), id: '00000000-0000-4000-8000-000000000005', title: body.title, url: body.url }; state.portfolio[state.actor].push(example); state.moderations[state.actor].revision++; return respond({ example, moderation: state.moderations[state.actor] }, 201); }
  if (pathname === '/api/v2/my/services/') return respond(paged(state.actor === 9 ? [state.own] : []));
  if (pathname === '/api/v2/my/services/43/' && method === 'GET') return state.actor === 9 ? respond(state.own) : denied(404);
  if (pathname === '/api/v2/my/services/43/' && method === 'PATCH') { if (state.actor !== 9) return denied(404); if (body.revision !== state.own.revision) return denied(409); const { revision, request_key, ...fields } = body; Object.assign(state.own, fields, { revision: revision + 1, status: 'draft' }); return respond(state.own); }
  if (pathname === '/api/v1/favorites/') return respond(paged(state.favorites[state.actor].includes(42) ? [publicService] : []));
  if (pathname === '/api/v1/favorites/42/') { if (method === 'PUT') state.favorites[state.actor] = [42]; else if (method === 'DELETE') state.favorites[state.actor] = []; return respond(null, 204); }
  if (pathname === '/api/v2/quotes/' && method === 'POST') { const id = `10000000-0000-4000-8000-${String(++state.quoteSequence).padStart(12, '0')}`; const value = snapshot(id, body.extra_ids.includes(E)); state.quotes.set(id, value); return respond(value, 201); }
  if (/^\/api\/v2\/quotes\/[^/]+\/$/.test(pathname)) return state.quotes.has(pathname.split('/')[4]) ? respond(state.quotes.get(pathname.split('/')[4])) : denied(404);
  if (pathname === '/api/v2/orders/' && method === 'POST') { if (state.orderConflict) { state.orderConflict = false; return denied(409); } const value = makeOrder(body); if (!value) return denied(404); if (state.orderUnknown) { state.orderUnknown = false; return route.abort('failed'); } return respond(orderForViewer(value), 201); }
  if (pathname === '/api/v2/orders/' && method === 'GET') { let rows = ownOrders(); const role = url.searchParams.get('role'); if (role) rows = rows.filter(x => (role === 'customer' ? x.buyer.id : x.performer.id) === state.actor); return respond(paged(rows.map(orderForViewer))); }
  if (pathname === '/api/v2/orders/12/') return ownOrders().find(x => x.id === 12) ? respond(orderForViewer(state.orders[0])) : denied(404);
  if (/^\/api\/v2\/orders\/12\/(accept|cancel|decline)\/$/.test(pathname)) {
    const order = state.orders[0], action = pathname.split('/')[5]; if (!order || !orderForViewer(order).available_actions.includes(action)) return denied(403); if (body.revision !== order.revision) return denied(409);
    order.revision++; order.status = action === 'accept' ? 'awaiting_payment' : action === 'cancel' ? 'cancelled' : 'declined'; if (action === 'accept') order.accepted_at = now; else order.closed_at = now; return respond(orderForViewer(order));
  }
  if (pathname === '/api/v1/orders/12/events/') return respond(paged([{ id: 1, actor_id: 9, action: 'created', revision: 1, created_at: now }]));
  if (pathname === '/api/v1/orders/12/conversation/') return [9, 7].includes(state.actor) ? respond(conversation()) : denied(404);
  if (pathname === '/api/v1/discussions/' && method === 'POST') { const value = { ...conversation(), id: '00000000-0000-4000-8000-000000000006', kind: 'discussion', order_id: null }; if (!state.conversations.some(x => x.id === value.id)) state.conversations.push(value); return respond(value, 201); }
  if (pathname === '/api/v1/conversations/') return respond(paged(state.conversations.filter(x => x.participant_ids.includes(state.actor))));
  if (/^\/api\/v1\/conversations\/[^/]+\/$/.test(pathname)) { const value = state.conversations.find(x => x.id === pathname.split('/')[4]); return value?.participant_ids.includes(state.actor) ? respond(value) : denied(404); }
  if (pathname === `/api/v1/conversations/${U}/messages/` && method === 'GET') {
    if (![9, 7].includes(state.actor)) return denied(404); const visible = state.messages.filter(x => x.status === 'stored' || x.sender_id === state.actor);
    const second = url.searchParams.has('cursor'); return respond({ next: second ? null : `/api/v1/conversations/${U}/messages/?cursor=synthetic-next`, previous: null, results: visible.filter(x => second ? x.sequence >= 3 : x.sequence < 3) });
  }
  if (pathname === `/api/v1/conversations/${U}/messages/` && method === 'POST') {
    const existing = state.messages.find(x => x.client_message_id === body.client_message_id); if (existing) return respond(existing);
    const value = { ...message(state.messages.length + 1, state.messages.length + 1, state.actor, body.text, body.text.includes('external payment')), client_message_id: body.client_message_id }; state.messages.push(value); if (state.messageUnknown) { state.messageUnknown = false; return route.abort('failed'); } return respond(value, 201);
  }
  if (pathname === '/api/v1/security-cases/4/appeal/') { if (state.actor !== 9) return denied(404); if (method === 'POST') { if (body.revision !== state.case.revision) return denied(409); state.case.appealed = true; state.case.appeal_reason = body.reason; state.case.revision++; } return respond(state.case); }
  if (pathname === '/api/v1/staff/me/') return state.actor === 100 ? respond({ id: 100, display_name: userNames[100], resources: state.staffResources, unavailable: ['finance', 'analytics'] }) : denied();
  if (pathname.startsWith('/api/v1/staff/')) {
    if (state.actor !== 100) return denied();
    const resource = pathname.split('/')[4], id = Number(pathname.split('/')[5]); if (!state.staffResources.includes(resource)) return denied();
    const profile = { ...state.moderations[7], display_name: userNames[7], description: 'Synthetic staff moderation material', examples: [] };
    const pendingService = state.staffService;
    if (pathname.endsWith('/decision/')) { const value = resource === 'performers' ? state.moderations[7] : pendingService; Object.assign(value, { revision: body.revision + 1, status: resource === 'services' && body.decision === 'approved' ? 'published' : body.decision, approved: body.decision === 'approved', reason: body.reason }); return respond(value); }
    if (resource === 'security-cases' && id) { if (method === 'POST') { state.case.decision = body.decision; state.case.decision_reason = body.reason; state.case.revision++; if (body.decision === 'release') { const item = state.messages.find(x => x.id === 2); Object.assign(item, { status: 'stored', warning: null, security_case_id: null, sequence: 20 }); } return respond(state.case); } if (!url.searchParams.get('purpose')) return denied(400); return respond(caseForStaff()); }
    const values = { users: [{ id: 9, display_name: userNames[9], is_active: true, roles: ['customer', 'performer'] }], performers: [profile], services: [pendingService], orders: state.orders, events: [{ id: 1, actor_id: 100, operation: 'synthetic.audit', target: '4', details: {}, created_at: now }], 'security-cases': [state.case] };
    return respond(id ? values[resource]?.find(x => (x.user_id ?? x.id) === id) : paged(values[resource] ?? []));
  }
  result.unhandledApi.push({ path: pathname, method }); return route.abort('blockedbyclient');
}

async function shot(name) { const file = `${evidencePrefix}-${name}.jpg`; await page.screenshot({ path: path.join(out, file), fullPage: true, type: 'jpeg', quality: 78 }); result.screenshots.push(file); }
async function go(route) { const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' }); eq(response.status(), 200, `HTTP200 ${route}`); await page.locator('main#campus-content').waitFor(); await page.locator('h1').or(page.getByRole('heading', { name: 'Войдите в STUDLY', exact: true })).or(page.locator('main [role="alert"]')).first().waitFor(); await page.waitForTimeout(100); }
async function visible(locator) { await locator.first().waitFor({ state: 'visible' }); ok(true, 'Expected visible UI'); }
async function geometry(route, width, theme) {
  const value = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, h1: [...document.querySelectorAll('h1')].map(x => x.textContent.trim()), topbar: document.querySelectorAll('header.topbar').length, width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
  eq(value.main, 1, `${route} one main`); eq(value.h1.length, 1, `${route} one h1`); eq(value.topbar, 1, `${route} one Campus topbar`); ok(value.scrollWidth <= width + 1, `${route} horizontal overflow ${JSON.stringify(value)}`);
  const content = await page.locator('main#campus-content').innerText(); ok(!/POISON_DEMO|Демо Студент|Создайте локальный Demo-профиль|Симулировать оплату/.test(content), `${route} no Demo fallback`); eq(await page.locator('.demo-label').innerText(), 'LIVE', `${route} Live label`);
  result.routes.push({ route, width, theme, ...value, pass: true });
}
async function profileFlow() {
  await go('/profile'); await visible(page.getByRole('heading', { level: 1, name: userNames[9], exact: true }));
  await page.getByRole('button', { name: 'Исполнитель', exact: true }).click(); await page.waitForURL('**/profile?role=performer'); await visible(page.getByRole('heading', { name: 'Примеры работ', exact: true })); record('Both-role account switches cabinet without changing authenticated account');
  await page.locator('#live-account-name').fill('Contract Account A Updated'); await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click(); await visible(page.getByRole('heading', { level: 1, name: 'Contract Account A Updated', exact: true }));
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.getByRole('heading', { level: 1, name: 'Contract Account A Updated', exact: true })); eq(state.registrations[9].profile.display_name, 'Contract Account A Updated'); record('Profile PATCH, refetch and browser reload restore the fixture server state');
  await page.locator('#live-example-title').fill('Contract added portfolio'); await page.locator('#live-example-url').fill('https://example.invalid/contract-added'); await page.getByRole('button', { name: 'Добавить пример', exact: true }).click(); await visible(page.getByRole('heading', { level: 3, name: 'Contract added portfolio', exact: true })); record('Portfolio link POST uses private account version and appears after server refetch');
  await page.getByRole('link', { name: 'Открыть редактор', exact: true }).first().click(); await page.waitForURL('**/create-service?id=43'); await page.getByLabel('Название услуги', { exact: true }).fill('Contract own draft updated'); await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click(); await visible(page.getByText('Черновик сохранён на сервере.', { exact: true })); await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByLabel('Название услуги', { exact: true }).waitFor(); eq(await page.getByLabel('Название услуги', { exact: true }).inputValue(), 'Contract own draft updated'); record('Owned service v2 editor PATCH and reload preserve revision and draft');
}
async function catalogFlow() {
  await go('/search'); await page.locator('#service-search').fill('Python'); await visible(page.getByRole('heading', { level: 3, name: publicService.title, exact: true })); await page.locator('#live-category').fill('Программирование'); await page.locator('#search-sort').selectOption('priceAsc'); await page.waitForTimeout(150);
  ok(result.requests.some(x => x.path === '/api/v2/services/' && x.query.includes('category=') && x.query.includes('price_asc')), 'Server category and ordering sent'); record('Catalog uses v2 server search/category/sort query');
  await go('/service/42'); await visible(page.getByRole('heading', { level: 1, name: publicService.title, exact: true })); await page.getByRole('button', { name: 'Добавить в избранное', exact: true }).click(); await visible(page.getByRole('button', { name: 'Убрать из избранного', exact: true })); await go('/favorites'); await visible(page.getByRole('heading', { level: 3, name: publicService.title, exact: true })); record('Favorites PUT then private list uses Django fixture data');
  await go('/service/42'); await page.getByRole('button', { name: 'Обсудить до заказа', exact: true }).click(); const discussionLink = page.getByRole('link', { name: 'Открыть обсуждение услуги', exact: true }); await visible(discussionLink); ok((await discussionLink.getAttribute('href')).endsWith('000000000006'), 'Preorder discussion separate ID'); record('Pre-order discussion uses a separate conversation');
}
async function quoteFlow() {
  await page.getByRole('checkbox', { name: /Contract extra report/ }).check(); await page.getByRole('button', { name: 'Получить расчёт', exact: true }).click(); await visible(page.getByRole('button', { name: 'Создать заказ', exact: true })); eq(await page.getByRole('button', { name: 'Создать заказ', exact: true }).isDisabled(), true, 'Consent required'); ok((await page.locator('main').innerText()).includes('5.00%'), 'Server 5% visible');
  const consent = page.getByRole('checkbox', { name: /Я просмотрел состав/ }); await consent.check(); state.orderConflict = true; await page.getByRole('button', { name: 'Создать заказ', exact: true }).click(); await visible(page.getByText(/Условия изменились или по этому расчёту/)); eq(await consent.count(), 0, '409 removes stale consent'); record('Quote 409 requires new calculation and fresh explicit consent');
  await page.getByRole('button', { name: 'Получить расчёт', exact: true }).click(); await visible(page.getByRole('checkbox', { name: /Я просмотрел состав/ })); eq(await page.getByRole('checkbox', { name: /Я просмотрел состав/ }).isChecked(), false, 'Fresh quote resets consent'); await page.getByRole('checkbox', { name: /Я просмотрел состав/ }).check(); state.orderUnknown = true; await page.getByRole('button', { name: 'Создать заказ', exact: true }).click(); await visible(page.getByText(/Результат запроса неизвестен/).first()); await page.getByRole('button', { name: 'Повторить создание с прежним ключом', exact: true }).click(); await visible(page.getByRole('link', { name: 'Открыть заказ', exact: true }));
  const attempts = result.requests.filter(x => x.path === '/api/v2/orders/' && x.method === 'POST'); eq(attempts.length, 3, 'One conflict, one unknown, one manual replay'); eq(attempts[1].request_key, attempts[2].request_key, 'Unknown outcome retains request key'); eq(attempts[1].quote_id, attempts[2].quote_id, 'Unknown outcome retains quote ID'); eq(state.orders.length, 1, 'Fixture creates one order across unknown outcome'); record('Unknown order response has explicit same-key retry and one server receipt'); await page.getByRole('link', { name: 'Открыть заказ', exact: true }).click(); await page.waitForURL('**/orders/12'); await visible(page.getByRole('heading', { level: 1, name: 'Заказ №12', exact: true }));
}
async function orderAndChatFlow() {
  state.actor = 7; await go('/orders/12'); await visible(page.getByRole('button', { name: 'Принять заказ', exact: true })); eq(await page.getByRole('button', { name: 'Отменить заказ', exact: true }).count(), 0, 'Performer cannot cancel as buyer'); await page.getByRole('button', { name: 'Принять заказ', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить действие', exact: true }).click(); await visible(page.getByText('Ожидает оплаты', { exact: true })); record('Actual performer identity accepts v2 order with optimistic revision');
  await go(`/chats/${U}`); await visible(page.getByText('Contract stored initial', { exact: true })); eq(await page.getByText('Contract held private', { exact: true }).count(), 0, 'Recipient cannot see held text'); record('Held message is private to sender in recipient fixture response and UI');
  state.actor = 9; await go(`/chats/${U}`); await visible(page.getByText('Contract held private', { exact: true })); await page.getByRole('button', { name: 'Загрузить следующие сообщения', exact: true }).click(); await visible(page.getByText('Contract cursor page', { exact: true })); record('Cursor messages append by server ID and sequence');
  await page.getByRole('button', { name: 'Посмотреть случай и обжаловать', exact: true }).click(); await page.getByLabel('Причина обжалования', { exact: true }).fill('Synthetic appeal reason'); await page.getByRole('button', { name: 'Отправить обжалование', exact: true }).click(); await visible(page.getByText('Обжалование сохранено.', { exact: true })); record('Held sender reads case and posts revisioned appeal');
  await page.locator('form textarea').last().fill('Contract message persisted'); state.messageUnknown = true; await page.getByRole('button', { name: 'Отправить', exact: true }).click(); await visible(page.getByText(/Результат запроса неизвестен/).first()); eq(await page.locator('form textarea').last().isDisabled(), true, 'Unknown message freezes original text'); await page.getByRole('button', { name: 'Повторить отправку с прежним ключом', exact: true }).click(); await page.waitForFunction(() => [...document.querySelectorAll('form textarea')].at(-1)?.value === ''); await visible(page.getByText('Contract message persisted', { exact: true })); const sends = result.requests.filter(x => x.path.endsWith('/messages/') && x.method === 'POST'); eq(sends[0].request_key, sends[1].request_key, 'Same client_message_id'); eq(await page.getByText('Contract message persisted', { exact: true }).count(), 1, 'One persisted message bubble'); ok(!/Доставлено|Прочитано/.test(await page.locator('main').innerText()), 'No false delivery/read claim'); record('Unknown message retries original client_message_id and renders stored status');
  await go('/orders/12'); await page.getByRole('button', { name: 'Отменить заказ', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить действие', exact: true }).click(); await visible(page.getByText('Отменён заказчиком', { exact: true })); record('Buyer can cancel accepted unpaid order; no fake payment or completed state');
}
async function staffFlow() {
  state.actor = 9; await go('/staff'); await visible(page.locator('main [role="alert"]')); eq(await page.getByRole('navigation', { name: 'Разделы рабочего места', exact: true }).count(), 0, 'Nonstaff cannot access staff workspace'); record('Nonstaff 403 cannot acquire workspace through Demo flags');
  state.actor = 100; await go('/staff'); await visible(page.getByRole('heading', { name: 'Обзор', exact: true })); eq(await page.getByRole('navigation', { name: 'Разделы рабочего места', exact: true }).getByRole('button').count(), 12, '12 staff sections preserved');
  const select = async (id, label) => { if (page.viewportSize().width <= 700) await page.getByLabel('Раздел рабочего места').selectOption(id); else await page.getByRole('navigation', { name: 'Разделы рабочего места', exact: true }).getByRole('button', { name: label, exact: true }).click(); await visible(page.getByRole('heading', { level: 1, name: label, exact: true })); };
  for (const [id, label] of [['dashboard', 'Обзор'], ['users', 'Пользователи'], ['profiles', 'Профили на проверке'], ['services', 'Услуги'], ['orders', 'Заказы'], ['disputes', 'Обращения и споры'], ['security', 'Жалобы и безопасность'], ['reviews', 'Отзывы'], ['finance', 'Финансы'], ['analytics', 'Аналитика'], ['events', 'История решений'], ['settings', 'Настройки']]) { await select(id, label); await geometry(`/staff#${id}`, page.viewportSize().width, 'light'); }
  record('All 12 staff sections route through real permissions or honest unavailable states');
  await select('profiles', 'Профили на проверке'); await page.getByRole('button', { name: new RegExp(userNames[7]) }).click(); await visible(page.getByRole('heading', { name: 'Решение сотрудника', exact: true })); await page.getByRole('checkbox', { name: /Я проверил/ }).check(); await page.getByRole('button', { name: 'Подтвердить решение', exact: true }).click(); await visible(page.getByText('Решение сохранено. Проверяем актуальное состояние.', { exact: true })); record('Staff profile approval requires current detail and explicit confirmation');
  await select('services', 'Услуги'); await page.getByRole('button', { name: /Contract staff service/ }).click(); await visible(page.getByRole('heading', { name: 'Решение сотрудника', exact: true })); await page.getByRole('checkbox', { name: /Я проверил/ }).check(); await page.getByRole('button', { name: 'Подтвердить решение', exact: true }).click(); await visible(page.getByText('Решение сохранено. Проверяем актуальное состояние.', { exact: true })); eq(state.staffService.status, 'published', 'Service approval response is published'); record('Staff service approval uses saved revision and server publication state');
  await select('security', 'Жалобы и безопасность'); await page.getByRole('button', { name: /Проверка сообщения/ }).click(); eq(await page.getByText('Contract held private', { exact: true }).count(), 0, 'Case list/detail metadata does not expose message text'); await page.getByLabel('Цель просмотра сообщения', { exact: true }).fill('Synthetic appeal review'); await page.getByRole('button', { name: 'Открыть сообщение по обращению', exact: true }).click(); await visible(page.getByText('Contract held private', { exact: true })); await page.locator('[aria-labelledby="staff-detail-title"] select').selectOption('release'); await page.getByLabel(/Причина/).last().fill('Synthetic release reason'); await page.getByRole('checkbox', { name: /Я проверил/ }).check(); await page.getByRole('button', { name: 'Подтвердить решение', exact: true }).click(); await visible(page.getByText('Решение сохранено. Проверяем актуальное состояние.', { exact: true })); record('Staff case message needs audited purpose; release decision carries version and reason');
  await shot('staff-1440-light');
}
async function failureAndIsolationFlow() {
  state.actor = 9;
  for (const status of [400, 401, 403, 404, 409, 500]) { state.failNext = { path: '/api/v2/services/42/', status }; await go('/service/42'); await visible(page.locator('main [role="alert"]')); ok(!(await page.locator('main').innerText()).includes(publicService.title), 'No stale detail on error'); state.failNext = null; await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click(); await visible(page.getByRole('heading', { level: 1, name: publicService.title, exact: true })); record(`API ${status} shows error and explicit GET retry`); }
  state.failNext = { path: '/api/v2/services/42/', network: true }; await go('/service/42'); await visible(page.getByText(/Не удалось связаться с сервером/)); record('Absent Backend network failure remains an honest error'); state.failNext = null;
  await go('/profile'); await visible(page.getByRole('heading', { level: 1, name: 'Contract Account A Updated', exact: true })); state.actor = 7; await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.getByRole('heading', { level: 1, name: userNames[7], exact: true })); ok(!(await page.locator('main').innerText()).includes('Contract Account A Updated'), 'Account A profile not retained for B'); await go('/favorites'); await visible(page.getByRole('heading', { name: 'Здесь пока пусто', exact: true })); eq(state.favorites[7].length, 0, 'Different account favorites'); record('Same-browser account replacement clears private profile and favorites');
  state.registrations[7].status.is_complete = false; const patchCount = result.requests.filter(x => x.path === '/api/v1/registration/' && x.method === 'PATCH').length; await go('/profile'); await visible(page.getByRole('heading', { level: 1, name: 'Регистрация скоро появится', exact: true })); eq(await page.locator('main form').count(), 0, 'Incomplete account cannot bypass production registration through profile'); eq(result.requests.filter(x => x.path === '/api/v1/registration/' && x.method === 'PATCH').length, patchCount, 'No profile PATCH behind closed gate'); state.registrations[7].status.is_complete = true; record('Incomplete authenticated account remains behind production registration gate');
  state.actor = null; await go('/orders'); await visible(page.getByRole('heading', { name: 'Войдите в STUDLY', exact: true })); ok(!(await page.locator('main').innerText()).includes('Заказ №12'), 'Guest no private order'); await go('/register/roles'); await visible(page.getByRole('heading', { level: 1, name: 'Регистрация скоро появится', exact: true })); eq(await page.locator('main form').count(), 0, 'Production registration gate'); await go('/admin'); await visible(page.getByRole('heading', { level: 1, name: 'Раздел закрыт', exact: true })); record('Guest and production registration/admin gates remain closed');
}
async function matrix() {
  state.actor = 9;
  const routes = ['/', '/search', '/category/programming', '/service/42', '/profile', '/profile?role=performer', '/profile/7', '/favorites', '/create-service?id=43', '/orders', '/orders/12', '/chats', `/chats/${U}`, '/admin'];
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) { await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.emulateMedia({ colorScheme: theme }); for (const route of routes) { await go(route); await page.waitForTimeout(70); await geometry(route, width, theme); if (width === 390 && theme === 'dark' && ['/service/42', '/profile', `/chats/${U}`].includes(route)) await shot(route === '/profile' ? 'profile-390-dark' : route === '/service/42' ? 'quote-390-dark' : 'chat-390-dark'); } record(`14 core routes at ${width}px ${theme}`); }
  state.actor = 100; await page.setViewportSize({ width: 390, height: 844 }); await go('/staff'); await visible(page.getByLabel('Раздел рабочего места')); eq(await page.getByLabel('Раздел рабочего места').locator('option').count(), 12, 'Mobile staff has 12 sections'); await page.getByLabel('Раздел рабочего места').selectOption('finance'); await visible(page.getByRole('heading', { name: 'Финансы', exact: true })); await geometry('/staff#finance', 390, 'dark'); await shot('staff-390-dark'); record('Mobile staff section navigation stays usable');
}
async function roleQuerySmoke() {
  const cases = [['?role=customer', 'customer', '?role=customer'], ['?role=performer', 'performer', '?role=performer'], ['?role=staff', 'all', ''], ['', 'all', '']];
  for (let index = 0; index < cases.length; index++) {
    const [query, expected, expectedQuery] = cases[index], width = index < 2 ? 1440 : 390, theme = index < 2 ? 'light' : 'dark';
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.emulateMedia({ colorScheme: theme });
    const previous = result.requests.length; await go(`/orders${query}`); await visible(page.getByText('Заказов пока нет.', { exact: true }));
    eq(await page.getByLabel(/Показать заказы/).inputValue(), expected, `Role query initializes selector ${query || 'absent'}`);
    const requests = result.requests.slice(previous).filter(x => x.path === '/api/v2/orders/' && x.method === 'GET'); ok(requests.length > 0, 'Orders fetched from v2'); ok(requests.every(x => x.query === expectedQuery), `Every request uses expected role ${expectedQuery || 'all'}`);
    await geometry(`/orders${query}`, width, theme); record(`Order query ${query || 'absent'} initializes ${expected} and matching API filter`);
  }
  await shot('390-dark');
}
function save() { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, `${evidencePrefix}-results.json`), JSON.stringify(result, null, 2) + '\n'); }
(async () => {
  try {
    fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', serviceWorkers: 'block' });
    await context.addInitScript(() => { localStorage.setItem('studly-orders', '[{"title":"POISON_DEMO"}]'); localStorage.setItem('studly-chats', '[{"title":"POISON_DEMO"}]'); localStorage.setItem('studly-favorites', '[1]'); localStorage.setItem('studly-demo-admin', 'enabled'); });
    await context.route('**/*', async route => { try { await intercept(route); } catch (error) { result.fixtureErrors.push(String(error.stack ?? error)); await route.abort('blockedbyclient').catch(() => {}); } });
    page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => result.pageErrors.push({ url: page.url(), message: error.message })); page.on('console', message => { if (message.type() === 'error' && /hydration|hydrating|did not match|Minified React error/i.test(message.text())) result.hydrationErrors.push({ url: page.url(), message: message.text() }); });
    if (phase === 'role-query') await roleQuerySmoke();
    else if (phase === 'full') { await profileFlow(); await catalogFlow(); await quoteFlow(); await orderAndChatFlow(); await staffFlow(); await failureAndIsolationFlow(); await matrix(); }
    else throw new Error(`Unknown browser phase: ${phase}`);
    const storage = await page.evaluate(async () => ({ orders: localStorage.getItem('studly-orders'), chats: localStorage.getItem('studly-chats'), databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(x => x.name) : [] }));
    eq(storage.orders, '[{"title":"POISON_DEMO"}]', 'Live did not mutate Demo order storage'); eq(storage.chats, '[{"title":"POISON_DEMO"}]', 'Live did not mutate Demo chat storage'); ok(!storage.databases.includes('studly-demo-workspace-v2'), 'Live never opened Demo workspace DB'); record('Poisoned Demo localStorage remains isolated; no Demo IndexedDB');
    eq(result.unhandledApi, [], 'Every API request intercepted or explicitly rejected'); eq(result.fixtureErrors, [], 'Fixture handlers clean'); eq(result.pageErrors, [], 'Zero browser exceptions'); eq(result.hydrationErrors, [], 'Zero hydration errors'); ok(result.requests.filter(x => !['GET', 'HEAD'].includes(x.method)).every(x => x.csrf), 'All UI mutations carry CSRF');
    result.pass = true; result.finishedAt = new Date().toISOString(); save(); console.log(`COMPLETE synthetic Live contract ${JSON.stringify({ assertions: result.assertions, checks: result.checks.length, routes: result.routes.length, requests: result.requests.length, djangoTested: false })}`);
  } catch (error) { result.pass = false; result.error = String(error.stack ?? error); result.finishedAt = new Date().toISOString(); try { await shot('failure'); } catch {} save(); console.error(result.error); process.exitCode = 1; }
  finally { await browser?.close(); }
})();
