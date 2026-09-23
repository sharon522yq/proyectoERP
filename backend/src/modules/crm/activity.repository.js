const Activity = require('./activity.model');

async function create(data) { return Activity.create(data); }
async function findById(id) { return Activity.findById(id); }
async function list(companyId, { page = 1, limit = 20, leadId, customerId, assignedTo, status, type } = {}) {
  const filter = { companyId, deletedAt: null };
  if (leadId) filter.leadId = leadId;
  if (customerId) filter.customerId = customerId;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (status) filter.status = status;
  if (type) filter.type = type;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Activity.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Activity.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Activity.updateOne({ _id: id }, { $set: data });
  return Activity.findById(id);
}
async function remove(id) {
  await Activity.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, list, update, remove };
