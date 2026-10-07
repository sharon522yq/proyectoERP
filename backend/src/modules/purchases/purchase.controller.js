const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./purchase.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, branchId: req.body?.branchId || null, ip: req.ip });

const createOrder = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.create(req.body, ctx(req)) }); });
const listOrders = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.list(ctx(req), req.query) }); });
const updateStatus = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateStatus(req.params.id, req.body.status, ctx(req), req.body.warehouseId) }); });

module.exports = { createOrder, listOrders, updateStatus };
