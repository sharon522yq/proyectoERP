const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/database');
const inventory = require('../src/modules/inventory/inventory.repository');
const finance = require('../src/modules/finance/finance.service');
const production = require('../src/modules/production/production.service');
let db, companyId, warehouseId, productId, ctx;
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri());
  companyId = new mongoose.Types.ObjectId(); warehouseId = new mongoose.Types.ObjectId(); productId = new mongoose.Types.ObjectId();
  ctx = { companyId, userId: new mongoose.Types.ObjectId() };
});
afterAll(async () => { await mongoose.disconnect(); await db.stop(); });
test('concurrent stock increments are not lost and withdrawals cannot go negative', async () => {
  await inventory.upsertStock(companyId, warehouseId, productId, 100);
  await Promise.all([inventory.upsertStock(companyId, warehouseId, productId, 1), inventory.upsertStock(companyId, warehouseId, productId, 2)]);
  expect((await inventory.findStock(companyId, warehouseId, productId)).quantity).toBe(103);
  await expect(inventory.upsertStock(companyId, warehouseId, productId, -104)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  expect((await inventory.findStock(companyId, warehouseId, productId)).quantity).toBe(103);
});
test('concurrent receipts retain both financial movements and the correct balance', async () => {
  const Account = require('../src/modules/finance/account.model');
  const account = await Account.create({ companyId, code: 'CONCURRENT', name: 'Caja', type: 'ASSET' });
  await Promise.all([10, 20].map(amount => finance.createTransaction({ accountId: account._id, type: 'INCOME', amount }, ctx)));
  expect((await Account.findById(account._id)).balance).toBe(30);
});
test('production cannot close through either route without required materials', async () => {
  const Bom = require('../src/modules/production/bom.model');
  const Order = require('../src/modules/production/productionOrder.model');
  const bom = await Bom.create({ companyId, productId, name: 'Receta', items: [{ componentProductId: new mongoose.Types.ObjectId(), quantity: 1 }] });
  const order = await Order.create({ companyId, productId, warehouseId, bomId: bom._id, folio: 'PROD-TEST', quantity: 1, status: 'IN_PROGRESS', createdBy: ctx.userId });
  await expect(production.completeProduction(String(order._id), ctx)).rejects.toMatchObject({ code: 'MATERIALS_NOT_CONSUMED' });
  await expect(production.updateProductionOrderStatus(String(order._id), 'COMPLETED', ctx)).rejects.toMatchObject({ code: 'MATERIALS_NOT_CONSUMED' });
  expect((await Order.findById(order._id)).status).toBe('IN_PROGRESS');
});

test('concurrent production consumption and completion change stock only once', async () => {
  const Bom = require('../src/modules/production/bom.model');
  const Order = require('../src/modules/production/productionOrder.model');
  const finished = new mongoose.Types.ObjectId();
  const bom = await Bom.create({ companyId, productId: finished, name: 'Receta prueba', items: [{ componentProductId: productId, quantity: 2, unitCost: 1 }] });
  const order = await Order.create({ companyId, productId: finished, warehouseId, bomId: bom._id, folio: 'PROD-ONCE', quantity: 1, status: 'IN_PROGRESS', createdBy: ctx.userId });
  await Promise.all([production.consumeMaterials(String(order._id), ctx), production.consumeMaterials(String(order._id), ctx)]);
  expect((await inventory.findStock(companyId, warehouseId, productId)).quantity).toBe(101);
  await Promise.all([production.completeProduction(String(order._id), ctx), production.completeProduction(String(order._id), ctx)]);
  expect((await inventory.findStock(companyId, warehouseId, finished)).quantity).toBe(1);
});

test('a retried manual finance movement increments the balance only once', async () => {
  const Account = require('../src/modules/finance/account.model');
  const account = await Account.create({ companyId, code: 'RETRY', name: 'Banco prueba', type: 'ASSET' });
  const input = { accountId: account._id, type: 'INCOME', amount: 7, requestId: 'finance-retry-test' };
  const result = await Promise.all([finance.createTransaction(input, ctx), finance.createTransaction(input, ctx)]);
  expect(String(result[0]._id)).toBe(String(result[1]._id)); expect((await Account.findById(account._id)).balance).toBe(7);
  await expect(finance.createTransaction({ ...input, amount: 8 }, ctx)).rejects.toMatchObject({ code: 'TRANSACTION_REQUEST_CONFLICT' });
});

test('failed audit write rolls back the financial movement instead of silently committing it', async () => {
  const Account = require('../src/modules/finance/account.model');
  const Audit = require('../src/modules/audit/audit.model');
  const Transaction = require('../src/modules/finance/transaction.model');
  const account = await Account.create({ companyId, code: 'AUDIT-FAIL', name: 'Caja auditada', type: 'ASSET' });
  const spy = jest.spyOn(Audit, 'create').mockRejectedValueOnce(new Error('Temporary audit outage'));
  try { await expect(finance.createTransaction({ accountId: account._id, type: 'INCOME', amount: 9 }, ctx)).rejects.toThrow('Temporary audit outage'); } finally { spy.mockRestore(); }
  expect((await Account.findById(account._id)).balance).toBe(0);
  expect(await Transaction.countDocuments({ accountId: account._id })).toBe(0);
});

test('cash balances preserve decimal cents over separate concurrent movements', async () => {
  const Account = require('../src/modules/finance/account.model');
  const account = await Account.create({ companyId, code: 'CENTS', name: 'Centavos', type: 'ASSET' });
  await Promise.all([0.1, 0.2].map(amount => finance.createTransaction({ accountId: account._id, type: 'INCOME', amount }, ctx)));
  expect((await Account.findById(account._id)).balance).toBe(0.3);
  expect(require('../src/utils/money')(10.075)).toBe(10.08);
});

test('an unsupported account transfer cannot create a one-sided withdrawal', async () => {
  const Account = require('../src/modules/finance/account.model');
  const Transaction = require('../src/modules/finance/transaction.model');
  const account = await Account.create({ companyId, code: 'NO-TRANSFER', name: 'Caja segura', type: 'ASSET', balance: 100 });
  await expect(finance.createTransaction({ accountId: account._id, type: 'TRANSFER', amount: 5 }, ctx)).rejects.toMatchObject({ code: 'TRANSFER_NOT_SUPPORTED' });
  expect((await Account.findById(account._id)).balance).toBe(100);
  expect(await Transaction.countDocuments({ accountId: account._id })).toBe(0);
});
