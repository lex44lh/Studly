/* eslint-disable @typescript-eslint/no-require-imports -- Real browser + synthetic contract transport; NOT Django E2E. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { backend, provenance, createFixture, names } = require('./contract-fixtures.cjs');
const root = path.resolve(__dirname, '../../../../../../..');
const base = process.env.STUDLY_BROWSER_BASE ?? 'http://127.0.0.1:3002';
const out = process.env.STUDLY_BROWSER_OUT ?? __dirname;
const selected = process.env.STUDLY_L2_CASES?.split(',');
const stamp = () => ({ utc: new Date().toISOString(), moscow: new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' }) });
const sourceFiles = ['apps/web/src/features/live-account/LiveAccountWorkspace.tsx', 'apps/web/src/features/live-account/useAccountWriter.ts',
  'apps/web/src/features/live-account/revisions.ts', 'apps/web/src/lib/api/registration.ts'];
const result = { kind: 'Residual L2 synthetic browser regression against published Django contract; NOT Django E2E', backend,
  fixtureSources: provenance, candidate: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  candidateWorkingTree: true, sourceHashes: sourceFiles.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
  sourceManifestSHA256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'source-manifest.json'))).digest('hex'),
  djangoTested: false, realTelegramTested: false, actualCsrfMiddlewareTested: false,
  started: stamp(), base, assertions: 0, cases: [], pageErrors: [] };
const ensure = (condition, message) => { result.assertions++; assert.ok(condition, message); };
const equal = (actual, expected, message) => { result.assertions++; assert.deepEqual(actual, expected, message); };
const cases = [
  ['A-profile-then-new-work', sequential], ['B-new-draft-then-profile-save', draftBeforeProfile],
  ['existing-edit-then-profile-save', existingBeforeProfile], ['portfolio-sibling-drafts', portfolioSiblings],
  ['external-profile-CAS', externalProfile], ['external-portfolio-CAS', externalPortfolio],
  ['external-after-own-confirmation', externalAfterOwn], ['profile-400-preserves-drafts', profile400],
  ['portfolio-400-preserves-draft', portfolio400], ['portfolio-503-same-key-retry', portfolio503],
  ['file-draft-survives-profile-save', fileDraft], ['dirty-work-prevents-destructive-switch', dirtySwitch],
  ['reload-canonical-state', reloadCanonical], ['account-switch-drops-old-intent', accountSwitch],
];
if (process.argv.includes('--describe')) { console.log(JSON.stringify({ ...result, cases: cases.map(([name]) => name), browserStarted: false }, null, 2)); process.exit(0); }
const { chromium } = require(process.env.STUDLY_PLAYWRIGHT_PATH ?? '/Users/alekspih/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let browser;
function save() { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'browser-l2-results.json'), JSON.stringify(result, null, 2) + '\n'); }
async function eventually(predicate, message, milliseconds = 10000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  ensure(false, message);
}
async function visible(locator) { await locator.first().waitFor({ state: 'visible' }); }
const addButton = page => page.getByRole('button', { name: 'Добавить пример', exact: true });
const profileButton = page => page.getByRole('button', { name: 'Сохранить данные профиля', exact: true });
const writes = fixture => fixture.state.requests.filter(row => ['POST', 'PATCH', 'DELETE'].includes(row.method) && row.path.includes('/portfolio/'));
async function profile(page, actor = 701) {
  await page.goto(`${base}/profile?role=performer`, { waitUntil: 'domcontentloaded' });
  await visible(page.locator('#live-account-name'));
  equal(await page.locator('#live-account-name').inputValue(), names[actor], 'Account loaded through actual shared synthetic browser cookie');
  await eventually(async () => !(await page.locator('#live-example-title').isDisabled()), 'Portfolio form is ready');
}
async function newWork(page, title, url = `https://example.com/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`) {
  await page.locator('#live-example-title').fill(title); await page.locator('#live-example-url').fill(url);
  return { title, url };
}
async function checkDraft(page, draft) {
  equal(await page.locator('#live-example-title').inputValue(), draft.title, 'Unsubmitted portfolio title retained');
  equal(await page.locator('#live-example-url').inputValue(), draft.url, 'Unsubmitted portfolio URL retained');
}
async function saveProfile(page, fixture, name) {
  await page.locator('#live-account-name').fill(name); await profileButton(page).click();
  await eventually(() => fixture.state.accounts[701].profile.display_name === name, 'Own profile mutation committed');
  await eventually(async () => !(await page.locator('#live-example-title').isDisabled()), 'Related forms unlock after own profile confirmation');
  equal(await page.locator('#live-account-name').inputValue(), name, 'Confirmed profile shown');
}
async function submitNew(page, fixture, draft, revision) {
  const count = fixture.state.portfolio[701].length;
  await addButton(page).click();
  await eventually(() => fixture.state.portfolio[701].length === count + 1, 'Previously entered new portfolio work committed');
  await eventually(async () => !(await page.locator('#live-example-title').isDisabled()), 'Related writer settled');
  equal(writes(fixture).at(-1).body.revision, revision, 'Portfolio CAS uses proven own shared revision');
  equal(fixture.state.portfolio[701].at(-1).title, draft.title, 'Intended title persisted');
  equal(fixture.state.portfolio[701].at(-1).url, draft.url, 'Intended URL persisted');
}
async function no409(fixture) { ensure(!fixture.state.requests.some(row => row.status === 409), 'Own sequential changes produce no false CAS conflict'); }
async function sequential({ page, fixture }) {
  await profile(page); await saveProfile(page, fixture, 'L2 sequence A'); equal(fixture.state.revisions[701], 5, 'Own profile increments 4 to 5');
  const draft = await newWork(page, 'L2 sequence A work'); await submitNew(page, fixture, draft, 5); await no409(fixture);
}
async function draftBeforeProfile({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 sequence B work', 'https://example.com/l2-sequence-b-original');
  await saveProfile(page, fixture, 'L2 sequence B'); await checkDraft(page, draft);
  await submitNew(page, fixture, draft, 5); await no409(fixture);
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.getByRole('heading', { name: draft.title, exact: true }));
  equal(await page.locator('#live-account-name').inputValue(), 'L2 sequence B', 'Sequence B profile survives reload');
}
async function openExisting(page, fixture, title) {
  const id = fixture.state.portfolio[701][0].id;
  await page.getByRole('button', { name: 'Изменить работу', exact: true }).first().click();
  await page.locator(`#example-title-${id}`).fill(title);
  await page.locator(`#example-url-${id}`).fill('https://example.com/l2-edited-original-url');
  return id;
}
async function existingBeforeProfile({ page, fixture }) {
  await profile(page); const title = 'L2 retained existing edit', id = await openExisting(page, fixture, title);
  await saveProfile(page, fixture, 'L2 existing editor owner');
  equal(await page.locator(`#example-title-${id}`).inputValue(), title, 'Existing editor remains mounted with dirty title across own profile refresh');
  equal(await page.locator(`#example-url-${id}`).inputValue(), 'https://example.com/l2-edited-original-url', 'Existing editor retains dirty URL across own profile refresh');
  await page.getByRole('button', { name: 'Сохранить работу', exact: true }).click();
  await eventually(() => fixture.state.portfolio[701][0].title === title, 'Existing edit commits after own profile save');
  equal(writes(fixture).at(-1).body.revision, 5, 'Existing edit advances only to proven own revision 5'); await no409(fixture);
}
async function portfolioSiblings({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 sibling new work'); await openExisting(page, fixture, 'L2 sibling existing edit');
  await page.getByRole('button', { name: 'Сохранить работу', exact: true }).click();
  await eventually(() => fixture.state.portfolio[701][0].title === 'L2 sibling existing edit', 'Own existing work mutation commits');
  await eventually(async () => !(await addButton(page).isDisabled()), 'New-work form unlocks after sibling mutation');
  await checkDraft(page, draft); await submitNew(page, fixture, draft, 5); await no409(fixture);
}
async function externalProfile({ page, context, fixture, record }) {
  await profile(page); await page.locator('#live-account-name').fill('Local stale profile draft');
  const external = await context.newPage(); await profile(external); await saveProfile(external, fixture, 'External canonical profile');
  record.observations.push({ externalUpdateThroughSecondRealBrowserTab: true, bothTabsShareActor: 701 });
  await profileButton(page).click(); await eventually(() => fixture.state.requests.some(row => row.path === '/api/v1/registration/' && row.method === 'PATCH' && row.status === 409), 'Actual stale profile PATCH rejected by CAS');
  equal(fixture.state.accounts[701].profile.display_name, 'External canonical profile', 'External profile change preserved');
  equal(await page.locator('#live-account-name').inputValue(), 'Local stale profile draft', 'Local stale profile input retained on 409');
  equal(fixture.state.requests.find(row => row.path === '/api/v1/registration/' && row.method === 'PATCH' && row.status === 409).body.performer_revision, 4, 'No arbitrary GET revision used by stale first tab');
}
async function externalPortfolio({ page, context, fixture, record }) {
  await profile(page); const draft = await newWork(page, 'L2 external conflict local');
  const external = await context.newPage(); await profile(external); await saveProfile(external, fixture, 'External portfolio revision');
  record.observations.push({ externalUpdateThroughSecondRealBrowserTab: true, bothTabsShareActor: 701 });
  await addButton(page).click(); await eventually(() => writes(fixture).some(row => row.status === 409), 'Actual stale portfolio POST rejected by shared CAS');
  equal(writes(fixture).at(-1).body.revision, 4, 'Stale external revision is not silently replaced');
  equal(fixture.state.portfolio[701].length, 1, 'No stale work created'); await checkDraft(page, draft);
}
async function externalAfterOwn({ page, fixture, record }) {
  await profile(page); const draft = await newWork(page, 'L2 external after own local'); fixture.controls.externalAfterProfile = true;
  await page.locator('#live-account-name').fill('Own confirmation before external'); await profileButton(page).click();
  await eventually(() => fixture.state.events.some(row => row.operation === 'external-profile-edit'), 'External change placed between own PATCH response and follow-up GET');
  await visible(page.locator('main [role="alert"]').first());
  await checkDraft(page, draft); equal(fixture.state.revisions[701], 6, 'External change has distinct unproven revision6');
  ensure(await addButton(page).isDisabled(), 'Unconfirmed own revision blocks related writes before an arbitrary external revision can be adopted');
  record.observations.push({ externalRevisionBlockedBeforeWrite: true, ownAckFollowedByExternalRevision: 6 });
  equal(fixture.state.portfolio[701].length, 1, 'No stale new work committed after external revision'); await checkDraft(page, draft);
}
async function profile400({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 validation both drafts'); await page.locator('#live-account-name').fill('L2 profile validation name');
  fixture.controls.failProfileBefore = 400; await profileButton(page).click();
  await eventually(() => fixture.state.requests.some(row => row.path === '/api/v1/registration/' && row.method === 'PATCH' && row.status === 400), 'Synthetic validation error exercised');
  await checkDraft(page, draft); equal(await page.locator('#live-account-name').inputValue(), 'L2 profile validation name', 'Profile400 preserves its own input');
  await profileButton(page).click(); await eventually(() => fixture.state.accounts[701].profile.display_name === 'L2 profile validation name', 'Corrected explicit profile resubmission succeeds');
  await eventually(async () => !(await addButton(page).isDisabled()), 'Portfolio unlocks after successful resubmission'); await checkDraft(page, draft);
  await submitNew(page, fixture, draft, 5);
}
async function portfolio400({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 portfolio validation draft'); fixture.controls.failPortfolioBefore = 400;
  await addButton(page).click(); await eventually(() => writes(fixture).some(row => row.status === 400), 'Portfolio400 exercised'); await checkDraft(page, draft);
  await submitNew(page, fixture, draft, 4); equal(fixture.state.portfolio[701].length, 2, 'Exactly one work after failed validation and explicit retry');
}
async function portfolio503({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 unknown original intent'); fixture.controls.failPortfolioAfter = 503;
  await addButton(page).click(); await eventually(() => writes(fixture).some(row => row.status === 503), 'Unknown503 after committed portfolio action exercised');
  await visible(page.getByRole('button', { name: 'Повторить исходную операцию с тем же ключом', exact: true }));
  ensure(await addButton(page).isDisabled(), 'Unknown result blocks new independent writes'); await checkDraft(page, draft);
  const original = structuredClone(writes(fixture).at(-1).body);
  await page.getByRole('button', { name: 'Повторить исходную операцию с тем же ключом', exact: true }).click();
  await eventually(() => writes(fixture).length === 2 && writes(fixture).at(-1).status === 200, 'Explicit retry replays original server receipt');
  equal(writes(fixture).at(-1).body, original, 'Retry retains original key, payload and revision');
  equal(fixture.state.portfolio[701].length, 2, 'Same-key retry creates no duplicate work');
}
async function fileDraft({ page, fixture }) {
  await profile(page); await page.getByRole('radio', { name: 'Файл', exact: true }).check();
  await page.locator('#live-example-title').fill('L2 retained file selection');
  // A real browser File with a tiny valid PNG payload; no upload middleware or
  // file normalization is claimed, only client retention and multipart wiring.
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7fUAAAAASUVORK5CYII=', 'base64');
  await page.locator('#live-example-file').setInputFiles({ name: 'synthetic-l2.png', mimeType: 'image/png', buffer: bytes });
  await saveProfile(page, fixture, 'L2 file draft owner');
  const selected = await page.locator('#live-example-file').evaluate(element => ({ name: element.files?.[0]?.name, size: element.files?.[0]?.size }));
  equal(selected, { name: 'synthetic-l2.png', size: bytes.length }, 'Actual File selection retained across confirmed own profile refresh');
  equal(await page.locator('#live-example-title').inputValue(), 'L2 retained file selection', 'File draft title retained');
  await addButton(page).click(); await eventually(() => fixture.state.portfolio[701].length === 2, 'Retained file uploaded explicitly');
  equal(writes(fixture).at(-1).body.revision, 5, 'Multipart revision promoted only by own profile proof');
  equal(writes(fixture).at(-1).upload.sha256, createHash('sha256').update(bytes).digest('hex'), 'Original browser File bytes survive');
}
async function dirtySwitch({ page, fixture }) {
  await profile(page); const draft = await newWork(page, 'L2 destructive role guard draft');
  const performer = page.getByRole('checkbox', { name: 'Исполнитель', exact: true });
  const before = fixture.state.requests.filter(row => row.path === '/api/v1/registration/' && row.method === 'PATCH').length;
  if (!(await performer.isDisabled())) {
    await performer.uncheck(); await profileButton(page).click(); await visible(page.locator('#live-account-roles-error'));
    equal(fixture.state.requests.filter(row => row.path === '/api/v1/registration/' && row.method === 'PATCH').length, before, 'Removing performer role cannot send PATCH while portfolio draft would be lost');
    await performer.check();
  }
  const mode = page.getByRole('button', { name: 'Заказчик', exact: true });
  ensure(await mode.isDisabled(), 'Cabinet mode switch preserves dirty portfolio');
  ensure(await page.locator('#live-account-avatar').isDisabled(), 'Unversioned avatar upload cannot bypass related draft coordination');
  await checkDraft(page, draft); equal(fixture.state.accounts[701].roles, ['customer', 'performer'], 'Role guard does not mutate server roles');
}
async function reloadCanonical({ page, fixture }) {
  await profile(page); await saveProfile(page, fixture, 'L2 canonical reload'); const draft = await newWork(page, 'L2 persisted reload work'); await submitNew(page, fixture, draft, 5);
  await page.reload({ waitUntil: 'domcontentloaded' }); await visible(page.locator('#live-account-name')); await visible(page.getByRole('heading', { name: draft.title, exact: true }));
  equal(await page.locator('#live-account-name').inputValue(), 'L2 canonical reload', 'Server-confirmed profile restored on reload');
  const secondDraft = await newWork(page, 'L2 after reload work'); await submitNew(page, fixture, secondDraft, 6); await no409(fixture);
}
async function accountSwitch({ page, context, fixture, record }) {
  await profile(page); const draft = await newWork(page, 'L2 Alpha private pending work'); const second = await context.newPage();
  await second.goto(`${base}/profile?role=performer`, { waitUntil: 'domcontentloaded' });
  await second.evaluate(() => { document.cookie = 'studly_qa_actor=799; Path=/; SameSite=Lax'; });
  await second.reload({ waitUntil: 'domcontentloaded' }); await visible(second.locator('#live-account-name'));
  equal(await second.locator('#live-account-name').inputValue(), names[799], 'Second real tab confirms Gamma with shared revision4');
  const attempted = await page.evaluate(title => { const field = document.querySelector('#live-example-title'); if (!field || field.value !== title) return false; field.closest('form').requestSubmit(); return true; }, draft.title);
  record.observations.push({ twoRealTabs: context.pages().length, oldIntentSubmittedBeforeFocus: attempted, bothActorsAtRevision4: true });
  await page.bringToFront(); await eventually(async () => (await page.locator('#live-example-title').inputValue().catch(() => '')) !== draft.title, 'Old account portfolio intention invalidated');
  equal(fixture.state.portfolio[701].length, 1, 'Old account draft was not written'); equal(fixture.state.portfolio[799].length, 1, 'Old draft never crosses shared session into Gamma');
  ensure(!writes(fixture).some(row => row.body?.title === draft.title), 'Identity fencing stops old draft before mutation');
}
async function scenario(name, work) {
  if (selected && !selected.includes(name)) return;
  const fixture = createFixture(), record = { name, started: stamp(), pass: false, screenshots: [], observations: [] }; result.cases.push(record);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', serviceWorkers: 'block' });
  await context.addCookies([{ name: 'studly_qa_actor', value: '701', url: base, sameSite: 'Lax' }]);
  context.on('page', item => { item.setDefaultTimeout(10000); item.on('pageerror', error => result.pageErrors.push({ name, url: item.url(), message: error.message })); });
  await context.route('**/*', async route => { try { await fixture.intercept(route, base); } catch (error) { fixture.state.errors.push(String(error.stack ?? error)); await route.abort('blockedbyclient').catch(() => {}); } });
  const page = await context.newPage();
  try { await work({ page, context, fixture, record }); equal(fixture.state.errors, [], `${name}: no hidden fixture/schema error`); record.pass = true; }
  catch (error) { record.error = String(error.stack ?? error); }
  finally {
    const screenshot = `browser-l2-${name}-${record.pass ? 'pass' : 'failure'}.png`;
    await page.screenshot({ path: path.join(out, screenshot), fullPage: true }).then(() => record.screenshots.push(screenshot)).catch(() => {});
    record.finished = stamp(); record.fixture = { accounts: fixture.state.accounts, revisions: fixture.state.revisions,
      portfolio: fixture.state.portfolio, events: fixture.state.events, requests: fixture.state.requests, errors: fixture.state.errors };
    save(); await context.close(); console.log(`${record.pass ? 'PASS' : 'FAIL'} ${name}${record.error ? `: ${record.error.split('\n')[0]}` : ''}`);
  }
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-background-networking'] });
  try { for (const [name, work] of cases) await scenario(name, work); }
  finally { await browser.close(); result.finished = stamp(); result.pass = result.cases.every(item => item.pass) && result.pageErrors.length === 0; save(); }
  console.log(JSON.stringify({ pass: result.pass, cases: result.cases.length, assertions: result.assertions, requests: result.cases.reduce((sum, item) => sum + item.fixture.requests.length, 0), pageErrors: result.pageErrors.length }));
  if (!result.pass) process.exitCode = 1;
})().catch(error => { result.fatal = String(error.stack ?? error); result.finished = stamp(); save(); console.error(result.fatal); process.exitCode = 1; });
