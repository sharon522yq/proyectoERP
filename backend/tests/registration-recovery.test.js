const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const User = require('../src/modules/users/user.model');
let mongo, app;
beforeAll(async () => {
  mongo = await createTestDatabase();
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

test('administrador global asigna empresa y registra auditoría', async () => {
  const admin = await request(app).post('/api/v1/auth/register').send({ name: 'Global Admin', email: 'global@example.com', password: 'Password123', role: 'SUPER_ADMIN' });
  const auth = { Authorization: `Bearer ${admin.body.data.accessToken}` };
  const company = (await request(app).post('/api/v1/companies').set(auth).send({ name: 'Empresa acceso' })).body.data;
  const user = await User.findOne({ email: 'public@example.com' });
  const assign = await request(app).put(`/api/v1/users/${user._id}`).set(auth).send({ companyId: company._id });
  expect(assign.status).toBe(200);
  expect(assign.body.data.companyId).toBe(company._id);
  const audits = await request(app).get('/api/v1/audit?module=users').set(auth);
  expect(audits.status).toBe(200);
  expect(audits.body.data.total).toBeGreaterThan(0);
  const other = (await request(app).post('/api/v1/companies').set(auth).send({ name: 'Otra empresa' })).body.data;
  expect((await request(app).put(`/api/v1/users/${user._id}`).set(auth).send({ companyId: other._id })).status).toBe(409);
  const invalid = await request(app).put(`/api/v1/users/${user._id}`).set(auth).send({ companyId: new mongoose.Types.ObjectId().toString() });
  expect(invalid.status).toBe(409);
});

test('administrador de empresa no accede a cuentas públicas ni las reclama', async () => {
  const Company = require('../src/modules/companies/company.model');
  const company = await Company.findOne({ name: 'Empresa acceso' });
  const admin = await request(app).post('/api/v1/auth/register').send({ name: 'Scoped Admin', email: 'scoped@example.com', password: 'Password123', role: 'ADMIN', companyId: company._id });
  const auth = { Authorization: `Bearer ${admin.body.data.accessToken}` };
  const pending = await request(app).post('/api/v1/auth/register').send({ name: 'Pending Account', email: 'pending@example.com', password: 'Password123' });
  const id = pending.body.data.user._id;
  expect((await request(app).get(`/api/v1/users/${id}`).set(auth)).status).toBe(403);
  expect((await request(app).put(`/api/v1/users/${id}`).set(auth).send({ companyId: company._id })).status).toBe(403);
  expect((await request(app).delete(`/api/v1/users/${id}`).set(auth)).status).toBe(403);
});

test('empresa inexistente no se asigna a cuenta pendiente', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'global@example.com', password: 'Password123' });
  const user = await User.findOne({ email: 'pending@example.com' });
  expect((await request(app).put(`/api/v1/users/${user._id}`).set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ companyId: new mongoose.Types.ObjectId().toString() })).status).toBe(400);
});
