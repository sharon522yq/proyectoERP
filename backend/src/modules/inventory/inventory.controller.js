const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./inventory.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

// Warehouses
const createWarehouse = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createWarehouse(req.body, ctx(req)) }); });
const listWarehouses = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listWarehouses(ctx(req)) }); });
const getWarehouse = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getWarehouse(req.params.id, ctx(req)) }); });

// Stock
const getStock = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getStock(ctx(req), req.query) }); });
const adjustStock = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.adjustStock(req.body.productId, req.body.warehouseId, req.body.quantity, req.body.type, req.body.reason, ctx(req)) }); });

// Movements
const listMovements = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listMovements(ctx(req), req.query) }); });
const kardex = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.kardex(req.params.productId, req.params.warehouseId, ctx(req)) }); });

module.exports = { createWarehouse, listWarehouses, getWarehouse, getStock, adjustStock, listMovements, kardex };
