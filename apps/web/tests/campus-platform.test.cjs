/* eslint-disable @typescript-eslint/no-require-imports -- Node harness loads isolated transpiled TypeScript. */
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/telegram/campus-platform.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fixture = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, fixture, fixture.exports);
const {
  createCampusPlatformSnapshot,
  getCampusPlatformSnapshot,
  getServerCampusPlatformSnapshot,
  subscribeCampusPlatform,
} = fixture.exports;
const snapshot = app => JSON.parse(createCampusPlatformSnapshot(app));
const originalWindow = global.window;
afterEach(() => {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
});

test('SSR snapshot is stable and does not access browser metadata', () => {
  delete global.window;
  const server = getServerCampusPlatformSnapshot();
  assert.equal(getServerCampusPlatformSnapshot(), server);
  assert.equal(getCampusPlatformSnapshot(), server);
  assert.deepEqual(JSON.parse(server), ['auto', 0, 0, '100svh', false, 0, 0]);
  assert.doesNotThrow(() => subscribeCampusPlatform(() => {})());
});

test('device and content insets use the greater value without adding padding', () => {
  assert.deepEqual(snapshot({
    safeAreaInset: { top: 24, bottom: 34 },
    contentSafeAreaInset: { top: 40, bottom: 12 },
  }).slice(1, 3), [40, 34]);
  assert.deepEqual(snapshot({ safeAreaInset: { top: 0, bottom: 0 } }).slice(1, 3), [0, 0]);
});

test('invalid inset metadata never becomes invalid or negative CSS', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1, '20', {}, true]) {
    const result = snapshot({ safeAreaInset: { top: value }, contentSafeAreaInset: { bottom: value } });
    assert.deepEqual(result.slice(1, 3), [0, 0]);
  }
  assert.deepEqual(snapshot({ safeAreaInset: null, contentSafeAreaInset: false }).slice(1, 3), [0, 0]);
});

test('landscape insets use finite device/content maxima without adding either edge', () => {
  assert.deepEqual(snapshot({
    safeAreaInset: { left: 44, right: 12 },
    contentSafeAreaInset: { left: 16, right: 32 },
  }).slice(5), [44, 32]);
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1, '20', {}, true]) {
    assert.deepEqual(snapshot({
      safeAreaInset: { left: value, right: value },
      contentSafeAreaInset: { left: value, right: value },
    }).slice(5), [0, 0]);
  }
  assert.deepEqual(snapshot({
    safeAreaInset: { left: NaN, right: 8 },
    contentSafeAreaInset: { left: 36, right: Infinity },
  }).slice(5), [36, 8]);
});

test('viewport prefers stable height, accepts finite positive pixels and falls back safely', () => {
  assert.equal(snapshot({ viewportStableHeight: 700, viewportHeight: 320 })[3], '700px');
  assert.equal(snapshot({ viewportStableHeight: NaN, viewportHeight: 320.5 })[3], '320.5px');
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1, 0, '700', {}, true]) {
    assert.equal(snapshot({ viewportStableHeight: value, viewportHeight: value })[3], '100svh');
  }
  // No undocumented device-specific maximum or rounding is imposed.
  assert.equal(snapshot({ viewportHeight: 10000 })[3], '10000px');
});

test('only valid Telegram theme metadata overrides the CSS system theme', () => {
  assert.equal(snapshot({ colorScheme: 'dark' })[0], 'dark');
  assert.equal(snapshot({ colorScheme: 'light' })[0], 'light');
  for (const colorScheme of [undefined, null, 'night', {}, false]) {
    assert.equal(snapshot({ colorScheme })[0], 'auto');
  }
  global.window = { matchMedia: () => ({ matches: true }) };
  assert.deepEqual(JSON.parse(getCampusPlatformSnapshot()), ['auto', 0, 0, '100svh', true, 0, 0]);
  assert.deepEqual(JSON.parse(getServerCampusPlatformSnapshot()), ['auto', 0, 0, '100svh', false, 0, 0]);
});

test('the SDK browser stub keeps automatic theme and dynamic CSS viewport fallback', () => {
  let subscriptions = 0;
  const app = {
    platform: 'unknown', colorScheme: 'light', viewportStableHeight: 700,
    safeAreaInset: { top: 24, bottom: 34 },
    onEvent() { subscriptions++; }, offEvent() {},
  };
  assert.deepEqual(snapshot(app), ['auto', 0, 0, '100svh', false, 0, 0]);
  subscribeCampusPlatform(() => {}, { Telegram: { WebApp: app } })();
  assert.equal(subscriptions, 0);
});

test('all supported SDK and system-theme listeners are removed once with identical callbacks', () => {
  const registrations = [];
  const removals = [];
  const callback = () => {};
  const app = {
    onEvent(event, listener) { assert.equal(this, app); registrations.push([event, listener]); },
    offEvent(event, listener) { assert.equal(this, app); removals.push([event, listener]); },
  };
  const query = {
    matches: false,
    addEventListener(event, listener) { registrations.push([event, listener]); },
    removeEventListener(event, listener) { removals.push([event, listener]); },
  };
  const cleanup = subscribeCampusPlatform(callback, {
    Telegram: { WebApp: app }, matchMedia: () => query,
  });
  assert.deepEqual(registrations.map(([name]) => name), [
    'themeChanged', 'viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'change',
  ]);
  assert.ok(registrations.every(([, listener]) => listener === callback));
  cleanup(); cleanup();
  assert.deepEqual(removals, registrations);
});

test('late SDK availability can reconnect and unsupported events do not break cleanup', () => {
  const browser = {};
  const oldCleanup = subscribeCampusPlatform(() => {}, browser);
  oldCleanup();
  const added = [];
  const removed = [];
  browser.Telegram = { WebApp: {
    onEvent(name) { if (name.includes('SafeArea') || name === 'safeAreaChanged') throw new Error('unsupported'); added.push(name); },
    offEvent(name) { removed.push(name); if (name === 'themeChanged') throw new Error('detached'); },
  } };
  const cleanup = subscribeCampusPlatform(() => {}, browser);
  cleanup();
  assert.deepEqual(added, ['themeChanged', 'viewportChanged']);
  assert.deepEqual(removed, added);
});

test('legacy media listeners work, but unremovable SDK listeners are never attached', () => {
  let mediaAdded = 0;
  let mediaRemoved = 0;
  let sdkAdded = 0;
  const cleanup = subscribeCampusPlatform(() => {}, {
    Telegram: { WebApp: { onEvent() { sdkAdded++; } } },
    matchMedia: () => ({ matches: false, addListener() { mediaAdded++; }, removeListener() { mediaRemoved++; } }),
  });
  cleanup();
  assert.equal(sdkAdded, 0);
  assert.equal(mediaAdded, 1);
  assert.equal(mediaRemoved, 1);
});

test('display metadata does not read personal data or call SDK lifecycle methods', () => {
  const app = {
    colorScheme: 'light',
    get initData() { throw new Error('must not read initData'); },
    get initDataUnsafe() { throw new Error('must not read personal data'); },
    ready() { throw new Error('must not signal readiness'); },
    expand() { throw new Error('must not expand'); },
    requestFullscreen() { throw new Error('must not enter fullscreen'); },
  };
  assert.equal(snapshot(app)[0], 'light');
  assert.doesNotThrow(() => subscribeCampusPlatform(() => {}, { Telegram: { WebApp: app } })());
});
