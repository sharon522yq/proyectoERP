const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./production.validation');
const ctrl = require('./production.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// BOM
router.post('/bom', requirePermission('production.bom.create'), v.createBom, validate, ctrl.createBom);
router.get('/bom', requirePermission('production.bom.read'), ctrl.listBoms);
router.get('/bom/:id', requirePermission('production.bom.read'), v.idParam, validate, ctrl.getBom);

// Production Orders
router.post('/orders', requirePermission('production.orders.create'), v.createProductionOrder, validate, ctrl.createProductionOrder);
router.get('/orders', requirePermission('production.orders.read'), ctrl.listProductionOrders);
router.get('/orders/:id', requirePermission('production.orders.read'), v.idParam, validate, ctrl.getProductionOrder);
router.put('/orders/:id/status', requirePermission('production.orders.update'), v.idParam, validate, ctrl.updateProductionOrderStatus);

// Work Orders
router.post('/orders/:productionOrderId/work-orders', requirePermission('production.work_orders.create'), v.createWorkOrder, validate, ctrl.createWorkOrder);
router.get('/work-orders', requirePermission('production.work_orders.read'), ctrl.listWorkOrders);
router.put('/work-orders/:id/status', requirePermission('production.work_orders.update'), v.idParam, validate, ctrl.updateWorkOrderStatus);

// Material Consumption & Completion
router.post('/orders/:productionOrderId/consume', requirePermission('production.orders.update'), ctrl.consumeMaterials);
router.post('/orders/:productionOrderId/complete', requirePermission('production.orders.update'), ctrl.completeProduction);

module.exports = router;
