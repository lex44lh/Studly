/* eslint-disable @typescript-eslint/no-require-imports -- Independent synthetic browser regressions; no Django, application imports, or production data. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { backend, provenance, createFixture, names } = require('./contract-fixtures.cjs');
const base = process.env.STUDLY_BROWSER_BASE ?? 'http://127.0.0.1:3002';
const out = process.env.STUDLY_BROWSER_OUT ?? __dirname;
const requested = process.env.STUDLY_CORRECTION_CASES?.split(',');
const stamp = () => ({ utc: new Date().toISOString(), moscow: new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' }) });
const result = { kind: 'Synthetic browser regression against pinned Django contract; NOT Django E2E', backend,
  fixtureSources: provenance, candidate: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceManifestSHA256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(out, 'source-manifest.json'))).digest('hex'), candidateWorkingTree: true,
  djangoTested: false, realTelegramTested: false, actualCsrfMiddlewareTested: false,
  reviewReferences: [
    '/Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-26_22-08_django-live-independent-acceptance.md',
    '/Users/alekspih/Projects/studly/documents/project/для отчетов/frontend/api-integration/2026-10-26_22-08_live-review-handoff.md',
  ], started: stamp(), base, assertions: 0, cases: [], pageErrors: [] };
const ensure = (condition, message) => { result.assertions++; assert.ok(condition, message); };
const equal = (actual, expected, message) => { result.assertions++; assert.deepEqual(actual, expected, message); };
const namesForCases = ['L4-shared-tabs', 'L4-switch-during-csrf', 'L2-own-portfolio', 'L2-external-conflict', 'L3-name', 'L3-roles', 'L1-extras-reload', 'L1-unavailable-quote', 'L1-no-order-quote-unavailable', 'C1-order-receipt', 'C1-message-release'];
if (process.argv.includes('--describe')) {
  console.log(JSON.stringify({ ...result, cases: namesForCases, browserStarted: false }, null, 2));
  process.exit(0);
}
const { chromium } = require(process.env.STUDLY_PLAYWRIGHT_PATH ?? '/Users/alekspih/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let browser;
function save() { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'browser-corrections-results.json'), JSON.stringify(result, null, 2) + '\n'); }
function snapshot(fixture) {
  return { accounts: fixture.state.accounts, revisions: fixture.state.revisions, portfolio: fixture.state.portfolio,
    quotes: Object.fromEntries(fixture.state.quotes), receipts: Object.fromEntries(fixture.state.receipts), orders: fixture.state.orders,
    messages: fixture.state.messages, events: fixture.state.events, requests: fixture.state.requests, fixtureErrors: fixture.state.errors };
}
async function eventually(predicate, message, milliseconds = 8000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  ensure(false, message);
}
async function visible(locator) { await locator.first().waitFor({ state: 'visible' }); }
async function profile(page, actor, role = 'performer') {
  await page.goto(`${base}/profile?role=${role}`, { waitUntil: 'domcontentloaded' });
  await visible(page.locator('#live-account-name'));
  equal(await page.locator('#live-account-name').inputValue(), names[actor], 'Fixture account loaded by actual browser cookie');
}
async function setActorInTab(page, actor) {
  await page.evaluate(id => { document.cookie = `studly_qa_actor=${id}; Path=/; SameSite=Lax`; }, actor);
}
async function capture(page, record, suffix) {
  const file = `browser-${record.name}-${suffix}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: true }); record.screenshots.push(file);
}
async function scenario(name, actor, work) {
  if (requested && !requested.includes(name)) return;
  const fixture = createFixture();
  const record = { name, started: stamp(), pass: false, screenshots: [], observations: [] };
  result.cases.push(record);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', serviceWorkers: 'block' });
  await context.addCookies([{ name: 'studly_qa_actor', value: String(actor), url: base, sameSite: 'Lax' }]);
  context.on('page', item => { item.setDefaultTimeout(10000); item.on('pageerror', error => result.pageErrors.push({ name, url: item.url(), message: error.message })); });
  await context.route('**/*', async route => {
    try { await fixture.intercept(route, base); }
    catch (error) { fixture.state.errors.push(String(error.stack ?? error)); await route.abort('blockedbyclient').catch(() => {}); }
  });
  const page = await context.newPage();
  try {
    await work({ page, context, fixture, record });
    equal(fixture.state.errors, [], `${name}: no hidden fixture/schema error`);
    record.pass = true;
    await capture(page, record, 'pass');
  } catch (error) {
    record.error = String(error.stack ?? error);
    await capture(page, record, 'failure').catch(() => {});
  } finally {
    record.finished = stamp(); record.fixture = snapshot(fixture); save(); await context.close();
    console.log(`${record.pass ? 'PASS' : 'FAIL'} ${name}${record.error ? `: ${record.error.split('\n')[0]}` : ''}`);
  }
}
async function sharedTabIdentity({ page, context, fixture, record }) {
  await profile(page, 702);
  const intended = 'Intended only for Beta'; await page.locator('#live-account-name').fill(intended);
  await capture(page, record, 'beta-dirty');
  const second = await context.newPage(); await second.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
  await setActorInTab(second, 799); await second.reload({ waitUntil: 'domcontentloaded' });
  await eventually(async () => (await second.locator('#live-account-name').inputValue().catch(() => '')) === names[799], 'Second tab authenticated as Gamma');
  equal(fixture.state.revisions[702], fixture.state.revisions[799], 'A and B deliberately have matching revisions');
  // Hidden old page submits the real form without a focus/reload that would hide
  // the original repro. A corrected cross-tab listener may already have removed it.
  const oldPresent = await page.evaluate(() => { const field = document.querySelector('#live-account-name'); if (!field || field.value !== 'Intended only for Beta') return false; field.closest('form').requestSubmit(); return true; });
  record.observations.push({ originalDirtyFormStillMountedAtSubmit: oldPresent, twoRealTabs: context.pages().length, sharedBrowserCookie: true });
  await page.bringToFront();
  await eventually(async () => (await page.locator('#live-account-name').inputValue().catch(() => '')) !== intended, 'Old account form must be invalidated after changed shared session');
  equal(fixture.state.accounts[702].profile.display_name, names[702], 'Original Beta profile was not changed');
  equal(fixture.state.accounts[799].profile.display_name, names[799], 'Beta intention never changed Gamma');
  ensure(!fixture.state.requests.some(item => item.method === 'PATCH' && item.body?.profile?.display_name === intended), 'Stale intent must stop before PATCH, even with valid fresh CSRF and equal revision');
}
async function csrfIdentity({ page, fixture, record }) {
  await profile(page, 702); await page.locator('#live-account-name').fill('Must not cross CSRF identity switch');
  fixture.state.failures.csrfActor = 799;
  await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click();
  await eventually(() => fixture.state.events.some(item => item.operation === 'csrf-session-switch'), 'Synthetic session switches during actual CSRF fetch');
  await visible(page.locator('#live-sign-in-title'));
  await visible(page.getByText('Аккаунт изменился или сессия больше не подтверждена. Несохранённые данные прежнего аккаунта удалены. Повторите проверку входа.', { exact: true }));
  await visible(page.getByRole('button', { name: 'Повторить проверку входа', exact: true }));
  equal(await page.locator('#live-account-name').count(), 0, 'Old private form removed on identity invalidation');
  equal(fixture.state.accounts[799].profile.display_name, names[799], 'No wrong-account PATCH after CSRF response changes shared session');
  ensure(!fixture.state.requests.some(item => item.method === 'PATCH' && item.actor === 799), 'Post-CSRF actor validation must run before mutation');
  record.observations.push({ boundary: 'Session changed in CSRF response, after any initial /me check; synthetic TOCTOU probe, not atomic Django guarantee' });
}
async function ownPortfolio({ page, fixture, record }) {
  const previousCount = fixture.state.portfolio[701].length;
  await profile(page, 701); await page.locator('#live-account-name').fill('Unsaved own text');
  const add = page.getByRole('button', { name: 'Добавить пример', exact: true });
  const blocked = await add.isDisabled(); record.observations.push({ ownPortfolioBlockedWhileProfileDirty: blocked });
  if (!blocked) {
    await page.locator('#live-example-title').fill('Own sequential portfolio'); await page.locator('#live-example-url').fill('https://example.com/synthetic-own');
    await add.click(); await eventually(() => fixture.state.portfolio[701].length === previousCount + 1, 'Own portfolio action persisted');
  }
  await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click();
  await eventually(() => fixture.state.accounts[701].profile.display_name === 'Unsaved own text', 'Own sequential actions must allow the intended profile save without false CAS conflict');
  if (blocked) {
    await eventually(async () => !(await add.isDisabled()), 'Portfolio is enabled after saving dirty text');
    await page.locator('#live-example-title').fill('Own sequential portfolio'); await page.locator('#live-example-url').fill('https://example.com/synthetic-own'); await add.click();
    await eventually(() => fixture.state.portfolio[701].length === previousCount + 1, 'Own portfolio action succeeds after profile save');
  }
  ensure(!fixture.state.requests.some(item => item.status === 409), 'Own operations do not produce a false external-conflict response');
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.locator('#live-account-name'));
  equal(await page.locator('#live-account-name').inputValue(), 'Unsaved own text', 'Profile survives browser reload');
  await visible(page.getByRole('heading', { name: 'Own sequential portfolio', exact: true }));
}
async function externalConflict({ page, fixture }) {
  await profile(page, 701); await page.locator('#live-account-name').fill('Local stale text');
  fixture.externalProfileEdit(701, 'External canonical text');
  await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click();
  await eventually(() => fixture.state.requests.some(item => item.method === 'PATCH' && item.status === 409), 'Real external revision conflict remains enforced');
  equal(fixture.state.accounts[701].profile.display_name, 'External canonical text', 'External update not overwritten');
  equal(await page.locator('#live-account-name').inputValue(), 'Local stale text', 'Dirty local input preserved on conflict');
  equal(fixture.state.requests.find(item => item.method === 'PATCH').body.performer_revision, 2, 'No blind revision promotion');
}
async function completedName({ page, fixture }) {
  await profile(page, 701); await page.locator('#live-account-name').fill('   ');
  const before = fixture.state.requests.filter(item => item.method === 'PATCH').length;
  await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click();
  await visible(page.locator('main [role="alert"]'));
  equal(fixture.state.requests.filter(item => item.method === 'PATCH').length, before, 'Blank completed-account name rejected before PATCH');
  equal(fixture.state.accounts[701].status.is_complete, true, 'Completed server account remains complete');
  await page.locator('#live-account-name').fill('Corrected safe name'); await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click();
  await eventually(() => fixture.state.accounts[701].profile.display_name === 'Corrected safe name', 'User can repair local validation error and save');
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.locator('#live-account-name'));
  equal(await page.locator('#live-account-name').inputValue(), 'Corrected safe name', 'Profile remains recoverable in production');
}
async function completedRoles({ page, fixture }) {
  await profile(page, 701);
  await page.getByRole('checkbox', { name: 'Заказчик', exact: true }).uncheck(); await page.getByRole('checkbox', { name: 'Исполнитель', exact: true }).uncheck();
  const before = fixture.state.requests.filter(item => item.method === 'PATCH').length;
  await page.getByRole('button', { name: 'Сохранить данные профиля', exact: true }).click(); await visible(page.locator('main [role="alert"]'));
  equal(fixture.state.requests.filter(item => item.method === 'PATCH').length, before, 'Zero completed-account roles rejected before PATCH');
  equal(fixture.state.accounts[701].status.is_complete, true, 'Zero-role invalidation never persists');
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.locator('#live-account-name'));
  equal(await page.getByRole('checkbox', { name: 'Заказчик', exact: true }).isChecked(), true, 'Server roles restored after invalid local form');
}
async function purchaseUnknown(page, fixture, record, committed = true) {
  await page.goto(`${base}/service/811`, { waitUntil: 'domcontentloaded' });
  const extra = page.getByRole('checkbox', { name: /Corrections extra/ }); await visible(extra); await extra.check();
  await page.getByRole('button', { name: 'Получить расчёт', exact: true }).click();
  const consent = page.getByRole('checkbox', { name: /Я просмотрел состав/ }); await visible(consent); await consent.check();
  ensure((await page.locator('main').innerText()).replace(/\s/g, '').includes('1260,00'), 'Initial server quote displays 1000 + 200 + 5% = 1260.00');
  fixture.state.failures[committed ? 'purchase' : 'purchaseBeforeCommit'] = true;
  await page.getByRole('button', { name: 'Создать заказ', exact: true }).click();
  if (committed) await eventually(() => fixture.state.orders.length === 2, 'Synthetic server saved purchase before losing response');
  await visible(page.getByText(/Результат запроса неизвестен/)); await capture(page, record, 'unknown-before-reload');
  equal(fixture.state.orders.length, committed ? 2 : 1, 'Explicitly model unknown response after commit or before commit');
  record.observations.push({ unknownResponseAfterCommit: committed });
  return cloneLastPurchase(fixture);
}
function cloneLastPurchase(fixture) { return structuredClone(fixture.state.requests.findLast(item => item.path === '/api/v2/orders/' && item.method === 'POST').body); }
async function extrasReload({ page, fixture, record }, { quoteUnavailable = false, committed = true } = {}) {
  const original = await purchaseUnknown(page, fixture, record, committed);
  if (committed) fixture.service.revision++;
  fixture.state.failures.quoteRead = quoteUnavailable;
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.getByRole('heading', { level: 1, name: fixture.service.title, exact: true }));
  await eventually(() => fixture.state.requests.some(item => item.path.includes(`/quotes/${original.quote_id}/`) || item.path === '/api/v2/orders/852/'), 'Reload finds pending intent via its own order or original quote independently of empty selection');
  if (quoteUnavailable && !committed) {
    await visible(page.getByText(/Новое оформление заблокировано до проверки предыдущего намерения/, { exact: false }));
    const calculate = page.getByRole('button', { name: /Получить расчёт|Обновить расчёт/, exact: true });
    ensure(await calculate.isDisabled(), 'Unavailable pending quote must keep new purchase locked');
    equal(fixture.state.orders.length, 1, 'Unavailable quote did not authorize a new base order');
    equal(fixture.state.requests.filter(item => item.path === '/api/v2/quotes/' && item.method === 'POST').length, 1, 'No replacement quote generated behind recovery lock');
    equal(fixture.state.requests.filter(item => item.path === '/api/v2/orders/' && item.method === 'POST').length, 1, 'Unknown purchase is not automatically replayed');
    ensure(fixture.state.requests.some(item => item.path.includes(`/quotes/${original.quote_id}/`) && item.status === 404), 'Actual failed original-quote GET was exercised');
    record.observations.push({ quoteUnavailableAfterReload: true, noCanonicalOrder: true, newIntentBlocked: true });
    await capture(page, record, 'quote-unavailable-locked');
    fixture.state.failures.quoteRead = false;
    await page.getByRole('button', { name: 'Повторить чтение сохранённого расчёта', exact: true }).click();
    await visible(page.getByRole('checkbox', { name: /Я просмотрел состав/ }));
  } else if (quoteUnavailable) {
    record.observations.push({ configuredQuote404ResolvedByCanonicalOrder: true });
  }
  await eventually(async () => (await page.getByRole('checkbox', { name: /Corrections extra/ }).isChecked()) || (await page.getByRole('link', { name: 'Открыть заказ', exact: true }).count()) > 0, 'Extra selection restored from server quote or existing order reconciled');
  const openedOrder = page.getByRole('link', { name: 'Открыть заказ', exact: true });
  if (!(await openedOrder.count())) {
    const consent = page.getByRole('checkbox', { name: /Я просмотрел состав/ }); await visible(consent);
    equal(await consent.isChecked(), false, 'Reload never retains consent automatically');
    await consent.check(); await page.getByRole('button', { name: /Создать заказ|Повторить создание с прежним ключом/, exact: true }).click(); await visible(openedOrder);
  } else record.observations.push({ pendingResolvedByCanonicalOrderRead: true });
  equal(fixture.state.orders.length, 2, 'Exactly one new order across lost response and reload with extras');
  const writes = fixture.state.requests.filter(item => item.path === '/api/v2/orders/' && item.method === 'POST');
  ensure(writes.every(item => JSON.stringify(item.body) === JSON.stringify(original)), 'Every explicit purchase retry retains original quote_id/request_key');
  equal(await openedOrder.getAttribute('href'), '/orders/852', 'Reconciled order is the original saved order');
}
async function orderReceipt({ page, fixture }) {
  await page.goto(`${base}/orders/851`, { waitUntil: 'domcontentloaded' }); await visible(page.getByRole('button', { name: 'Принять заказ', exact: true }));
  fixture.state.failures.accept = true;
  await page.getByRole('button', { name: 'Принять заказ', exact: true }).click(); await page.getByRole('button', { name: 'Подтвердить действие', exact: true }).click();
  await eventually(() => fixture.state.orders[0].status === 'awaiting_payment', 'Accept stored before response loss');
  await visible(page.getByRole('button', { name: 'Повторить с прежним ключом', exact: true }));
  fixture.externalCancel(851);
  await page.getByRole('button', { name: 'Повторить с прежним ключом', exact: true }).click();
  await eventually(() => fixture.state.requests.filter(item => item.path.endsWith('/851/accept/')).length === 2, 'Explicit action retry occurred');
  const writes = fixture.state.requests.filter(item => item.path.endsWith('/851/accept/'));
  equal(writes[0].body, writes[1].body, 'Action retry uses unchanged key/revision');
  await eventually(() => fixture.state.requests.some(item => item.sequence > writes[1].sequence && item.path === '/api/v2/orders/851/' && item.method === 'GET'), 'Original receipt response followed by current-resource GET');
  await visible(page.getByText('Отменён заказчиком', { exact: true }));
  ensure(!(await page.getByRole('button', { name: 'Принять заказ', exact: true }).count()), 'Old receipt cannot reopen current actions');
}
async function messageReceipt({ page, fixture }) {
  await page.goto(`${base}/chats/${fixture.conversationId}`, { waitUntil: 'domcontentloaded' }); await visible(page.getByRole('textbox', { name: 'Сообщение', exact: true }));
  const text = 'Оплатим напрямую на карту — synthetic security regression';
  await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(text); fixture.state.failures.message = true;
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await eventually(() => fixture.state.messages.length === 1, 'Held message saved before lost response');
  await visible(page.getByRole('button', { name: 'Повторить отправку с прежним ключом', exact: true })); fixture.releaseMessage();
  await page.getByRole('button', { name: 'Повторить отправку с прежним ключом', exact: true }).click();
  const path = `/api/v1/conversations/${fixture.conversationId}/messages/`;
  await eventually(() => fixture.state.requests.filter(item => item.path === path && item.method === 'POST').length === 2, 'Explicit message retry occurred');
  const writes = fixture.state.requests.filter(item => item.path === path && item.method === 'POST');
  equal(writes[0].body, writes[1].body, 'Message retry retains exact client_message_id/text');
  await eventually(() => fixture.state.requests.some(item => item.path === path && item.method === 'GET' && item.sequence > writes[1].sequence), 'Message receipt reconciled by canonical cursor GET');
  const content = page.getByText(text, { exact: true }); await visible(content);
  await eventually(async () => (await content.locator('..').innerText()).includes('Сохранено'), 'Released current sequence replaces old held receipt');
  equal(fixture.state.messages.length, 1, 'One canonical message'); equal(await content.count(), 1, 'Released message not duplicated in DOM');
  ensure(!(await content.locator('..').innerText()).includes('Удержано'), 'Stale receipt does not restore held state');
}
(async () => {
  try {
    fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ headless: true, executablePath: process.env.STUDLY_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    await scenario('L4-shared-tabs', 702, sharedTabIdentity);
    await scenario('L4-switch-during-csrf', 702, csrfIdentity);
    await scenario('L2-own-portfolio', 701, ownPortfolio); await scenario('L2-external-conflict', 701, externalConflict);
    await scenario('L3-name', 701, completedName); await scenario('L3-roles', 701, completedRoles);
    await scenario('L1-extras-reload', 701, args => extrasReload(args));
    await scenario('L1-unavailable-quote', 701, args => extrasReload(args, { quoteUnavailable: true }));
    await scenario('L1-no-order-quote-unavailable', 701, args => extrasReload(args, { quoteUnavailable: true, committed: false }));
    await scenario('C1-order-receipt', 702, orderReceipt); await scenario('C1-message-release', 701, messageReceipt);
    result.pass = result.cases.every(item => item.pass) && result.pageErrors.length === 0;
    result.finished = stamp(); save(); if (!result.pass) process.exitCode = 1;
    console.log(JSON.stringify({ pass: result.pass, cases: result.cases.length, assertions: result.assertions, djangoTested: false }));
  } catch (error) { result.pass = false; result.error = String(error.stack ?? error); result.finished = stamp(); save(); console.error(result.error); process.exitCode = 1; }
  finally { await browser?.close(); }
})();
