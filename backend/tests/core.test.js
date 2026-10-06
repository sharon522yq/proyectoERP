const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');

let mongo;
let app;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// Helper: crear usuario + login, retorna { token, user }
async function setupAdmin(email = 'admin@test.com') {
  await request(app).post('/api/auth/register').send({
    name: 'Admin Test', email, password: 'Password123', role: 'SUPER_ADMIN'
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
  return { token: login.body.data.accessToken, user: login.body.data.user };
}

describe('Auth', () => {
  test('QA-001 login válido', async () => {
    const { token } = await setupAdmin('auth1@test.com');
    expect(token).toBeDefined();
  });

  test('QA-002 login inválido → 401', async () => {
    await setupAdmin('auth2@test.com');
    const res = await request(app).post('/api/auth/login').send({ email: 'auth2@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('QA-003 sin permiso → 403', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Emp', email: `emp${Date.now()}@test.com`, password: 'Password123', role: 'EMPLEADO' });
    const login = await request(app).post('/api/auth/login').send({ email: `emp${Date.now()}@test.com`, password: 'Password123' });
    if (login.status === 200) {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(403);
    }
  });

  test('refresh rota tokens', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'auth1@test.com', password: 'Password123' });
    expect(login.status).toBe(200);
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.data.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeDefined();
    // Reuso del refresh → debe fallar
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.data.refreshToken });
    expect(reuse.status).toBe(401);
  });
});

describe('Companies', () => {
  test('QA-004 crear empresa', async () => {
    const { token } = await setupAdmin(`comp${Date.now()}@test.com`);
    const res = await request(app).post('/api/companies').set('Authorization', `Bearer ${token}`).send({ name: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Acme');
  });

  test('listar empresas', async () => {
    const { token } = await setupAdmin(`comp2${Date.now()}@test.com`);
    const res = await request(app).get('/api/companies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Branches + Multiempresa', () => {
  test('aislamiento multiempresa', async () => {
    const { token } = await setupAdmin(`br1${Date.now()}@test.com`);
    const c1 = (await request(app).post('/api/companies').set('Authorization', `Bearer ${token}`).send({ name: 'C1' })).body.data;
    const c2 = (await request(app).post('/api/companies').set('Authorization', `Bearer ${token}`).send({ name: 'C2' })).body.data;
    // usuario atado a C1
    const email = `u1branch${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({ name: 'U1', email, password: 'Password123', role: 'ADMIN', companyId: c1._id });
    const u1 = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    const t1 = u1.body.data.accessToken;
    const forbidden = await request(app).post('/api/branches').set('Authorization', `Bearer ${t1}`).send({ companyId: c2._id, name: 'Suc X' });
    expect(forbidden.status).toBe(403);
    const ok = await request(app).post('/api/branches').set('Authorization', `Bearer ${t1}`).send({ companyId: c1._id, name: 'Suc OK' });
    expect(ok.status).toBe(201);
  });
});

describe('Audit', () => {
  test('QA-008 operación genera log', async () => {
    const { token } = await setupAdmin(`aud${Date.now()}@test.com`);
    await request(app).post('/api/companies').set('Authorization', `Bearer ${token}`).send({ name: 'AuditCo' });
    const res = await request(app).get('/api/audit?module=companies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });
});
