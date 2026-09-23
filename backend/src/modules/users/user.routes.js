const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const controller = require('./user.controller');
const v = require('./user.validation');

const router = Router();
router.use(authenticate, scopeCompany);
router.get('/', requirePermission('users.read'), controller.list);
router.post('/', requirePermission('users.create'), v.createRules, validate, controller.create);
router.get('/:id', requirePermission('users.read'), v.idRule, validate, controller.getById);
router.put('/:id', requirePermission('users.update'), v.updateRules, validate, controller.update);
router.delete('/:id', requirePermission('users.delete'), v.idRule, validate, controller.remove);

module.exports = router;
