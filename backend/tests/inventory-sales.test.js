const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token, companyId, productId, warehouseId, customerId, invoiceId;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  // Register admin
  await request(app).post('/api/v1/auth/register').send({ name: 'Test Admin', email: 'invadmin@test.com', password: 'Password123', role: 'ADMIN' });
  // Create company
  const comp = await request(app).post('/api/v1/companies').set('Authorization', 'Bearer ' + (await request(app).post('/api/v1/auth/login').send({ email: 'invadmin@test.com', password: 'Password123' })).body.data.accessToken).send({ name: 'Inv Test Co' });
  companyId = comp.body.data._id;
  // Update user & re-login
  await require('../src/modules/users/user.model').updateOne({ email: 'invadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'invadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;

  // Create product
  const prod = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({ sku: 'INV-001', name: 'Widget', price: 100, cost: 50 });
  productId = prod.body.data._id;

  // Create warehouse
  const wh = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Almacén Central', code: 'AC01' });
  warehouseId = wh.body.data._id;

  // Create customer
  const cust = await request(app).post('/api/v1/crm/customers').set('Authorization', `Bearer ${token}`).send({ name: 'Test Customer', email: 'cust@test.com' });
  customerId = cust.body.data._id;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Inventory', () => {
  test('crear almacén', async () => {
    const res = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Almacén Norte', code: 'AN01' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('AN01');
  });

  test('listar almacenes', async () => {
    const res = await request(app).get('/api/v1/inventory/warehouses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('entrada de stock (PURCHASE_ENTRY)', async () => {
    const res = await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', `Bearer ${token}`).send({
      productId, warehouseId, quantity: 100, type: 'PURCHASE_ENTRY', reason: 'Compra inicial'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(100);
  });

  test('salida de stock (SALE_EXIT)', async () => {
    const res = await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', `Bearer ${token}`).send({
      productId, warehouseId, quantity: 10, type: 'SALE_EXIT', reason: 'Venta test'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(90);
  });

  test('consulta de stock', async () => {
    const res = await request(app).get('/api/v1/inventory/stock').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('historial de movimientos', async () => {
    const res = await request(app).get('/api/v1/inventory/movements').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  test('kardex', async () => {
    const res = await request(app).get(`/api/v1/inventory/kardex/${productId}/${warehouseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Sales - Full Flow', () => {
  let quoteId, orderId;

  test('crear cotización', async () => {
    const res = await request(app).post('/api/v1/sales/quotes').set('Authorization', `Bearer ${token}`).send({
      customerId, items: [{ productId, quantity: 5, unitPrice: 100, taxRate: 16 }]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^COT-/);
    expect(res.body.data.total).toBeGreaterThan(0);
    quoteId = res.body.data._id;
  });

  test('aprobar cotización', async () => {
    const res = await request(app).post(`/api/v1/sales/quotes/${quoteId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  test('convertir cotización en pedido', async () => {
    const res = await request(app).post(`/api/v1/sales/quotes/${quoteId}/order`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PED-/);
    orderId = res.body.data._id;
  });

  test('confirmar pedido', async () => {
    const res = await request(app).put(`/api/v1/sales/orders/${orderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  test('listar pedidos', async () => {
    const res = await request(app).get('/api/v1/sales/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('crear factura desde pedido', async () => {
    const res = await request(app).post(`/api/v1/sales/orders/${orderId}/invoice`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^FAC-/);
    invoiceId = res.body.data._id;
  });

  test('registrar pago', async () => {
    const res = await request(app).post(`/api/v1/sales/invoices/${invoiceId}/payments`).set('Authorization', `Bearer ${token}`).send({
      amount: 580, method: 'TRANSFER', reference: 'REF-001'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PAG-/);
  });

  test('listar pagos', async () => {
    const res = await request(app).get('/api/v1/sales/payments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Security - Inventory', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/inventory/stock');
    expect(res.status).toBe(401);
  });
});
