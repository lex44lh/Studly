/* eslint-disable @typescript-eslint/no-require-imports -- Execute the actual pure Demo domain/catalog adapters without a server or browser storage. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const base = path.resolve(__dirname, '../src', relative);
  const file = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (cache.has(file)) return cache.get(file).exports;
  const fixture = { exports: {} }; cache.set(file, fixture);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file }).outputText;
  const localRequire = name => name === './Provider' ? { useOptionalDemoWorkspace: () => null } : name.startsWith('@/') ? load(name.slice(2)) : name.startsWith('.') ? load(path.relative(path.join(__dirname, '../src'), path.resolve(path.dirname(file), name))) : require(name);
  new Function('require', 'module', 'exports', compiled)(localRequire, fixture, fixture.exports);
  return fixture.exports;
}
const { applyCommand, emptyWorkspace, sellable } = load('features/demo-workspace/domain');
const { SELF, MODERATOR, NEXT_SERVICE_ID, ratingFor } = load('features/demo-workspace/model');
const { demoCatalog, SELF_PROFILE_ID } = load('features/demo-workspace/catalog');
const { filterSearchServices } = load('lib/catalog/search');
const fixtures = load('data/services').default;

function scenario() {
  let state = emptyWorkspace(), sequence = 0;
  const customer = { id: SELF, role: 'customer' }, performer = { id: SELF, role: 'performer' }, moderator = { id: MODERATOR, role: 'moderator' };
  function command(value, actor = customer) {
    const result = applyCommand(state, value, actor, `catalog-test-${++sequence}`, sequence, true);
    state = result.state; return result.entityId;
  }
  const draft = structuredClone(state.draft);
  draft.roles = ['customer', 'performer']; draft.profile.displayName = 'Demo owner'; draft.performer.description = 'Test description';
  command({ type: 'registration', draft }); command({ type: 'register' });
  command({ type: 'example.add', example: { id: 'example', kind: 'link', title: 'Work', url: 'https://example.com/work' } });
  command({ type: 'profile.submit' }, performer); command({ type: 'profile.decide', decision: 'approved', reason: '' }, moderator);
  function draftService(title = 'Unique demo service') {
    return Number(command({ type: 'service.save', input: { title, category: 'Программирование', description: 'Frozen description', included: ['Analysis'], price: 75050, days: 2, extras: [], exampleIds: ['example'] } }, performer));
  }
  function publish(id) { command({ type: 'service.submit', id }, performer); command({ type: 'service.decide', id, decision: 'approved', reason: '' }, moderator); }
  function completedReview(serviceId, rating, actor = customer) {
    const source = sellable(state, serviceId);
    const id = command({ type: 'purchase', simulated: true, purchase: { ...source, extras: [] } }, actor);
    const worker = { id: source.performerId, role: 'performer' };
    command({ type: 'order.accept', id, revision: 0 }, worker);
    command({ type: 'order.result', id, revision: 1, text: 'Result' }, worker);
    command({ type: 'order.complete', id, revision: 2 }, actor);
    command({ type: 'review', orderId: id, rating, text: '' }, actor);
    return id;
  }
  return { get state() { return state; }, command, draftService, publish, completedReview, customer, performer, moderator };
}

test('catalog keeps fixture IDs and never inherits their historical synthetic ratings', () => {
  const original = JSON.stringify(fixtures), catalog = demoCatalog(null);
  assert.deepEqual(catalog.map(service => service.id), fixtures.map(service => service.id));
  assert.ok(catalog.every(service => service.rating === ''));
  assert.equal(JSON.stringify(fixtures), original, 'catalog projection must not mutate the approved fixture source');
});

test('new numeric service ID becomes searchable only after both profile and service approvals', () => {
  const s = scenario(), id = s.draftService();
  assert.ok(Number.isSafeInteger(id) && id >= NEXT_SERVICE_ID);
  assert.ok(!fixtures.some(service => service.id === id));
  assert.ok(!demoCatalog(s.state).some(service => service.id === id), 'draft cannot appear published');
  s.command({ type: 'service.submit', id }, s.performer);
  assert.ok(!demoCatalog(s.state).some(service => service.id === id), 'pending service cannot appear published');
  s.command({ type: 'service.decide', id, decision: 'approved', reason: '' }, s.moderator);
  const catalog = demoCatalog(s.state), service = catalog.find(service => service.id === id);
  assert.ok(service); assert.equal(service.profileId, SELF_PROFILE_ID); assert.equal(service.priceNumber, 750.5); assert.equal(service.durationDays, 2); assert.equal(service.seller, 'Demo owner');
  const defaults = { query: 'Unique demo service', category: '', minPrice: '', maxPrice: '', duration: 'any', rating47: false, sort: 'relevance' };
  assert.deepEqual(filterSearchServices(catalog, defaults, true).map(service => service.id), [id]);
  assert.deepEqual(filterSearchServices(catalog, { ...defaults, rating47: true }, true), [], 'unreviewed service cannot pass a 4.7 rating filter');
  const waitingProfile = structuredClone(s.state); waitingProfile.account.moderation = 'pending';
  assert.ok(!demoCatalog(waitingProfile).some(service => service.id === id));
});

test('rejected/changes revisions remain out of catalog and editing preserves the existing ID', () => {
  for (const decision of ['rejected', 'changes']) {
    const s = scenario(), id = s.draftService(); s.command({ type: 'service.submit', id }, s.performer);
    s.command({ type: 'service.decide', id, decision, reason: 'Please revise' }, s.moderator);
    assert.ok(!demoCatalog(s.state).some(service => service.id === id));
    const previous = s.state.services.find(service => service.id === id);
    const input = Object.fromEntries(['title', 'category', 'description', 'included', 'price', 'days', 'extras', 'exampleIds'].map(key => [key, previous[key]]));
    const saved = s.command({ type: 'service.save', id, revision: previous.revision, input: { ...input, title: 'Revised service' } }, s.performer);
    assert.equal(Number(saved), id); assert.equal(s.state.services.length, 1); assert.equal(s.state.services[0].status, 'draft');
    s.publish(id); assert.equal(demoCatalog(s.state).filter(service => service.id === id).length, 1);
  }
});

test('ratings come exclusively from linked completed STUDLY Demo orders and are performer-scoped', () => {
  const s = scenario(), fixture = fixtures[0];
  assert.equal(ratingFor(s.state, `fixture:${fixture.profileId}`).average, null);
  const orderId = s.completedReview(fixture.id, 5);
  let stats = ratingFor(s.state, `fixture:${fixture.profileId}`);
  assert.equal(stats.count, 1); assert.equal(stats.average, 5); assert.equal(stats.completed, 1);
  assert.match(demoCatalog(s.state).find(service => service.id === fixture.id).rating, /^5\.0 \(1 /);
  const otherFixture = fixtures.find(service => service.profileId !== fixture.profileId);
  assert.equal(demoCatalog(s.state).find(service => service.id === otherFixture.id).rating, '');
  const withoutCompletion = structuredClone(s.state); withoutCompletion.orders.find(order => order.id === orderId).status = 'REVIEW';
  assert.equal(ratingFor(withoutCompletion, `fixture:${fixture.profileId}`).count, 0);
  const withArbitration = structuredClone(s.state); withArbitration.orders.find(order => order.id === orderId).arbitration = { stage: 'open', reason: 'Test-only hypothetical arbitration record' };
  assert.equal(ratingFor(withArbitration, `fixture:${fixture.profileId}`).count, 0);
  stats = ratingFor(s.state, SELF); assert.equal(stats.count, 0); assert.equal(stats.average, null);
});

test('own published services share the true performer rating rather than arbitrary fixture statistics', () => {
  const s = scenario(), first = s.draftService('First own service'), second = s.draftService('Second own service');
  s.publish(first); s.publish(second);
  const guest = { id: 'demo-guest-customer', role: 'customer' };
  s.completedReview(first, 3, guest); s.completedReview(second, 5, guest);
  const stats = ratingFor(s.state, SELF); assert.equal(stats.count, 2); assert.equal(stats.average, 4); assert.equal(stats.completed, 2);
  const own = demoCatalog(s.state).filter(service => [first, second].includes(service.id));
  assert.equal(own.length, 2); assert.ok(own.every(service => service.profileId === SELF_PROFILE_ID && /^4\.0 \(2 /.test(service.rating)));
});
