/* eslint-disable @typescript-eslint/no-require-imports -- Execute the actual profile editor hooks and real Demo commands without changing browser storage. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const drain = () => new Promise(resolve => setImmediate(resolve));
const base = path.resolve(__dirname, '../src/features/demo-workspace');
const source = path.join(base, 'AccountWorkspace.tsx');
function loader(override = () => undefined) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const fixtureModule = { exports: {} }; cache.set(file, fixtureModule);
    const text = fs.readFileSync(file, 'utf8') + (file === source ? '\nexport { ProfileEditor };' : '');
    const code = ts.transpileModule(text, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      const value = override(name, file); if (value !== undefined) return value;
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === 'next/link' || name === 'next/image') return { __esModule: true, default: () => null };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const stem = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const child = [stem, `${stem}.ts`, `${stem}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!child) throw new Error(`Cannot resolve ${name}`);
        return load(child);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, fixtureModule, fixtureModule.exports);
    return fixtureModule.exports;
  };
}
const domain = loader()(path.join(base, 'domain.ts'));
const actor = { id: 'demo-self', role: 'customer' };
function registered() {
  let state = domain.emptyWorkspace();
  const draft = structuredClone(state.draft); draft.roles = ['customer']; draft.profile.displayName = 'Initial';
  state = domain.applyCommand(state, { type: 'registration', draft }, actor, 'registration-fixture', 1).state;
  return domain.applyCommand(state, { type: 'register' }, actor, 'register-fixture', 2).state;
}
function mount(initial = registered(), avatarOptions = {}) {
  const slots = [], commands = [], avatarCalls = []; let cursor = 0, action = 0, tree;
  const workspace = { state: structuredClone(initial), busy: false };
  function apply(command, expectedRevision) {
    commands.push({ command: structuredClone(command), expectedRevision, actualRevision: workspace.state.revision });
    if (expectedRevision !== undefined && expectedRevision !== workspace.state.revision) throw new Error('Данные изменились в другой вкладке. Загрузите актуальные данные.');
    const result = domain.applyCommand(workspace.state, command, actor, `fixture-${++action}`, action + 2);
    workspace.state = result.state;
    return result;
  }
  workspace.run = async (command, options = {}) => apply(command, options.expectedRevision).entityId;
  workspace.saveAvatar = async (file, options = {}) => {
    avatarCalls.push({ file, options });
    if (avatarOptions.beforeCommit) await avatarOptions.beforeCommit();
    if (avatarOptions.fail) throw new Error('Не удалось сохранить аватар');
    apply({ type: 'profile', patch: { avatarAssetId: file ? 'avatar-fixture' : '' } }, options.expectedRevision);
    const committedRevision = workspace.state.revision;
    if (avatarOptions.afterCommit) await avatarOptions.afterCommit();
    return committedRevision;
  };
  const hooks = { ...React,
    useState(initialValue) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initialValue === 'function' ? initialValue() : initialValue }; return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }]; },
    useRef(initialValue) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initialValue } }; return slots[index].value; },
  };
  const load = loader(name => name === 'react' ? hooks : name === './Provider' ? { useDemoWorkspace: () => workspace } : undefined);
  const Editor = load(source).ProfileEditor;
  function render() { cursor = 0; tree = Editor({ account: workspace.state.account }); return tree; }
  function find(predicate) {
    const visit = node => { if (!node || typeof node !== 'object') return undefined; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props?.children)) { const match = visit(child); if (match) return match; } };
    const result = visit(tree); assert.ok(result, 'Expected actual profile editor control'); return result;
  }
  function input(id) { return find(node => node.props?.id === id); }
  function editName(name) { input('account-name').props.onChange({ target: { value: name } }); render(); }
  async function avatar(file) {
    if (file) input('account-avatar').props.onChange({ target: { files: [file], value: 'selected-file' } });
    else find(node => node.type === 'button' && node.props.children === 'Удалить аватар').props.onClick();
    await drain(); render();
  }
  async function save() { await find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); }
  function external(name) { apply({ type: 'profile', patch: { name } }); }
  function alertText() { return find(node => node.props?.role === 'alert').props.children; }
  render();
  return { workspace, commands, avatarCalls, render, input, editName, avatar, save, external, alertText };
}
const image = () => new File(['fixture'], 'avatar.png', { type: 'image/png' });

test('profile avatar: unsaved text then avatar upload then save survives reload', async () => {
  const h = mount(), start = h.workspace.state.revision;
  h.editName('Saved with avatar'); await h.avatar(image()); await h.save();
  assert.equal(h.avatarCalls[0].options.expectedRevision, start, 'avatar command must use the text form revision');
  assert.equal(h.workspace.state.account.name, 'Saved with avatar');
  assert.equal(h.workspace.state.account.avatarAssetId, 'avatar-fixture');
  assert.equal(h.commands.at(-1).expectedRevision, start + 1, 'only the known successful own transaction advances the form');
  const restored = mount(JSON.parse(JSON.stringify(h.workspace.state)));
  assert.equal(restored.input('account-name').props.value, 'Saved with avatar');
  assert.equal(restored.workspace.state.account.avatarAssetId, 'avatar-fixture');
});

test('profile avatar: unsaved text then avatar removal then save survives reload', async () => {
  const state = registered(); state.account.avatarAssetId = 'saved-avatar';
  const h = mount(state), start = state.revision;
  h.editName('Saved without avatar'); await h.avatar(null); await h.save();
  assert.equal(h.avatarCalls[0].options.expectedRevision, start);
  assert.equal(h.workspace.state.account.name, 'Saved without avatar');
  assert.equal(h.workspace.state.account.avatarAssetId, '');
  const restored = mount(JSON.parse(JSON.stringify(h.workspace.state)));
  assert.equal(restored.input('account-name').props.value, 'Saved without avatar');
  assert.equal(restored.workspace.state.account.avatarAssetId, '');
});

test('profile avatar: external change before upload rejects avatar and keeps dirty input', async () => {
  const h = mount(); h.editName('Keep unsaved text'); h.external('Remote name'); h.render();
  await h.avatar(image()); await h.save();
  assert.equal(h.workspace.state.account.name, 'Remote name');
  assert.equal(h.workspace.state.account.avatarAssetId, undefined);
  assert.equal(h.input('account-name').props.value, 'Keep unsaved text');
  assert.match(String(h.alertText()[0]), /другой вкладке/);
});

test('profile avatar: external transaction while upload is pending cannot be overwritten', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const h = mount(registered(), { beforeCommit: () => pending }); h.editName('Pending local name');
  const upload = h.avatar(image()); h.external('Concurrent name'); h.render(); release(); await upload; await h.save();
  assert.equal(h.workspace.state.account.name, 'Concurrent name');
  assert.equal(h.workspace.state.account.avatarAssetId, undefined);
  assert.equal(h.input('account-name').props.value, 'Pending local name');
  assert.match(String(h.alertText()[0]), /другой вкладке/);
});

test('profile avatar: external transaction after avatar commit still rejects stale text', async () => {
  let h;
  h = mount(registered(), { afterCommit: () => h.external('Remote after avatar') });
  h.editName('Local before avatar'); await h.avatar(image()); await h.save();
  assert.equal(h.workspace.state.account.avatarAssetId, 'avatar-fixture');
  assert.equal(h.workspace.state.account.name, 'Remote after avatar');
  assert.equal(h.input('account-name').props.value, 'Local before avatar');
  assert.equal(h.commands.at(-1).expectedRevision + 1, h.commands.at(-1).actualRevision, 'use the returned own revision rather than the newest observed revision');
  assert.match(String(h.alertText()[0]), /другой вкладке/);
});

test('profile avatar: a failed avatar write does not advance the text form revision', async () => {
  const h = mount(registered(), { fail: true }), start = h.workspace.state.revision;
  h.editName('Text remains saveable'); await h.avatar(image());
  assert.equal(h.workspace.state.revision, start);
  assert.equal(h.input('account-name').props.value, 'Text remains saveable');
  assert.match(String(h.alertText()[0]), /Не удалось сохранить аватар/);
  await h.save();
  assert.equal(h.workspace.state.account.name, 'Text remains saveable');
  assert.equal(h.commands.at(-1).expectedRevision, start);
  assert.equal(h.workspace.state.account.avatarAssetId, undefined);
});
