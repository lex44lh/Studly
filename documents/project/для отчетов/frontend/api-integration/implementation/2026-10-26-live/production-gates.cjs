// Public Frontend HTML only. This script never calls Django or any /api endpoint.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:3002';
const result = { kind: 'Frontend production gate HTML checks', djangoTested: false, startedAt: new Date().toISOString(), checks: [] };
(async () => {
  try {
    for (const route of ['/register/roles', '/register/profile', '/register/performer']) {
      const response = await fetch(base + route, { redirect: 'error' });
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.ok(html.includes('Регистрация скоро появится'));
      assert.doesNotMatch(html, /id="(?:display-name|performer-description)"|name="roles"/);
      result.checks.push({ route, status: response.status, closed: true, pass: true });
    }
    const response = await fetch(base + '/admin', { redirect: 'error' });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes('Раздел закрыт'));
    assert.doesNotMatch(html, /Открыть тестовое рабочее место/);
    result.checks.push({ route: '/admin', status: response.status, closed: true, demoAdminFlag: 'enabled at Live build; no Live permission granted', pass: true });
    result.pass = true;
  } catch (error) { result.pass = false; result.error = String(error.stack || error); process.exitCode = 1; }
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'gates-live.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})();
