const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const setup = require('../src/modules/auth/setup.service');
const User = require('../src/modules/users/user.model');
const Company = require('../src/modules/companies/company.model');
const Role = require('../src/modules/roles/role.model');
const { ensureSeeded } = require('../src/modules/roles/role.service');
let db, app;
const password = crypto.randomBytes(24).toString('hex');
const data = { name: 'Synthetic owner', email: 'owner@example.invalid', companyName: 'Synthetic company', password };
beforeAll(async () => { db = await createTestDatabase(); await mongoose.connect(db.getUri()); app = createApp(); }, 60000);
afterAll(async () => { delete process.env.INITIAL_SETUP_TOKEN; await mongoose.disconnect(); if (db) await db.stop(); });
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); process.env.INITIAL_SETUP_TOKEN = crypto.randomBytes(32).toString('hex'); });
test('bootstrap concurrency has one company and ADMIN account, no global owner', async () => {
  const results = await Promise.allSettled([1, 2].map(() => setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)));
  expect(results.some(r => r.status === 'fulfilled')).toBe(true);
  expect(await User.countDocuments()).toBe(1);
  expect(await Company.countDocuments()).toBe(1);
  expect(await User.countDocuments({ role: 'SUPER_ADMIN' })).toBe(0);
  expect((await setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)).created).toBe(false);
});
test('company-only destination rejects bootstrap and rolls back marker and user', async () => {
  await Company.create({ name: 'Existing company' });
  await expect(setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)).rejects.toMatchObject({ code: 'SETUP_COMPLETE' });
  expect(await User.countDocuments()).toBe(0);
  expect(await mongoose.connection.collection('initial_setup').countDocuments()).toBe(0);
});
test('conflicting role rolls back company, user, marker and audit', async () => {
  await Role.create({ name: 'ADMIN', permissions: ['*'] });
  await expect(setup.initialize(data, process.env.INITIAL_SETUP_TOKEN)).rejects.toMatchObject({ code: 'SETUP_CONFLICT' });
  expect(await Company.countDocuments()).toBe(0);
  expect(await User.countDocuments()).toBe(0);
  expect(await mongoose.connection.collection('initial_setup').countDocuments()).toBe(0);
  expect(await mongoose.connection.collection('audit_logs').countDocuments()).toBe(0);
});
test('company-less account cannot access any operational module even with ADMIN permissions', async () => {
  await ensureSeeded();
  const account = await request(app).post('/api/v1/auth/register').send({ ...data, role: 'ADMIN' });
  const headers = { Authorization: 'Bearer ' + account.body.data.accessToken };
  expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(200);
  for (const path of ['users','roles','companies','branches','audit','settings','crm/leads','products','inventory/stock','sales/quotes','purchases','finance/accounts','hr/employees','projects','production/orders','ai/health']) {
    const response = await request(app).get('/api/v1/' + path).set(headers);
    expect({ path, status: response.status }).toEqual({ path, status: 403 });
  }
  const dashboard = await request(app).get('/api/v1/dashboard').set(headers);
  expect(dashboard.status).toBe(200); expect(dashboard.body.data).toEqual({});
});
test('password change revokes access and refresh and permits new login', async () => {
  await setup.initialize(data, process.env.INITIAL_SETUP_TOKEN);
  const login = (await request(app).post('/api/v1/auth/login').send({ email: data.email, password })).body.data;
  const headers = { Authorization: 'Bearer ' + login.accessToken };
  const changed = await request(app).post('/api/v1/auth/change-password').set(headers).send({ currentPassword: password, newPassword: password + 'A' });
  expect(changed.status).toBe(200);
  expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(401);
  expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.refreshToken })).status).toBe(401);
  expect((await request(app).post('/api/v1/auth/login').send({ email: data.email, password: password + 'A' })).status).toBe(200);
});
test('bcrypt byte limit rejects truncation collisions', async () => {
  await ensureSeeded();
  expect((await request(app).post('/api/v1/auth/register').send({ ...data, password: 'á'.repeat(37) })).status).toBe(400);
});

test('concurrent company assignment has one winner and preserves revocation', async () => {
  await ensureSeeded();
  const target = (await request(app).post('/api/v1/auth/register').send({ ...data })).body.data;
  const companies = await Company.create([{ name: 'Company A' }, { name: 'Company B' }]);
  const service = require('../src/modules/users/user.service');
  const ctx = { userId: target.user._id, permissions: ['*'] };
  const result = await Promise.allSettled(companies.map(company => service.update(target.user._id, { companyId: company._id }, ctx)));
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(result.filter(r => r.status === 'rejected')).toHaveLength(1);
  expect(result.find(r => r.status === 'rejected').reason.status).toBe(409);
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer ' + target.accessToken)).status).toBe(401);
});
