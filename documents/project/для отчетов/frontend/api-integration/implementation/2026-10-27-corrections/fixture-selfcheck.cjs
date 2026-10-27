/* eslint-disable @typescript-eslint/no-require-imports -- Exercise synthetic transport/schema validators only; never opens a browser or Django. */
const { createFixture } = require('./contract-fixtures.cjs');
(async () => {
  const fixture = createFixture(), base = 'http://127.0.0.1:3002'; let actor = 701, token;
  async function request(path, method = 'GET', body) {
    let response;
    await fixture.intercept({ request: () => ({ url: () => base + path, method: () => method, postData: () => body ? JSON.stringify(body) : null,
      postDataJSON: () => body, headers: () => ({ cookie: `studly_qa_actor=${actor}`, 'x-csrftoken': token }) }),
    fulfill: async value => { response = { status: value.status, body: JSON.parse(value.body || 'null') }; },
    continue: async () => {}, abort: async () => { throw new Error('Unexpected synthetic abort'); } }, base);
    return response;
  }
  for (const path of ['/api/v1/auth/me/', '/api/v1/auth/options/', '/api/v1/account/', '/api/v1/cabinet/?role=performer', '/api/v1/registration/',
    '/api/v1/performer/moderation/', '/api/v1/portfolio/', '/api/v1/specializations/', '/api/v1/favorites/', '/api/v2/my/services/', '/api/v2/services/811/']) await request(path);
  token = (await request('/api/v1/auth/csrf/')).body.csrf_token;
  await request('/api/v1/registration/', 'PATCH', { performer_revision: 2, profile: { display_name: 'Synthetic changed name' } });
  await request('/api/v1/portfolio/', 'POST', { revision: 3, request_key: 'aaaa0000-0000-4000-8000-000000000001', title: 'Synthetic work', url: 'https://example.com/work' });
  const quote = (await request('/api/v2/quotes/', 'POST', { service_id: 811, extra_ids: [fixture.extraId] })).body;
  fixture.state.failures.purchase = true;
  const intent = { quote_id: quote.quote_id, request_key: 'aaaa0000-0000-4000-8000-000000000002' };
  await request('/api/v2/orders/', 'POST', intent); await request('/api/v2/orders/', 'POST', intent);
  actor = 702; token = (await request('/api/v1/auth/csrf/')).body.csrf_token; fixture.state.failures.accept = true;
  const action = { revision: 1, request_key: 'aaaa0000-0000-4000-8000-000000000003' };
  await request('/api/v2/orders/851/accept/', 'POST', action); fixture.externalCancel(851);
  await request('/api/v2/orders/851/accept/', 'POST', action); await request('/api/v2/orders/851/');
  actor = 701; token = (await request('/api/v1/auth/csrf/')).body.csrf_token; fixture.state.failures.message = true;
  const message = { client_message_id: 'aaaa0000-0000-4000-8000-000000000004', text: 'Оплатим напрямую на карту' };
  const messagesPath = `/api/v1/conversations/${fixture.conversationId}/messages/`;
  await request(messagesPath, 'POST', message); fixture.releaseMessage(); await request(messagesPath, 'POST', message); await request(messagesPath);
  console.log(`Synthetic fixture/schema self-check PASS: ${fixture.state.requests.length} calls; browser/Django not executed`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
