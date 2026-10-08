const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./inventory.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

// Warehouses
const createWarehouse = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createWarehouse(req.body, ctx(req)) }); });
const listWarehouses = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listWarehouses(ctx(req)) }); });
const getWarehouse = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getWarehouse(req.params.id, ctx(req)) }); });

const updateWarehouse = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateWarehouse(req.params.id, req.body, ctx(req)) }); });
const deleteWarehouse = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.deleteWarehouse(req.params.id, ctx(req)) }); });
// Stock
const getStock = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getStock(ctx(req), req.query) }); });
const adjustStock = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.adjustStock(req.body.productId, req.body.warehouseId, req.body.quantity, req.body.type, req.body.reason, ctx(req)) }); });

// Movements
const listMovements = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listMovements(ctx(req), req.query) }); });
const kardex = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.kardex(req.params.productId, req.params.warehouseId, ctx(req)) }); });

const exportInventory = asyncHandler(async (req, res) => {
  const data = await require('./inventory-export.service').exportInventory(ctx(req), req.query);
  res.set('Cache-Control', 'private, no-store').json({ success: true, data });
});
module.exports = { exportInventory, updateWarehouse, deleteWarehouse, createWarehouse, listWarehouses, getWarehouse, getStock, adjustStock, listMovements, kardex };
