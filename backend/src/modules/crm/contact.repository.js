const Contact = require('./contact.model');

async function create(data) { return Contact.create(data); }
async function findById(id) { return Contact.findById(id); }
async function listByCustomer(companyId, customerId, { page = 1, limit = 20 } = {}) {
  const filter = { companyId, customerId, deletedAt: null };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Contact.find(filter).sort({ isPrimary: -1, name: 1 }).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Contact.updateOne({ _id: id }, { $set: data });
  return Contact.findById(id);
}
async function remove(id) {
  await Contact.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, listByCustomer, update, remove };
