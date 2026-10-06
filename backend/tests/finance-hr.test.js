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

  await request(app).post('/api/v1/auth/register').send({ name: 'Fin Admin', email: 'finadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = { body: { data: await require('../src/modules/companies/company.model').create({ name: 'Fin Test Co' }) } };
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'finadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'finadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Finance', () => {
  let accountId;

  test('crear cuenta', async () => {
    const res = await request(app).post('/api/v1/finance/accounts').set('Authorization', `Bearer ${token}`).send({
      code: '1100', name: 'Banco', type: 'ASSET'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('1100');
    accountId = res.body.data._id;
  });

  test('listar cuentas', async () => {
    const res = await request(app).get('/api/v1/finance/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('registrar ingreso', async () => {
    const res = await request(app).post('/api/v1/finance/transactions').set('Authorization', `Bearer ${token}`).send({
      accountId, type: 'INCOME', amount: 5000, description: 'Venta de servicio'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(5000);
  });

  test('resumen financiero', async () => {
    const res = await request(app).get('/api/v1/finance/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.assets).toBe(5000);
  });
});

describe('HR', () => {
  test('crear departamento', async () => {
    const res = await request(app).post('/api/v1/hr/departments').set('Authorization', `Bearer ${token}`).send({ name: 'Ventas' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Ventas');
  });

  test('listar departamentos', async () => {
    const res = await request(app).get('/api/v1/hr/departments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('crear empleado', async () => {
    const res = await request(app).post('/api/v1/hr/employees').set('Authorization', `Bearer ${token}`).send({
      employeeId: 'EMP001', name: 'Juan García', position: 'Vendedor', salary: 15000
    });
    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe('EMP001');
  });

  test('listar empleados', async () => {
    const res = await request(app).get('/api/v1/hr/employees').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Security - Finance/HR', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/finance/accounts');
    expect(res.status).toBe(401);
  });
});
