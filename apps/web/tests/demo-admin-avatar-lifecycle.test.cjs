/* eslint-disable @typescript-eslint/no-require-imports -- Run the actual UserAvatar effect with controlled asset reads and lifecycle cleanup. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const drain = () => new Promise(resolve => setImmediate(resolve));
const image = () => new Blob(['avatar'], { type: 'image/png' });

function mountAvatar() {
  const slots = [], effects = [], reads = [], writes = [];
  let cursor = 0, mounted = true, props = { name: 'Demo User', assetId: undefined };
  const workspace = { getAsset(id) { return new Promise((resolve, reject) => reads.push({ id, resolve, reject })); } };
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => {
        writes.push({ mounted, value: update });
        if (mounted) slots[index].value = typeof update === 'function' ? update(slots[index].value) : update;
      }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((dependency, position) => !Object.is(previous.dependencies[position], dependency))) {
        slots[index] = { ...previous, dependencies: dependencies.slice() };
        effects.push({ index, effect });
      }
    },
  };
  const file = path.join(__dirname, '../src/features/demo-workspace/AdminWorkspace.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const fixtureModule = { exports: {} };
  const fixtureRequire = name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === './Provider') return { useDemoWorkspace: () => workspace };
    if (name.endsWith('.css')) return { __esModule: true, default: { personAvatar: 'personAvatar' } };
    if (['next/link', '@/components/studly/Icon', './ui', './model'].includes(name)) return {};
    throw new Error(`Unexpected UserAvatar dependency: ${name}`);
  };
  // Export the private component only inside this in-memory test module; production exports stay unchanged.
  new Function('require', 'module', 'exports', `${compiled}\nmodule.exports.fixtureUserAvatar = UserAvatar;`)(fixtureRequire, fixtureModule, fixtureModule.exports);
  function render(next = props) { props = next; cursor = 0; return fixtureModule.exports.fixtureUserAvatar(props); }
  function commit() {
    while (effects.length) {
      const { index, effect } = effects.shift();
      slots[index].cleanup?.();
      slots[index].cleanup = effect();
    }
  }
  function unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()); }
  return { render, commit, unmount, reads, writes };
}

async function withObjectUrls(run) {
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const created = [], revoked = [];
  URL.createObjectURL = () => { const url = `blob:admin-avatar-fixture-${created.length + 1}`; created.push(url); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  try { await run({ created, revoked }); }
  finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
}

test('admin avatar: a delayed asset resolved after unmount creates no object URL or late state write', async () => {
  await withObjectUrls(async ({ created, revoked }) => {
    const h = mountAvatar(); h.render({ name: 'Demo User', assetId: 'avatar-a' }); h.commit();
    assert.equal(h.reads.length, 1);
    h.unmount(); h.reads[0].resolve(image()); await drain();
    assert.deepEqual(created, []);
    assert.deepEqual(revoked, []);
    assert.deepEqual(h.writes, []);
  });
});

test('admin avatar: changing assetId invalidates the pending old read and only displays the current image', async () => {
  await withObjectUrls(async ({ created, revoked }) => {
    const h = mountAvatar(); h.render({ name: 'Demo User', assetId: 'avatar-a' }); h.commit();
    h.render({ name: 'Demo User', assetId: 'avatar-b' }); h.commit();
    assert.deepEqual(h.reads.map(read => read.id), ['avatar-a', 'avatar-b']);
    h.reads[1].resolve(image()); await drain();
    assert.equal(h.render().props.children.props.src, created[0]);
    h.reads[0].resolve(image()); await drain();
    assert.equal(created.length, 1, 'the obsolete read must not allocate another URL');
    assert.equal(h.writes.length, 1, 'the obsolete read must not replace the current image');
    h.unmount();
    assert.deepEqual(revoked, created);
    assert.ok(h.writes.every(write => write.mounted));
  });
});

test('admin avatar: repeated card open and close revokes every allocated URL and ignores late reads', async () => {
  await withObjectUrls(async ({ created, revoked }) => {
    for (let cycle = 0; cycle < 6; cycle++) {
      const h = mountAvatar(); h.render({ name: 'Demo User', assetId: `avatar-${cycle}` }); h.commit();
      if (cycle % 2 === 0) { h.reads[0].resolve(image()); await drain(); }
      h.unmount();
      if (cycle % 2 !== 0) { h.reads[0].resolve(image()); await drain(); }
      assert.ok(h.writes.every(write => write.mounted));
    }
    assert.equal(created.length, 3, 'only images loaded while their cards are open allocate a URL');
    assert.deepEqual(revoked, created);
  });
});

test('admin avatar: replacing and removing a loaded avatar releases each URL before showing initials', async () => {
  await withObjectUrls(async ({ created, revoked }) => {
    const h = mountAvatar(); h.render({ name: 'Demo User', assetId: 'avatar-a' }); h.commit();
    h.reads[0].resolve(image()); await drain();
    h.render({ name: 'Demo User', assetId: 'avatar-b' }); h.commit();
    assert.deepEqual(revoked, [created[0]]);
    h.reads[1].resolve(image()); await drain();
    assert.equal(h.render().props.children.props.src, created[1]);
    const fallback = h.render({ name: 'Demo User', assetId: undefined }); h.commit();
    assert.equal(fallback.props.children, 'DU');
    assert.deepEqual(revoked, created);
    h.unmount();
    assert.deepEqual(revoked, created, 'cleanup must not revoke the same URL twice');
  });
});

test('admin avatar: missing, unsupported and failed assets retain initials without allocating URLs', async () => {
  await withObjectUrls(async ({ created, revoked }) => {
    for (const outcome of ['missing', 'unsupported', 'failed']) {
      const h = mountAvatar(); h.render({ name: 'Demo User', assetId: outcome }); h.commit();
      if (outcome === 'failed') h.reads[0].reject(new Error('Read unavailable'));
      else h.reads[0].resolve(outcome === 'missing' ? undefined : new Blob(['pdf'], { type: 'application/pdf' }));
      await drain();
      assert.equal(h.render().props.children, 'DU');
      assert.deepEqual(h.writes, []);
      h.unmount();
    }
    assert.deepEqual(created, []);
    assert.deepEqual(revoked, []);
  });
});
