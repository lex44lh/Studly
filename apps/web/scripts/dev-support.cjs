/* eslint-disable @typescript-eslint/no-require-imports -- Node launcher, no compilation required. */
const net = require('node:net');

function launchOptions(args, env = process.env) {
  const [mode, ...rest] = args;
  if (!['demo', 'live'].includes(mode)) throw new Error('Используйте npm run dev:demo или npm run dev:live.');
  let port = env.PORT ?? '3000';
  let hostname = '127.0.0.1';
  const nextArgs = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--port' || arg === '-p') port = rest[++i];
    else if (arg === '--hostname' || arg === '-H') hostname = rest[++i];
    else if (arg === '--webpack' || arg === '--turbopack') nextArgs.push(arg);
    else throw new Error('Неизвестный параметр запуска. Поддерживаются --port, --hostname, --webpack, --turbopack.');
  }
  if (!/^\d+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535) throw new Error('PORT / --port должен быть числом от 1 до 65535.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) throw new Error('Локальный запуск поддерживает --hostname localhost, 127.0.0.1 или ::1.');
  return { mode, port: Number(port), hostname, nextArgs };
}

function backendOrigin(value) {
  let url;
  try { url = new URL(value ?? 'http://127.0.0.1:8000'); } catch { throw new Error('DJANGO_API_ORIGIN: нужен HTTP(S) origin, например http://127.0.0.1:8000.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('DJANGO_API_ORIGIN: только HTTP(S) origin, без /api/, пути, логина, пароля или параметров.');
  }
  return url.origin;
}

function freePort(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ port, host, exclusive: true }, () => server.close(error => error ? reject(error) : resolve()));
  });
}

async function assertPortAvailable(port) {
  for (const host of ['127.0.0.1', '::1']) {
    try { await freePort(port, host); } catch (error) {
      if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) continue;
      if (error.code === 'EADDRINUSE') throw new Error(`Порт ${port} занят. Остановите прежний сервер через Ctrl+C. Для проверки: lsof -nP -iTCP:${port} -sTCP:LISTEN. Другой порт автоматически не выбирается.`);
      throw new Error(`Не удалось проверить порт ${port} (${error.code ?? 'ошибка сети'}).`);
    }
  }
}

async function jsonGet(base, path, { fetcher = fetch, signal, timeout = 5000 } = {}) {
  let response;
  try {
    response = await fetcher(base + path, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) });
  } catch (error) {
    const reason = ['TimeoutError', 'AbortError'].includes(error.name) ? 'таймаут или остановка' : error.cause?.code ?? 'нет соединения';
    throw new Error(`GET ${path}: ${reason}. Проверьте адрес Django и запущен ли сервер.`);
  }
  let json;
  try { json = await response.json(); } catch { throw new Error(`GET ${path}: HTTP ${response.status}, ожидался JSON. Проверьте API proxy, а не HTML-страницу.`); }
  return { status: response.status, json, cookie: response.headers.get('set-cookie') ?? '' };
}

function serviceValid(s) {
  return s && Number.isSafeInteger(s.id) && s.id > 0 && typeof s.title === 'string' && typeof s.description === 'string'
    && typeof s.price_amount === 'string' && /^\d+\.\d{2}$/.test(s.price_amount) && s.currency === 'RUB'
    && Number.isInteger(s.duration_days) && s.duration_days > 0 && s.performer && Number.isSafeInteger(s.performer.id)
    && typeof s.performer.name === 'string' && Array.isArray(s.included) && s.included.every(x => typeof x === 'string') && typeof s.is_demo === 'boolean';
}

async function checkApi(base, { session = false, ...options } = {}) {
  const paths = ['/api/v1/health/', '/api/v1/ready/', '/api/v1/services/', '/api/v1/auth/options/'];
  const results = await Promise.all(paths.map(path => jsonGet(base, path, options)));
  for (let i = 0; i < results.length; i++) {
    if (results[i].status !== 200) throw new Error(`GET ${paths[i]}: HTTP ${results[i].status}.${i === 1 ? ' PostgreSQL ещё не готова; проверьте Django ready и Docker db.' : ' Live не готов.'}`);
  }
  if (results[0].json?.status !== 'ok' || results[1].json?.status !== 'ok') throw new Error('Django health/ready не подтвердили готовность. Live не готов.');
  const page = results[2].json;
  const validPageLink = value => {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    try { return new URL(value, base).pathname === '/api/v1/services/'; } catch { return false; }
  };
  if (!page || !Number.isSafeInteger(page.count) || page.count < 0 || !Array.isArray(page.results) || page.count < page.results.length || !page.results.every(serviceValid) || !validPageLink(page.next) || !validPageLink(page.previous)) throw new Error('Каталог Django вернул несовместимый формат. Demo-данные не подставляются.');
  const auth = results[3].json;
  if (typeof auth?.telegram_mini_app !== 'boolean' || typeof auth?.telegram_website !== 'boolean') throw new Error('Не подтверждён контракт auth/options Django. Live не готов.');
  if (session) {
    const csrf = await jsonGet(base, '/api/v1/auth/csrf/', options);
    if (csrf.status !== 200 || typeof csrf.json?.csrf_token !== 'string' || !csrf.json.csrf_token || !/(?:^|[,;]\s*)csrftoken=/i.test(csrf.cookie) || !/httponly/i.test(csrf.cookie)) throw new Error('Proxy /auth/csrf/ не подтвердил JSON и HttpOnly CSRF-cookie. Вход не проверен; Live не готов.');
    const me = await jsonGet(base, '/api/v1/auth/me/', options);
    if (![200, 401, 403].includes(me.status) || (me.status === 200 && !Number.isSafeInteger(me.json?.user?.id)) || !me.json || typeof me.json !== 'object') throw new Error('Proxy /auth/me/ недоступен. Для гостя ожидается 401/403, для сессии — JSON user.');
  }
  return { miniApp: auth.telegram_mini_app, website: auth.telegram_website, count: page.count };
}

module.exports = { launchOptions, backendOrigin, assertPortAvailable, checkApi };
