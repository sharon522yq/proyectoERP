const Bom = require('./bom.model');
const ProductionOrder = require('./productionOrder.model');
const WorkOrder = require('./workOrder.model');
const MaterialConsumption = require('./materialConsumption.model');
const mongoose = require('mongoose');

// ---- BOM ----
async function createBom(data) { return Bom.create(data); }
async function findBomById(id) { return Bom.findById(id); }
async function listBoms(companyId, { page = 1, limit = 20, productId } = {}) {
  const filter = { companyId, deletedAt: null };
  if (productId) filter.productId = productId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Bom.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Bom.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateBom(id, data) {
  await Bom.updateOne({ _id: id }, { $set: data });
  return Bom.findById(id);
}

// ---- Production Orders ----
async function createProductionOrder(data) { return ProductionOrder.create(data); }
async function findProductionOrderById(id) { return ProductionOrder.findById(id); }
async function listProductionOrders(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ProductionOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ProductionOrder.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateProductionOrder(id, data) {
  await ProductionOrder.updateOne({ _id: id }, { $set: data });
  return ProductionOrder.findById(id);
}

// ---- Work Orders ----
async function createWorkOrder(data) { return WorkOrder.create(data); }
async function findWorkOrderById(id) { return WorkOrder.findById(id); }
async function listWorkOrders(companyId, { productionOrderId, status, page = 1, limit = 20 } = {}) {
  const filter = { companyId };
  if (productionOrderId) filter.productionOrderId = productionOrderId;
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WorkOrder.find(filter).sort({ sequence: 1 }).skip(skip).limit(limit).lean(),
    WorkOrder.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateWorkOrder(id, data) {
  await WorkOrder.updateOne({ _id: id }, { $set: data });
  return WorkOrder.findById(id);
}

// ---- Material Consumption ----
async function createMaterialConsumption(data) { return MaterialConsumption.create(data); }
async function findMaterialConsumptionById(id) { return MaterialConsumption.findById(id); }
async function listMaterialConsumptions(companyId, { productionOrderId, page = 1, limit = 20 } = {}) {
  const filter = { companyId };
  if (productionOrderId) filter.productionOrderId = productionOrderId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MaterialConsumption.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MaterialConsumption.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateMaterialConsumption(id, data) {
  await MaterialConsumption.updateOne({ _id: id }, { $set: data });
  return MaterialConsumption.findById(id);
}

// ---- Folio ----
async function nextFolio(companyId, prefix) {
  const counter = await mongoose.connection.collection('counters');
  const result = await counter.findOneAndUpdate(
    { _id: `${companyId}_${prefix}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `${prefix}-${String(result.seq).padStart(6, '0')}`;
}

module.exports = {
  createBom, findBomById, listBoms, updateBom,
  createProductionOrder, findProductionOrderById, listProductionOrders, updateProductionOrder,
  createWorkOrder, findWorkOrderById, listWorkOrders, updateWorkOrder,
  createMaterialConsumption, findMaterialConsumptionById, listMaterialConsumptions, updateMaterialConsumption,
  nextFolio
};
