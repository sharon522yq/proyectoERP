const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token, companyId;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  await request(app).post('/api/v1/auth/register').send({ name: 'Dash Admin', email: 'dashadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = { body: { data: await require('../src/modules/companies/company.model').create({ name: 'Dash Test Co' }) } };
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'dashadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'dashadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Dashboard', () => {
  test('obtener dashboard completo', async () => {
    const res = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sales');
    expect(res.body.data).toHaveProperty('inventory');
    expect(res.body.data).toHaveProperty('finance');
    expect(res.body.data).toHaveProperty('production');
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('crm');
    expect(res.body.data).toHaveProperty('hr');
  });

  test('resumen de ventas', async () => {
    const res = await request(app).get('/api/v1/dashboard/sales').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalInvoiced');
  });

  test('resumen de inventario', async () => {
    const res = await request(app).get('/api/v1/dashboard/inventory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalProducts');
  });

  test('resumen financiero', async () => {
    const res = await request(app).get('/api/v1/dashboard/finance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('assets');
  });

  test('resumen de producción', async () => {
    const res = await request(app).get('/api/v1/dashboard/production').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalOrders');
  });

  test('reporte de ventas', async () => {
    const res = await request(app).get('/api/v1/dashboard/sales/report').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('items');
  });

  test('reporte de inventario', async () => {
    const res = await request(app).get('/api/v1/dashboard/inventory/report').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('items');
  });
});

describe('Security - Dashboard', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });
});
