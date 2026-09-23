const Audit = require('./audit.model');

async function list({ companyId, module, page = 1, limit = 20 }) {
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (module) filter.module = module;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Audit.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    Audit.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

module.exports = { list };
