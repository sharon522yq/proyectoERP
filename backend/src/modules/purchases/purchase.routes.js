const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./purchase.validation');
const ctrl = require('./purchase.controller');

const router = Router();
router.use(authenticate, scopeCompany);

router.post('/', requirePermission('purchases.create'), v.createOrder, validate, ctrl.createOrder);
router.get('/', requirePermission('purchases.read'), ctrl.listOrders);
router.put('/:id/status', requirePermission('purchases.update'), v.idParam, validate, ctrl.updateStatus);

module.exports = router;
