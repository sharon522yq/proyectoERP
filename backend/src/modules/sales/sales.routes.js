const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./sales.validation');
const ctrl = require('./sales.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// Quotes
router.post('/quotes', requirePermission('sales.quotes.create'), v.createQuote, validate, ctrl.createQuote);
router.get('/quotes', requirePermission('sales.quotes.read'), ctrl.listQuotes);
router.post('/quotes/:id/approve', requirePermission('sales.quotes.approve'), v.idParam, validate, ctrl.approveQuote);

// Orders
router.post('/quotes/:quoteId/order', requirePermission('sales.orders.create'), ctrl.createOrderFromQuote);
router.get('/orders', requirePermission('sales.orders.read'), ctrl.listOrders);
router.put('/orders/:id/status', requirePermission('sales.orders.update'), v.idParam, validate, ctrl.updateOrderStatus);

// Invoices
router.post('/orders/:orderId/invoice', requirePermission('sales.invoices.create'), ctrl.createInvoiceFromOrder);
router.get('/invoices', requirePermission('sales.invoices.read'), ctrl.listInvoices);

// Payments
router.post('/invoices/:invoiceId/payments', requirePermission('sales.payments.create'), v.createPayment, validate, ctrl.registerPayment);
router.get('/payments', requirePermission('sales.payments.read'), ctrl.listPayments);

module.exports = router;
