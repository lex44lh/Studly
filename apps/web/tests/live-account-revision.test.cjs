/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the actual account revision coordinator without a browser. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function chain() {
  const file = path.resolve(__dirname, '../src/features/live-account/revisions.ts');
  const fixture = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name === '@/lib/api/account' ? { accountClient: {} } : require(name), fixture, fixture.exports);
  return fixture.exports.createOwnRevisionChain();
}
test('account revision chain advances an old dirty form through consecutive acknowledged own writes only', () => {
  const revisions = chain(); assert.equal(revisions.resolve(4), 4);
  revisions.confirm(4, 5); revisions.confirm(5, 6);
  assert.equal(revisions.resolve(4), 6); assert.equal(revisions.resolve(5), 6); assert.equal(revisions.resolve(6), 6);
});
test('account revision chain never bridges an unowned revision between two successful own operations', () => {
  const revisions = chain(); revisions.confirm(4, 5); revisions.confirm(6, 7);
  assert.equal(revisions.resolve(4), 5); assert.equal(revisions.resolve(5), 5); assert.equal(revisions.resolve(6), 7);
});
test('account revision chain accepts a canonical no-op without inventing advancement or erasing a proven later transition', () => {
  const revisions = chain(); revisions.confirm(4, 4); assert.equal(revisions.resolve(4), 4);
  revisions.confirm(4, 5); revisions.confirm(5, 6); revisions.confirm(4, 5);
  try { revisions.confirm(4, 4); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(revisions.resolve(4), 6); assert.equal(revisions.resolve(5), 6);
});
test('account revision chain rejects or ignores malformed, backward and unexplained multi-revision acknowledgements', () => {
  const revisions = chain(); revisions.confirm(4, 5);
  for (const [from, to] of [[5, 7], [5, 4], [5, 5.5], [NaN, 6], [5, Infinity], [0, 1], [-1, 0]]) {
    try { revisions.confirm(from, to); } catch (error) { assert.ok(error instanceof Error); }
  }
  assert.equal(revisions.resolve(4), 5); assert.equal(revisions.resolve(5), 5);
});
test('account revision chain is local to its mounted account, and a new mount starts with no inherited promotion', () => {
  const firstAccount = chain(); firstAccount.confirm(4, 5);
  const secondAccount = chain(); const reloadedAccount = chain();
  assert.equal(firstAccount.resolve(4), 5); assert.equal(secondAccount.resolve(4), 4); assert.equal(reloadedAccount.resolve(4), 4);
});
