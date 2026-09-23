const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./production.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, branchId: req.body?.branchId || null, ip: req.ip });

// BOM
const createBom = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createBom(req.body, ctx(req)) }); });
const listBoms = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listBoms(ctx(req), req.query) }); });
const getBom = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getBom(req.params.id, ctx(req)) }); });

// Production Orders
const createProductionOrder = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createProductionOrder(req.body, ctx(req)) }); });
const listProductionOrders = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listProductionOrders(ctx(req), req.query) }); });
const getProductionOrder = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getProductionOrder(req.params.id, ctx(req)) }); });
const updateProductionOrderStatus = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateProductionOrderStatus(req.params.id, req.body.status, ctx(req)) }); });

// Work Orders
const createWorkOrder = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createWorkOrder(req.body, ctx(req)) }); });
const listWorkOrders = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listWorkOrders(ctx(req), req.query) }); });
const updateWorkOrderStatus = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateWorkOrderStatus(req.params.id, req.body.status, ctx(req)) }); });

// Material Consumption
const consumeMaterials = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.consumeMaterials(req.params.productionOrderId, ctx(req)) }); });

// Complete Production
const completeProduction = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.completeProduction(req.params.productionOrderId, ctx(req)) }); });

module.exports = {
  createBom, listBoms, getBom,
  createProductionOrder, listProductionOrders, getProductionOrder, updateProductionOrderStatus,
  createWorkOrder, listWorkOrders, updateWorkOrderStatus,
  consumeMaterials, completeProduction
};
