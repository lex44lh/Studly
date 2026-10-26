/* eslint-disable @typescript-eslint/no-require-imports -- Render the real shell around a controlled API form. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function render(pathname, demoMode = false) {
  const file = path.join(__dirname, '../src/components/AppShell.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const shellModule = { exports: {} };
  const pass = ({ children }) => children;
  function fixtureRequire(name) {
    if (name === 'next/navigation') return { usePathname: () => pathname };
    if (name === '@/context/FavoritesContext') return { FavoritesProvider: pass };
    if (name === '@/lib/api/catalog') return { demoMode };
    if (name === '@/features/demo-workspace/Provider') return {
      DemoWorkspaceProvider: ({ children }) => React.createElement('div', { 'data-demo-provider': true }, children), useOptionalDemoWorkspace: () => null,
    };
    if (name === './studly/CampusShell') return { CampusShell: ({ children }) => React.createElement('main', null, children) };
    return require(name);
  }
  new Function('require', 'module', 'exports', code)(fixtureRequire, shellModule, shellModule.exports);
  const child = React.createElement('form', { 'aria-label': 'Server operation' },
    React.createElement('input', { name: 'title', defaultValue: 'Server draft' }), React.createElement('button', { type: 'submit' }, 'Save server action'));
  return renderToStaticMarkup(React.createElement(shellModule.exports.default, null, child));
}

for (const route of ['/orders', '/orders/12', '/chats', '/chats/12345678-1234-4234-8234-123456789012', '/create-service', '/staff']) {
  test(`Live ${route}: the shell leaves server-permitted controls enabled`, () => {
    const html = render(route);
    assert.match(html, /Server operation/);
    assert.match(html, /Save server action/);
    assert.doesNotMatch(html, /<fieldset[^>]*disabled|page-disabled-preview|Серверные данные этого раздела ещё не подключены/);
    assert.doesNotMatch(html, /data-demo-provider|Демонстрационный режим/);
  });
}
test('Demo keeps its own provider and mode notice when the Live preview wrapper is removed', () => {
  const html = render('/orders', true);
  assert.match(html, /data-demo-provider/);
  assert.match(html, /Демонстрационный режим/);
});
