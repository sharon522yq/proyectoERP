const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const controller = require('./branch.controller');
const v = require('./branch.validation');

const router = Router();
router.use(authenticate, scopeCompany);
router.get('/', requirePermission('branches.read'), controller.list);
router.post('/', requirePermission('branches.create'), v.createRules, validate, controller.create);
router.get('/:id', requirePermission('branches.read'), v.idRule, validate, controller.getById);
router.put('/:id', requirePermission('branches.update'), v.updateRules, validate, controller.update);

module.exports = router;
