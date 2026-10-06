const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Replica set local para validar transacciones; no usa MongoDB de producción.
async function createTestDatabase() {
  return MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ args: process.platform === 'win32' ? [] : ['--nounixsocket'] }]
  });
}
module.exports = { createTestDatabase };
