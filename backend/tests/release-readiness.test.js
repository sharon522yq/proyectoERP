const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/database');
const Product = require('../src/modules/products/product.model');
const Warehouse = require('../src/modules/inventory/warehouse.model');
const Inventory = require('../src/modules/inventory/inventory.model');
const Movement = require('../src/modules/inventory/movement.model');
const Audit = require('../src/modules/audit/audit.model');
const Customer = require('../src/modules/crm/customer.model');
const Purchase = require('../src/modules/purchases/purchaseOrder.model');
const SalesOrder = require('../src/modules/sales/salesOrder.model');
const Account = require('../src/modules/finance/account.model');
const Transaction = require('../src/modules/finance/transaction.model');
const Bom = require('../src/modules/production/bom.model');
const ProductionOrder = require('../src/modules/production/productionOrder.model');
const Category = require('../src/modules/products/category.model');
const finance = require('../src/modules/finance/finance.service');
const purchases = require('../src/modules/purchases/purchase.service');
const sales = require('../src/modules/sales/sales.service');
const products = require('../src/modules/products/product.service');
const inventory = require('../src/modules/inventory/inventory.service');
const production = require('../src/modules/production/production.service');
let db, f;
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri());
  await Promise.all([Inventory.init(), Movement.init(), Audit.init(), Account.init(), Transaction.init(), SalesOrder.init(), Bom.init(), ProductionOrder.init(), Category.init()]);
});
beforeEach(async () => {
  const ctx = { companyId: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId() };
  const product = await Product.create({ companyId: ctx.companyId, sku: 'QA', name: 'Artículo QA', price: 10 });
  const warehouse = await Warehouse.create({ companyId: ctx.companyId, name: 'Almacén QA', code: 'QA' });
  const customer = await Customer.create({ companyId: ctx.companyId, name: 'Tercero QA' });
  f = { ctx, product, warehouse, customer };
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); await db.stop(); });

test('preflight comprueba réplica e integridad sin escribir registros o índices', async () => {
  const { inspectReleaseDatabase } = require('../scripts/release-preflight');
  const before = await mongoose.connection.db.collection('inventory').countDocuments();
  const report = await inspectReleaseDatabase(mongoose.connection);
  expect(report.success).toBe(true);
  expect(await mongoose.connection.db.collection('inventory').countDocuments()).toBe(before);
  // Detects legacy duplicate stock even when its index has not yet been created.
  const collection = mongoose.connection.db.collection('inventory');
  await collection.dropIndex('companyId_1_warehouseId_1_productId_1');
  const row = { companyId: f.ctx.companyId, warehouseId: f.warehouse._id, productId: f.product._id, quantity: 1 };
  try {
    await collection.insertMany([row, { ...row }]);
    expect((await inspectReleaseDatabase(mongoose.connection)).success).toBe(false);
  } finally {
    await collection.deleteMany({ companyId: f.ctx.companyId });
    await collection.createIndex({ companyId: 1, warehouseId: 1, productId: 1 }, { unique: true });
  }
});

