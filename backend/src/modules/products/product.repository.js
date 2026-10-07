const searchText = require('../../utils/searchText');
const Product = require('./product.model');

async function create(data) { return Product.create(data); }
async function findById(id) { return Product.findOne({ _id: id, deletedAt: null }); }
async function findBySku(companyId, sku) { return Product.findOne({ companyId, sku }); }
async function list(companyId, { page = 1, limit = 20, categoryId, status, search } = {}) {
  const filter = { companyId, deletedAt: null };
  if (categoryId) filter.categoryId = categoryId;
  if (status) filter.status = status;
  if (search) filter.$or = [{ name: { $regex: searchText(search), $options: 'i' } }, { sku: { $regex: searchText(search), $options: 'i' } }];
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await Product.updateOne({ _id: id }, { $set: data });
  return Product.findById(id);
}
async function remove(id) {
  await Product.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

module.exports = { create, findById, findBySku, list, update, remove };
