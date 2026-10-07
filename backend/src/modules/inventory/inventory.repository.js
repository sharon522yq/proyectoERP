const Warehouse = require('./warehouse.model');
const Inventory = require('./inventory.model');
const Movement = require('./movement.model');

// Warehouses
async function createWarehouse(data) { return Warehouse.create(data); }
async function findWarehouseById(id) { return Warehouse.findOne({ _id: id, deletedAt: null }); }
async function listWarehouses(companyId) {
  return Warehouse.find({ companyId, deletedAt: null }).sort({ name: 1 }).lean();
}
async function updateWarehouse(id, data) {
  await Warehouse.updateOne({ _id: id }, { $set: data });
  return Warehouse.findById(id);
}

// Inventory (stock per warehouse per product)
async function findStock(companyId, warehouseId, productId) {
  return Inventory.findOne({ companyId, warehouseId, productId });
}
async function upsertStock(companyId, warehouseId, productId, quantityDelta) {
  const filter = { companyId, warehouseId, productId };
  if (quantityDelta < 0) filter.quantity = { $gte: -quantityDelta };
  const stock = await Inventory.findOneAndUpdate(filter,
    { $inc: { quantity: quantityDelta }, $set: { lastMovementAt: new Date() } },
    { new: true, upsert: quantityDelta >= 0, setDefaultsOnInsert: true });
  if (!stock) throw new (require('../../utils/ApiError').ApiError)(400, 'Existencias insuficientes. Revisa la cantidad y el almacén.', 'INSUFFICIENT_STOCK');
  return stock;
}
async function listStock(companyId, { warehouseId, productId, page = 1, limit = 20 } = {}) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  if (productId) filter.productId = productId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Inventory.find(filter).sort({ quantity: -1 }).skip(skip).limit(limit).lean(),
    Inventory.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

// Movements
async function createMovement(data) { return Movement.create(data); }
async function listMovements(companyId, { warehouseId, productId, type, page = 1, limit = 20 } = {}) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  if (productId) filter.productId = productId;
  if (type) filter.type = type;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Movement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Movement.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

module.exports = {
  createWarehouse, findWarehouseById, listWarehouses, updateWarehouse,
  findStock, upsertStock, listStock,
  createMovement, listMovements
};
