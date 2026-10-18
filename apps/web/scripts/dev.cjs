/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local Node launcher. */
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');
const { loadEnvConfig } = require('@next/env'); // Already supplied by the installed Next.js dependency.
const { launchOptions, backendOrigin, assertPortAvailable, checkApi } = require('./dev-support.cjs');

const webRoot = path.resolve(__dirname, '..');
const stopped = new AbortController();
let child;
let stopCode = 0;
let killTimer;
function stop(code = 0) {
  stopCode = code;
  stopped.abort();
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    killTimer ??= setTimeout(() => child?.kill('SIGKILL'), 5000).unref();
  }
}
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

async function run() {
  // PORT comes from the invoking shell / CLI, as with next dev; not from .env.
  const options = launchOptions(process.argv.slice(2));
  process.env.NODE_ENV = 'development';
  loadEnvConfig(webRoot, true, { info() {}, error() { console.error('Не удалось загрузить .env Next.js. Проверьте файл; секреты не выводятся.'); } });
  if (process.env.NEXT_PUBLIC_STUDLY_DATA_MODE === 'api') console.warn('Устаревший режим api означает LIVE. Команда запуска явно выбирает ' + options.mode.toUpperCase() + '; .env не перезаписывается.');
  process.env.NEXT_PUBLIC_STUDLY_DATA_MODE = options.mode;
  const backend = options.mode === 'live' ? backendOrigin(process.env.DJANGO_API_ORIGIN) : 'http://127.0.0.1:8000';
  // Pin the exact checked origin; the child must not resolve a different default.
  process.env.DJANGO_API_ORIGIN = backend;
  await assertPortAvailable(options.port);
  if (options.mode === 'live') {
    console.log('STUDLY — проверяем LIVE: Django HTTP, PostgreSQL ready, каталог и auth/options…');
    try { await checkApi(backend, { signal: stopped.signal }); } catch (error) {
      throw new Error(`${error.message}\nDjango: ${backend}\nЗапустите Backend отдельно по LOCAL_START.md. Next.js не запущен; автоматического перехода в Demo нет.`);
    }
  } else console.log('STUDLY — запускаем DEMO; Django не требуется…');
  if (stopped.signal.aborted) return;
  const executable = require.resolve('next/dist/bin/next');
  child = spawn(process.execPath, [executable, 'dev', '--hostname', options.hostname, '--port', String(options.port), ...options.nextArgs], { cwd: webRoot, env: process.env, stdio: ['inherit', 'pipe', 'pipe'] });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => { if (killTimer) clearTimeout(killTimer); resolve(stopped.signal.aborted ? stopCode : code ?? (signal ? 1 : 0)); });
  });
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', line => {
      // Only our successful GET checks announce application readiness.
      if (!/Ready in|Local:|Network:/.test(line)) console.log(line);
    });
  }
  const origin = `http://${options.hostname === '::1' ? '[::1]' : options.hostname}:${options.port}`;
  const frontendReady = (async () => {
    const until = Date.now() + 60000;
    while (!stopped.signal.aborted && Date.now() < until) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('Next.js завершился до готовности. См. сообщение выше; старый .next/dev/lock не удаляется автоматически.');
      let ready = false;
      try {
        const response = await fetch(origin + '/search', { signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(5000)]), redirect: 'manual' });
        ready = response.status === 200 && (await response.text()).includes('STUDLY');
      } catch { /* The dev server may still be starting; retry until the deadline. */ }
      if (ready) {
        if (options.mode === 'live') {
          console.log('Next.js отвечает; проверяем /api/ через тот же origin и CSRF-cookie…');
          const auth = await checkApi(origin, { session: true, signal: stopped.signal });
          if (!auth.miniApp && !auth.website) console.warn('Django не объявил настроенный Telegram-вход. Публичный API доступен; аккаунт не авторизован.');
        }
        if (!stopped.signal.aborted) {
          console.log(`\nSTUDLY — ${options.mode.toUpperCase()} MODE\nhttp://localhost:${options.port}`);
          console.log(options.mode === 'demo' ? 'Демонстрационные данные. Настоящие заказы и платежи не выполняются.' : 'Django и API proxy проверены GET-запросами. Вход пользователя требует настоящего Telegram и не подтверждается этой проверкой.');
          console.log('Открыть каталог: /search. Остановить: Ctrl+C. После смены режима или окружения перезапустите сервер.\n');
        }
        return;
      }
      await delay(250, undefined, { signal: stopped.signal }).catch(() => {});
    }
    if (!stopped.signal.aborted) throw new Error('Next.js не подтвердил готовность /search за60секунд. Проверьте ошибки сборки и .next/dev/lock; Live готовым не объявлен.');
  })();
  try {
    // Child failure must not leave a readiness loop or an orphaned Next process.
    await Promise.race([frontendReady, completion.then(code => { if (!stopped.signal.aborted) throw new Error(`Next.js остановлен до завершения проверки (код ${code}).`); })]);
  } catch (error) { stop(1); await completion; throw error; }
  process.exitCode = await completion;
}
run().catch(error => {
  if (stopped.signal.aborted && stopCode === 0) { process.exitCode = 0; return; }
  console.error('\nSTUDLY — запуск остановлен\n' + error.message);
  stop(1);
  process.exitCode = 1;
});
