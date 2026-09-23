const Lead = require('./lead.model');

async function create(data) { return Lead.create(data); }
async function findById(id) { return Lead.findById(id); }
async function list(companyId, { page = 1, limit = 20, status, assignedTo } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  if (assignedTo) filter.assignedTo = assignedTo;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Lead.updateOne({ _id: id }, { $set: data });
  return Lead.findById(id);
}
async function remove(id) {
  await Lead.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, list, update, remove };
