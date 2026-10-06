const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const controller = require('./company.controller');
const v = require('./company.validation');

const router = Router();
router.use(authenticate, scopeCompany);
router.get('/', requirePermission('companies.read'), controller.list);
router.post('/', requirePermission('companies.create'), v.createRules, validate, controller.create);
router.get('/:id', requirePermission('companies.read'), v.idRule, validate, controller.getById);
router.put('/:id', requirePermission('companies.update'), v.updateRules, validate, controller.update);

module.exports = router;
