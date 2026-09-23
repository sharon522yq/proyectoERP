const Category = require('./category.model');

async function create(data) { return Category.create(data); }
async function findById(id) { return Category.findById(id); }
async function list(companyId, { page = 1, limit = 50 } = {}) {
  const filter = { companyId, deletedAt: null };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Category.updateOne({ _id: id }, { $set: data });
  return Category.findById(id);
}
async function remove(id) {
  await Category.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, list, update, remove };
