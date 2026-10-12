const mongoose = require('mongoose');
const FirstAccess = require('./firstAccess.model');
const AccessGrant = require('./accessGrant.model');
const Product = require('../products/product.model');
const Customer = require('../crm/customer.model');
const Warehouse = require('../inventory/warehouse.model');
const Inventory = require('../inventory/inventory.model');
const Branch = require('../branches/branch.model');

async function seedDevelopmentFixtures(companyId) {
  if (!['development', 'test'].includes(process.env.NODE_ENV) || process.env.DEVELOPMENT_FIXTURES_ENABLED !== 'true') throw new Error('DEVELOPMENT_FIXTURES_DISABLED');
  const grant = await AccessGrant.findOne({ companyId, mode: 'development_fixture', active: true, expiresAt: { $gt: new Date() } });
  if (!grant) throw new Error('DEVELOPMENT_GRANT_REQUIRED');
  await Promise.all([Product.init(), Warehouse.init(), Inventory.init()]);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const marker = await FirstAccess.findOneAndUpdate({ companyId, target: 'development', fixturesSeededAt: { $exists: false } },
        { $set: { fixturesSeededAt: new Date() } }, { session, ordered: true });
      if (!marker) return { seeded: false };
      const branch = await Branch.findOne({ companyId }).session(session);
      const [warehouse] = await Warehouse.create([{ companyId, branchId: branch._id, name: 'Almacén sintético de prueba', code: 'DEMO' }], { session, ordered: true });
      const products = await Product.create([1, 2, 3].map(index => ({ companyId, sku: `DEMO-${index}`, name: `Producto sintético ${index}`,
        description: 'Datos ficticios exclusivamente para visualizar interfaces locales', price: 100 * index, cost: 50 * index, currency: 'MXN' })), { session, ordered: true });
      await Inventory.create(products.map(product => ({ companyId, warehouseId: warehouse._id, productId: product._id, quantity: 10 })), { session, ordered: true });
      await Customer.create([1, 2].map(index => ({ companyId, name: `Cliente sintético ${index}`, type: 'BUSINESS',
        notes: 'Datos ficticios; no representa una persona o cliente real' })), { session, ordered: true });
      return { seeded: true, products: 3, customers: 2 };
    });
  } finally { await session.endSession(); }
}
module.exports = { seedDevelopmentFixtures };

