const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token, companyId, productId, bomId, warehouseId, productionOrderId, rawProductId;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  // Setup admin user + company
  await request(app).post('/api/v1/auth/register').send({ name: 'Prod Admin', email: 'prodadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = await request(app).post('/api/v1/companies').set('Authorization', 'Bearer ' + (await request(app).post('/api/v1/auth/login').send({ email: 'prodadmin@test.com', password: 'Password123' })).body.data.accessToken).send({ name: 'Prod Test Co' });
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'prodadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'prodadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;

  // Create finished product
  const prod = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
    sku: 'PROD-001', name: 'Producto Terminado', price: 500, cost: 200, minimumStock: 10
  });
  productId = prod.body.data._id;

  // Create raw material products
  const raw1 = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
    sku: 'RAW-001', name: 'Materia Prima A', price: 50, cost: 30
  });
  rawProductId = raw1.body.data._id;

  const raw2 = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
    sku: 'RAW-002', name: 'Materia Prima B', price: 30, cost: 15
  });

  // Create warehouse
  const wh = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', `Bearer ${token}`).send({
    name: 'Almacén Producción', code: 'AP01'
  });
  warehouseId = wh.body.data._id;

  // Add stock for raw materials
  await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', `Bearer ${token}`).send({
    productId: rawProductId, warehouseId, quantity: 500, type: 'PURCHASE_ENTRY', reason: 'Stock inicial'
  });
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Production - BOM', () => {
  test('crear BOM', async () => {
    const res = await request(app).post('/api/v1/production/bom').set('Authorization', `Bearer ${token}`).send({
      productId, name: 'BOM Producto Terminado',
      items: [
        { componentProductId: rawProductId, quantity: 2 },
      ]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.totalMaterialCost).toBeGreaterThan(0);
    bomId = res.body.data._id;
  });

  test('listar BOMs', async () => {
    const res = await request(app).get('/api/v1/production/bom').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('obtener BOM por id', async () => {
    const res = await request(app).get(`/api/v1/production/bom/${bomId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(bomId);
  });
});

describe('Production - Orders', () => {
  test('crear orden de producción', async () => {
    const res = await request(app).post('/api/v1/production/orders').set('Authorization', `Bearer ${token}`).send({
      productId, bomId, warehouseId, quantity: 10, notes: 'Primera producción'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PROD-/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.materialCost).toBeGreaterThan(0);
    productionOrderId = res.body.data._id;
  });

  test('listar órdenes de producción', async () => {
    const res = await request(app).get('/api/v1/production/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('obtener orden de producción por id', async () => {
    const res = await request(app).get(`/api/v1/production/orders/${productionOrderId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(productionOrderId);
  });

  test('transición DRAFT → PLANNED', async () => {
    const res = await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'PLANNED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PLANNED');
  });

  test('transición PLANNED → RELEASED', async () => {
    const res = await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'RELEASED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RELEASED');
  });

  test('transición inválida rechazada', async () => {
    const res = await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' });
    expect(res.status).toBe(400);
  });
});

describe('Production - Work Orders', () => {
  let workOrderId;

  test('crear work order', async () => {
    const res = await request(app).post(`/api/v1/production/orders/${productionOrderId}/work-orders`).set('Authorization', `Bearer ${token}`).send({
      productionOrderId, name: 'Corte', sequence: 1
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Corte');
    workOrderId = res.body.data._id;
  });

  test('listar work orders', async () => {
    const res = await request(app).get('/api/v1/production/work-orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('transición PENDING → IN_PROGRESS', async () => {
    const res = await request(app).put(`/api/v1/production/work-orders/${workOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  test('transición IN_PROGRESS → COMPLETED', async () => {
    const res = await request(app).put(`/api/v1/production/work-orders/${workOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });
});

describe('Production - Material Consumption', () => {
  test('iniciar producción (RELEASED → IN_PROGRESS)', async () => {
    const res = await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  test('consumir materiales', async () => {
    const res = await request(app).post(`/api/v1/production/orders/${productionOrderId}/consume`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('verificar movimiento de inventario', async () => {
    const res = await request(app).get('/api/v1/inventory/movements').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const prodMovements = res.body.data.items.filter(m => m.referenceType === 'PRODUCTION');
    expect(prodMovements.length).toBeGreaterThanOrEqual(1);
  });

  test('completar producción', async () => {
    const res = await request(app).post(`/api/v1/production/orders/${productionOrderId}/complete`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('verificar entrada de producto terminado en inventario', async () => {
    const res = await request(app).get(`/api/v1/inventory/kardex/${productId}/${warehouseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    const entry = res.body.data.items.find(m => m.referenceType === 'PRODUCTION');
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(10);
  });
});

describe('Security - Production', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/production/orders');
    expect(res.status).toBe(401);
  });
});