test('B1: fallo financiero revierte recepción y reintento recibe solo una vez', async () => {
  const { ctx, product, customer } = f;
  const order = await Purchase.create({ companyId: ctx.companyId, folio: 'QA-PO', supplierId: customer._id, status: 'CONFIRMED', items: [{ productId: product._id, quantity: 5, unitCost: 5, subtotal: 25 }], subtotal: 25, total: 25 });
  const spy = jest.spyOn(finance, 'postSystemTransaction').mockRejectedValueOnce(new Error('Fallo financeiro QA'));
  await expect(purchases.updateStatus(order._id, 'RECEIVED', ctx)).rejects.toThrow('Fallo financeiro QA');
  spy.mockRestore();
  expect(await Inventory.countDocuments({ companyId: ctx.companyId })).toBe(0);
  expect(await Movement.countDocuments({ companyId: ctx.companyId })).toBe(0);
  expect((await Purchase.findById(order._id)).status).toBe('CONFIRMED');
  await purchases.updateStatus(order._id, 'RECEIVED', ctx);
  expect((await Inventory.findOne({ companyId: ctx.companyId })).quantity).toBe(5);
  expect(await Movement.countDocuments({ companyId: ctx.companyId })).toBe(1);
});
test('B2: dos confirmaciones concurrentes descontarán el pedido una sola vez', async () => {
  const { ctx, product, warehouse, customer } = f;
  await Inventory.create({ companyId: ctx.companyId, warehouseId: warehouse._id, productId: product._id, quantity: 20 });
  const order = await SalesOrder.create({ companyId: ctx.companyId, folio: 'QA-SO', customerId: customer._id, items: [{ productId: product._id, quantity: 3, unitPrice: 10, subtotal: 30 }], subtotal: 30, total: 30 });
  const results = await Promise.allSettled([sales.updateOrderStatus(order._id, 'CONFIRMED', ctx), sales.updateOrderStatus(order._id, 'CONFIRMED', ctx)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await Inventory.findOne({ companyId: ctx.companyId })).quantity).toBe(17);
  expect(await Movement.countDocuments({ companyId: ctx.companyId, type: 'SALE_EXIT' })).toBe(1);
});
test('B3: no se genera terminado ni se cierra producción sin consumo', async () => {
  const { ctx, product, warehouse } = f;
  const bom = await Bom.create({ companyId: ctx.companyId, productId: product._id, name: 'Receta QA', items: [{ componentProductId: new mongoose.Types.ObjectId(), quantity: 2 }] });
  const order = await ProductionOrder.create({ companyId: ctx.companyId, productId: product._id, warehouseId: warehouse._id, bomId: bom._id, folio: 'QA-PROD', quantity: 3, status: 'IN_PROGRESS', createdBy: ctx.userId });
  await expect(production.completeProduction(order._id, ctx)).rejects.toMatchObject({ code: 'MATERIALS_NOT_CONSUMED' });
  await expect(production.updateProductionOrderStatus(order._id, 'COMPLETED', ctx)).rejects.toMatchObject({ code: 'MATERIALS_NOT_CONSUMED' });
  expect(await Inventory.countDocuments({ companyId: ctx.companyId })).toBe(0);
  expect((await ProductionOrder.findById(order._id)).status).toBe('IN_PROGRESS');
});
test('B4/B5: saldo concurrente correcto y transferencia unilateral rechazada', async () => {
  const { ctx } = f;
  const account = await Account.create({ companyId: ctx.companyId, code: 'QA', name: 'Cuenta QA', type: 'ASSET', balance: 10 });
  await Promise.all([7, 7].map(amount => finance.createTransaction({ accountId: account._id, type: 'INCOME', amount }, ctx)));
  expect((await Account.findById(account._id)).balance).toBe(24);
  await expect(finance.createTransaction({ accountId: account._id, type: 'TRANSFER', amount: 3 }, ctx)).rejects.toMatchObject({ code: 'TRANSFER_NOT_SUPPORTED' });
  expect((await Account.findById(account._id)).balance).toBe(24);
  expect(await Transaction.countDocuments({ companyId: ctx.companyId })).toBe(2);
});
test('B6: alta/edición rechazan categorías ajenas o inactivas y unidades inexistentes', async () => {
  const { ctx, product } = f;
  const other = await Category.create({ companyId: new mongoose.Types.ObjectId(), name: 'Categoría ajena' });
  const inactive = await Category.create({ companyId: ctx.companyId, name: 'Inactiva', active: false });
  for (const category of [other, inactive]) {
    await expect(products.create({ sku: 'INVALID', name: 'Producto', price: 1, categoryId: category._id }, ctx)).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    await expect(products.update(product._id, { categoryId: category._id }, ctx)).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
  }
  await expect(products.update(product._id, { unitId: new mongoose.Types.ObjectId() }, ctx)).rejects.toMatchObject({ code: 'UNIT_NOT_FOUND' });
  expect((await Product.findById(product._id)).categoryId).toBeUndefined();
  const own = await Category.create({ companyId: ctx.companyId, name: 'Propia' });
  await products.update(product._id, { categoryId: own._id }, ctx);
  expect(String((await Product.findById(product._id)).categoryId)).toBe(String(own._id));
});
test('requestId de inventario resiste concurrencia y reintento sin duplicar', async () => {
  const { ctx, product, warehouse } = f;
  const action = () => inventory.adjustStock(product._id, warehouse._id, 5, 'INITIAL_STOCK', 'QA', ctx, { requestId: 'retry' });
  await Promise.all([action(), action()]); await action();
  expect((await Inventory.findOne({ companyId: ctx.companyId })).quantity).toBe(5);
  expect(await Movement.countDocuments({ companyId: ctx.companyId })).toBe(1);
  expect(await Audit.countDocuments({ companyId: ctx.companyId })).toBe(1);
  await expect(inventory.adjustStock(product._id, warehouse._id, 6, 'INITIAL_STOCK', 'QA', ctx, { requestId: 'retry' })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
});
test('token con contexto de empresa anterior no se reutiliza en la nueva empresa', async () => {
  const jwt = require('jsonwebtoken');
  const request = require('supertest');
  const env = require('../src/config/env');
  await require('../src/modules/roles/role.service').ensureSeeded();
  const User = require('../src/modules/users/user.model');
  const user = await User.create({ name: 'QA', email: `qa-${Date.now()}@example.invalid`, passwordHash: 'synthetic', role: 'ADMIN', companyId: f.ctx.companyId });
  const token = jwt.sign({ sub: String(user._id), companyId: String(f.ctx.companyId), permissions: ['*'], version: 0 }, env.jwt.secret);
  const app = require('../src/app').createApp();
  expect((await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  await User.updateOne({ _id: user._id }, { $set: { companyId: new mongoose.Types.ObjectId() } });
  const response = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(401); expect(response.body.code).toBe('SESSION_CONTEXT_CHANGED');
});
