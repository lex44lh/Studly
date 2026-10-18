/* eslint-disable @typescript-eslint/no-require-imports -- Node loads the isolated pure TypeScript model. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, '../src/lib/catalog/search.ts');
const model = new Module(file, module);
model._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { filterSearchServices, validatePriceRange, searchRequestQuery } = model.exports;

const source = [
  { id: 1, title: 'Python', description: 'Разбор кода', seller: 'Иван', category: 'Код', priceNumber: 500, durationDays: 1, rating: '4.6 (2 отзыва)' },
  { id: 2, title: 'Математика', description: 'Помощь с Python', seller: 'Анна', category: 'Задачи', priceNumber: 900, durationDays: 3, rating: '4.9 (20 отзывов)' },
  { id: 3, title: 'Python и анализ данных', description: 'Практика', seller: 'Олег', category: 'Код', priceNumber: 1500, durationDays: 7, rating: '4.8 (5 отзывов)' },
];
const defaults = { query: '', category: '', minPrice: '', maxPrice: '', duration: 'any', rating47: false, sort: 'relevance' };
const ids = rows => rows.map(row => row.id);

test('demo searches metadata without case/outer spaces and ranks title matches first', () => {
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, query: '  PYTHON  ' }, true)), [1, 3, 2]);
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, query: 'анна' }, true)), [2]);
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, category: 'Код' }, true)), [1, 3]);
  assert.deepEqual(ids(source), [1, 2, 3]);
});
test('valid price bounds include endpoints, zero and duration filters', () => {
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, minPrice: '500', maxPrice: '900', duration: '3' }, true)), [1, 2]);
  assert.equal(validatePriceRange('0', '').min, 0);
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, duration: '1' }, true)), [1]);
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, duration: '7' }, true)), [1, 2, 3]);
});
test('invalid ranges expose errors and never silently apply a single price bound', () => {
  for (const [minPrice, maxPrice] of [['-1', '900'], ['1500', '900'], ['invalid', '900'], ['', 'Infinity']]) {
    assert.ok(validatePriceRange(minPrice, maxPrice).error);
    assert.deepEqual(ids(filterSearchServices(source, { ...defaults, minPrice, maxPrice }, true)), [1, 2, 3]);
  }
  assert.equal(validatePriceRange('', '').error, '');
});
test('rating and sorting use demo metadata without mutating source order', () => {
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, rating47: true, sort: 'rating' }, true)), [2, 3]);
  assert.deepEqual(ids(filterSearchServices(source, { ...defaults, sort: 'priceDesc' }, true)), [3, 2, 1]);
  assert.deepEqual(ids(filterSearchServices([...source].reverse(), { ...defaults, sort: 'duration' }, true)), [1, 2, 3]);
  assert.deepEqual(ids(filterSearchServices([...source].reverse(), { ...defaults, sort: 'priceAsc' }, true)), [1, 2, 3]);
  assert.deepEqual(ids(source), [1, 2, 3]);
});
test('live keeps Django search results, ignores unavailable categories/rating and filters only its supplied page', () => {
  const page = source.slice(0, 2);
  assert.deepEqual(ids(filterSearchServices(page, { ...defaults, query: 'no match', category: 'none', rating47: true, sort: 'rating' }, false)), [1, 2]);
  assert.deepEqual(ids(filterSearchServices(page, { ...defaults, minPrice: '700', sort: 'priceDesc' }, false)), [2]);
});
test('pagination query is retained only for its originating search', () => {
  const page = { search: 'python', query: 'search=Python&page=2' };
  assert.equal(searchRequestQuery(' Python ', page), 'search=Python&page=2');
  assert.equal(searchRequestQuery('математика', page), new URLSearchParams({ search: 'математика' }).toString());
  assert.equal(searchRequestQuery('', page), 'search=');
});
