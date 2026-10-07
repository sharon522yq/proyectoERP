const mongoose = require('mongoose');
const request = require('supertest');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const Company = require('../src/modules/companies/company.model');
const Invoice = require('../src/modules/sales/invoice.model');
const Order = require('../src/modules/sales/salesOrder.model');
const Transaction = require('../src/modules/finance/transaction.model');
const finance = require('../src/modules/finance/finance.service');
let db, app, token, company, customer, product, warehouse;
const call = (method, path) => request(app)[method]('/api/v1/' + path).set('Authorization', 'Bearer ' + token);
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri()); await ensureSeeded(); app = createApp();
  company = await Company.create({ name: 'Nexus prueba sintética' });
  const account = await request(app).post('/api/v1/auth/register').send({ name: 'QA', email: 'sales-qa@example.com', password: 'OnlyTemporaryTest123', role: 'ADMIN', companyId: company._id });
  token = account.body.data.accessToken;
  customer = (await call('post', 'crm/customers').send({ name: 'Cliente sintético' })).body.data;
  product = (await call('post', 'products').send({ name: 'Producto sintético', sku: 'QA-1', price: 100 })).body.data;
  warehouse = (await call('post', 'inventory/warehouses').send({ name: 'Almacén QA', code: 'QA' })).body.data;
  await call('post', 'inventory/stock/adjust').send({ productId: product._id, warehouseId: warehouse._id, quantity: 20, type: 'INITIAL_STOCK', reason: 'Fixture sintético' });
}, 60000);
afterAll(async () => { await mongoose.disconnect(); if (db) await db.stop(); });
async function order(quantity = 2) {
  const quote = await call('post', 'sales/quotes').send({ customerId: customer._id, items: [{ productId: product._id, description: product.name, quantity, unitPrice: 100, taxRate: 16 }] });
  expect(quote.status).toBe(201);
  expect((await call('post', 'sales/quotes/' + quote.body.data._id + '/approve')).status).toBe(200);
  const created = await call('post', 'sales/quotes/' + quote.body.data._id + '/order');
  expect(created.status).toBe(201);
  return created.body.data;
}
test('full sale produces one internal invoice and one receivable even on concurrent retry', async () => {
  const draft = await order();
  const path = 'sales/orders/' + draft._id;
  expect((await call('post', path + '/invoice')).status).toBe(400);
  expect((await call('put', path + '/status').send({ status: 'CONFIRMED' })).status).toBe(200);
  const responses = await Promise.all([call('post', path + '/invoice'), call('post', path + '/invoice')]);
  expect(responses.map(r => r.status)).toEqual([201, 201]);
  expect(responses[0].body.data._id).toBe(responses[1].body.data._id);
  expect(responses[0].body.data.total).toBe(232);
  expect(responses[0].body.data.issuerName).toBe(company.name);
  expect(responses[0].body.data.customerName).toBe(customer.name);
  expect(await Invoice.countDocuments({ salesOrderId: draft._id })).toBe(1);
  expect(await Transaction.countDocuments({ referenceType: 'SALES_INVOICE', referenceId: responses[0].body.data._id })).toBe(1);
  const stock = (await call('get', 'inventory/stock')).body.data.items.find(s => s.productId === product._id);
  expect(stock.quantity).toBe(18);
  expect((await call('get', 'sales/invoices')).body.data.items[0]._id).toBe(responses[0].body.data._id);
});
test('insufficient stock leaves order in draft and stock unchanged', async () => {
  const draft = await order(100);
  expect((await call('put', 'sales/orders/' + draft._id + '/status').send({ status: 'CONFIRMED' })).status).toBe(400);
  expect((await Order.findById(draft._id)).status).toBe('DRAFT');
  expect((await call('get', 'inventory/stock')).body.data.items.find(s => s.productId === product._id).quantity).toBe(18);
});
test('finance failure rolls back invoice and invoice marker so retry succeeds', async () => {
  const draft = await order();
  expect((await call('put', 'sales/orders/' + draft._id + '/status').send({ status: 'CONFIRMED' })).status).toBe(200);
  const fail = jest.spyOn(finance, 'postSystemTransaction').mockRejectedValueOnce(new Error('Injected temporary finance failure'));
  expect((await call('post', 'sales/orders/' + draft._id + '/invoice')).status).toBe(500);
  fail.mockRestore();
  expect(await Invoice.countDocuments({ salesOrderId: draft._id })).toBe(0);
  expect((await Order.findById(draft._id)).invoiceId).toBeUndefined();
  expect((await call('post', 'sales/orders/' + draft._id + '/invoice')).status).toBe(201);
});
test('invalid tax and discount are rejected before saving a quote', async () => {
  for (const values of [{ taxRate: 101 }, { discount: 201 }]) {
    const result = await call('post', 'sales/quotes').send({ customerId: customer._id, items: [{ productId: product._id, quantity: 2, unitPrice: 100, ...values }] });
    expect(result.status).toBe(400);
  }
});
test('valid line discount preserves net subtotal and tax', async () => {
  const result = await call('post', 'sales/quotes').send({ customerId: customer._id, items: [{ productId: product._id, quantity: 2, unitPrice: 100, discount: 10, taxRate: 16 }] });
  expect(result.status).toBe(201);
  expect(result.body.data.subtotal).toBe(190);
  expect(result.body.data.discountTotal).toBe(10);
  expect(result.body.data.total).toBe(220.4);
});

