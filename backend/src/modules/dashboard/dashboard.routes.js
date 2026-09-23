const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const ctrl = require('./dashboard.controller');

const router = Router();
router.use(authenticate, scopeCompany);

router.get('/', requirePermission('settings.read'), ctrl.getDashboard);
router.get('/sales', requirePermission('sales.invoices.read'), ctrl.getSalesSummary);
router.get('/sales/report', requirePermission('sales.invoices.read'), ctrl.getSalesReport);
router.get('/inventory', requirePermission('inventory.read'), ctrl.getInventorySummary);
router.get('/inventory/report', requirePermission('inventory.read'), ctrl.getInventoryReport);
router.get('/finance', requirePermission('finance.accounts.read'), ctrl.getFinanceSummary);
router.get('/production', requirePermission('production.orders.read'), ctrl.getProductionSummary);

module.exports = router;
