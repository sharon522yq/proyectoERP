// Read-only: never creates indexes or changes business records.
const mongoose = require('mongoose');
const models = [
  require('../src/modules/inventory/inventory.model'),
  require('../src/modules/inventory/movement.model'),
  require('../src/modules/sales/payment.model'),
  require('../src/modules/finance/transaction.model')
];

async function inspectReleaseDatabase(connection) {
  const hello = await connection.db.admin().command({ hello: 1 });
  const checks = [{ check: 'transactions', ok: !!(hello.setName || hello.msg === 'isdbgrid') }];
  for (const model of models) {
    for (const [key, options] of model.schema.indexes().filter(([, options]) => options.unique)) {
      const group = Object.fromEntries(Object.keys(key).map(field => [field, '$' + field]));
      const duplicates = await connection.db.collection(model.collection.name).aggregate([
        ...(options.partialFilterExpression ? [{ $match: options.partialFilterExpression }] : []),
        { $group: { _id: group, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }, { $count: 'groups' }
      ]).toArray();
      checks.push({ check: 'unique-data', collection: model.collection.name, key, ok: !duplicates.length, duplicateGroups: duplicates[0]?.groups || 0 });
    }
  }
  return { success: checks.every(check => check.ok), checks };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI debe configurarse en el entorno; no se imprime ni se guarda.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  try {
    const report = await inspectReleaseDatabase(mongoose.connection);
    console.log(JSON.stringify(report, null, 2));
    if (!report.success) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(() => { console.error('No se pudo completar la comprobación de base de datos. Verifica conexión y permisos.'); process.exitCode = 1; });
module.exports = { inspectReleaseDatabase };
