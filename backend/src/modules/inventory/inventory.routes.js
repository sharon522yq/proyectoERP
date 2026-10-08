const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./inventory.validation');
const ctrl = require('./inventory.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// An authenticated export includes catalog prices and costs; both read permissions are required.
const exportLimit = require('express-rate-limit')({ windowMs: 60000, max: 3, keyGenerator: req => req.user.id, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Espera un minuto antes de exportar nuevamente.', code: 'EXPORT_RATE_LIMIT' } });
router.get('/export.xlsx', requirePermission('inventory.read'), requirePermission('products.read'), v.exportQuery, validate, exportLimit, ctrl.exportInventory);

// Warehouses
router.get('/warehouses', requirePermission('inventory.read'), ctrl.listWarehouses);
router.post('/warehouses', requirePermission('branches.create'), v.createWarehouse, validate, ctrl.createWarehouse);
router.get('/warehouses/:id', requirePermission('inventory.read'), v.idParam, validate, ctrl.getWarehouse);

router.put('/warehouses/:id', requirePermission('branches.update'), v.updateWarehouse, validate, ctrl.updateWarehouse);
router.delete('/warehouses/:id', requirePermission('branches.update'), v.idParam, validate, ctrl.deleteWarehouse);
// Stock
router.get('/stock', requirePermission('inventory.read'), ctrl.getStock);
router.post('/stock/adjust', requirePermission('inventory.adjust'), v.adjustStock, validate, ctrl.adjustStock);

// Movements
router.get('/movements', requirePermission('inventory.movements'), ctrl.listMovements);
router.get('/kardex/:productId/:warehouseId', requirePermission('inventory.movements'), ctrl.kardex);

module.exports = router;
