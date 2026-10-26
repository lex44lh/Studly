/* eslint-disable @typescript-eslint/no-require-imports -- Node renders isolated, transpiled production components without adding a test dependency. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.join(__dirname, '../src');

// Only the Next runtime/environment is stubbed. The shell, favorites provider,
// platform hook, icons, brand and error fallback below are the actual components.
function components(pathname, demoMode = true) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const fixture = { exports: {} };
    cache.set(filename, fixture);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    const localRequire = request => {
      if (request === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
      if (request === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ back() {} }) };
      if (request === '@/context/AuthContext') return { useAuth: () => ({ sdkReady: false, state: { status: 'anonymous', user: null, message: 'Test session' } }) };
      if (request === '@/lib/data-mode' || request === '@/lib/api/catalog') return { demoMode };
      if (request.endsWith('.css')) return { page: 'information-page', state: 'information-state', stateIcon: 'information-icon' };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const target = request.startsWith('@/')
          ? path.join(sourceRoot, request.slice(2))
          : path.resolve(path.dirname(filename), request);
        const resolved = [target, `${target}.tsx`, `${target}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        assert.ok(resolved, `Cannot resolve component dependency: ${request}`);
        return load(resolved);
      }
      return require(request);
    };
    new Function('require', 'module', 'exports', compiled)(localRequire, fixture, fixture.exports);
    return fixture.exports;
  }
  return {
    CampusShell: load(path.join(sourceRoot, 'components/studly/CampusShell.tsx')).CampusShell,
    AppShell: load(path.join(sourceRoot, 'components/AppShell.tsx')).default,
    ErrorPage: load(path.join(sourceRoot, 'app/error.tsx')).default,
  };
}

function openingTags(html) {
  return [...html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)].map(([, tag, attributes]) => ({
    tag,
    attributes: Object.fromEntries([...attributes.matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)]
      .map(([, name, value]) => [name.toLowerCase(), value])),
  }));
}

function skipTarget(html) {
  const tags = openingTags(html);
  const links = tags.filter(({ tag, attributes }) => tag === 'a' && attributes.class?.split(' ').includes('skip-link'));
  assert.equal(links.length, 1, 'The rendered shell must expose exactly one skip link');
  const href = links[0].attributes.href;
  assert.ok(href.startsWith('#') && href.length > 1, 'The skip link must point within the current document');
  const targets = tags.filter(({ attributes }) => attributes.id === href.slice(1));
  assert.equal(targets.length, 1, `The skip destination ${href} must exist exactly once, including during an error`);
  assert.equal(targets[0].tag, 'main', 'The shell must own its destination independently of page headings');
  assert.equal(targets[0].attributes.tabindex, '-1', 'The destination must accept keyboard focus without joining the tab order');
  assert.equal(tags.filter(({ tag }) => tag === 'main').length, 1, 'Do not introduce nested or duplicate main landmarks');
  return href;
}

test('CampusShell owns a focusable skip target even when its children have no heading', () => {
  const { CampusShell } = components('/search');
  for (const props of [{}, { contentId: 'service-title' }, { contentId: 'campus-content', variant: 'standard' }]) {
    const html = renderToStaticMarkup(React.createElement(CampusShell, props, React.createElement('p', null, 'Content without a route heading')));
    skipTarget(html);
  }
});

for (const [pathname, headingId] of [['/search', 'search-title'], ['/service/101', 'service-title']]) {
  test(`AppShell ${pathname} keeps its skip destination through page → error → restored page in Demo and Live`, () => {
    for (const demoMode of [true, false]) {
      const { AppShell, ErrorPage } = components(pathname, demoMode);
      let resetCalls = 0;
      const reset = () => { resetCalls++; };
      const html = child => renderToStaticMarkup(React.createElement(AppShell, null, child));
      const before = html(React.createElement('h1', { id: headingId }, 'Route content'));
      const failed = html(React.createElement(ErrorPage, { error: new Error('Test error'), reset }));
      const restored = html(React.createElement('h1', { id: headingId }, 'Restored route content'));
      const target = skipTarget(failed);
      assert.equal(skipTarget(before), target);
      assert.equal(skipTarget(restored), target);
      assert.match(failed, /id="error-title"/);
      assert.ok(!openingTags(failed).some(({ attributes }) => attributes.id === headingId), 'The route heading really is absent from the rendered error fallback');
      assert.ok(openingTags(before).some(({ attributes }) => attributes.id === headingId), 'Existing route headings must remain intact');
      assert.equal(resetCalls, 0, 'Rendering an error must not invoke recovery or business actions');
    }
  });
}

test('standard and onboarding AppShell variants retain the same accessible shell destination', () => {
  for (const pathname of ['/profile', '/welcome']) {
    const { AppShell } = components(pathname);
    const html = renderToStaticMarkup(React.createElement(AppShell, null, React.createElement('h1', null, 'Page content')));
    assert.equal(skipTarget(html), '#campus-content');
  }
});

test('ErrorPage recovery button invokes only the reset callback supplied by the boundary', () => {
  const { ErrorPage } = components('/search');
  let resets = 0;
  const reset = () => { resets++; };
  const tree = ErrorPage({ error: new Error('Test error'), reset });
  const buttons = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button') buttons.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.onClick, reset);
  assert.equal(resets, 0);
  buttons[0].props.onClick();
  assert.equal(resets, 1);
});
