// Explicit Live offline branches, against the real production Frontend. All API/external HTTP is blocked.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('/Users/alekspih/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:3002', out = __dirname;
const routes = ['/', '/search', '/category/programming', '/service/1', '/favorites', '/profile', '/profile/101', '/orders', '/orders/order-offline-smoke', '/orders/order-offline-smoke/additional-payment?serviceId=urgent', '/chats', '/chats/conversation-offline-smoke', '/create-service', '/welcome', '/register/roles', '/register/profile', '/register/performer', '/notifications', '/about', '/rules', '/safety', '/support', '/admin'];
const privateRoutes = new Set(['/profile', '/orders', '/orders/order-offline-smoke', '/chats', '/chats/conversation-offline-smoke']);
const result = { kind: 'Frontend Live offline branch regression; NOT Django E2E', djangoTested: false, startedAt: new Date().toISOString(), routes: [], blockedApi: [], pageErrors: [], hydrationErrors: [], pass: false,
  adjustedExpectation: 'Historical pre-integration runner expected h1 on every route. Existing LiveAccess anonymous/error branch renders h2#live-sign-in-title. This runner checks that exact closed branch, explicit message/retry and no private form; it does not accept arbitrary missing headings.' };
let browser;
(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) { result.blockedApi.push(url.pathname); return route.abort('blockedbyclient'); }
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== base ? route.abort('blockedbyclient') : route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('console', item => { if (item.type() === 'error' && /hydration|hydrating|Minified React error/i.test(item.text())) result.hydrationErrors.push(item.text()); });
    for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
      await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme });
      for (const route of routes) {
        const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' }); assert.equal(response.status(), 200);
        await page.locator('main#campus-content').waitFor();
        if (privateRoutes.has(route)) {
          await page.locator('#live-sign-in-title').waitFor(); await page.getByRole('button', { name: 'Повторить проверку входа', exact: true }).waitFor();
          await page.getByText('Не удалось связаться с сервером.', { exact: true }).waitFor();
          assert.equal(await page.locator('h1').count(), 0); assert.equal(await page.locator('main form').count(), 0);
        } else if (route === '/profile/101') {
          await page.locator('main [role="alert"]').waitFor(); await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).waitFor(); assert.equal(await page.locator('h1').count(), 0);
        } else { await page.locator('h1').waitFor(); assert.equal(await page.locator('h1').count(), 1); }
        const text = await page.locator('main').innerText();
        assert.doesNotMatch(text, /Демо Студент|Создайте локальный Demo-профиль|ADMIN SANDBOX · DEMO/);
        assert.equal(await page.locator('.demo-label').innerText(), 'LIVE');
        if (route.startsWith('/register/')) { assert.match(text, /Регистрация скоро появится/); assert.equal(await page.locator('main form').count(), 0); }
        if (route === '/admin') assert.match(text, /Раздел закрыт/);
        const geometry = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, topbar: document.querySelectorAll('header.topbar').length, width: innerWidth, scroll: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) }));
        assert.equal(geometry.main, 1); assert.equal(geometry.topbar, 1); assert.ok(geometry.scroll <= width + 1);
        assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.hydrationErrors, []);
        result.routes.push({ route, width, theme, pass: true, ...geometry });
        if (width === 390 && ['/profile', '/register/roles', '/admin'].includes(route)) await page.screenshot({ path: path.join(out, `offline-${route.replaceAll('/', '-')}.png`), fullPage: true });
      }
    }
    assert.equal(result.routes.length, 46); result.pass = true; console.log('PASS 46 Live offline route/viewport/theme combinations; exact closed session branches and gates');
  } catch (error) { result.error = String(error.stack ?? error); process.exitCode = 1; console.error(result.error); }
  finally { result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'browser-offline-results.json'), JSON.stringify(result, null, 2) + '\n'); await browser?.close(); }
})();
