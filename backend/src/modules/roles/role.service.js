const Role = require('./role.model');
const { ROLE_SEEDS } = require('../../config/permissions');

async function ensureSeeded() {
  for (const seed of ROLE_SEEDS) {
    await Role.updateOne({ name: seed.name }, { $setOnInsert: { ...seed, isSystem: true } }, { upsert: true });
  }
}

async function list() {
  return Role.find().sort({ name: 1 }).lean();
}

async function findByName(name) {
  return Role.findOne({ name });
}

module.exports = { ensureSeeded, list, findByName };
