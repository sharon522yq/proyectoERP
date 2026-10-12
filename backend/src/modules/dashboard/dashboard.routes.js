const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const ctrl = require('./dashboard.controller');

const router = Router();
router.use(authenticate, scopeCompany);

router.get('/', ctrl.getDashboard);
router.get('/sales', requirePermission('sales.invoices.read'), requirePermission('sales.payments.read'), ctrl.getSalesSummary);
router.get('/sales/report', requirePermission('sales.invoices.read'), ctrl.getSalesReport);
router.get('/inventory', requirePermission('inventory.read'), requirePermission('products.read'), ctrl.getInventorySummary);
router.get('/inventory/report', requirePermission('inventory.read'), ctrl.getInventoryReport);
router.get('/finance', requirePermission('finance.accounts.read'), ctrl.getFinanceSummary);
router.get('/production', requirePermission('production.orders.read'), require('../../middlewares/modules').requireEnabledModule('production'), ctrl.getProductionSummary);

module.exports = router;
