/**
 * Auditoría final — tests de integración cross-module, política de registro
 * y aislamiento multiempresa.
 *
 * Cubre los enlaces implementados en la Auditoría Final (D-010):
 *   - Venta confirmada  → salida de stock (SALE_EXIT) con referencia SALES_ORDER
 *   - Factura           → Cuentas por Cobrar (CxC)
 *   - Pago              → Caja y bancos + reducción de CxC (partida doble)
 *   - Compra recibida   → entrada de stock (PURCHASE_ORDER) + Cuentas por Pagar
 * y las matrices de transición de estado (D-007).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app;
const stamp = Date.now();
const emailA = `audit-a${stamp}@test.com`;
const emailB = `audit-b${stamp}@test.com`;
let tokenA, companyA;
let tokenB, companyB;
let productId, warehouseId, customerId, supplierBId;
let orderIdA, invoiceIdA, purchaseOrderA;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  // ---- Empresa A ----
  await request(app).post('/api/v1/auth/register').send({ name: 'Admin A', email: emailA, password: 'Password123', role: 'ADMIN' });
  let login = await request(app).post('/api/v1/auth/login').send({ email: emailA, password: 'Password123' });
  const compA = await request(app).post('/api/v1/companies').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ name: `Empresa A ${stamp}` });
  companyA = compA.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: emailA }, { $set: { companyId: companyA } });
  login = await request(app).post('/api/v1/auth/login').send({ email: emailA, password: 'Password123' });
  tokenA = login.body.data.accessToken;

  const prod = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${tokenA}`).send({ sku: 'AUD-001', name: 'Producto Auditoría', price: 200, cost: 30 });
  productId = prod.body.data._id;
  const wh = await request(app).post('/api/v1/inventory/warehouses').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Almacén A', code: `A${stamp}` });
  warehouseId = wh.body.data._id;
  const adj = await request(app).post('/api/v1/inventory/stock/adjust').set('Authorization', `Bearer ${tokenA}`).send({ productId, warehouseId, quantity: 100, type: 'INITIAL_STOCK', reason: 'Stock inicial auditoría' });
  expect(adj.status).toBe(200);
  const cust = await request(app).post('/api/v1/crm/customers').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Cliente A', email: `cust-a${stamp}@test.com` });
  customerId = cust.body.data._id;

  // ---- Empresa B ----
  await request(app).post('/api/v1/auth/register').send({ name: 'Admin B', email: emailB, password: 'Password123', role: 'ADMIN' });
  login = await request(app).post('/api/v1/auth/login').send({ email: emailB, password: 'Password123' });
  const compB = await request(app).post('/api/v1/companies').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ name: `Empresa B ${stamp}` });
  companyB = compB.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: emailB }, { $set: { companyId: companyB } });
  login = await request(app).post('/api/v1/auth/login').send({ email: emailB, password: 'Password123' });
  tokenB = login.body.data.accessToken;
  const supB = await request(app).post('/api/v1/crm/customers').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Proveedor B', email: `sup-b${stamp}@test.com`, type: 'BUSINESS' });
  supplierBId = supB.body.data._id;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

// Quote → approve → order
async function makeOrder(token, quantity, unitPrice) {
  const quote = await request(app).post('/api/v1/sales/quotes').set('Authorization', `Bearer ${token}`)
    .send({ customerId, items: [{ productId, quantity, unitPrice }] });
  expect(quote.status).toBe(201);
  const quoteId = quote.body.data._id;
  const approved = await request(app).post(`/api/v1/sales/quotes/${quoteId}/approve`).set('Authorization', `Bearer ${token}`);
  expect(approved.status).toBe(200);
  const order = await request(app).post(`/api/v1/sales/quotes/${quoteId}/order`).set('Authorization', `Bearer ${token}`);
  expect(order.status).toBe(201);
  return order.body.data._id;
}

async function setOrderStatus(token, id, status) {
  return request(app).put(`/api/v1/sales/orders/${id}/status`).set('Authorization', `Bearer ${token}`).send({ status });
}

async function kardexItems(token, prodId, whId) {
  const res = await request(app).get(`/api/v1/inventory/kardex/${prodId}/${whId}`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data.items;
}

describe('Enlace Venta → Inventario (D-010)', () => {
  test('confirmar pedido descuenta stock y registra SALE_EXIT referenciado', async () => {
    orderIdA = await makeOrder(tokenA, 5, 200);
    const res = await setOrderStatus(tokenA, orderIdA, 'CONFIRMED');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');

    const items = await kardexItems(tokenA, productId, warehouseId);
    const exit = items.find(m => m.type === 'SALE_EXIT' && m.referenceType === 'SALES_ORDER');
    expect(exit).toBeDefined();
    expect(exit.quantity).toBe(5);
    expect(exit.newStock).toBe(95);
    expect(String(exit.referenceId)).toBe(String(orderIdA));
  });

  test('transiciones inválidas: reconfirmar y cancelar tras confirmar → 400', async () => {
    const again = await setOrderStatus(tokenA, orderIdA, 'CONFIRMED');
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('INVALID_STATUS_TRANSITION');

    const cancel = await setOrderStatus(tokenA, orderIdA, 'CANCELLED');
    expect(cancel.status).toBe(400);
    expect(cancel.body.code).toBe('INVALID_STATUS_TRANSITION');

    // La salida ocurrió exactamente una vez
    const items = await kardexItems(tokenA, productId, warehouseId);
    const exits = items.filter(m => m.type === 'SALE_EXIT');
    expect(exits.length).toBe(1);
  });

  test('transición inválida desde DRAFT (p. ej. DELIVERED) → 400', async () => {
    const orderId = await makeOrder(tokenA, 1, 200);
    const res = await setOrderStatus(tokenA, orderId, 'DELIVERED');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    // El pedido sigue en DRAFT y no hubo salida de stock
    expect(res.body.success).toBe(false);
    const items = await kardexItems(tokenA, productId, warehouseId);
    expect(items.filter(m => m.type === 'SALE_EXIT').length).toBe(1);
  });

  test('stock insuficiente bloquea la confirmación sin salidas parciales', async () => {
    const orderId = await makeOrder(tokenA, 1000, 200);
    const res = await setOrderStatus(tokenA, orderId, 'CONFIRMED');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    const items = await kardexItems(tokenA, productId, warehouseId);
    const exits = items.filter(m => m.type === 'SALE_EXIT');
    expect(exits.length).toBe(1);
    expect(exits[0].newStock).toBe(95); // sin salidas parciales
  });
});

describe('Enlace Venta → Finanzas (D-010)', () => {
  test('factura genera Cuentas por Cobrar', async () => {
    const res = await request(app).post(`/api/v1/sales/orders/${orderIdA}/invoice`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(201);
    invoiceIdA = res.body.data._id;
    expect(res.body.data.total).toBe(1000);

    const summary = await request(app).get('/api/v1/finance/summary').set('Authorization', `Bearer ${tokenA}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.assets).toBe(1000); // CxC = 5 * 200

    const txs = await request(app).get('/api/v1/finance/transactions').set('Authorization', `Bearer ${tokenA}`);
    const cxC = txs.body.data.items.find(t => t.referenceType === 'SALES_INVOICE');
    expect(cxC).toBeDefined();
    expect(cxC.type).toBe('INCOME');
    expect(cxC.amount).toBe(1000);
  });

  test('pago acredita caja y reduce CxC (partida doble)', async () => {
    const res = await request(app).post(`/api/v1/sales/invoices/${invoiceIdA}/payments`).set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 1000, method: 'TRANSFER', reference: 'AUD-REF-1' });
    expect(res.status).toBe(201);

    const accounts = await request(app).get('/api/v1/finance/accounts').set('Authorization', `Bearer ${tokenA}`);
    const caja = accounts.body.data.find(a => a.code === '1000');
    const cxCobrar = accounts.body.data.find(a => a.code === '1200');
    expect(caja).toBeDefined();
    expect(caja.balance).toBe(1000);
    expect(cxCobrar).toBeDefined();
    expect(cxCobrar.balance).toBe(0);

    const summary = await request(app).get('/api/v1/finance/summary').set('Authorization', `Bearer ${tokenA}`);
    expect(summary.body.data.assets).toBe(1000); // caja 1000 + CxC 0

    const txs = await request(app).get('/api/v1/finance/transactions').set('Authorization', `Bearer ${tokenA}`);
    const paymentTxs = txs.body.data.items.filter(t => t.referenceType === 'PAYMENT');
    expect(paymentTxs.length).toBe(2); // INCOME en caja + EXPENSE en CxC
  });
});

describe('Enlace Compra → Inventario/Finanzas (D-010)', () => {
  test('confirmar compra no altera stock; recibirla sí (entrada única)', async () => {
    const create = await request(app).post('/api/v1/purchases').set('Authorization', `Bearer ${tokenA}`)
      .send({ supplierId: customerId, items: [{ productId, quantity: 10, unitCost: 30 }], notes: 'Compra auditoría' });
    expect(create.status).toBe(201);
    purchaseOrderA = create.body.data._id;
    expect(create.body.data.total).toBe(300);

    const confirm = await request(app).put(`/api/v1/purchases/${purchaseOrderA}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'CONFIRMED' });
    expect(confirm.status).toBe(200);
    let items = await kardexItems(tokenA, productId, warehouseId);
    expect(items.find(m => m.referenceType === 'PURCHASE_ORDER')).toBeUndefined();

    const receive = await request(app).put(`/api/v1/purchases/${purchaseOrderA}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'RECEIVED' });
    expect(receive.status).toBe(200);

    items = await kardexItems(tokenA, productId, warehouseId);
    const entry = items.find(m => m.referenceType === 'PURCHASE_ORDER');
    expect(entry).toBeDefined();
    expect(entry.type).toBe('PURCHASE_ENTRY');
    expect(entry.quantity).toBe(10);
    expect(entry.newStock).toBe(105); // 95 + 10

    // Finanzas: Cuentas por Pagar reconocidas
    const accounts = await request(app).get('/api/v1/finance/accounts').set('Authorization', `Bearer ${tokenA}`);
    const cxp = accounts.body.data.find(a => a.code === '2100');
    expect(cxp).toBeDefined();
    expect(cxp.type).toBe('LIABILITY');
    expect(cxp.balance).toBe(300);

    const summary = await request(app).get('/api/v1/finance/summary').set('Authorization', `Bearer ${tokenA}`);
    expect(summary.body.data.liabilities).toBe(300);
  });

  test('transiciones inválidas de compra (recibido → confirmado / repetido) → 400', async () => {
    const back = await request(app).put(`/api/v1/purchases/${purchaseOrderA}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'CONFIRMED' });
    expect(back.status).toBe(400);
    expect(back.body.code).toBe('INVALID_STATUS_TRANSITION');

    const same = await request(app).put(`/api/v1/purchases/${purchaseOrderA}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'RECEIVED' });
    expect(same.status).toBe(400);
    expect(same.body.code).toBe('INVALID_STATUS_TRANSITION');

    // Alta de stock ocurrió exactamente una vez
    const items = await kardexItems(tokenA, productId, warehouseId);
    expect(items.filter(m => m.referenceType === 'PURCHASE_ORDER').length).toBe(1);
  });

  test('no se puede usar un proveedor de otra empresa → 404', async () => {
    const res = await request(app).post('/api/v1/purchases').set('Authorization', `Bearer ${tokenA}`)
      .send({ supplierId: supplierBId, items: [{ productId, quantity: 1, unitCost: 10 }] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SUPPLIER_NOT_FOUND');
  });

  test('no se puede usar un producto de otra empresa → 404', async () => {
    const prodB = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${tokenB}`).send({ sku: `B-${stamp}`, name: 'Producto B', price: 10 });
    expect(prodB.status).toBe(201);
    const res = await request(app).post('/api/v1/purchases').set('Authorization', `Bearer ${tokenB}`)
      .send({ supplierId: supplierBId, items: [{ productId, quantity: 1, unitCost: 10 }] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('Política de registro público (OWASP A01)', () => {
  test('sin privilegios el registro fuerza rol EMPLEADO y sin companyId', async () => {
    process.env.ALLOW_PRIVILEGED_REGISTER = 'false';
    try {
      const email = `pub${stamp}@test.com`;
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Atacante', email, password: 'Password123', role: 'ADMIN', companyId: companyA
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('EMPLEADO');
      expect(res.body.data.user.companyId).toBeUndefined();
      expect(res.body.data.permissions).not.toContain('*');
    } finally {
      delete process.env.ALLOW_PRIVILEGED_REGISTER;
    }
  });
});

describe('Aislamiento multiempresa (OWASP A01 / IDOR)', () => {
  test('B no ve el producto de A → 404', async () => {
    const res = await request(app).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('B no cambia el estado del pedido de A → 404', async () => {
    const res = await setOrderStatus(tokenB, orderIdA, 'PREPARING');
    expect(res.status).toBe(404);
  });

  test('B no recibe la orden de compra de A → 404', async () => {
    const res = await request(app).put(`/api/v1/purchases/${purchaseOrderA}/status`).set('Authorization', `Bearer ${tokenB}`).send({ status: 'RECEIVED' });
    expect(res.status).toBe(404);
  });

  test('B no ve el stock de A', async () => {
    const res = await request(app).get('/api/v1/inventory/stock').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
  });

  test('B no ve las cuentas ni transacciones de A', async () => {
    const accounts = await request(app).get('/api/v1/finance/accounts').set('Authorization', `Bearer ${tokenB}`);
    expect(accounts.status).toBe(200);
    expect(accounts.body.data.length).toBe(0);
    const txs = await request(app).get('/api/v1/finance/transactions').set('Authorization', `Bearer ${tokenB}`);
    expect(txs.body.data.total).toBe(0);
  });

  test('B no ve a los usuarios de A', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find(u => u.email === emailA);
    expect(found).toBeUndefined();
  });

  test('B no crea cotización con cliente de A → 404', async () => {
    const prodB = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${tokenB}`).send({ sku: `B2-${stamp}`, name: 'Producto B2', price: 10 });
    const res = await request(app).post('/api/v1/sales/quotes').set('Authorization', `Bearer ${tokenB}`)
      .send({ customerId, items: [{ productId: prodB.body.data._id, quantity: 1, unitPrice: 10 }] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
  });
});