test('payment rollback and retry retain one confirmed payment and one cash receipt', async () => {
  const draft = await order(1);
  await call('put', 'sales/orders/' + draft._id + '/status').send({ status: 'CONFIRMED' });
  const issued = await call('post', 'sales/orders/' + draft._id + '/invoice');
  const id = issued.body.data._id;
  const Payment = require('../src/modules/sales/payment.model');
  const path = 'sales/invoices/' + id + '/payments';
  const data = { amount: 10, method: 'CASH', requestId: 'payment-retry-test' };
  const spy = jest.spyOn(finance, 'postSystemTransaction').mockRejectedValueOnce(new Error('Temporary finance outage'));
  try { expect((await call('post', path).send(data)).status).toBe(500); } finally { spy.mockRestore(); }
  expect(await Payment.countDocuments({ invoiceId: id })).toBe(0);
  expect((await Invoice.findById(id)).paidAmount).toBe(0);
  const responses = await Promise.all([call('post', path).send(data), call('post', path).send(data)]);
  expect(responses.map(r => r.status)).toEqual([201, 201]);
  expect(responses[0].body.data._id).toBe(responses[1].body.data._id);
  expect(responses[0].body.data.status).toBe('CONFIRMED');
  expect(await Payment.countDocuments({ invoiceId: id })).toBe(1);
  expect((await Invoice.findById(id)).paidAmount).toBe(10);
  expect((await call('post', path).send({ ...data, amount: 11 })).status).toBe(409);
});

test('multiple warehouses require explicit selection and shipment uses the selected tenant warehouse', async () => {
  const Warehouse = require('../src/modules/inventory/warehouse.model');
  const Inventory = require('../src/modules/inventory/inventory.model');
  const other = await Warehouse.create({ companyId: company._id, name: 'Otra salida', code: 'OTHER-SHIP' });
  await call('post', 'inventory/stock/adjust').send({ productId: product._id, warehouseId: other._id, quantity: 5, type: 'INITIAL_STOCK', reason: 'Fixture de selección' });
  const draft = await order(1), path = 'sales/orders/' + draft._id + '/status';
  expect((await call('put', path).send({ status: 'CONFIRMED' })).body.code).toBe('WAREHOUSE_REQUIRED');
  const alien = await Warehouse.create({ companyId: new mongoose.Types.ObjectId(), name: 'Ajeno', code: 'ALIEN' });
  expect((await call('put', path).send({ status: 'CONFIRMED', warehouseId: alien._id })).status).toBe(404);
  const confirmed = await call('put', path).send({ status: 'CONFIRMED', warehouseId: other._id });
  expect(confirmed.status).toBe(200); expect(confirmed.body.data.warehouseId).toBe(String(other._id));
  expect((await Inventory.findOne({ warehouseId: other._id, productId: product._id })).quantity).toBe(4);
});

test('line tax and final invoice totals use cents and the displayed full amount settles the invoice', async () => {
  const quote = await call('post', 'sales/quotes').send({ customerId: customer._id, items: [{ productId: product._id, quantity: 3, unitPrice: 10.1, taxRate: 16 }] });
  expect(quote.body.data.total).toBe(35.15); expect(quote.body.data.taxTotal).toBe(4.85);
  await call('post', 'sales/quotes/' + quote.body.data._id + '/approve');
  const created = await call('post', 'sales/quotes/' + quote.body.data._id + '/order');
  await call('put', 'sales/orders/' + created.body.data._id + '/status').send({ status: 'CONFIRMED', warehouseId: warehouse._id });
  const issued = await call('post', 'sales/orders/' + created.body.data._id + '/invoice');
  const paid = await call('post', 'sales/invoices/' + issued.body.data._id + '/payments').send({ amount: 35.15, method: 'CASH', requestId: 'cent-payment-test' });
  expect(paid.status).toBe(201); expect((await Invoice.findById(issued.body.data._id)).status).toBe('PAID');
});
