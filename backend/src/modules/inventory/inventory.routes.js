const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./inventory.validation');
const ctrl = require('./inventory.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// Warehouses
router.get('/warehouses', requirePermission('inventory.read'), ctrl.listWarehouses);
router.post('/warehouses', requirePermission('branches.create'), v.createWarehouse, validate, ctrl.createWarehouse);
router.get('/warehouses/:id', requirePermission('inventory.read'), v.idParam, validate, ctrl.getWarehouse);

// Stock
router.get('/stock', requirePermission('inventory.read'), ctrl.getStock);
router.post('/stock/adjust', requirePermission('inventory.adjust'), v.adjustStock, validate, ctrl.adjustStock);

// Movements
router.get('/movements', requirePermission('inventory.movements'), ctrl.listMovements);
router.get('/kardex/:productId/:warehouseId', requirePermission('inventory.movements'), ctrl.kardex);

module.exports = router;
