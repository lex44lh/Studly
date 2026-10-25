// Synthetic, read-only frontend QA fixture. Never deploy or use as Django.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone test-only Node server. */
if (process.env.STUDLY_ALLOW_TEST_FIXTURE !== '1') throw new Error('Explicit test-only opt-in required');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let attempts = 0;
const service = id => ({ id, title: id === 42 ? 'Консультация по Python' : id === 44 ? 'ДлинноеНазваниеБезПробелов'.repeat(8) : 'Проверочная услуга', description: id === 43 ? '' : 'Синтетическая HTTP-фикстура. Не настоящее предложение.\nОбсудим вопросы и разберём примеры.', price_amount: '1000.00', currency: 'RUB', duration_days: 3, performer: { id: 7, name: id === 43 ? '' : 'Тестовый исполнитель' }, included: id === 43 ? [] : ['Разбор вопросов', 'Практические примеры'], is_demo: id === 43 });
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
  if (u.pathname === '/api/v1/__qa/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(__dirname, 'platform-preview.html'))); return; }
  if (req.method !== 'GET') return send({ detail: 'Test-only: read requests only' }, 405);
  if (u.pathname === '/api/v1/auth/me/') return send({ detail: 'No session' }, 403);
  if (u.pathname === '/api/v1/auth/options/') return send({ telegram_mini_app: false, telegram_website: false });
  if (u.pathname === '/api/v1/services/') return send({ count: 1, next: null, previous: null, results: [service(42)] });
  if (u.pathname === '/api/v1/performers/7/') return send({ id: 7, name: 'Тестовый исполнитель', about: 'Синтетический профиль' });
  const match = u.pathname.match(/^\/api\/v1\/services\/(\d+)\/(quote\/)?$/);
  if (!match) return send({ detail: 'Not found' }, 404);
  const id = Number(match[1]);
  if ([401, 403, 404, 500].includes(id)) return send({ detail: 'Fixture error' }, id);
  if (id === 501 && !match[2] && attempts++ === 0) return send({ detail: 'Retry fixture' }, 500);
  if (id === 502) { res.end('<not-json>'); return; }
  if (id === 503) return send({ id });
  if (match[2]) {
    if (id === 45) return send({ detail: 'Quote not available' }, 500);
    if (id === 46) return send({ detail: 'Quote not found' }, 404);
    if (id === 47) return send({ service_id: id });
    return send({ service_id: id, service_revision: 1, price_amount: '1000.00', currency: 'RUB', is_demo: id === 43, buyer_fee_percent: '3.00', buyer_fee_amount: '30.00', total_amount: '1030.00' });
  }
  if (id === 48) { setTimeout(() => send(service(id)), 2500); return; }
  if (id === 49) { setTimeout(() => send(service(id)), 20000); return; }
  return send(service(id));
}).listen(18003, '127.0.0.1', () => console.log('TEST-ONLY read fixture on 18003'));
