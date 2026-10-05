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

  // Setup admin + company
  await request(app).post('/api/v1/auth/register').send({ name: 'E2E Admin', email: 'e2eadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = await request(app).post('/api/v1/companies').set('Authorization', 'Bearer ' + (await request(app).post('/api/v1/auth/login').send({ email: 'e2eadmin@test.com', password: 'Password123' })).body.data.accessToken).send({ name: 'E2E Test Co' });
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'e2eadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'e2eadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

function auth() { return `Bearer ${token}`; }

describe('E2E — Escenario 1: Venta completa', () => {
  let customerId, productId, warehouseId, quoteId, orderId, invoiceId;

  test('1. Crear customer', async () => {
    const res = await request(app).post('/api/v1/crm/customers').set('Authorization', auth()).send({
      name: 'Cliente E2E', email: 'e2e@client.com', type: 'BUSINESS'
    });
    expect(res.status).toBe(201);
    customerId = res.body.data._id;
  });

  test('2. Crear producto', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', auth()).send({
      sku: 'E2E-PROD', name: 'Producto E2E', price: 250, cost: 100, taxRate: 16
    });
    expect(res.status).toBe(201);
    productId = res.body.data._id;
  });

  test('3. Crear almacén', async () => {
    const res = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', auth()).send({
      name: 'Almacén E2E', code: 'E2E'
    });
    expect(res.status).toBe(201);
    warehouseId = res.body.data._id;
  });

  test('4. Agregar stock', async () => {
    const res = await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', auth()).send({
      productId, warehouseId, quantity: 100, type: 'PURCHASE_ENTRY', reason: 'Stock inicial E2E'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(100);
  });

  test('5. Crear cotización', async () => {
    const res = await request(app).post('/api/v1/sales/quotes').set('Authorization', auth()).send({
      customerId, items: [{ productId, quantity: 5, unitPrice: 250, taxRate: 16 }]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^COT-/);
    quoteId = res.body.data._id;
  });

  test('6. Aprobar cotización', async () => {
    const res = await request(app).post(`/api/v1/sales/quotes/${quoteId}/approve`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  test('7. Convertir a pedido', async () => {
    const res = await request(app).post(`/api/v1/sales/quotes/${quoteId}/order`).set('Authorization', auth());
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PED-/);
    orderId = res.body.data._id;
  });

  test('8. Confirmar pedido', async () => {
    const res = await request(app).put(`/api/v1/sales/orders/${orderId}/status`).set('Authorization', auth()).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
  });

  test('9. Crear factura', async () => {
    const res = await request(app).post(`/api/v1/sales/orders/${orderId}/invoice`).set('Authorization', auth());
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^FAC-/);
    invoiceId = res.body.data._id;
  });

  test('10. Registrar pago', async () => {
    const res = await request(app).post(`/api/v1/sales/invoices/${invoiceId}/payments`).set('Authorization', auth()).send({
      amount: 1450, method: 'TRANSFER', reference: 'E2E-REF'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PAG-/);
  });

  test('11. Verificar factura pagada', async () => {
    const res = await request(app).get('/api/v1/sales/invoices').set('Authorization', auth());
    expect(res.status).toBe(200);
    const inv = res.body.data.items.find(i => i._id === invoiceId);
    expect(inv.status).toBe('PAID');
  });

  test('12. Verificar stock en inventario', async () => {
    const res = await request(app).get('/api/v1/inventory/kardex/${productId}/${warehouseId}'.replace('${productId}', productId).replace('${warehouseId}', warehouseId)).set('Authorization', auth());
    expect(res.status).toBe(200);
    const entry = res.body.data.items.find(m => m.type === 'PURCHASE_ENTRY');
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(100);
  });
});

describe('E2E — Escenario 2: Multiempresa', () => {
  let token2, companyId2, productId2;

  test('1. Crear segunda empresa', async () => {
    await request(app).post('/api/v1/auth/register').send({ name: 'E2E Admin 2', email: 'e2e2@test.com', password: 'Password123', role: 'ADMIN' });
    const login2 = await request(app).post('/api/v1/auth/login').send({ email: 'e2e2@test.com', password: 'Password123' });
    token2 = login2.body.data.accessToken;
    const comp = await request(app).post('/api/v1/companies').set('Authorization', `Bearer ${token2}`).send({ name: 'Empresa 2' });
    companyId2 = comp.body.data._id;
    await require('../src/modules/users/user.model').updateOne({ email: 'e2e2@test.com' }, { $set: { companyId: companyId2 } });
    const login2b = await request(app).post('/api/v1/auth/login').send({ email: 'e2e2@test.com', password: 'Password123' });
    token2 = login2b.body.data.accessToken;
  });

  test('2. Empresa 2 crea producto', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token2}`).send({
      sku: 'E2E2-PROD', name: 'Producto Empresa 2', price: 100
    });
    expect(res.status).toBe(201);
    productId2 = res.body.data._id;
  });

  test('3. Empresa 1 NO puede ver producto de Empresa 2', async () => {
    const res = await request(app).get(`/api/v1/products/${productId2}`).set('Authorization', auth());
    expect(res.status).toBe(404);
  });

  test('4. Empresa 2 NO puede ver customers de Empresa 1', async () => {
    const res = await request(app).get('/api/v1/crm/customers').set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
  });
});

describe('E2E — Escenario 3: Producción completa', () => {
  let rawProductId, finishedProductId, bomId, warehouseId, productionOrderId;

  test('1. Crear materia prima', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', auth()).send({
      sku: 'E2E-RAW', name: 'Materia Prima E2E', price: 20, cost: 10
    });
    expect(res.status).toBe(201);
    rawProductId = res.body.data._id;
  });

  test('2. Crear producto terminado', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', auth()).send({
      sku: 'E2E-FIN', name: 'Producto Terminado E2E', price: 100, cost: 50
    });
    expect(res.status).toBe(201);
    finishedProductId = res.body.data._id;
  });

  test('3. Crear almacén', async () => {
    const res = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', auth()).send({
      name: 'Almacén Prod E2E', code: 'E2P'
    });
    expect(res.status).toBe(201);
    warehouseId = res.body.data._id;
  });

  test('4. Agregar stock de materia prima', async () => {
    const res = await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', auth()).send({
      productId: rawProductId, warehouseId, quantity: 200, type: 'PURCHASE_ENTRY', reason: 'Stock materia prima'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(200);
  });

  test('5. Crear BOM', async () => {
    const res = await request(app).post('/api/v1/production/bom').set('Authorization', auth()).send({
      productId: finishedProductId, name: 'BOM E2E',
      items: [{ componentProductId: rawProductId, quantity: 2 }]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(1);
    bomId = res.body.data._id;
  });

  test('6. Crear orden de producción', async () => {
    const res = await request(app).post('/api/v1/production/orders').set('Authorization', auth()).send({
      productId: finishedProductId, bomId, warehouseId, quantity: 10
    });
    expect(res.status).toBe(201);
    expect(res.body.data.folio).toMatch(/^PROD-/);
    expect(res.body.data.materialCost).toBe(200); // 2 * 10 * 10
    productionOrderId = res.body.data._id;
  });

  test('7. Transiciones de estado', async () => {
    await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', auth()).send({ status: 'PLANNED' });
    await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', auth()).send({ status: 'RELEASED' });
    const res = await request(app).put(`/api/v1/production/orders/${productionOrderId}/status`).set('Authorization', auth()).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
  });

  test('8. Consumir materiales', async () => {
    const res = await request(app).post(`/api/v1/production/orders/${productionOrderId}/consume`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('9. Completar producción', async () => {
    const res = await request(app).post(`/api/v1/production/orders/${productionOrderId}/complete`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('10. Verificar producto terminado en inventario', async () => {
    const res = await request(app).get(`/api/v1/inventory/kardex/${finishedProductId}/${warehouseId}`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const entry = res.body.data.items.find(m => m.referenceType === 'PRODUCTION');
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(10);
  });

  test('11. Verificar materia prima descontada', async () => {
    const res = await request(app).get(`/api/v1/inventory/kardex/${rawProductId}/${warehouseId}`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const movements = res.body.data.items;
    const totalConsumed = movements.filter(m => m.referenceType === 'PRODUCTION').reduce((s, m) => s + m.quantity, 0);
    expect(totalConsumed).toBe(20); // 2 * 10
  });
});

describe('E2E — Escenario 4: Dashboard', () => {
  test('Dashboard retorna datos de todos los módulos', async () => {
    const res = await request(app).get('/api/v1/dashboard').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sales');
    expect(res.body.data).toHaveProperty('inventory');
    expect(res.body.data).toHaveProperty('finance');
    expect(res.body.data).toHaveProperty('production');
    expect(res.body.data).toHaveProperty('crm');
    expect(res.body.data).toHaveProperty('hr');
    expect(res.body.data.inventory.totalProducts).toBeGreaterThan(0);
    expect(res.body.data.crm.totalCustomers).toBeGreaterThan(0);
  });
});
