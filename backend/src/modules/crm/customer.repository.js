const searchText = require('../../utils/searchText');
const Customer = require('./customer.model');

async function create(data) { return Customer.create(data); }
async function findById(id) { return Customer.findById(id); }
async function list(companyId, { page = 1, limit = 20, status, search } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  if (search) filter.$or = [{ name: { $regex: searchText(search), $options: 'i' } }, { email: { $regex: searchText(search), $options: 'i' } }];
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Customer.updateOne({ _id: id }, { $set: data });
  return Customer.findById(id);
}
async function remove(id) {
  await Customer.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, list, update, remove };
