// UI contract fixture only. Never deploy as Django or point production at it.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test fixture. */
if (process.env.STUDLY_ALLOW_TEST_FIXTURE !== '1') throw new Error('Test-only fixture requires explicit opt-in');
const http = require('node:http');
let registration = {
  roles: [], profile: { display_name: 'Тестовый пользователь', avatar_url: null, university: '', city: '', about: '' }, performer: null,
  progress: { current_step: 'roles', performer_skipped: false, updated_at: null },
  status: { is_complete: false, completed_at: null, missing_fields: ['roles'], performer_ready: false, performer_missing_fields: ['performer.specialization_ids'] },
};
const service = { id: 42, title: 'Тестовая консультация', description: 'Данные HTTP-фикстуры для проверки интерфейса',
  price_amount: '1000.00', currency: 'RUB', duration_days: 3, performer: { id: 7, name: 'Тестовый исполнитель' }, included: ['Консультация'], is_demo: true };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
  const route = url.pathname;
  if (route === '/api/v1/auth/me/') { res.setHeader('Set-Cookie', 'fixture_session=test-only; HttpOnly; SameSite=Lax; Path=/'); return send({ user: { id: 999, display_name: 'Тестовый пользователь', telegram_username: 'fixture' } }); }
  if (route === '/api/v1/auth/options/') return send({ telegram_mini_app: false, telegram_website: false });
  if (route === '/api/v1/auth/csrf/') { res.setHeader('Set-Cookie', 'fixture_csrf=test-only; HttpOnly; SameSite=Lax; Path=/'); return send({ csrf_token: 'fixture-token' }); }
  if (['PATCH', 'POST', 'DELETE'].includes(req.method) && req.headers['x-csrftoken'] !== 'fixture-token') return send({ code: 'csrf_failed' }, 403);
  if (route === '/api/v1/registration/' && req.method === 'PATCH') {
    let body = ''; for await (const chunk of req) body += chunk;
    const patch = JSON.parse(body);
    if (patch.roles) registration.roles = patch.roles;
    for (const key of ['profile', 'progress']) if (patch[key]) registration[key] = { ...registration[key], ...patch[key] };
    if (patch.performer) registration.performer = { ...patch.performer, specializations: [] };
    registration.status.missing_fields = registration.roles.length && registration.profile.display_name.trim() ? [] : ['roles'];
    console.log('fixture PATCH registration'); return send(registration);
  }
  if (route === '/api/v1/registration/complete/') {
    registration.status.is_complete = true; registration.status.completed_at = new Date().toISOString();
    console.log('fixture POST complete'); return send(registration);
  }
  if (route === '/api/v1/registration/') return send(registration);
  if (route === '/api/v1/specializations/') return send({ count: 0, next: null, previous: null, results: [] });
  if (route === '/api/v1/services/') {
    const search = url.searchParams.get('search') ?? '';
    const results = search && !service.title.includes(search) ? [] : [service];
    return send({ count: results.length, next: null, previous: null, results });
  }
  if (route === '/api/v1/services/42/') return send(service);
  if (route === '/api/v1/services/42/quote/') return send({ service_id: 42, service_revision: 1, price_amount: '1000.00', currency: 'RUB', is_demo: true, buyer_fee_percent: '3.00', buyer_fee_amount: '30.00', total_amount: '1030.00' });
  if (route === '/api/v1/performers/7/') return send({ id: 7, name: 'Тестовый исполнитель', about: 'Тестовый профиль' });
  return send({ detail: 'Not found' }, 404);
});
server.listen(18000, '127.0.0.1', () => console.log('TEST FIXTURE only: http://127.0.0.1:18000'));
