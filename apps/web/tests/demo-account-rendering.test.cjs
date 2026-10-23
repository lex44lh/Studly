/* eslint-disable @typescript-eslint/no-require-imports -- Render the real TSX views with an isolated workspace context, without browser or storage writes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const base = path.resolve(__dirname, '../src/features/demo-workspace');
function render(state, extra = {}, publicId) {
  const context = {
    state, ready: state !== null, busy: false, error: '', notice: '',
    run: async () => null, saveExample: async () => {}, saveAvatar: async () => {},
    getAsset: async () => undefined, retry() {}, sandboxEnabled: false, ...extra,
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixtureModule = { exports: {} };
    cache.set(file, fixtureModule);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = name => {
      if (name === './Provider') return { useDemoWorkspace: () => context };
      // Asset retrieval is tested separately; these checks concern its real view placement and entity metadata.
      if (name === './ui') return { AssetPreview: ({ example }) => React.createElement('span', { 'data-asset': example.id }, example.title) };
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name === 'next/image') return { __esModule: true, default: ({ unoptimized, ...props }) => { void unoptimized; return React.createElement('img', props); } };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const stem = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const dependency = [stem, `${stem}.ts`, `${stem}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!dependency) throw new Error(`Cannot resolve fixture dependency ${name}`);
        return load(dependency);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', compiled)(localRequire, fixtureModule, fixtureModule.exports);
    return fixtureModule.exports;
  }
  const views = load(path.join(base, 'AccountWorkspace.tsx'));
  const View = publicId === undefined ? views.default : views.PublicDemoPerformer;
  const before = state && JSON.stringify(state);
  const html = renderToStaticMarkup(React.createElement(View, publicId === undefined ? {} : { performerId: publicId }));
  if (state) assert.equal(JSON.stringify(state), before, 'rendering must not mutate the canonical workspace');
  return html;
}

const empty = () => ({
  schemaVersion: 2, revision: 0,
  draft: { roles: [], profile: { displayName: '', avatarFile: null, avatarUrl: '', university: '', city: '', about: '' }, performer: { specializations: [], description: '', studyYear: '', portfolio: '' } },
  registrationAvatarId: null, registrationStep: 'roles', account: null,
  services: [], orders: [], conversations: [], messages: [], reviews: [], adminEvents: [], applied: {},
});
const performer = () => ({
  id: 'demo-self', name: 'Тестовый студент', university: 'Мой университет', city: '', about: '',
  description: 'Помогу с проектом', roles: ['performer', 'customer'], activeRole: 'performer',
  createdAt: 0, moderation: 'draft', moderationReason: '', examples: [],
});
const example = { id: 'example-1', title: 'Пример работы', kind: 'link', url: 'https://example.org' };

test('account: loading uses a status instead of exposing a false empty account', () => {
  const html = render(null);
  assert.match(html, /Открываем личный кабинет/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /Создайте локальный Demo-профиль/);
});

test('account: a failed initial read offers retry instead of permanent loading', () => {
  const html = render(null, { error: 'Хранилище недоступно' });
  assert.match(html, /Хранилище недоступно/);
  assert.match(html, /Повторить загрузку/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Открываем личный кабинет/);
});

test('account: an incomplete registration resumes its existing step', () => {
  const state = empty();
  state.draft.roles = ['performer'];
  state.registrationStep = 'profile';
  const html = render(state);
  assert.match(html, /href="\/register\/profile"/);
  assert.match(html, /Продолжить знакомство/);
  assert.match(html, /Настоящий аккаунт и серверная сессия не создаются/);
});

test('account: the customer dashboard links existing routes without inventing performer data', () => {
  const html = render({ ...empty(), account: { ...performer(), roles: ['customer'], activeRole: 'customer' } });
  for (const route of ['/search', '/favorites', '/orders', '/chats']) assert.ok(html.includes(`href="${route}"`));
  assert.match(html, /Мой университет/);
  assert.doesNotMatch(html, /Примеры работ|Подтвердить модерацию/);
});

test('account: switching roles keeps both dashboard subtrees mounted', () => {
  const html = render({ ...empty(), account: { ...performer(), activeRole: 'customer' } });
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /<div hidden="">/);
  assert.match(html, /example-title/);
  assert.match(html, /account-name/);
});

test('account: an incomplete performer cannot submit or create a service', () => {
  const html = render({ ...empty(), account: performer() });
  assert.match(html, /<button[^>]*disabled=""[^>]*>Отправить профиль на модерацию/);
  assert.doesNotMatch(html, /href="\/create-service"/);
});

test('account: pending and approved profile snapshots are read only', () => {
  for (const moderation of ['pending', 'approved']) {
    const html = render({ ...empty(), account: { ...performer(), moderation, examples: [example] } });
    assert.match(html, /<fieldset disabled=""/);
    assert.doesNotMatch(html, /example-title|Удалить пример/);
    assert.match(html, /data-asset="example-1"/);
    if (moderation === 'approved') assert.match(html, /href="\/create-service"/);
    else assert.doesNotMatch(html, /href="\/create-service"/);
  }
});

test('account: the administrative link requires the explicit sandbox capability', () => {
  const state = { ...empty(), account: performer() };
  assert.doesNotMatch(render(state), /href="\/admin"/);
  assert.match(render(state, { sandboxEnabled: true }), /href="\/admin"/);
});

test('account: a rejected decision shows its actual reason and allows resubmission', () => {
  const html = render({ ...empty(), account: { ...performer(), moderation: 'rejected', moderationReason: 'Нужен читаемый пример', examples: [example] } });
  assert.match(html, /Нужен читаемый пример/);
  assert.match(html, /Отправить профиль на модерацию/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Отправить профиль на модерацию/);
});

test('public self profile: only approved services and reviews backed by completed orders appear', () => {
  const services = [
    { id: 1_000_000_000, performerId: 'demo-self', title: 'APPROVED DEMO', description: 'Описание', price: 100_000, days: 3, status: 'approved' },
    { id: 1_000_000_001, performerId: 'demo-self', title: 'HIDDEN DRAFT', status: 'draft' },
  ];
  const orders = [{ id: 'done', performerId: 'demo-self', status: 'COMPLETED', arbitration: null }];
  const reviews = [
    { id: 'review-1', orderId: 'done', performerId: 'demo-self', author: 'Заказчик', rating: 4, text: 'Спасибо', at: 0 },
    { id: 'review-2', orderId: 'missing', performerId: 'demo-self', author: 'Orphan review', rating: 5, text: 'Не показывать', at: 0 },
  ];
  const html = render({ ...empty(), account: performer(), services, orders, reviews }, {}, 'demo-self');
  assert.match(html, /APPROVED DEMO/);
  assert.doesNotMatch(html, /HIDDEN DRAFT|Orphan review/);
  assert.match(html, /<strong>4<\/strong><span>Средняя оценка/);
  assert.match(html, /Спасибо/);
});

test('public self profile: read failures offer retry and foreign IDs do not expose the account', () => {
  assert.match(render(null, { error: 'Ошибка локального чтения' }, 'demo-self'), /Повторить загрузку/);
  const html = render({ ...empty(), account: performer() }, {}, 'someone-else');
  assert.match(html, /Demo-профиль не найден/);
  assert.doesNotMatch(html, /Тестовый студент/);
});
