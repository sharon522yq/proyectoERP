const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token, companyId, productId, supplierId;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  await request(app).post('/api/v1/auth/register').send({ name: 'Purch Admin', email: 'purchadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = { body: { data: await require('../src/modules/companies/company.model').create({ name: 'Purch Test Co' }) } };
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'purchadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'purchadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;

  const prod = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({ sku: 'PURCH-001', name: 'Materia Prima', price: 50, cost: 30 });
  productId = prod.body.data._id;

  const sup = await request(app).post('/api/v1/crm/customers').set('Authorization', `Bearer ${token}`).send({ name: 'Proveedor XYZ', email: 'xyz@test.com', type: 'BUSINESS' });
  supplierId = sup.body.data._id;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Purchases', () => {
  let orderId;

  test('crear orden de compra', async () => {
    const res = await request(app).post('/api/v1/purchases').set('Authorization', `Bearer ${token}`).send({
      supplierId, items: [{ productId, quantity: 50, unitCost: 30 }], notes: 'Compra de materia prima'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^OC-/);
    expect(res.body.data.total).toBe(1500);
    orderId = res.body.data._id;
  });

  test('listar órdenes de compra', async () => {
    const res = await request(app).get('/api/v1/purchases').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('confirmar orden de compra', async () => {
    const res = await request(app).put(`/api/v1/purchases/${orderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });
});

describe('Security - Purchases', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/purchases');
    expect(res.status).toBe(401);
  });
});

test('receipt rollback preserves stock and purchase status when finance fails', async () => {
  const Warehouse = require('../src/modules/inventory/warehouse.model');
  const Inventory = require('../src/modules/inventory/inventory.model');
  const Order = require('../src/modules/purchases/purchaseOrder.model');
  const finance = require('../src/modules/finance/finance.service');
  const wh = await Warehouse.create({ companyId, name: 'Recepción QA', code: 'RECEIPT-QA' });
  const created = await request(app).post('/api/v1/purchases').set('Authorization', 'Bearer ' + token).send({ supplierId, warehouseId: String(wh._id), items: [{ productId, quantity: 5, unitCost: 10, taxRate: 16 }] });
  expect(created.status).toBe(201); expect(created.body.data.total).toBe(58); expect(created.body.data.items[0].taxRate).toBe(16);
  const id = created.body.data._id;
  const change = status => request(app).put('/api/v1/purchases/' + id + '/status').set('Authorization', 'Bearer ' + token).send({ status });
  expect((await change('CONFIRMED')).status).toBe(200);
  const spy = jest.spyOn(finance, 'postSystemTransaction').mockRejectedValueOnce(new Error('Temporary receipt failure'));
  try { expect((await change('RECEIVED')).status).toBe(500); } finally { spy.mockRestore(); }
  expect(await Inventory.countDocuments({ warehouseId: wh._id })).toBe(0);
  expect((await Order.findById(id)).status).toBe('CONFIRMED');
  expect((await change('RECEIVED')).status).toBe(200);
  expect((await Inventory.findOne({ warehouseId: wh._id, productId })).quantity).toBe(5);
  expect((await change('RECEIVED')).status).toBe(400);
  expect((await Inventory.findOne({ warehouseId: wh._id, productId })).quantity).toBe(5);
});
