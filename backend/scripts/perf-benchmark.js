/**
 * Benchmark de rendimiento — mide latencias HTTP reales contra el servidor
 * de producción (src/server.js) con MongoDB en memoria.
 *
 * Uso: node scripts/perf-benchmark.js
 *
 * No destructivo: solo lecturas + setup mínimo. Respeta el rate limit global
 * (300 req/15 min) manteniendo el total de peticiones por debajo del límite.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');

const N = Number(process.env.PERF_N) || 60; // peticiones por endpoint
const PORT = Number(process.env.PERF_PORT) || 4789;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function log(msg) { console.log(`[+${((performance.now() / 1000).toFixed(1))}s] ${msg}`); }

// Watchdog: aborta a los 240s si algo se cuelga (evita procesos colgados)
setTimeout(() => { console.error('[watchdog] benchmark abortado a los 240s'); process.exit(2); }, 240000);

async function waitForHealth(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('El servidor no respondió /health a tiempo');
}

async function json(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    n: sorted.length,
    avg: +(sum / sorted.length).toFixed(2),
    p50: +pct(50).toFixed(2),
    p95: +pct(95).toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
    min: +sorted[0].toFixed(2)
  };
}

async function measure(label, fn) {
  const samples = [];
  let errors = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    try {
      const { status } = await fn();
      if (status >= 400) errors++;
    } catch { errors++; }
    samples.push(performance.now() - t0);
  }
  return { endpoint: label, errors, ...stats(samples) };
}

async function main() {
  log(`N=${N} por endpoint, port=${PORT}`);
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  log('MongoMemoryServer listo');

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: uri, PORT: String(PORT), NODE_ENV: 'development', ALLOW_PRIVILEGED_REGISTER: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  const results = [];
  try {
    await waitForHealth();
    log('Servidor /health OK');

    // ---- Setup mínimo ----
    const email = `perf${stamp}@test.com`;
    await json('POST', '/api/v1/auth/register', { body: { name: 'Perf Admin', email, password: 'Password123', role: 'ADMIN' } });
    let login = await json('POST', '/api/v1/auth/login', { body: { email, password: 'Password123' } });
    const comp = await json('POST', '/api/v1/companies', { token: login.data.data.accessToken, body: { name: `Perf Co ${stamp}` } });
    // asignar companyId al usuario (como hacen los tests) y obtener token con empresa
    const mongoose = require('mongoose');
    await mongoose.connect(uri);
    await require('../src/modules/users/user.model').updateOne({ email }, { $set: { companyId: comp.data.data._id } });
    await mongoose.disconnect();
    login = await json('POST', '/api/v1/auth/login', { body: { email, password: 'Password123' } });
    const token2 = login.data.data.accessToken;

    // Warmup (primera petición incluye conexión Mongo en frío)
    await json('GET', '/health');
    await json('GET', '/api/v1/products', { token: token2 });

    // ---- Mediciones ----
    log('Iniciando mediciones...');
    results.push(await measure('GET /health (sin auth)', () => json('GET', '/health')));
    log('medido /health');
    results.push(await measure('GET /api/v1/products?limit=20', () => json('GET', '/api/v1/products?page=1&limit=20', { token: token2 })));
    log('medido /products');
    results.push(await measure('GET /api/v1/sales/orders?limit=20', () => json('GET', '/api/v1/sales/orders?page=1&limit=20', { token: token2 })));
    log('medido /sales/orders');
    results.push(await measure('GET /api/v1/dashboard (agrega 6 módulos)', () => json('GET', '/api/v1/dashboard', { token: token2 })));
    log('medido /dashboard');

    console.log('\n=== RESULTADOS (ms) ===');
    console.table(results);
    console.log('Total peticiones medida:', results.length * N);
  } catch (err) {
    console.error('[perf] ERROR:', err.message);
    console.error('[perf] server log:\n', serverLog.slice(-2000));
    process.exitCode = 1;
  } finally {
    server.kill();
    await mongo.stop();
    log('Servidor y Mongo detenidos');
  }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e); process.exit(1); });
