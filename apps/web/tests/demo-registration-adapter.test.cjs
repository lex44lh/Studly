/* eslint-disable @typescript-eslint/no-require-imports -- Execute the actual registration adapter's effects with isolated hooks; render its real form and shell. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const drain = () => new Promise(resolve => setImmediate(resolve));
function initialState() {
  return { revision: 0, registrationStep: 'profile', registrationAvatarId: null, account: null,
    draft: { roles: ['customer'], profile: { displayName: 'Первое имя', university: 'Университет', city: '', about: '', avatarFile: null, avatarUrl: '' }, performer: { specializations: [], description: '', studyYear: '', portfolio: '' } } };
}
function mount(state = initialState(), overrides = {}) {
  const slots = [], effects = [], timers = new Map(), routes = [], saves = [], commands = [];
  let cursor = 0, mounted = true, nextTimer = 1, value, tree;
  const workspace = {
    state, ready: true, busy: false, error: '', notice: '', sandboxEnabled: false,
    getAsset: async () => undefined, retry() {},
    async saveRegistration(draft, step, expectedRevision, avatarIntent = "preserve") {
      if (expectedRevision !== undefined && expectedRevision !== workspace.state.revision) throw new Error('Черновик изменился в другой вкладке. Загрузите актуальные данные.');
      saves.push({ draft: structuredClone(draft), step, avatarIntent });
      const clean = structuredClone(draft); clean.profile.avatarFile = null;
      if (clean.profile.avatarUrl.startsWith('blob:')) clean.profile.avatarUrl = '';
      workspace.state = { ...workspace.state, revision: workspace.state.revision + 1, draft: clean, ...(step ? { registrationStep: step } : {}), ...(avatarIntent === "remove" ? {registrationAvatarId:null} : {}) };
      return workspace.state.revision;
    },
    async run(command) { commands.push(command); return 'demo-self'; }, ...overrides,
  };
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => { if (mounted) slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }];
    },
    useReducer(reducer, argument, initialize) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initialize ? initialize(argument) : argument };
      return [slots[index].value, action => { if (mounted) slots[index].value = reducer(slots[index].value, action); }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !dependencies || dependencies.some((dependency, position) => !Object.is(previous.dependencies?.[position], dependency))) {
        slots[index] = { ...previous, dependencies: dependencies?.slice() };
        effects.push({ index, effect });
      }
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixtureModule = { exports: {} }; cache.set(file, fixtureModule);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      if (name === 'react') return file.endsWith('/RegistrationAdapter.tsx') ? hooks : React;
      if (name === './Provider') return { useDemoWorkspace: () => workspace, WorkspaceStatus: () => React.createElement('p', { role: workspace.error ? 'alert' : 'status' }, workspace.error || 'Загрузка локального пространства') };
      if (name === '@/context/RegistrationContext') return { useRegistration: () => value };
      if (name === '@/context/AuthContext') return { useAuth: () => ({ state: { status: 'anonymous', message: '' }, refresh() {} }) };
      if (name === '@/lib/api/registration') return { registrationClient: {} };
      if (name === '@/lib/data-mode') return { demoMode: true };
      if (name === 'next/navigation') return { useRouter: () => ({ push: route => routes.push(['push', route]), replace: route => routes.push(['replace', route]) }) };
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name === 'next/image') return { __esModule: true, default: ({ unoptimized, ...props }) => { void unoptimized; return React.createElement('img', props); } };
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const stem = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const candidate = [stem, `${stem}.ts`, `${stem}.tsx`].find(item => fs.existsSync(item) && fs.statSync(item).isFile());
        if (!candidate) throw new Error(`Cannot resolve registration fixture ${name}`);
        return load(candidate);
      }
      return require(name);
    };
    const schedule = callback => { const id = nextTimer++; timers.set(id, callback); return id; };
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', compiled)(localRequire, fixtureModule, fixtureModule.exports, schedule, id => timers.delete(id));
    return fixtureModule.exports;
  }
  const Bridge = load(path.resolve(__dirname, '../src/features/demo-workspace/RegistrationAdapter.tsx')).DemoRegistrationBridge;
  const ProfileForm = load(path.resolve(__dirname, '../src/components/registration/ProfileForm.tsx')).default;
  const RegistrationStep = load(path.resolve(__dirname, '../src/components/registration/RegistrationShell.tsx')).RegistrationStep;
  const children = React.createElement(RegistrationStep, { step: 'profile', title: 'Давайте познакомимся!', intro: 'Расскажите о себе.' }, React.createElement(ProfileForm));
  const fixtureContext = { Provider: ({ value: next, children: content }) => { value = next; return content; } };
  function render() {
    cursor = 0;
    const element = Bridge({ children, context: fixtureContext });
    tree = typeof element.type === 'function' && element.type.name === 'Session' ? element.type(element.props) : element;
    return renderToStaticMarkup(tree);
  }
  function flushEffects() { while (effects.length) { const { index, effect } = effects.shift(); slots[index].cleanup?.(); slots[index].cleanup = effect(); } }
  function flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); }
  function unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()); timers.clear(); }
  function clickButton(label) {
    function find(node) {
      if (!React.isValidElement(node)) return undefined;
      if (node.type === 'button' && node.props.children === label) return node;
      return React.Children.toArray(node.props.children).map(find).find(Boolean);
    }
    const button = find(tree); assert.ok(button, `Rendered button: ${label}`); button.props.onClick();
  }
  return { workspace, routes, saves, commands, render, flushEffects, flushTimers, unmount, clickButton, get value() { return value; } };
}

async function withBlobUrls(run) {
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const created = [], revoked = [];
  URL.createObjectURL = () => { const url = `blob:registration-fixture-${created.length + 1}`; created.push(url); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  try { await run({ created, revoked }); }
  finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
}

test('registration adapter: reload restores the real profile form fields', () => {
  const h = mount();
  const html = h.render(); h.flushEffects();
  assert.match(html, /id="display-name"[^>]*value="Первое имя"/);
  assert.match(html, /id="university"[^>]*value="Университет"/);
  assert.equal(h.value.previewComplete, false);
  h.unmount();
});

test('registration adapter: hydration blocks the actual form and prerequisite navigation', () => {
  const h = mount(null, { ready: false });
  const html = h.render(); h.flushEffects();
  assert.match(html, /Загрузка локального пространства/);
  assert.doesNotMatch(html, /id="display-name"|Открываем предыдущий шаг/);
  assert.deepEqual(h.routes, []);
  h.unmount();
});

test('registration adapter: queued autosaves preserve the latest edited draft', async () => {
  const h = mount(); h.render(); h.flushEffects();
  h.value.dispatch({ type: 'profile', patch: { city: 'Первый город' } }); h.render(); h.flushEffects();
  h.value.dispatch({ type: 'profile', patch: { city: 'Последний город' } }); h.render(); h.flushEffects();
  h.flushTimers(); await drain();
  assert.ok(h.saves.length > 0);
  assert.equal(h.saves.at(-1).draft.profile.city, 'Последний город');
  assert.equal(h.saves.at(-1).draft.profile.displayName, 'Первое имя');
  assert.equal(h.workspace.state.draft.profile.city, 'Последний город');
  h.unmount();
});

test('registration adapter: failed persistence retains input and never navigates or completes', async () => {
  const h = mount(initialState(), { saveRegistration: async () => { throw new Error('Хранилище недоступно'); } });
  h.render(); h.flushEffects();
  h.value.dispatch({ type: 'profile', patch: { displayName: 'Не потерять' } }); h.render(); h.flushEffects();
  await h.value.saveStep('profile');
  const html = h.render();
  assert.match(html, /value="Не потерять"/);
  assert.match(html, /Хранилище недоступно/);
  assert.deepEqual(h.routes, []);
  assert.deepEqual(h.commands, []);
  h.unmount();
});

test('registration adapter: step navigation happens only after the confirmed save', async () => {
  let finish;
  const h = mount(initialState(), { saveRegistration: () => new Promise(resolve => { finish = resolve; }) });
  h.render(); h.flushEffects();
  const saving = h.value.saveStep('roles');
  assert.deepEqual(h.routes, []);
  await drain();
  finish(); await saving;
  assert.deepEqual(h.routes, [['push', '/register/profile']]);
  assert.deepEqual(h.commands, []);
  h.unmount();
});

test('registration adapter: completing a customer creates the Demo account then opens its cabinet', async () => {
  const h = mount(); h.render(); h.flushEffects();
  await h.value.saveStep('profile');
  assert.deepEqual(h.commands, [{ type: 'register' }]);
  assert.deepEqual(h.routes, [['replace', '/profile']]);
  h.unmount();
});

test('registration adapter: a clean open form follows an incoming canonical draft', async () => {
  const h = mount(); h.render(); h.flushEffects();
  h.workspace.state = { ...h.workspace.state, revision: 1, draft: { ...h.workspace.state.draft, profile: { ...h.workspace.state.draft.profile, displayName: 'Новое имя из другой вкладки' } } };
  h.render(); h.flushEffects();
  await drain();
  const html = h.render();
  assert.match(html, /value="Новое имя из другой вкладки"/);
  h.unmount();
});

test('registration adapter: a dirty form cannot overwrite an incoming newer draft', async () => {
  const h = mount(); h.render(); h.flushEffects();
  h.value.dispatch({ type: 'profile', patch: { city: 'Несохранённый город' } }); h.render(); h.flushEffects();
  h.workspace.state = { ...h.workspace.state, revision: 1, draft: { ...h.workspace.state.draft, profile: { ...h.workspace.state.draft.profile, displayName: 'Имя из другой вкладки' } } };
  h.render(); h.flushEffects();
  await drain();
  const html = h.render();
  assert.equal(h.workspace.state.draft.profile.displayName, 'Имя из другой вкладки');
  assert.equal(h.saves.length, 0, 'the rejected stale form must not be committed');
  assert.match(html, /value="Несохранённый город"/);
  assert.match(html, /Черновик изменился|актуальн/);
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.routes, []);
  h.unmount();
});

test('registration adapter: an incoming avatar-only update is restored behind the loading guard', async () => {
  await withBlobUrls(async () => {
    let finish;
    const h = mount(initialState(), { getAsset: () => new Promise(resolve => { finish = resolve; }) });
    h.render(); h.flushEffects();
    h.workspace.state = { ...h.workspace.state, revision: 1, registrationAvatarId: 'incoming-avatar' };
    for (let commit = 0; commit < 3; commit++) { h.render(); h.flushEffects(); await drain(); }
    const loadingHtml = h.render();
    assert.equal(typeof finish, 'function', 'an avatar reference change must read the new persisted file');
    assert.equal(h.value.loading, true, 'the form must wait until its incoming avatar has been restored');
    assert.match(loadingHtml, /Восстанавливаем регистрацию/);
    await h.value.saveStep('profile');
    assert.deepEqual(h.saves, [], 'continuing during avatar restoration must not clear the incoming asset reference');
    assert.deepEqual(h.commands, []);
    assert.deepEqual(h.routes, []);
    assert.equal(h.workspace.state.registrationAvatarId, 'incoming-avatar');
    finish(new Blob(['avatar'], { type: 'image/png' })); await drain();
    h.render(); h.flushEffects();
    const html = h.render();
    assert.equal(h.value.loading, false);
    assert.match(html, /src="blob:registration-fixture-/);
    h.unmount();
  });
});

test('registration adapter: a late avatar restore after unmount does not leak its blob URL', async () => {
  await withBlobUrls(async ({ created, revoked }) => {
    let finish;
    const state = initialState(); state.registrationAvatarId = 'saved-avatar';
    const h = mount(state, { getAsset: () => new Promise(resolve => { finish = resolve; }) });
    h.render(); h.flushEffects(); h.unmount();
    finish(new Blob(['avatar'], { type: 'image/png' })); await drain();
    assert.ok(created.every(url => revoked.includes(url)), 'URLs created after an unmounted restore must be released or never created');
  });
});

test('registration adapter: replaced and removed form avatar previews are released', async () => {
  await withBlobUrls(async ({ revoked }) => {
    const h = mount(); h.render(); h.flushEffects();
    const first = URL.createObjectURL(new Blob(['one'], { type: 'image/png' }));
    h.value.dispatch({ type: 'profile', patch: { avatarUrl: first } }); h.render(); h.flushEffects();
    const second = URL.createObjectURL(new Blob(['two'], { type: 'image/png' }));
    h.value.dispatch({ type: 'profile', patch: { avatarUrl: second } }); h.render(); h.flushEffects();
    assert.ok(revoked.includes(first), 'Replacing an avatar releases the previous form preview');
    h.value.dispatch({ type: 'profile', patch: { avatarFile: null, avatarUrl: '' } }); h.render(); h.flushEffects();
    assert.ok(revoked.includes(second), 'Removing an avatar releases its form preview');
    h.unmount();
  });
});

test('F2: retry after a cross-tab conflict waits for the saved avatar and blocks edit autosave/Next', async () => {
  await withBlobUrls(async () => {
    let finish;
    const h = mount(initialState(), { getAsset: () => new Promise(resolve => { finish = resolve; }) });
    h.render(); h.flushEffects();
    h.value.dispatch({type:'profile',patch:{city:'Unsaved city'}});h.render();h.flushEffects();
    h.workspace.state={...h.workspace.state,revision:1,registrationAvatarId:'remote-avatar',draft:{...h.workspace.state.draft,profile:{...h.workspace.state.draft.profile,displayName:'Remote name'}}};
    await drain();h.render();h.flushEffects();
    h.value.retry();h.render();h.flushEffects();
    assert.equal(h.value.loading,true,'retry must restart the loading lifecycle before the read resolves');
    h.value.dispatch({type:'profile',patch:{city:'Typed before file resolves'}});h.render();h.flushEffects();await drain();
    await h.value.saveStep('profile');
    assert.equal(h.saves.length,0);assert.equal(h.routes.length,0);assert.equal(h.workspace.state.registrationAvatarId,'remote-avatar');
    finish(new Blob(['avatar'],{type:'image/png'}));await drain();h.render();h.flushEffects();await drain();h.render();h.flushEffects();
    assert.equal(h.value.loading,false);assert.equal(h.workspace.state.registrationAvatarId,'remote-avatar');
    assert.equal(h.saves.at(-1).draft.profile.city,'Typed before file resolves');
    h.unmount();
  });
});

test('F2: retry reloads the same avatar ID and a failed read retains its reference and input',async()=>{
  await withBlobUrls(async()=>{
    let reads=0,rejectRead;const state=initialState();state.registrationAvatarId='same-avatar';
    const h=mount(state,{getAsset:()=>{reads++;return reads===1?Promise.resolve(new Blob(['avatar'],{type:'image/png'})):new Promise((_,reject)=>{rejectRead=reject;});}});
    h.render();h.flushEffects();await drain();h.render();h.flushEffects();
    h.value.retry();h.render();h.flushEffects();await drain();
    assert.equal(reads,2,'same-ID retry must not reuse an absent preview');assert.equal(h.value.loading,true);
    rejectRead(Error('Slow disk failed'));await drain();h.render();h.flushEffects();
    assert.equal(h.value.loading,false);assert.match(h.value.error,/аватар.*недоступен/i);
    h.value.dispatch({type:'profile',patch:{city:'Keep local input'}});h.render();h.flushEffects();await drain();await h.value.saveStep('profile');
    assert.equal(h.workspace.state.registrationAvatarId,'same-avatar');assert.equal(h.routes.length,0);assert.equal(h.saves.length,0);assert.match(h.render(),/Keep local input/);
    h.unmount();
  });
});

test('F2: a failed preview can be explicitly removed, and only that action clears its reference',async()=>{
  const state=initialState();state.registrationAvatarId='saved-avatar';const h=mount(state,{getAsset:async()=>{throw Error('Unavailable file');}});
  h.render();h.flushEffects();await drain();h.render();h.flushEffects();
  assert.equal(h.saves.length,0);assert.equal(h.workspace.state.registrationAvatarId,'saved-avatar');
  h.value.dispatch({type:'profile',patch:{city:'Keep input when removing'}});h.render();h.flushEffects();await drain();
  h.clickButton('Удалить недоступный аватар');h.render();h.flushEffects();await drain();h.render();h.flushEffects();
  assert.equal(h.saves.at(-1).avatarIntent,'remove');assert.equal(h.workspace.state.registrationAvatarId,null);
  assert.equal(h.workspace.state.draft.profile.city,'Keep input when removing');assert.doesNotMatch(h.render(),/Сохранённый аватар недоступен/);h.unmount();
});

test('F2: restored avatar is preserved through Next and a new adapter mount after recovery',async()=>{
  await withBlobUrls(async()=>{const state=initialState();state.registrationAvatarId='persisted-after-retry';const blob=new Blob(['avatar'],{type:'image/png'}),h=mount(state,{getAsset:async()=>blob});
    h.render();h.flushEffects();await drain();h.render();h.flushEffects();h.value.retry();h.render();h.flushEffects();await drain();h.render();h.flushEffects();
    await h.value.saveStep('profile');assert.equal(h.workspace.state.registrationAvatarId,'persisted-after-retry');assert.equal(h.saves.at(-1).avatarIntent,'preserve');
    const reloaded=mount(structuredClone(h.workspace.state),{getAsset:async()=>blob});reloaded.render();reloaded.flushEffects();await drain();reloaded.render();reloaded.flushEffects();
    assert.match(reloaded.render(),/src="blob:registration-fixture-/);assert.equal(reloaded.workspace.state.registrationAvatarId,'persisted-after-retry');h.unmount();reloaded.unmount();
  });
});

test('F2: a clean incoming text revision keeps the ready preview for the same saved avatar',async()=>{
  await withBlobUrls(async({revoked})=>{let reads=0;const state=initialState();state.registrationAvatarId='same-avatar';const h=mount(state,{getAsset:async()=>{reads++;return new Blob(['avatar'],{type:'image/png'});}});
    h.render();h.flushEffects();await drain();h.render();h.flushEffects();const preview=h.value.draft.profile.avatarUrl;
    h.workspace.state={...h.workspace.state,revision:1,draft:{...h.workspace.state.draft,profile:{...h.workspace.state.draft.profile,displayName:'Updated remotely'}}};h.render();h.flushEffects();await drain();h.render();h.flushEffects();
    assert.equal(h.value.draft.profile.displayName,'Updated remotely');assert.equal(h.value.draft.profile.avatarUrl,preview);assert.equal(reads,1);assert.equal(revoked.includes(preview),false);h.unmount();assert.ok(revoked.includes(preview));
  });
});

test('F2: retry clears the rejected write chain so Next works without another edit',async()=>{
  const h=mount();h.render();h.flushEffects();h.value.dispatch({type:'profile',patch:{city:'Stale local edit'}});h.render();h.flushEffects();
  h.workspace.state={...h.workspace.state,revision:1,draft:{...h.workspace.state.draft,profile:{...h.workspace.state.draft.profile,displayName:'Current remote name'}}};await drain();h.render();h.flushEffects();assert.match(h.value.error,/изменился/);
  h.value.retry();h.render();h.flushEffects();await drain();h.render();h.flushEffects();await h.value.saveStep('profile');
  assert.equal(h.workspace.state.draft.profile.displayName,'Current remote name');assert.equal(h.saves.length,1);assert.deepEqual(h.commands,[{type:'register'}]);assert.deepEqual(h.routes,[['replace','/profile']]);h.unmount();
});
