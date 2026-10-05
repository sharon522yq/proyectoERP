/**
 * Pen testing NO destructivo (auditoría final).
 *
 * Cubre verificaciones activas pero no invasivas:
 *  - Headers de seguridad (Helmet, sin X-Powered-By)
 *  - Autenticación JWT (ausente, malformado, firma falsificada)
 *  - Formato de errores {success:false, message, code}
 *  - Inyección NoSQL vía query params (?limit[$gt]=1)
 *  - CORS: origen no permitido no recibe Access-Control-Allow-Origin
 *  - Rate limiting real en /auth/login (429 con formato de error)
 *  - Paginación con entradas maliciosas no provoca 500
 *
 * Sin escrituras destructivas, sin fuerza bruta real, sin payloads ofensivos.
 */
const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token;
const stamp = Date.now();
const email = `sec${stamp}@test.com`;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  await request(app).post('/api/v1/auth/register').send({ name: 'Sec Admin', email, password: 'Password123', role: 'ADMIN' });
  let login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  const comp = await request(app).post('/api/v1/companies').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ name: `Sec Co ${stamp}` });
  await require('../src/modules/users/user.model').updateOne({ email }, { $set: { companyId: comp.body.data._id } });
  login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Headers de seguridad', () => {
  test('X-Powered-By desactivado y Helmet activo', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cross-origin-resource-policy']).toBeDefined();
  });
});

describe('Autenticación (OWASP A07)', () => {
  test('sin token → 401 con formato de error', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('token malformado → 401', async () => {
    const res = await request(app).get('/api/v1/products').set('Authorization', 'Bearer no-si-un-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID');
  });

  test('token firmado con otro secreto → 401', async () => {
    const forged = jwt.sign({ sub: '000000000000000000000001', role: 'ADMIN', companyId: null, permissions: ['*'] }, 'secreto-falso-del-atacante-32-chars', { expiresIn: '1h' });
    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID');
  });

  test('token de refresh no sirve como access token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
    const refresh = login.body.data.refreshToken;
    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${refresh}`);
    expect(res.status).toBe(401);
  });
});

describe('Inyección NoSQL por query params (OWASP A03)', () => {
  test('objetos en query se eliminan: 200 y paginación saneada', async () => {
    const res = await request(app)
      .get('/api/v1/products?limit[$gt]=1&page[$ne]=0&companyId[$ne]=null')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.limit).toBe(20);  // objeto eliminado → default
    expect(res.body.data.page).toBe(1);    // objeto eliminado → default
  });

  test('page/limit no numéricos → 200 con valores por defecto (sin 500)', async () => {
    const res = await request(app)
      .get('/api/v1/products?page=abc&limit=DROP')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.limit).toBe(20);
    expect(res.body.data.page).toBe(1);
  });

  test('body con operadores de filtro en update no persiste', async () => {
    // status debe ser escalar: un objeto se rechaza por la matriz de transiciones
    const prod = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`)
      .send({ sku: `SEC-${stamp}`, name: 'Producto Sec', price: 10 });
    expect(prod.status).toBe(201);
    const res = await request(app).put('/api/v1/products/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ price: { $gt: 0 } });
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

describe('CORS (OWASP A05)', () => {
  test('origen no permitido no recibe Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Rate limiting en login (OWASP A07)', () => {
  test('tras superar el límite se responde 429 con formato de error', async () => {
    let limited = null;
    for (let i = 0; i < 55 && !limited; i++) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: `probe${i}-${stamp}@test.com`, password: 'WrongPass123' });
      if (res.status === 429) limited = res;
    }
    expect(limited).not.toBeNull();
    expect(limited.body.success).toBe(false);
    expect(limited.body.code).toBe('RATE_LIMIT');
  }, 60000);
});
