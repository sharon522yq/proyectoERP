const mongoose = require('mongoose');
const request = require('supertest');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const User = require('../src/modules/users/user.model');
const setup = require('../src/modules/auth/setup.service');
let db, app, access, refresh;
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri());
  process.env.INITIAL_SETUP_TOKEN = 's'.repeat(40); app = createApp();
}, 60000);
afterAll(async () => { delete process.env.INITIAL_SETUP_TOKEN; await mongoose.disconnect(); await db.stop(); });
test('configuración exige código y crea una empresa con administrador', async () => {
  const data = { name: 'Responsable', companyName: 'Empresa prueba', email: 'owner@example.com', password: 'Password123' };
  expect((await request(app).post('/api/v1/auth/setup').send(data)).status).toBe(404);
  await expect(setup.initialize(data, '')).rejects.toMatchObject({ code: 'SETUP_FORBIDDEN' });
  expect((await setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)).created).toBe(true);
  const user = await User.findOne({ email: data.email });
  expect(user.role).toBe('ADMIN'); expect(user.companyId).toBeTruthy();
  expect((await setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)).created).toBe(false);
  await expect(setup.initialize({ ...data, companyName: 'Conflicting company' }, process.env.INITIAL_SETUP_TOKEN)).rejects.toMatchObject({ code: 'SETUP_CONFLICT' });
});
test('me devuelve permisos y desactivación invalida access emitido', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@example.com', password: 'Password123' });
  access = login.body.data.accessToken; refresh = login.body.data.refreshToken;
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`)).status).toBe(200);
  await User.updateOne({ email: 'owner@example.com' }, { active: false });
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`)).status).toBe(401);
  await User.updateOne({ email: 'owner@example.com' }, { active: true });
});
test('un refresh concurrente solo tiene un ganador', async () => {
  const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh })));
  expect(results.map(r => r.status).sort()).toEqual([200, 401]);
});
test('logout revoca access inmediatamente', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@example.com', password: 'Password123' });
  access = login.body.data.accessToken;
  expect((await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${access}`).send({})).status).toBe(200);
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`)).status).toBe(401);
});
test('token de reset solo puede usarse una vez y revoca access', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@example.com', password: 'Password123' });
  const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'owner@example.com' });
  const body = { token: forgot.body.data.resetToken, newPassword: 'Changed123' };
  expect((await request(app).post('/api/v1/auth/reset-password').send(body)).status).toBe(200);
  expect((await request(app).post('/api/v1/auth/reset-password').send(body)).status).toBe(400);
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`)).status).toBe(401);
});
