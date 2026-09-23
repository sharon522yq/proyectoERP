const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./production.validation');
const ctrl = require('./production.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// BOM
router.post('/bom', requirePermission('products.create'), v.createBom, validate, ctrl.createBom);
router.get('/bom', requirePermission('products.read'), ctrl.listBoms);
router.get('/bom/:id', requirePermission('products.read'), v.idParam, validate, ctrl.getBom);

// Production Orders
router.post('/orders', requirePermission('products.create'), v.createProductionOrder, validate, ctrl.createProductionOrder);
router.get('/orders', requirePermission('products.read'), ctrl.listProductionOrders);
router.get('/orders/:id', requirePermission('products.read'), v.idParam, validate, ctrl.getProductionOrder);
router.put('/orders/:id/status', requirePermission('products.update'), v.idParam, validate, ctrl.updateProductionOrderStatus);

// Work Orders
router.post('/orders/:productionOrderId/work-orders', requirePermission('products.create'), v.createWorkOrder, validate, ctrl.createWorkOrder);
router.get('/work-orders', requirePermission('products.read'), ctrl.listWorkOrders);
router.put('/work-orders/:id/status', requirePermission('products.update'), v.idParam, validate, ctrl.updateWorkOrderStatus);

// Material Consumption & Completion
router.post('/orders/:productionOrderId/consume', requirePermission('products.update'), ctrl.consumeMaterials);
router.post('/orders/:productionOrderId/complete', requirePermission('products.update'), ctrl.completeProduction);

module.exports = router;
