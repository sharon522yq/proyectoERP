const repo = require('./inventory.repository');
const productRepo = require('../products/product.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

// ---- Warehouses ----
async function createWarehouse(data, ctx) {
  const warehouse = await repo.createWarehouse({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'inventory.warehouses', documentId: String(warehouse._id), newData: { name: warehouse.name, code: warehouse.code }, ip: ctx.ip });
  return warehouse;
}

async function listWarehouses(ctx) { return repo.listWarehouses(ctx.companyId); }

async function getWarehouse(id, ctx) {
  const wh = await repo.findWarehouseById(id);
  if (!wh || String(wh.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Almacén no encontrado', 'WAREHOUSE_NOT_FOUND');
  return wh;
}

// ---- Stock ----
async function getStock(ctx, query) { return repo.listStock(ctx.companyId, query); }

async function adjustStock(productId, warehouseId, quantity, type, reason, ctx, reference = {}) {
  const product = await productRepo.findById(productId);
  if (!product || String(product.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
  const wh = await repo.findWarehouseById(warehouseId);
  if (!wh || String(wh.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Almacén no encontrado', 'WAREHOUSE_NOT_FOUND');

  const current = await repo.findStock(ctx.companyId, warehouseId, productId);
  const prevStock = current ? current.quantity : 0;
  const delta = type === 'SALE_EXIT' || type === 'TRANSFER' ? -Math.abs(quantity) : Math.abs(quantity);
  const newStock = prevStock + delta;

  if (newStock < 0) throw new ApiError(400, 'Stock insuficiente', 'INSUFFICIENT_STOCK');

  const updated = await repo.upsertStock(ctx.companyId, warehouseId, productId, delta);
  await repo.createMovement({
    companyId: ctx.companyId, warehouseId, productId, type,
    quantity: Math.abs(quantity), previousStock: prevStock, newStock,
    reason, userId: ctx.userId,
    referenceType: reference.referenceType, referenceId: reference.referenceId
  });

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'inventory', documentId: String(productId), previousStock: prevStock, newStock, ip: ctx.ip });
  return updated;
}

// Pre-valida que haya stock suficiente para todos los requerimientos (agrupados por producto)
// antes de aplicar movimientos en lote, para evitar salidas parciales.
async function assertStockAvailable(ctx, warehouseId, requirements) {
  for (const req of requirements) {
    const current = await repo.findStock(ctx.companyId, warehouseId, req.productId);
    const available = current ? current.quantity : 0;
    if (available < req.quantity) {
      throw new ApiError(400, `Stock insuficiente para el producto ${req.productId} (disponible: ${available}, requerido: ${req.quantity})`, 'INSUFFICIENT_STOCK');
    }
  }
}

// ---- Movements ----
async function listMovements(ctx, query) { return repo.listMovements(ctx.companyId, query); }

// ---- Kardex (history for a product in a warehouse) ----
async function kardex(productId, warehouseId, ctx) {
  return repo.listMovements(ctx.companyId, { productId, warehouseId, limit: 1000 });
}

module.exports = { createWarehouse, listWarehouses, getWarehouse, getStock, adjustStock, assertStockAvailable, listMovements, kardex };
