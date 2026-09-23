const PurchaseOrder = require('./purchaseOrder.model');
const mongoose = require('mongoose');

async function create(data) { return PurchaseOrder.create(data); }
async function findById(id) { return PurchaseOrder.findById(id); }
async function list(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PurchaseOrder.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function update(id, data) {
  await PurchaseOrder.updateOne({ _id: id }, { $set: data });
  return PurchaseOrder.findById(id);
}
async function nextFolio(companyId, prefix) {
  const counter = await mongoose.connection.collection('counters');
  const result = await counter.findOneAndUpdate(
    { _id: `${companyId}_${prefix}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `${prefix}-${String(result.seq).padStart(6, '0')}`;
}

module.exports = { create, findById, list, update, nextFolio };
