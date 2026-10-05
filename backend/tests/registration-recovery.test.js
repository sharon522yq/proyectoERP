const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const User = require('../src/modules/users/user.model');
let mongo, app;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  app = createApp();
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
test('registro público ignora privilegios y valida duplicados', async () => {
  process.env.ALLOW_PRIVILEGED_REGISTER = 'false';
  try {
    const payload = { name: 'Cuenta pública', email: 'public@example.com', password: 'Password123', role: 'ADMIN', companyId: new mongoose.Types.ObjectId().toString() };
    const res = await request(app).post('/api/v1/auth/register').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('EMPLEADO');
    expect(res.body.data.user.companyId).toBeUndefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect((await request(app).post('/api/v1/auth/register').send(payload)).status).toBe(409);
    expect((await request(app).post('/api/v1/auth/register').send({ ...payload, email: 'invalid', password: 'short' })).status).toBe(400);
  } finally { delete process.env.ALLOW_PRIVILEGED_REGISTER; }
});
test('enlace nuevo invalida anterior, se consume una vez y revoca refresh', async () => {
  const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Reset Test', email: 'reset@example.com', password: 'Password123' });
  expect(reg.status).toBe(201);
  const forgot = () => request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset@example.com' });
  const old = (await forgot()).body.data.resetToken;
  const current = (await forgot()).body.data.resetToken;
  const reset = (token) => request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'NewPassword123' });
  expect((await reset(old)).status).toBe(400);
  expect((await reset(current)).status).toBe(200);
  expect((await reset(current)).status).toBe(400);
  expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.body.data.refreshToken })).status).toBe(401);
  expect((await request(app).post('/api/v1/auth/login').send({ email: 'reset@example.com', password: 'Password123' })).status).toBe(401);
  expect((await request(app).post('/api/v1/auth/login').send({ email: 'reset@example.com', password: 'NewPassword123' })).status).toBe(200);
  const expired = (await forgot()).body.data.resetToken;
  await User.updateOne({ email: 'reset@example.com' }, { $set: { resetExpires: new Date(0) } });
  expect((await reset(expired)).status).toBe(400);
});
